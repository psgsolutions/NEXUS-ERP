import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";
import { resolveBankTarget, writeCheque } from "@/lib/bank-cheque.server";
import { expenseAccountOf, payeeKeyOf } from "@/lib/payables";
import { groupIdOfCompany } from "@/lib/company-group.server";
import { getRecordTx } from "@/lib/master-store.server";
import { sellerSnapshot } from "@/lib/documents/seller.server";
import { partySnapshot } from "@/lib/documents/party";

/**
 * [API-SERVER] จ่ายชำระเจ้าหนี้ / ค่าใช้จ่าย (ใบสำคัญจ่าย)
 * Endpoint: POST /api/finance/payments
 * body: { companyId, payeeKey, paymentDate, paymentMethod: CASH|TRANSFER|CHEQUE, bankAccount?, reference?, note?,
 *         lines: [{ expenseDocId, amount, whtRate }] }
 *
 * transaction เดียว: ออกเลข PV (เฉพาะเมื่อสำเร็จ) -> สร้างใบสำคัญจ่าย -> ตัดยอดค่าใช้จ่าย
 * -> ออกหนังสือรับรองหัก ณ ที่จ่าย (ถ้ายังไม่มี) -> บันทึกบัญชี (draft)
 *   Dr เจ้าหนี้การค้า 2111-00 (หนี้จากการรับสินค้าตาม PO ซึ่งตั้งไว้แล้วตอนรับของ)
 *      หรือ บัญชีค่าใช้จ่าย (ค่าใช้จ่ายตรง/เบิกพนักงาน ที่ยังไม่ได้ตั้งหนี้)     = ยอดก่อน VAT
 *   Dr ภาษีซื้อ 1151-00                                                       = VAT
 *   Cr ภาษีหัก ณ ที่จ่ายค้างจ่าย 2132-00                                         = ภาษีที่หักไว้
 *   Cr เงินสด 1111-00 / เงินฝากธนาคาร 1112-00                                    = เงินที่จ่ายจริง
 */

const METHODS = {
  CASH: { label: "เงินสด", code: "1111-00", name: "เงินสด" },
  TRANSFER: { label: "โอนเงิน", code: "1112-00", name: "เงินฝากธนาคาร" },
  CHEQUE: { label: "เช็ค", code: "1112-00", name: "เงินฝากธนาคาร" },
} as const;
type Method = keyof typeof METHODS;

const WHT_RATES = [0, 1, 2, 3, 5];
const round2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอสำหรับการจ่ายเงิน");

    const payeeKey = str(body.payeeKey, 200);
    const method = (str(body.paymentMethod).toUpperCase() || "TRANSFER") as Method;
    const paymentDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.paymentDate || "")) ? body.paymentDate : new Date().toISOString().slice(0, 10);
    const rawLines: any[] = Array.isArray(body.lines) ? body.lines : [];
    if (!payeeKey) throw new ApiAuthError(400, "กรุณาเลือกผู้รับเงิน");
    if (!METHODS[method]) throw new ApiAuthError(400, "วิธีจ่ายเงินไม่ถูกต้อง");
    if (rawLines.length === 0) throw new ApiAuthError(400, "กรุณาเลือกรายการที่จ่ายชำระ");
    const bank = await resolveBankTarget(companyId, method, body, "จ่ายเงิน");

    await assertPeriodOpen(companyId, paymentDate);

    const [groupId, payer] = await Promise.all([groupIdOfCompany(companyId), sellerSnapshot(companyId)]);
    const takePv = await prepareSequence("PV", companyId);
    const takeWht = await prepareSequence("WHT", companyId);
    const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const result = await adminDb.runTransaction(async (tx) => {
      // ---- อ่าน ----
      const pv = await takePv(tx);
      const ids = Array.from(new Set(rawLines.map((l) => str(l.expenseDocId, 120)).filter(Boolean)));
      if (ids.length !== rawLines.length) throw new ApiAuthError(400, "รายการซ้ำหรือไม่ครบ");
      const refs = ids.map((id) => adminDb.doc(`companies/${companyId}/expenses/${id}`));
      const snaps = await tx.getAll(...refs);

      let payeeName = "";
      let supplierId = "";
      const lines = snaps.map((snap, i) => {
        if (!snap.exists) throw new ApiAuthError(404, `ไม่พบรายการ ${ids[i]}`);
        const e = snap.data()!;
        const docNo = e.expenseId || e.documentNo || snap.id;
        if (e.isSample) throw new ApiAuthError(400, `${docNo} เป็นเอกสารตัวอย่าง จ่ายชำระไม่ได้`);
        if (e.isDeleted === true || String(e.status || "").toLowerCase() === "cancelled") throw new ApiAuthError(400, `${docNo} ถูกยกเลิกแล้ว`);
        if (payeeKeyOf(e) !== payeeKey) throw new ApiAuthError(400, `${docNo} ไม่ใช่รายการของผู้รับเงินนี้`);
        payeeName = payeeName || e.supplierName || e.vendor || e.employeeName || "";
        supplierId = supplierId || e.supplierId || "";

        const total = round2(Number(e.totalAmount) || 0);
        const subTotal = round2(Number(e.subTotal ?? total) || 0);
        const paidBefore = round2(Number(e.paidAmount) || 0);
        const balance = round2(e.balance !== undefined ? Number(e.balance) : total - paidBefore);
        const raw = rawLines.find((l) => str(l.expenseDocId, 120) === snap.id);
        const amount = round2(Number(raw.amount) || 0);
        if (amount <= 0) throw new ApiAuthError(400, `ยอดจ่ายของ ${docNo} ต้องมากกว่า 0`);
        if (amount > balance + 0.009) throw new ApiAuthError(400, `ยอดจ่ายของ ${docNo} เกินยอดค้าง (${balance.toLocaleString("th-TH")})`);

        // แยกยอดก่อน VAT / VAT ตามสัดส่วนที่จ่าย
        const fraction = total > 0 ? amount / total : 1;
        const preVat = round2(subTotal * fraction);
        const vat = round2(amount - preVat);

        // ภาษีหัก ณ ที่จ่าย: ใช้ตามหนังสือรับรองที่ออกไว้แล้ว (ถ้ามี) มิฉะนั้นตามอัตราที่เลือก
        const hasCert = !!e.whtId;
        const whtRate = hasCert
          ? Number(e.whtRate) || (subTotal > 0 ? Math.round((Number(e.whtAmount) / subTotal) * 100) : 0)
          : (WHT_RATES.includes(Number(raw.whtRate)) ? Number(raw.whtRate) : 0);
        const whtAmount = hasCert ? round2((Number(e.whtAmount) || 0) * fraction) : round2(preVat * (whtRate / 100));

        // บันทึกใบกำกับภาษีซื้อแล้ว (apPosted): ตั้งหนี้เต็มจำนวนไว้แล้ว -> ล้างเจ้าหนี้ทั้งก้อน
        // ซื้อตาม PO (ตั้งหนี้ส่วนก่อน VAT ตอนรับสินค้า) -> ล้างเจ้าหนี้ + ลงภาษีซื้อ
        // ค่าใช้จ่ายตรง/เบิกพนักงาน ที่ยังไม่ตั้งหนี้ -> ลงค่าใช้จ่าย + ภาษีซื้อ
        const apPosted = !!e.apPosted;
        const debit = apPosted || (e.poRef && e.documentType !== "ExpenseClaim")
          ? { code: "2111-00", name: "เจ้าหนี้การค้า" }
          : expenseAccountOf(e);

        const paidAfter = round2(paidBefore + amount);
        const balanceAfter = round2(Math.max(0, total - paidAfter));
        return {
          ref: refs[i], e, docNo, hasCert, apPosted,
          line: { expenseDocId: snap.id, expenseNo: docNo, total, balanceBefore: balance, amount, preVat, vat, whtRate, whtAmount, netPaid: round2(amount - whtAmount), debitAccount: debit.code },
          debit,
          paid: balanceAfter <= 0.009,
          update: {
            paidAmount: paidAfter,
            balance: balanceAfter,
            paymentStatus: balanceAfter <= 0.009 ? "paid" : "partial",
            status: balanceAfter <= 0.009 ? "Paid" : "Partially Paid",
            lastPaymentDate: paymentDate,
            paymentRefs: admin.firestore.FieldValue.arrayUnion(pv.number),
            updatedAt: now,
            updatedBy: apiUser.uid,
          } as Record<string, any>,
        };
      });

      // เลขหนังสือรับรองหัก ณ ที่จ่าย (อ่านตัวนับก่อนเขียน) — ใช้เฉพาะเมื่อมีรายการที่ต้องออกใหม่
      const needCert = lines.filter((l) => !l.hasCert && l.line.whtAmount > 0);
      const whtSeq = needCert.length ? await takeWht(tx) : null;
      // ผู้รับเงิน ณ วันที่จ่าย (ใช้บนใบสำคัญจ่ายและ 50 ทวิ)
      const sup = supplierId ? await getRecordTx(tx, "suppliers", companyId, groupId, supplierId) : null;
      const payee = partySnapshot(sup?.data, { name: payeeName, taxId: lines[0]?.e?.taxId || "" });

      const totalAmount = round2(lines.reduce((s, l) => s + l.line.amount, 0));
      const totalWht = round2(lines.reduce((s, l) => s + l.line.whtAmount, 0));
      const netPaid = round2(totalAmount - totalWht);
      const pay = METHODS[method];

      // รวมบรรทัดบัญชีตามรหัส
      const dr = new Map<string, { name: string; amount: number }>();
      const addDr = (code: string, name: string, amount: number) => {
        if (amount <= 0) return;
        const cur = dr.get(code) || { name, amount: 0 };
        cur.amount = round2(cur.amount + amount);
        dr.set(code, cur);
      };
      lines.forEach((l) => {
        if (l.apPosted) {
          addDr(l.debit.code, l.debit.name, l.line.amount);
        } else {
          addDr(l.debit.code, l.debit.name, l.line.preVat);
          addDr("1151-00", "ภาษีซื้อ", l.line.vat);
        }
      });
      const journalItems = [
        ...Array.from(dr.entries()).map(([code, v]) => ({ accountCode: code, accountName: v.name, debit: v.amount, credit: 0 })),
        ...(totalWht > 0 ? [{ accountCode: "2132-00", accountName: "ภาษีหัก ณ ที่จ่ายค้างจ่าย", debit: 0, credit: totalWht }] : []),
        { accountCode: pay.code, accountName: pay.name, debit: 0, credit: netPaid },
      ];
      const totalDebit = round2(journalItems.reduce((s, l) => s + l.debit, 0));
      const totalCredit = round2(journalItems.reduce((s, l) => s + l.credit, 0));
      if (Math.abs(totalDebit - totalCredit) > 0.02) throw new Error(`บัญชีไม่สมดุล ${totalDebit}/${totalCredit}`);

      // ---- เขียน ----
      pv.commit();
      if (whtSeq) whtSeq.commit();
      let certIndex = 0;
      const certs: string[] = [];
      lines.forEach((l) => {
        if (!l.hasCert && l.line.whtAmount > 0 && whtSeq) {
          // ใบเดียวต่อการจ่าย: ถ้ามีหลายรายการ ต่อท้ายเลขด้วยลำดับ
          const whtId = needCert.length > 1 ? `${whtSeq.number}-${++certIndex}` : whtSeq.number;
          certs.push(whtId);
          tx.create(adminDb.doc(`companies/${companyId}/withholding_taxes/${whtId}`), {
            id: whtId,
            whtId,
            companyId,
            expenseId: l.line.expenseDocId,
            expRef: l.line.expenseDocId,
            paymentRef: pv.number,
            vendor: payeeName,
            supplierId: l.e.supplierId || "",
            taxId: payee.taxId,
            vendorType: payee.corporate ? "CORPORATE" : "INDIVIDUAL",
            payee,
            payerSnapshot: payer,
            baseAmount: l.line.preVat,
            whtRate: l.line.whtRate,
            taxAmount: l.line.whtAmount,
            whtAmount: l.line.whtAmount,
            documentType: "Withholding Tax (50 Tawi)",
            status: "Issued",
            // ภ.ง.ด.3/53 นับเดือนตามวันที่จ่ายเงิน (ไม่ใช่วันที่บันทึก)
            issuedAt: paymentDate,
            filingDate: paymentDate,
            createdBy: apiUser.uid,
            createdAt: now,
            isDeleted: false,
          });
          // หนังสือที่ออกตอนจ่ายเก็บแยกจาก whtId (ซึ่งหมายถึงหนังสือที่ออกล่วงหน้าทั้งใบ)
          l.update.paymentWhtIds = admin.firestore.FieldValue.arrayUnion(whtId);
        }
        l.update.whtPaidAmount = round2((Number(l.e.whtPaidAmount) || 0) + l.line.whtAmount);
        tx.update(l.ref, l.update);
      });

      writeCheque(tx, companyId, bank, { direction: "OUT", docKind: "payment", docNo: pv.number, docDate: paymentDate, party: payeeName, amount: netPaid, uid: apiUser.uid });
      tx.create(adminDb.doc(`companies/${companyId}/payments/${pv.number}`), {
        companyId,
        paymentNo: pv.number,
        documentNo: pv.number,
        payeeKey,
        payeeName,
        payeeSnapshot: payee,
        supplierId,
        paymentDate,
        paymentMethod: method,
        paymentMethodLabel: pay.label,
        bankAccountId: bank.bankAccountId,
        bankAccount: bank.bankAccount,
        ...(bank.cheque ? { cheque: bank.cheque } : {}),
        reference: str(body.reference, 120),
        note: str(body.note, 500),
        lines: lines.map((l) => l.line),
        expenseNos: lines.map((l) => l.docNo).join(", "),
        totalAmount,
        totalWht,
        netPaid,
        whtCertificates: certs,
        journalId: journalRef.id,
        status: "posted",
        isSample: false,
        isDeleted: false,
        createdBy: apiUser.uid,
        createdAt: now,
        updatedAt: now,
      });

      tx.set(journalRef, {
        companyId,
        date: paymentDate,
        bookType: "PV",
        description: `[AUTO] จ่ายชำระ ${pv.number} ให้ ${payeeName}`,
        reference: pv.number,
        items: journalItems,
        totalDebit,
        totalCredit,
        status: "draft",
        createdBy: apiUser.uid,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      });

      return { paymentNo: pv.number, totalAmount, totalWht, netPaid, whtCertificates: certs };
    });

    await auditServer.logCreate(apiUser.uid, companyId, "PAYMENT", result.paymentNo, { payeeKey, ...result });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[PAYMENT_API_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกจ่ายชำระไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
