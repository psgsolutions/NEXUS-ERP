import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { mergeSupplierPrice, normalizeAliases, normalizeSupplierPriceItem, type SupplierPriceItem } from "@/lib/supplier-prices";

/**
 * นำเข้าราคาผู้ขาย — POST /api/procurement/supplier-prices { companyId, action: "apply", items: [...] } (ครั้งละไม่เกิน 500 แถว)
 *  item: { productId, supplierId, supplierSku?, kind: LIST|QUOTE, price, priceDate?, ref?, note?, project? }
 *  aliases?: [{ name, supplierId }]  ชื่อในไฟล์ที่ผู้ใช้จับคู่เอง → เก็บที่ companies/{id}/suppliers/{sid}.nameAliases (ครั้งหน้าจับคู่ให้เอง)
 *  รวมเข้า companies/{id}/products/{productId}.supplierConfig (ข้อมูลของบริษัท) — ราคาที่ใหม่กว่าไม่ถูกทับ
 *  สินค้า/ผู้ขายที่ไม่อยู่ในบริษัท = ข้าม (แจ้งกลับ)
 * ต้องมีสิทธิ์ procurement:edit หรือ inventory:edit
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = String(body.companyId || "").trim().slice(0, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const user = await requireApiUser(request, companyId);
    if (!can(user.roles, "procurement:edit") && !can(user.roles, "inventory:edit")) throw new ApiAuthError(403, "ต้องมีสิทธิ์แก้ไขจัดซื้อหรือคลังสินค้า");
    if (String(body.action) !== "apply") throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
    const raw: any[] = Array.isArray(body.items) ? body.items : [];
    if (raw.length > 500) throw new ApiAuthError(400, "ส่งได้ครั้งละไม่เกิน 500 แถว");
    const items = raw.map(normalizeSupplierPriceItem).filter((x): x is SupplierPriceItem => !!x);
    const aliases = normalizeAliases(body.aliases);

    const prodIds = Array.from(new Set(items.map((i) => i.productId)));
    const supIds = Array.from(new Set([...items.map((i) => i.supplierId), ...aliases.map((a) => a.supplierId)]));
    const pRefs = prodIds.map((id) => adminDb.doc(`companies/${companyId}/products/${id}`));
    const sRefs = supIds.map((id) => adminDb.doc(`companies/${companyId}/suppliers/${id}`));
    const [pSnaps, sSnaps] = await Promise.all([pRefs.length ? adminDb.getAll(...pRefs) : Promise.resolve([]), sRefs.length ? adminDb.getAll(...sRefs) : Promise.resolve([])]);
    const products = new Map(pSnaps.filter((s) => s.exists && s.get("isDeleted") !== true).map((s) => [s.id, s]));
    const supOk = new Set(sSnaps.filter((s) => s.exists && s.get("isDeleted") !== true).map((s) => s.id));

    const next = new Map<string, any[]>();
    const skipped: { productId: string; supplierId: string; reason: string }[] = [];
    for (const it of items) {
      const p = products.get(it.productId);
      if (!p) { skipped.push({ productId: it.productId, supplierId: it.supplierId, reason: "ไม่พบสินค้าในบริษัท" }); continue; }
      if (!supOk.has(it.supplierId)) { skipped.push({ productId: it.productId, supplierId: it.supplierId, reason: "ไม่พบผู้ขายในบริษัท" }); continue; }
      next.set(it.productId, mergeSupplierPrice(next.get(it.productId) ?? (p.get("supplierConfig") || []), it));
    }
    let batch = adminDb.batch(), n = 0;
    for (const [pid, cfg] of next) {
      batch.set(adminDb.doc(`companies/${companyId}/products/${pid}`), { supplierConfig: cfg, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (++n >= 400) { await batch.commit(); batch = adminDb.batch(); n = 0; }
    }
    // ชื่อในไฟล์ที่ผู้ใช้จับคู่เอง → ชื่อเรียกของผู้ขาย (ของบริษัท) ครั้งหน้าจับคู่ให้เอง
    for (const a of aliases) {
      if (!supOk.has(a.supplierId)) continue;
      batch.set(adminDb.doc(`companies/${companyId}/suppliers/${a.supplierId}`), { nameAliases: admin.firestore.FieldValue.arrayUnion(a.name) }, { merge: true });
      if (++n >= 400) { await batch.commit(); batch = adminDb.batch(); n = 0; }
    }
    if (n) await batch.commit();
    await auditServer.logUpdate(user.uid, companyId, "SUPPLIER_PRICES", "import", {}, { rows: items.length, products: next.size, skipped: skipped.length });
    return NextResponse.json({ success: true, applied: items.length - skipped.length, products: next.size, skipped, invalid: raw.length - items.length });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[SUPPLIER_PRICES_API_ERROR]", err);
    if (/RESOURCE_EXHAUSTED|Quota exceeded/i.test(String(err?.message || err))) return NextResponse.json({ success: false, error: "โควตาฐานข้อมูลของวันนี้เต็ม — ลองใหม่หลัง 15:00 น. (แถวที่บันทึกแล้วไม่หาย นำเข้าซ้ำได้)" }, { status: 503 });
    return NextResponse.json({ success: false, error: "นำเข้าราคาผู้ขายไม่สำเร็จ" }, { status: 500 });
  }
}
