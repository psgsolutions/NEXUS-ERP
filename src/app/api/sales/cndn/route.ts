import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { sellerSnapshot } from "@/lib/documents/seller.server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";
import { CNDN_REASONS, CNDN_TYPE_TH, applyArDelta, arPaymentStatus, cndnAmounts, cndnLines, type CnDnLine, type CnDnType } from "@/lib/cndn";
import { processStockMovements } from "@/lib/stock-service";
import { isStockItem } from "@/lib/product-kind";

/**
 * [API-SERVER] ออกใบลดหนี้ / ใบเพิ่มหนี้ อ้างอิงใบกำกับภาษีเดิม
 * Endpoint: POST /api/sales/cndn
 * body: { companyId, type: "CN" | "DN", invoiceDocId, amount (ผลต่างก่อน VAT), reason, reasonDetail?, issueDate?,
 *         items?: [{ lineNo, qty, unitPrice? }]  รายการจากใบกำกับเดิม (มีรายการ = คิดยอดจากรายการ ไม่ใช้ amount)
 *         returnToStock?: boolean               ใบลดหนี้ที่รับสินค้าคืน: รับเข้าคลัง + กลับต้นทุนขาย (Dr สินค้าคงเหลือ / Cr ต้นทุนขาย) }
 *
 * ทำในทรานแซกชันเดียว:
 *  - เลขที่ (ชุด CN / DBN ตั้งรูปแบบได้ที่ ตั้งค่า > รูปแบบเลขที่) ออกพร้อมการบันทึก เรียงต่อเนื่อง ไม่ข้าม
 *  - ใบลดหนี้: ห้ามเกินมูลค่าคงเหลือของใบกำกับ (หลังหักใบลดหนี้ก่อนหน้า)
 *  - ปรับยอดค้างของใบกำกับ: ลดหนี้ -> balance ลด, เพิ่มหนี้ -> balance เพิ่ม
 *    ใบลดหนี้ที่เกินยอดค้าง (ลูกค้าชำระแล้ว) -> ส่วนเกินเป็นยอดค้างคืนลูกค้า (refundDue) คืนผ่าน /api/finance/customer-refunds
 *  - บันทึกบัญชี (รออนุมัติ) ลงวันที่ออกเอกสาร:
 *      ใบลดหนี้:  Dr รับคืนและส่วนลด 4113-00, Dr ภาษีขาย 2121-00 / Cr ลูกหนี้ 1131-00
 *      ใบเพิ่มหนี้: Dr ลูกหนี้ 1131-00 / Cr รายได้ 4111-00, Cr ภาษีขาย 2121-00
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "sales:billing") && !can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "ออกเอกสารเรียกเก็บเงินได้เฉพาะฝ่ายบัญชี/การเงินหรือฝ่ายขายที่มีสิทธิ์วางบิล");

    const type: CnDnType | "" = body.type === "CN" || body.type === "DN" ? body.type : "";
    const invoiceDocId = str(body.invoiceDocId, 120);
    const reason = str(body.reason, 120);
    const reasonDetail = str(body.reasonDetail, 300);
    const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.issueDate || "")) ? body.issueDate : todayBkk();
    if (!type) throw new ApiAuthError(400, "กรุณาเลือกประเภทเอกสาร");
    if (!invoiceDocId) throw new ApiAuthError(400, "กรุณาเลือกใบกำกับภาษีที่อ้างอิง");
    if (!CNDN_REASONS[type].includes(reason)) throw new ApiAuthError(400, "กรุณาเลือกเหตุผลการออกเอกสาร");
    if (reason === "อื่น ๆ" && !reasonDetail) throw new ApiAuthError(400, "กรุณาระบุรายละเอียดเหตุผล");
    if (issueDate > todayBkk()) throw new ApiAuthError(400, "ออกเอกสารล่วงหน้าไม่ได้");
    await assertPeriodOpen(companyId, issueDate);

    const invRef = adminDb.doc(`companies/${companyId}/invoices/${invoiceDocId}`);
    const docRef = adminDb.collection(`companies/${companyId}/cndn`).doc();
    const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
    const [take, seller] = await Promise.all([prepareSequence(type === "CN" ? "CN" : "DBN", companyId), sellerSnapshot(companyId)]);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const label = CNDN_TYPE_TH[type];

    // รายการที่ลด/เพิ่ม + สินค้าที่รับคืน (อ่านใบกำกับก่อนเพื่อสร้างรายการเคลื่อนไหวสต็อก ตรวจซ้ำในทรานแซกชัน)
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 300) : [];
    const pre = (await invRef.get()).data() || {};
    const preLines = rawItems.length ? cndnLines(pre, rawItems, type) : { lines: [] as CnDnLine[], amount: 0, error: "" };
    if (preLines.error) throw new ApiAuthError(400, preLines.error);
    const returnToStock = type === "CN" && body.returnToStock === true && preLines.lines.length > 0;
    const stockLines = returnToStock ? preLines.lines.filter((l) => l.productId && isStockItem({ itemType: l.itemType })) : [];
    if (returnToStock && !stockLines.length) throw new ApiAuthError(400, "ไม่มีรายการสินค้าที่คุมสต็อกให้รับคืน");
    const returnCost = r2(stockLines.reduce((s, l) => s + l.qty * l.unitCost, 0));
    const cogsRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();

    let result: any;
    const reads = async (tx: admin.firestore.Transaction) => {
      // ---- อ่าน ----
      const snap = await tx.get(invRef);
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบกำกับภาษีที่อ้างอิง");
      const inv = snap.data()!;
      const invNo = inv.invoiceNo || inv.documentNo || inv.invoiceId || invoiceDocId;
      if (inv.isSample) throw new ApiAuthError(400, `${invNo} เป็นเอกสารตัวอย่าง`);
      // ใบแจ้งหนี้งวดงาน (VAT เกิดตอนรับเงิน) ไม่ใช่ใบกำกับภาษี: ออกใบลด/เพิ่มหนี้ไม่ได้ ให้ยกเลิกแล้วออกใหม่ที่หน้าโครงการ
      if (inv.vatTiming === "receipt") throw new ApiAuthError(400, `${invNo} เป็นใบแจ้งหนี้งานโครงการ (ยังไม่ใช่ใบกำกับภาษี) ให้ยกเลิกและออกใหม่ที่หน้าโครงการ`);
      if (inv.isDeleted === true || String(inv.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(409, `${invNo} ถูกยกเลิกแล้ว`);
      if (issueDate < String(inv.issueDate || "").slice(0, 10)) throw new ApiAuthError(400, `วันที่ออก${label}ต้องไม่ก่อนวันที่ใบกำกับภาษี`);
      const seq = await take(tx);

      // ---- คำนวณ ----
      const byLines = rawItems.length ? cndnLines(inv, rawItems, type) : null;
      if (byLines?.error) throw new ApiAuthError(400, byLines.error);
      const { amount, vatAmount, totalAmount, vatRate } = cndnAmounts(byLines ? byLines.amount : Number(body.amount), inv);
      if (amount <= 0) throw new ApiAuthError(400, "จำนวนเงินต้องมากกว่า 0");
      const originalAmount = r2(Number(inv.subTotal) || 0);
      const creditedBefore = r2(Number(inv.creditNoteTotal) || 0);   // ผลรวมใบลดหนี้ก่อนหน้า (ก่อน VAT)
      const debitedBefore = r2(Number(inv.debitNoteTotal) || 0);     // ผลรวมใบเพิ่มหนี้ก่อนหน้า (ก่อน VAT)
      const valueBefore = r2(originalAmount - creditedBefore + debitedBefore);
      const grandTotal = r2(Number(inv.grandTotal) || 0);
      const paid = r2(Number(inv.paidAmount) || 0);
      const balanceBefore = r2(inv.balance !== undefined ? Number(inv.balance) : grandTotal - paid);
      if (type === "CN") {
        if (amount > valueBefore + 0.009) throw new ApiAuthError(400, `ลดได้ไม่เกินมูลค่าคงเหลือของใบกำกับ ${valueBefore.toLocaleString("th-TH")} บาท (ก่อน VAT)`);
      }
      const valueAfter = r2(type === "CN" ? valueBefore - amount : valueBefore + amount);
      const refundDueBefore = r2(Number(inv.refundDue) || 0);
      const ar = applyArDelta(balanceBefore, refundDueBefore, type === "CN" ? -totalAmount : totalAmount);
      const balanceAfter = ar.balance;
      const refundCreated = r2(Math.max(0, ar.refundDue - refundDueBefore));
      const docNo = seq.number;
      const customerName = inv.customerName || inv.customerSnapshot?.name || "";

      result = { seq, inv, invNo, byLines, amount, vatAmount, totalAmount, vatRate, valueBefore, valueAfter, creditedBefore, debitedBefore, paid, balanceAfter, ar, refundCreated, docNo, customerName };
    };
    const writes = (tx: admin.firestore.Transaction) => {
      const { seq, inv, invNo, byLines, amount, vatAmount, totalAmount, vatRate, valueBefore, valueAfter, creditedBefore, debitedBefore, paid, balanceAfter, ar, refundCreated, docNo, customerName } = result;
      // ---- เขียน ----
      seq.commit();
      tx.create(docRef, {
        id: docRef.id, companyId, type,
        documentNo: docNo, cndnNo: docNo, docNumber: docNo,
        invoiceDocId, invoiceNo: invNo, invoiceDate: String(inv.issueDate || "").slice(0, 10),
        customerId: inv.customerId || "", customerName, customerSnapshot: inv.customerSnapshot || null,
        sellerSnapshot: seller,
        issueDate, reason, reasonDetail,
        originalAmount: valueBefore, correctAmount: valueAfter, amount, vatRate, vatAmount, totalAmount,
        items: byLines?.lines || [],
        ...(returnToStock ? { stockReturned: true, returnCost, cogsJournalId: returnCost > 0 ? cogsRef.id : "" } : {}),
        journalId: journalRef.id, status: "issued", refundCreated,
        createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      tx.update(invRef, {
        balance: balanceAfter,
        refundDue: ar.refundDue,
        paymentStatus: arPaymentStatus(balanceAfter, paid),
        ...(type === "CN" ? { creditNoteTotal: r2(creditedBefore + amount) } : { debitNoteTotal: r2(debitedBefore + amount) }),
        adjustmentRefs: admin.firestore.FieldValue.arrayUnion(docNo),
        // จำนวนที่ลดหนี้แล้วต่อบรรทัด (กันลด/คืนเกินจำนวนที่ขาย)
        ...(type === "CN" ? Object.fromEntries((byLines?.lines || []).map((l: CnDnLine) => [`returnedQty.${l.lineNo}`, admin.firestore.FieldValue.increment(l.qty)])) : {}),
        updatedAt: now, updatedBy: apiUser.uid,
      });
      if (returnToStock && returnCost > 0) {
        // สินค้ากลับเข้าคลัง: กลับต้นทุนขายที่บันทึกตอนเบิกส่งลูกค้า
        tx.set(cogsRef, {
          companyId, date: issueDate, bookType: "JV",
          description: `[AUTO] รับคืนสินค้าตาม${label} ${docNo} อ้างอิง ${invNo}`,
          reference: docNo, totalDebit: returnCost, totalCredit: returnCost, status: "draft", isOfficialTax: false,
          items: [
            { accountCode: "1141-00", accountName: "สินค้าคงเหลือ", debit: returnCost, credit: 0 },
            { accountCode: "5111-00", accountName: "ต้นทุนขาย", debit: 0, credit: returnCost },
          ],
          createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
      }
      const items = type === "CN"
        ? [
            { accountCode: "4113-00", accountName: "รับคืนและส่วนลดจ่าย", debit: amount, credit: 0 },
            ...(vatAmount > 0 ? [{ accountCode: "2121-00", accountName: "ภาษีขาย", debit: vatAmount, credit: 0 }] : []),
            { accountCode: "1131-00", accountName: "ลูกหนี้การค้า", debit: 0, credit: totalAmount },
          ]
        : [
            { accountCode: "1131-00", accountName: "ลูกหนี้การค้า", debit: totalAmount, credit: 0 },
            { accountCode: "4111-00", accountName: "รายได้จากการขาย", debit: 0, credit: amount },
            ...(vatAmount > 0 ? [{ accountCode: "2121-00", accountName: "ภาษีขาย", debit: 0, credit: vatAmount }] : []),
          ];
      tx.set(journalRef, {
        companyId, date: issueDate, bookType: "SV",
        description: `[AUTO] ${label} ${docNo} อ้างอิง ${invNo} (${customerName}): ${reason}`,
        reference: docNo, items, totalDebit: totalAmount, totalCredit: totalAmount,
        isOfficialTax: vatAmount > 0, status: "draft",
        createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      result.out = { id: docRef.id, docNo, invoiceNo: invNo, amount, vatAmount, totalAmount, balanceAfter, refundDue: ar.refundDue, stockReturned: returnToStock };
    };
    if (stockLines.length) {
      await processStockMovements(stockLines.map((l) => ({
        companyId, productId: l.productId!, type: "IN" as const, quantity: l.qty, unitCost: l.unitCost,
        referenceId: `CN:${docRef.id}`, userId: apiUser.email || apiUser.uid,
      })), writes, reads);
    } else {
      await adminDb.runTransaction(async (tx) => { await reads(tx); writes(tx); });
    }
    result = result.out;

    await auditServer.logCreate(apiUser.uid, companyId, type === "CN" ? "CREDIT_NOTE" : "DEBIT_NOTE", result.docNo, { invoice: result.invoiceNo, totalAmount: result.totalAmount, reason });
    return NextResponse.json({ success: true, type, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[CNDN_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ออกเอกสารไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
