import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { processStockMovements, type StockMovement } from "@/lib/stock-service";
import { getProduct, getProductTx } from "@/lib/product-store.server";
import { groupIdOfCompany } from "@/lib/company-group.server";
import { nexusSequenceServer } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";

/**
 * [API-SERVER] ตรวจนับและปรับปรุงสต็อก — POST /api/inventory/stock-count
 *  - { companyId, action: "list" }  ใบตรวจนับล่าสุด 50 ใบ
 *  - { companyId, action: "post", countDate, note, lines: [{ productId, counted, book }] }
 *      book = ยอดในระบบที่เห็นตอนนับ — ยอดเปลี่ยนก่อนบันทึก (มีรับ/เบิกระหว่างนับ) = ปฏิเสธ ให้โหลดยอดใหม่
 *      ผลต่าง: เกิน = รับเข้า · ขาด = เบิกออก (มูลค่าตามต้นทุนเฉลี่ย ไม่เปลี่ยนต้นทุนเฉลี่ย)
 *      บันทึกบัญชีผลต่างรวมหนึ่งรายการ (รอฝ่ายบัญชีอนุมัติ): ขาด Dr 5311-00 / Cr 1141-00 · เกิน Dr 1141-00 / Cr 5311-00
 *      ใบตรวจนับเก็บที่ companies/{id}/stock_counts/{SC…} (ยอดในระบบ ยอดนับ ผลต่าง มูลค่า) แก้/ลบไม่ได้
 */
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);

    if (body.action === "list") {
      if (!can(apiUser.roles, "inventory:view")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
      const snap = await adminDb.collection(`companies/${companyId}/stock_counts`).orderBy("createdAt", "desc").limit(50).get();
      return NextResponse.json({ success: true, counts: snap.docs.map((d) => { const x = d.data(); return { id: d.id, countDate: x.countDate, note: x.note, lines: x.lines?.length || 0, diffLines: x.diffLines || 0, shortValue: x.shortValue || 0, overValue: x.overValue || 0, createdByName: x.createdByName || "" }; }) });
    }
    if (body.action !== "post") throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
    if (!can(apiUser.roles, "inventory:edit")) throw new ApiAuthError(403, "บันทึกผลตรวจนับได้เฉพาะผู้ดูแลคลังสินค้า");

    const countDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.countDate || "")) ? body.countDate : todayBkk();
    if (countDate > todayBkk()) throw new ApiAuthError(400, "วันที่ตรวจนับต้องไม่เกินวันนี้");
    await assertPeriodOpen(companyId, countDate);
    const raw: any[] = Array.isArray(body.lines) ? body.lines.slice(0, 1000) : [];
    const seen = new Set<string>();
    const lines = raw.map((l) => ({ productId: str(l?.productId, 120), counted: Number(l?.counted), book: Number(l?.book) }))
      .filter((l) => l.productId && Number.isFinite(l.counted) && l.counted >= 0 && Number.isFinite(l.book) && !seen.has(l.productId) && seen.add(l.productId));
    if (!lines.length) throw new ApiAuthError(400, "กรอกจำนวนที่นับได้อย่างน้อย 1 รายการ");

    // ข้อมูลสินค้า (ชื่อ ต้นทุนเฉลี่ย) — ยอดจริงตรวจซ้ำในธุรกรรม
    const groupId = await groupIdOfCompany(companyId);
    const info = new Map<string, { name: string; sku: string; unit: string; wac: number }>();
    for (const l of lines) {
      const h = await getProduct(companyId, l.productId, groupId);
      if (!h) throw new ApiAuthError(400, `ไม่พบสินค้า ${l.productId}`);
      const d: any = h.data;
      info.set(l.productId, { name: str(d.name, 200), sku: str(d.sku, 60), unit: str(d.unit || d.uom || "ชิ้น", 30), wac: Number(d.pricing?.costWAC ?? d.costPrice ?? 0) || 0 });
    }
    const rows = lines.map((l) => {
      const p = info.get(l.productId)!, diff = r4(l.counted - l.book);
      return { productId: l.productId, name: p.name, sku: p.sku, unit: p.unit, book: l.book, counted: l.counted, diff, unitCost: r4(p.wac), value: r2(diff * p.wac) };
    });
    const moves: StockMovement[] = rows.filter((r) => r.diff !== 0).map((r) => ({
      productId: r.productId, type: r.diff > 0 ? "IN" : "OUT", quantity: Math.abs(r.diff), unitCost: r.unitCost, skipGl: true, userId: apiUser.uid, companyId,
    }));
    const shortValue = r2(-rows.filter((r) => r.value < 0).reduce((s, r) => s + r.value, 0));
    const overValue = r2(rows.filter((r) => r.value > 0).reduce((s, r) => s + r.value, 0));

    const scNo = await nexusSequenceServer("SC", companyId);
    const scRef = adminDb.doc(`companies/${companyId}/stock_counts/${scNo}`);
    const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const who = str((apiUser as any).name || apiUser.email || apiUser.uid, 80);

    const verify = async (tx: admin.firestore.Transaction) => {
      // ยอดในระบบต้องเท่ากับที่เห็นตอนนับ (มีรับ/เบิกระหว่างนับ = ผลต่างไม่ถูกต้อง)
      for (const l of lines) {
        const h = await getProductTx(tx, companyId, groupId, l.productId);
        const onHand = Number((h?.data as any)?.stockStatus?.onHand ?? 0);
        if (Math.abs(onHand - l.book) > 0.0001) throw new ApiAuthError(409, `ยอดในระบบของ ${info.get(l.productId)!.name} เปลี่ยนเป็น ${onHand} ระหว่างตรวจนับ — โหลดยอดใหม่แล้วตรวจอีกครั้ง`);
      }
    };
    const write = (tx: admin.firestore.Transaction) => {
      const net = r2(overValue - shortValue);
      if (net !== 0) {
        const amount = Math.abs(net);
        tx.set(journalRef, {
          companyId, date: countDate, bookType: "JV", reference: scNo,
          description: `[AUTO] ปรับปรุงสินค้าตามการตรวจนับ ${scNo} (ขาด ${shortValue.toLocaleString("th-TH")} · เกิน ${overValue.toLocaleString("th-TH")})`,
          items: net < 0
            ? [{ accountCode: "5311-00", accountName: "ผลต่างจากการตรวจนับสินค้า", debit: amount, credit: 0 }, { accountCode: "1141-00", accountName: "สินค้าคงเหลือ", debit: 0, credit: amount }]
            : [{ accountCode: "1141-00", accountName: "สินค้าคงเหลือ", debit: amount, credit: 0 }, { accountCode: "5311-00", accountName: "ผลต่างจากการตรวจนับสินค้า", debit: 0, credit: amount }],
          totalDebit: amount, totalCredit: amount, status: "draft", createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
      }
      tx.create(scRef, {
        id: scNo, companyId, countDate, note: str(body.note, 500), lines: rows,
        diffLines: rows.filter((r) => r.diff !== 0).length, shortValue, overValue,
        ...(net !== 0 ? { journalId: journalRef.id } : {}),
        status: "posted", createdBy: apiUser.uid, createdByName: who, createdAt: now, isDeleted: false,
      });
    };

    if (moves.length) await processStockMovements(moves.map((m) => ({ ...m, referenceId: scNo })), write, verify);
    else await adminDb.runTransaction(async (tx) => { await verify(tx); write(tx); });

    await auditServer.logCreate(apiUser.uid, companyId, "STOCK_COUNT", scNo, { lines: rows.length, diffLines: moves.length, shortValue, overValue });
    return NextResponse.json({ success: true, id: scNo, diffLines: moves.length, shortValue, overValue });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    const msg = String(err?.message || "");
    // สต็อกไม่พอ/ปิดงวด ฯลฯ จากตัวจัดการสต็อก: แจ้งผู้ใช้ตามจริง
    if (/สต็อก|งวด|ปิด/.test(msg)) return NextResponse.json({ success: false, error: msg }, { status: 400 });
    console.error("[STOCK_COUNT]", err);
    return NextResponse.json({ success: false, error: "บันทึกผลตรวจนับไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
