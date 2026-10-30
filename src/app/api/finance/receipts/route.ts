import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";
import { priorResult, rememberResult, requestKeyOf } from "@/lib/idempotency.server";
import { resolveBankTarget, writeCheque } from "@/lib/bank-cheque.server";
import { vatPortionOfPayment } from "@/lib/project-billing";
import { sellerSnapshot } from "@/lib/documents/seller.server";

/**
 * [API-SERVER] รับชำระเงินจากลูกค้า (ใบเสร็จรับเงิน)
 * Endpoint: POST /api/finance/receipts
 * body: { companyId, customerId, paymentDate (YYYY-MM-DD), paymentMethod: CASH|TRANSFER|CHEQUE,
 *         bankAccount?, reference?, note?, lines: [{ invoiceDocId, amount, whtRate }] }
 *
 * ทำใน transaction เดียว:
 *  - ตรวจยอดค้างของใบแจ้งหนี้ (รับชำระบางส่วนได้ ห้ามเกินยอดค้าง)
 *  - สร้างใบเสร็จ companies/{id}/receipts/{RE...}
 *  - ตัดยอดใบแจ้งหนี้: paidAmount / balance / paymentStatus (partial | paid)
 *  - บันทึกบัญชี (draft รอฝ่ายบัญชีอนุมัติ):
 *      Dr เงินสด 1111-00 หรือ เงินฝากธนาคาร 1112-00  (เงินที่ได้รับจริง)
 *      Dr ภาษีเงินได้ถูกหัก ณ ที่จ่าย 1154-00         (ลูกค้าหักไว้)
 *      Cr ลูกหนี้การค้า 1131-00                       (ยอดที่ตัดหนี้)
 *  - ใบแจ้งหนี้งานบริการที่ VAT เกิดตอนรับเงิน (vatTiming "receipt" เช่น งวดงานโครงการ, ม.78/1):
 *      ใบเสร็จนี้เป็นใบกำกับภาษีด้วย และโอน Dr ภาษีขายยังไม่ถึงกำหนด 2123-00 / Cr ภาษีขาย 2121-00 ตามส่วนที่รับชำระ
 */

const METHODS = {
  CASH: { label: "เงินสด", account: { code: "1111-00", name: "เงินสด" } },
  TRANSFER: { label: "โอนเงิน", account: { code: "1112-00", name: "เงินฝากธนาคาร" } },
  CHEQUE: { label: "เช็ค", account: { code: "1112-00", name: "เงินฝากธนาคาร" } },
} as const;
type Method = keyof typeof METHODS;

const WHT_RATES = [0, 1, 2, 3, 5];
const round2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) return NextResponse.json({ success: false, error: "ไม่พบรหัสบริษัท" }, { status: 400 });

    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:edit") && !can(apiUser.roles, "sales:billing")) {
      throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอสำหรับการรับชำระเงิน");
    }

    const customerId = str(body.customerId, 120);
    const method = (str(body.paymentMethod).toUpperCase() || "TRANSFER") as Method;
    const paymentDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.paymentDate || "")) ? body.paymentDate : new Date().toISOString().slice(0, 10);
    const rawLines: any[] = Array.isArray(body.lines) ? body.lines : [];
    if (!customerId) throw new ApiAuthError(400, "กรุณาเลือกลูกค้า");
    if (!METHODS[method]) throw new ApiAuthError(400, "วิธีรับชำระไม่ถูกต้อง");
    if (rawLines.length === 0) throw new ApiAuthError(400, "กรุณาเลือกใบแจ้งหนี้ที่รับชำระ");
    const bank = await resolveBankTarget(companyId, method, body, "รับเงิน");

    // ปิดงวดแล้วบันทึกไม่ได้
    await assertPeriodOpen(companyId, paymentDate);

    // เลขใบเสร็จออกใน transaction เดียวกับการบันทึก (ตรวจไม่ผ่าน = เลขไม่ข้าม)
    const takeNumber = await prepareSequence("RE", companyId);
    const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const seller = await sellerSnapshot(companyId);

    // เน็ตหลุดแล้วกดบันทึกซ้ำ (รหัสคำขอเดิม): คืนใบเสร็จที่ออกไปแล้ว ไม่รับเงินซ้ำ
    const requestKey = requestKeyOf(body.requestKey);
    type Done = { receiptNo: string; totalApplied: number; totalWht: number; cashReceived: number; invoices: { invoiceNo: string; status: string }[]; replayed?: boolean };
    const result = await adminDb.runTransaction(async (tx): Promise<Done> => {
      const prior = await priorResult<Done>(tx, companyId, "receipt", requestKey);
      if (prior) return { ...prior, replayed: true };
      const seq = await takeNumber(tx);
      const receiptNo = seq.number;
      const receiptRef = adminDb.doc(`companies/${companyId}/receipts/${receiptNo}`);
      // ---- อ่านใบแจ้งหนี้ทั้งหมดก่อน (transaction: read ก่อน write) ----
      const ids = Array.from(new Set(rawLines.map((l) => str(l.invoiceDocId, 120)).filter(Boolean)));
      if (ids.length !== rawLines.length) throw new ApiAuthError(400, "รายการใบแจ้งหนี้ซ้ำหรือไม่ครบ");
      const refs = ids.map((id) => adminDb.doc(`companies/${companyId}/invoices/${id}`));
      const snaps = await tx.getAll(...refs);

      let customerName = "";
      const lines = snaps.map((snap, i) => {
        if (!snap.exists) throw new ApiAuthError(404, `ไม่พบใบแจ้งหนี้ ${ids[i]}`);
        const inv = snap.data()!;
        const invNo = inv.invoiceNo || inv.documentNo || snap.id;
        if (inv.isSample) throw new ApiAuthError(400, `${invNo} เป็นเอกสารตัวอย่าง รับชำระไม่ได้`);
        if (inv.isDeleted === true || String(inv.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(400, `${invNo} ถูกยกเลิกแล้ว`);
        if (inv.customerId !== customerId) throw new ApiAuthError(400, `${invNo} ไม่ใช่ใบแจ้งหนี้ของลูกค้านี้`);
        customerName = customerName || inv.customerName || "";

        const grandTotal = round2(Number(inv.grandTotal) || 0);
        const paidBefore = round2(Number(inv.paidAmount) || 0);
        const balance = round2(inv.balance !== undefined ? Number(inv.balance) : grandTotal - paidBefore);
        const raw = rawLines.find((l) => str(l.invoiceDocId, 120) === snap.id);
        const amount = round2(Number(raw.amount) || 0);
        if (amount <= 0) throw new ApiAuthError(400, `ยอดรับชำระของ ${invNo} ต้องมากกว่า 0`);
        if (amount > balance + 0.009) throw new ApiAuthError(400, `ยอดรับชำระของ ${invNo} เกินยอดค้าง (${balance.toLocaleString("th-TH")})`);

        // ภาษีหัก ณ ที่จ่าย คิดจากยอดก่อน VAT ตามสัดส่วนที่ชำระ
        const whtRate = WHT_RATES.includes(Number(raw.whtRate)) ? Number(raw.whtRate) : 0;
        const subTotal = Number(inv.subTotal) || grandTotal;
        const whtBase = grandTotal > 0 ? round2(amount * (subTotal / grandTotal)) : amount;
        const whtAmount = round2(whtBase * (whtRate / 100));

        const paidAfter = round2(paidBefore + amount);
        // ลดจากยอดค้างปัจจุบัน (รวมผลของใบลดหนี้/ใบเพิ่มหนี้แล้ว) ไม่คำนวณใหม่จากยอดรวมใบกำกับ
        const balanceAfter = round2(Math.max(0, balance - amount));
        // VAT เกิดตอนรับเงิน: ส่วนของ VAT ในยอดที่รับครั้งนี้
        const vatOnReceipt = inv.vatTiming === "receipt" ? vatPortionOfPayment(inv as any, amount, balanceAfter) : null;
        return {
          ref: refs[i],
          customerSnapshot: inv.customerSnapshot || null,
          line: {
            invoiceDocId: snap.id, invoiceNo: invNo, invoiceTotal: grandTotal, balanceBefore: balance, amount, whtRate, whtBase, whtAmount, netReceived: round2(amount - whtAmount),
            ...(vatOnReceipt ? { vatOnReceipt: true, taxBase: vatOnReceipt.base, vat: vatOnReceipt.vat, ...(inv.projectName ? { projectName: inv.projectName } : {}), ...(inv.milestoneName ? { milestoneName: inv.milestoneName } : {}) } : {}),
          },
          invUpdate: {
            paidAmount: paidAfter,
            balance: balanceAfter,
            paymentStatus: balanceAfter <= 0.009 ? "paid" : "partial",
            lastPaymentDate: paymentDate,
            ...(vatOnReceipt ? { vatRealized: round2((Number(inv.vatRealized) || 0) + vatOnReceipt.vat) } : {}),
            receiptRefs: admin.firestore.FieldValue.arrayUnion(receiptNo),
            updatedAt: now,
            updatedBy: apiUser.uid,
          },
        };
      });

      const totalApplied = round2(lines.reduce((s, l) => s + l.line.amount, 0));
      const totalWht = round2(lines.reduce((s, l) => s + l.line.whtAmount, 0));
      const cashReceived = round2(totalApplied - totalWht);
      const account = METHODS[method].account;
      const taxLines = lines.filter((l) => (l.line as any).vatOnReceipt);
      const vatRealized = round2(taxLines.reduce((s, l) => s + ((l.line as any).vat || 0), 0));
      const taxBase = round2(taxLines.reduce((s, l) => s + ((l.line as any).taxBase || 0), 0));

      const journalItems = [
        { accountCode: account.code, accountName: account.name, debit: cashReceived, credit: 0 },
        ...(totalWht > 0 ? [{ accountCode: "1154-00", accountName: "ภาษีเงินได้ถูกหัก ณ ที่จ่าย", debit: totalWht, credit: 0 }] : []),
        { accountCode: "1131-00", accountName: "ลูกหนี้การค้า", debit: 0, credit: totalApplied },
        // ใบเสร็จ/ใบกำกับภาษี: ภาษีขายถึงกำหนดในเดือนที่รับเงิน
        ...(vatRealized > 0 ? [
          { accountCode: "2123-00", accountName: "ภาษีขายยังไม่ถึงกำหนด", debit: vatRealized, credit: 0 },
          { accountCode: "2121-00", accountName: "ภาษีขาย", debit: 0, credit: vatRealized },
        ] : []),
      ];

      // ---- เขียน ----
      seq.commit();
      tx.create(receiptRef, {
        companyId,
        sellerSnapshot: seller,
        receiptNo,
        documentNo: receiptNo,
        customerId,
        customerName,
        paymentDate,
        paymentMethod: method,
        paymentMethodLabel: METHODS[method].label,
        bankAccountId: bank.bankAccountId,
        bankAccount: bank.bankAccount,
        ...(bank.cheque ? { cheque: bank.cheque } : {}),
        reference: str(body.reference, 120),
        note: str(body.note, 500),
        lines: lines.map((l) => l.line),
        invoiceNo: lines.map((l) => l.line.invoiceNo).join(", "),
        totalApplied,
        totalWht,
        cashReceived,
        amount: totalApplied,
        // เป็นใบกำกับภาษีด้วย (งานบริการ VAT เกิดตอนรับเงิน) — ข้อมูลผู้ซื้อตาม ม.86/4
        ...(taxLines.length ? { isTaxInvoice: true, taxBase, vatAmount: vatRealized, customerSnapshot: taxLines[0].customerSnapshot } : {}),
        journalId: journalRef.id,
        status: "posted",
        isSample: false,
        isDeleted: false,
        createdBy: apiUser.uid,
        createdAt: now,
        updatedAt: now,
      });
      lines.forEach((l) => tx.update(l.ref, l.invUpdate));
      writeCheque(tx, companyId, bank, { direction: "IN", docKind: "receipt", docNo: receiptNo, docDate: paymentDate, party: customerName, amount: cashReceived, uid: apiUser.uid });
      tx.set(journalRef, {
        companyId,
        date: paymentDate,
        bookType: "RV",
        description: `[AUTO] รับชำระเงิน ${receiptNo} จาก ${customerName}`,
        reference: receiptNo,
        items: journalItems,
        totalDebit: round2(totalApplied + vatRealized),
        totalCredit: round2(totalApplied + vatRealized),
        status: "draft",
        createdBy: apiUser.uid,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      });

      const done = { receiptNo, totalApplied, totalWht, cashReceived, invoices: lines.map((l) => ({ invoiceNo: String(l.line.invoiceNo), status: String(l.invUpdate.paymentStatus) })) };
      rememberResult(tx, companyId, "receipt", requestKey, apiUser.uid, done);
      return done;
    });
    if (result.replayed) return NextResponse.json({ success: true, ...result });

    await auditServer.logCreate(apiUser.uid, companyId, "RECEIPT", result.receiptNo, { customerId, ...result });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    console.error("[RECEIPT_API_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกรับชำระเงินไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
