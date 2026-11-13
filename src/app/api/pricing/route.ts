import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { getProduct } from "@/lib/product-store.server";
import { allocateLots, fifoOrder } from "@/lib/stock-lots";
import { markupFor, normalizePricing, priceSuggestions, PRICE_BASES } from "@/lib/price-bases";
import { auditServer } from "@/services/audit.server";

/**
 * ราคาขายแนะนำ — POST /api/pricing { companyId, action, ... }
 *  bases    { productId, qty, customerId? }  ราคาแนะนำทุกฐาน + GP% จริงจาก Lot ที่จะถูกตัด (FIFO)
 *  settings                                   กฎ markup ตามหมวด/ยี่ห้อ · GP เป้าหมาย · ฐานตั้งต้น
 *  saveSettings { pricing }                   บันทึกกฎ (สิทธิ์ settings:manage)
 * ต้นทุนและ GP% แสดงเฉพาะผู้มีสิทธิ์ดูต้นทุน (sales:cost) — คนอื่นเห็นเฉพาะราคาแนะนำ
 */
const OPEN_QT = ["SENT", "APPROVED", "ACCEPTED", "WON"];
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = String(body.companyId || "");
    const user = await requireApiUser(request, companyId);
    const settingsRef = adminDb.doc(`companies/${companyId}/settings/pricing`);
    const action = String(body.action || "");

    if (action === "settings") {
      if (!can(user.roles, "sales:view")) return NextResponse.json({ success: false, error: "สิทธิ์การใช้งานไม่เพียงพอ" }, { status: 403 });
      return NextResponse.json({ success: true, pricing: normalizePricing((await settingsRef.get()).data()), bases: PRICE_BASES });
    }
    if (action === "saveSettings") {
      if (!can(user.roles, "settings:manage")) return NextResponse.json({ success: false, error: "ตั้งค่ากฎราคาได้เฉพาะผู้ดูแลระบบ" }, { status: 403 });
      const next = normalizePricing(body.pricing);
      const before = (await settingsRef.get()).data() || {};
      await settingsRef.set({ ...next, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: user.uid });
      await auditServer.logUpdate(user.uid, companyId, "PRICING_RULES", companyId, normalizePricing(before), next);
      return NextResponse.json({ success: true, pricing: next });
    }

    if (action === "bases") {
      if (!can(user.roles, "sales:view")) return NextResponse.json({ success: false, error: "สิทธิ์การใช้งานไม่เพียงพอ" }, { status: 403 });
      const productId = String(body.productId || "");
      const qty = Math.max(1, n(body.qty) || 1);
      if (!productId || productId.includes("/")) return NextResponse.json({ success: false, error: "ไม่ระบุสินค้า" }, { status: 400 });
      const [h, settingsSnap, lotSnap] = await Promise.all([
        getProduct(companyId, productId), settingsRef.get(),
        adminDb.collection(`companies/${companyId}/stock_lots`).where("productId", "==", productId).limit(500).get(),
      ]);
      if (!h) return NextResponse.json({ success: false, error: "ไม่พบสินค้า" }, { status: 404 });
      const p = h.data;
      const pricing = normalizePricing(settingsSnap.data());
      const lots = lotSnap.docs.map((d) => d.data()).filter((l) => !l.isDeleted);
      const open = fifoOrder(lots.filter((l) => n(l.qtyRemaining) > 0).map((l) => ({ lotNo: String(l.lotNo), remaining: n(l.qtyRemaining), unitCost: n(l.unitCost), receivedDate: String(l.receivedDate || "") })));
      const wac = n(p.pricing?.costWAC ?? p.costPrice);
      const alloc = open.length ? allocateLots(open, qty) : null;
      const fifoCost = alloc ? alloc.allocations.reduce((s, a) => s + a.qty * a.unitCost, 0) + alloc.short * wac : wac > 0 ? wac * qty : null;
      const allLots = fifoOrder(lots.map((l) => ({ lotNo: String(l.lotNo), remaining: n(l.qtyRemaining), unitCost: n(l.unitCost), receivedDate: String(l.receivedDate || "") })));
      // ราคาซื้อล่าสุด: ผู้ขายที่รับล่าสุด → Lot ใหม่สุด → ต้นทุนตั้งต้นของสินค้า
      const sup = (Array.isArray(p.supplierConfig) ? p.supplierConfig : []).filter((c: any) => n(c?.latestCost) > 0).sort((a: any, b: any) => String(b.lastReceivedAt || "").localeCompare(String(a.lastReceivedAt || "")))[0];
      const lastPurchase = sup ? n(sup.latestCost) : allLots.length ? allLots[allLots.length - 1].unitCost : n(p.costPrice) || null;
      // ราคาล่าสุดที่ขายลูกค้ารายนี้ (ใบเสนอราคาที่ส่ง/ได้งานแล้ว)
      let lastSold: { price: number; docNo: string } | null = null;
      const customerId = String(body.customerId || "");
      if (customerId && !customerId.includes("/")) {
        const qs = (await adminDb.collection(`companies/${companyId}/quotations`).where("productIds", "array-contains", productId).limit(100).get()).docs
          .map((d) => ({ ref: d.ref, ...d.data() } as any)).filter((q) => q.customerId === customerId && OPEN_QT.includes(String(q.status)) && !q.isDeleted)
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        for (const q of qs.slice(0, 5)) {
          const line = (await q.ref.collection("lines").where("productId", "==", productId).limit(1).get()).docs[0]?.data();
          if (line && n(line.unitPrice) > 0) { lastSold = { price: n(line.unitPrice), docNo: String(q.documentNo || "") }; break; }
        }
      }
      const category = String(p.skuCategory || p.category || String(p.sku || "").split("-")[0] || "");
      const markup = markupFor({ brand: p.brand, category }, pricing);
      const suggestions = priceSuggestions({
        fifoCost, pickedUnitCosts: alloc ? alloc.allocations.map((a) => a.unitCost) : [],
        newestLotCost: open.length ? open[open.length - 1].unitCost : null, oldestLotCost: open.length ? open[0].unitCost : null,
        lastPurchaseCost: lastPurchase, listPrice: n(p.pricing?.priceProject ?? p.pricing?.pricePOS) || null, lastSoldPrice: lastSold?.price ?? null, qty,
      }, markup.pct, pricing.targetGpPct);
      const seeCost = can(user.roles, "sales:cost");
      return NextResponse.json({
        success: true, defaultBase: pricing.defaultBase, markupPct: markup.pct, markupSource: markup.source, targetGpPct: pricing.targetGpPct,
        lastSoldDoc: lastSold?.docNo || "", stock: n(p.stockStatus?.onHand), shortQty: alloc?.short ?? (open.length ? 0 : qty),
        ...(seeCost ? { unitCost: fifoCost === null ? null : Math.round((fifoCost / qty) * 100) / 100, lots: alloc?.allocations || [] } : {}),
        suggestions: suggestions.map((s) => (seeCost ? s : { ...s, base: s.key === "list" || s.key === "lastSold" ? s.base : null, gpPct: null })),
      });
    }

    return NextResponse.json({ success: false, error: "ไม่รู้จักคำสั่ง" }, { status: 400 });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PRICING_API]", err);
    return NextResponse.json({ success: false, error: err.message || "ทำรายการไม่สำเร็จ" }, { status: 500 });
  }
}
