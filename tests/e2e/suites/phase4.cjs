// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = process.env.BASE_URL || E2E_BASE + "";
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const P = (c, id) => db.doc(`companies/${C}/${c}/${id}`);
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), month = today.slice(0, 7);

(async () => {
  const stamp = Date.now();
  const acct = `test-p4-acct-${stamp}`, sales = `test-p4-sales-${stamp}`;
  await db.doc(`users/${acct}`).set({ companyId: C, roles: ["ACCOUNTANT"], role: "ACCOUNTANT", status: "ACTIVE" });
  await db.doc(`users/${sales}`).set({ companyId: C, roles: ["SALES"], role: "SALES", status: "ACTIVE" });
  const ta = await tok(acct), ts = await tok(sales);
  const mk = (t) => (url, body) => fetch(`${BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ companyId: C, ...body }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const call = mk(ta), callS = mk(ts);
  const counters = {}; for (const id of ["RE", "PV", "WHT"]) counters[id] = (await db.doc(`companies/${C}/counters/${id}`).get()).data() || null;
  const made = []; // [col,id]
  const custId = `TEST-CUS-${stamp}`, invId = `TEST-INV-P4-${stamp}`, expId = `TEST-EXP-P4-${stamp}`;
  try {
    await P("invoices", invId).set({ companyId: C, invoiceNo: invId, customerId: custId, customerName: "TEST ลูกค้า P4", customerSnapshot: { name: "TEST ลูกค้า P4", taxId: "0105555000009" }, issueDate: today, dueDate: today, subTotal: 1000, vatAmount: 70, grandTotal: 1070, balance: 1070, paidAmount: 0, paymentStatus: "unpaid", status: "issued", isTest: true });
    await P("expenses", expId).set({ companyId: C, expenseId: expId, supplierName: "TEST ผู้ขาย P4", totalAmount: 500, subTotal: 500, vatAmount: 0, paidAmount: 0, status: "Unpaid", issuedAt: today, dueDate: today, isTest: true });
    made.push(["invoices", invId], ["expenses", expId]);

    // ---- ทะเบียนบัญชีธนาคาร ----
    const accNo = `999-${String(stamp).slice(-6)}`;
    const ba = await call("/api/finance/bank-accounts", { action: "create", name: "TEST บัญชี P4", bankName: "TEST", accountNo: accNo, openingBalance: 10000, openingDate: `${month}-01` });
    const bankId = ba.body.id; if (bankId) made.push(["bank_accounts", bankId]);
    ok("create bank account", ba.status === 200 && !!bankId, JSON.stringify(ba.body));
    const dup = await call("/api/finance/bank-accounts", { action: "create", name: "x", accountNo: accNo });
    ok("duplicate account no blocked", dup.status === 409, JSON.stringify(dup.body));
    const sba = await callS("/api/finance/bank-accounts", { action: "create", name: "x", accountNo: "1" });
    ok("SALES cannot manage bank accounts", sba.status === 403);

    // ---- รับชำระด้วยเช็ค ----
    const noCheque = await call("/api/finance/receipts", { customerId: custId, paymentDate: today, paymentMethod: "CHEQUE", bankAccountId: bankId, lines: [{ invoiceDocId: invId, amount: 1070, whtRate: 0 }] });
    ok("cheque receipt needs cheque no", noCheque.status === 400 && /เลขที่เช็ค/.test(noCheque.body.error), JSON.stringify(noCheque.body));
    const rc = await call("/api/finance/receipts", { customerId: custId, paymentDate: today, paymentMethod: "CHEQUE", bankAccountId: bankId, chequeNo: "TEST-CHQ-1", chequeDate: today, chequeBank: "TEST Bank", lines: [{ invoiceDocId: invId, amount: 1070, whtRate: 0 }] });
    const reNo = rc.body.receiptNo; if (reNo) made.push(["receipts", reNo], ["cheques", reNo]);
    ok("receipt by cheque into registered account", rc.status === 200 && !!reNo, JSON.stringify(rc.body));
    const re = reNo ? (await P("receipts", reNo).get()).data() : {};
    if (re.journalId) made.push(["journal_entries", re.journalId]);
    const chq = reNo ? (await P("cheques", reNo).get()).data() : null;
    ok("receipt stores bank account id + cheque", re.bankAccountId === bankId && re.cheque?.chequeNo === "TEST-CHQ-1", JSON.stringify({ b: re.bankAccountId, c: re.cheque }));
    ok("cheque registered (IN, PENDING, 1070)", chq && chq.direction === "IN" && chq.status === "PENDING" && chq.amount === 1070, JSON.stringify(chq));

    // ---- จ่ายเงินด้วยเช็ค ----
    const pv = await call("/api/finance/payments", { payeeKey: "NAME:TEST ผู้ขาย P4", paymentDate: today, paymentMethod: "CHEQUE", bankAccountId: bankId, chequeNo: "TEST-CHQ-2", chequeDate: today, lines: [{ expenseDocId: expId, amount: 500, whtRate: 0 }] });
    const pvNo = pv.body.paymentNo; if (pvNo) made.push(["payments", pvNo], ["cheques", pvNo]);
    ok("payment by cheque", pv.status === 200 && !!pvNo, JSON.stringify(pv.body));
    const pvd = pvNo ? (await P("payments", pvNo).get()).data() : {};
    if (pvd.journalId) made.push(["journal_entries", pvd.journalId]);

    // ---- สถานะเช็ค ----
    const d1 = await call("/api/finance/cheques", { id: reNo, action: "deposit" });
    const c1 = await call("/api/finance/cheques", { id: reNo, action: "clear" });
    ok("cheque IN deposit -> clear", d1.status === 200 && c1.status === 200 && c1.body.status === "CLEARED", JSON.stringify([d1.body, c1.body]));
    const b1 = await call("/api/finance/cheques", { id: reNo, action: "bounce" });
    ok("cleared cheque cannot bounce", b1.status === 409, JSON.stringify(b1.body));
    const o1 = await call("/api/finance/cheques", { id: pvNo, action: "deposit" });
    ok("OUT cheque has no deposit action", o1.status === 400, JSON.stringify(o1.body));

    // ---- รายงานบัญชีย่อย ----
    const st = await call("/api/reports/subledger", { report: "ar-statement", customerId: custId, from: month, to: month });
    ok("customer statement: invoice 1070 - receipt 1070 = 0", st.status === 200 && st.body.statement?.entries?.length === 2 && st.body.statement.closing === 0, JSON.stringify(st.body.statement));
    const ap = await call("/api/reports/subledger", { report: "ap-statement", payeeKey: "NAME:TEST ผู้ขาย P4", from: month, to: month });
    ok("supplier statement: 500 - 500 = 0", ap.status === 200 && ap.body.statement?.entries?.length === 2 && ap.body.statement.closing === 0, JSON.stringify(ap.body.statement));
    const bk = await call("/api/reports/subledger", { report: "bank-book", bookId: bankId, from: month, to: month });
    ok("bank book: 10,000 + 1,070 - 500 = 10,570", bk.status === 200 && bk.body.book.opening === 10000 && bk.body.book.closing === 10570 && bk.body.book.entries.length === 2, JSON.stringify(bk.body.book));
    const chl = await call("/api/reports/subledger", { report: "cheques" });
    ok("cheque register lists both", chl.status === 200 && [reNo, pvNo].every((n) => chl.body.rows.some((r) => r.id === n)));
    const ag = await call("/api/reports/subledger", { report: "ar-aging" });
    ok("AR aging responds", ag.status === 200 && Array.isArray(ag.body.buckets));
    for (const r of ["ap-aging", "assets", "valuation"]) { const x = await call("/api/reports/subledger", { report: r }); ok(`${r} responds`, x.status === 200, JSON.stringify(x.body).slice(0, 120)); }
    const sc = await callS("/api/reports/subledger", { report: "stock-card" });
    ok("SALES sees stock card without cost", sc.status === 200 && sc.body.showCost === false, JSON.stringify({ s: sc.status, c: sc.body.showCost }));
    const sag = await callS("/api/reports/subledger", { report: "ar-aging" });
    ok("SALES cannot open AR aging", sag.status === 403);
    const sval = await callS("/api/reports/subledger", { report: "valuation" });
    ok("SALES cannot open valuation", sval.status === 403);

    // ---- กระทบยอด ----
    const rows = [{ date: today, description: "เช็คเข้า", amount: 1070 }, { date: today, description: "เช็คจ่าย", amount: -500 }, { date: today, description: "ค่าธรรมเนียม", amount: -20 }];
    const mt = await call("/api/finance/bank-reconcile", { action: "match", bookId: bankId, month, rows });
    ok("auto match 2 of 3 rows", mt.status === 200 && mt.body.matches.length === 2 && mt.body.unmatchedRows.length === 1, JSON.stringify({ m: mt.body.matches, u: mt.body.unmatchedRows }));
    const sv = await call("/api/finance/bank-reconcile", { action: "save", bookId: bankId, month, rows, matches: mt.body.matches, statementClosing: 10550 });
    made.push(["bank_reconciliations", `${bankId}_${month}`]);
    ok("reconciliation balances (10,570 − 20 fee = 10,550)", sv.status === 200 && sv.body.difference === 0 && sv.body.adjustedBookBalance === 10550, JSON.stringify(sv.body));
    const dupM = await call("/api/finance/bank-reconcile", { action: "save", bookId: bankId, month, rows, matches: [mt.body.matches[0], { ...mt.body.matches[0], rowIndex: 2 }], statementClosing: 0 });
    ok("duplicate match rejected", dupM.status === 400, JSON.stringify(dupM.body));

    // ---- ยกเลิกใบเสร็จ -> เช็คถูกยกเลิก ----
    const cx = await call("/api/finance/document-cancel", { kind: "payment", docNo: pvNo, reason: "TEST ยกเลิก" });
    const pchq = (await P("cheques", pvNo).get()).data();
    ok("cancel payment voids its cheque", cx.status === 200 && pchq.status === "CANCELLED", JSON.stringify({ s: cx.status, b: cx.body, c: pchq?.status }));
    const jr = (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", pvNo).get()).docs.map((d) => d.id);
    jr.forEach((id) => made.push(["journal_entries", id]));
  } catch (e) { fails++; console.log("ERROR", e); }
  finally {
    for (const [c, id] of made) await P(c, id).delete().catch(() => {});
    for (const id of Object.keys(counters)) counters[id] ? await db.doc(`companies/${C}/counters/${id}`).set(counters[id]) : await db.doc(`companies/${C}/counters/${id}`).delete();
    for (const u of [acct, sales]) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log(`cleanup ${made.length} docs. ${fails ? fails + " FAILED" : "ALL PASS"}`); process.exit(0);
  }
})();
