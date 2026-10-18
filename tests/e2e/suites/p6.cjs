// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// Phase 6A: เรียกเก็บเงินตามงวดงาน + เงินประกันผลงาน + ใบเสร็จ/ใบกำกับภาษีตอนรับเงิน (ม.78/1)
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const near = (a, b) => Math.abs(a - b) < 0.011;
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const toks = {};
const call = (uid) => async (url, b) => {
  toks[uid] = toks[uid] || await tok(uid);
  const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + toks[uid] }, body: JSON.stringify({ companyId: C, ...b }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

(async () => {
  const s = Date.now();
  const U = { acct: `test-p6a-${s}`, eng: `test-p6e-${s}` };
  await db.doc(`users/${U.acct}`).set({ companyId: C, roles: ["ACCOUNTANT"], role: "ACCOUNTANT", status: "ACTIVE" });
  await db.doc(`users/${U.eng}`).set({ companyId: C, roles: ["ENGINEER"], role: "ENGINEER", status: "ACTIVE" });
  const acct = call(U.acct), eng = call(U.eng);
  const CUS = `TEST-CUS-P6-${s}`, PRJ = `TEST-PRJ-P6-${s}`;
  const made = { invoices: [], receipts: [] };
  try {
    await db.doc(`companies/${C}/customers/${CUS}`).set({ companyId: C, name: "TEST กรมทดสอบระบบ", taxId: "0994000000000", branchCode: "00000", address_detail: "1 ถนนทดสอบ", province: "กรุงเทพมหานคร", isDeleted: false });
    await db.doc(`companies/${C}/projects/${PRJ}`).set({ companyId: C, projectId: PRJ, projectName: "TEST โครงการติดตั้งระบบ P6", customerId: CUS, customerName: "TEST กรมทดสอบระบบ", status: "IN_PROGRESS", isDeleted: false,
      milestones: [{ id: "m1", name: "งวดที่ 1 ติดตั้งอุปกรณ์", weight: 60, amount: 107000, progress: 100, endDate: today }, { id: "m2", name: "งวดที่ 2 ส่งมอบงาน", weight: 40, amount: 53500, progress: 50, endDate: today }] });

    const st0 = await acct("/api/projects/billing", { action: "status", projectDocId: PRJ });
    ok("status: contract 160,500, nothing billed", st0.status === 200 && st0.body.summary.contract === 160500 && st0.body.summary.unbilledAmount === 160500, JSON.stringify(st0.body.summary));
    ok("engineer (no sales/finance edit) cannot change settings", (await eng("/api/projects/billing", { action: "settings", projectDocId: PRJ, retentionPercent: 5 })).status === 403);
    ok("retention > 20% rejected", (await acct("/api/projects/billing", { action: "settings", projectDocId: PRJ, retentionPercent: 30 })).status === 400);
    const set = await acct("/api/projects/billing", { action: "settings", projectDocId: PRJ, retentionPercent: 5, whtRate: 1 });
    ok("settings saved", set.status === 200);
    await db.doc(`companies/${C}/projects/${PRJ}`).update({ status: "Draft" });
    const draft = await acct("/api/projects/billing", { action: "bill", projectDocId: PRJ, milestoneId: "m1" });
    const stD = await acct("/api/projects/billing", { action: "status", projectDocId: PRJ });
    ok("draft project cannot be billed", draft.status === 409 && stD.body.billable === false, JSON.stringify(draft.body));
    await db.doc(`companies/${C}/projects/${PRJ}`).update({ status: "IN_PROGRESS" });

    // ---- ออกใบแจ้งหนี้งวด 1 ----
    const b1 = await acct("/api/projects/billing", { action: "bill", projectDocId: PRJ, milestoneId: "m1" });
    if (b1.body.invoiceNo) made.invoices.push(b1.body.invoiceNo);
    const inv1 = b1.body.invoiceNo ? (await db.doc(`companies/${C}/invoices/${b1.body.invoiceNo}`).get()).data() : {};
    ok("bill m1: PB number, W 100,000 R 5,000 B 95,000 V 6,650 G 101,650", b1.status === 200 && /^PB/.test(b1.body.invoiceNo) && inv1.workValue === 100000 && inv1.retentionAmount === 5000 && inv1.subTotal === 95000 && inv1.vatAmount === 6650 && inv1.grandTotal === 101650 && inv1.vatTiming === "receipt" && inv1.isTaxInvoice === false, JSON.stringify([b1.body, inv1.grandTotal]));
    const j1 = (await db.doc(`companies/${C}/journal_entries/${inv1.journalId}`).get()).data();
    const line = (j, code) => (j.items || []).find((x) => x.accountCode === code) || {};
    ok("bill journal: Dr AR 101,650 + Dr retention 5,000 / Cr service revenue 100,000 + Cr undue VAT 6,650",
      line(j1, "1131-00").debit === 101650 && line(j1, "1133-00").debit === 5000 && line(j1, "4112-00").credit === 100000 && line(j1, "2123-00").credit === 6650 && j1.totalDebit === j1.totalCredit, JSON.stringify(j1.items));
    ok("same milestone cannot be billed twice", (await acct("/api/projects/billing", { action: "bill", projectDocId: PRJ, milestoneId: "m1" })).status === 409);
    ok("CN/DN on progress bill blocked", (await acct("/api/sales/cndn", { type: "CN", invoiceDocId: b1.body.invoiceNo, amount: 1000, reason: "TEST" })).status === 400);

    // ---- VAT ยังไม่เกิด ----
    const ym = today.slice(0, 7);
    const vat0 = await acct("/api/reports/financial", { report: "vat-out", to: ym });
    ok("progress bill NOT in output VAT report", vat0.status === 200 && !vat0.body.rows.some((r) => r.docNo === b1.body.invoiceNo), JSON.stringify(vat0.body.rows?.slice(-2)));

    // ---- รับชำระบางส่วน -> ใบเสร็จ/ใบกำกับภาษี ----
    const r1 = await acct("/api/finance/receipts", { customerId: CUS, paymentDate: today, paymentMethod: "CASH", lines: [{ invoiceDocId: b1.body.invoiceNo, amount: 50000, whtRate: 1 }] });
    if (r1.body.receiptNo) made.receipts.push(r1.body.receiptNo);
    const rc1 = r1.body.receiptNo ? (await db.doc(`companies/${C}/receipts/${r1.body.receiptNo}`).get()).data() : {};
    const expVat1 = Math.round(50000 * 6650 / 101650 * 100) / 100;
    ok("partial receipt is a tax invoice with VAT share", r1.status === 200 && rc1.isTaxInvoice === true && near(rc1.vatAmount, expVat1) && near(rc1.taxBase, 50000 - expVat1) && rc1.customerSnapshot?.taxId === "0994000000000", JSON.stringify([r1.body, rc1.vatAmount, expVat1]));
    const jr1 = (await db.doc(`companies/${C}/journal_entries/${rc1.journalId}`).get()).data();
    ok("receipt journal moves undue VAT -> output VAT and balances", near(line(jr1, "2123-00").debit, expVat1) && near(line(jr1, "2121-00").credit, expVat1) && near(jr1.totalDebit, jr1.totalCredit) && near(line(jr1, "1154-00").debit, rc1.totalWht), JSON.stringify(jr1.items));
    ok("WHT 1% on base of the paid amount", near(rc1.totalWht, Math.round(50000 * 95000 / 101650 * 0.01 * 100) / 100), String(rc1.totalWht));
    const vat1 = await acct("/api/reports/financial", { report: "vat-out", to: ym });
    const row = vat1.body.rows.find((r) => r.docNo === r1.body.receiptNo);
    ok("receipt appears in output VAT report", row && near(row.vat, expVat1) && row.kind === "ใบเสร็จรับเงิน/ใบกำกับภาษี", JSON.stringify(row));

    const r2 = await acct("/api/finance/receipts", { customerId: CUS, paymentDate: today, paymentMethod: "CASH", lines: [{ invoiceDocId: b1.body.invoiceNo, amount: 51650, whtRate: 1 }] });
    if (r2.body.receiptNo) made.receipts.push(r2.body.receiptNo);
    const invAfter = (await db.doc(`companies/${C}/invoices/${b1.body.invoiceNo}`).get()).data();
    ok("final payment realises the remaining VAT exactly", r2.status === 200 && invAfter.paymentStatus === "paid" && near(invAfter.vatRealized, 6650), JSON.stringify([r2.body, invAfter.vatRealized]));
    ok("paid bill cannot be cancelled", (await acct("/api/projects/billing", { action: "cancel", projectDocId: PRJ, invoiceDocId: b1.body.invoiceNo, reason: "TEST" })).status === 409);

    // ---- ยกเลิกใบเสร็จ -> คืน VAT ที่รับรู้ ----
    const cx = await acct("/api/finance/document-cancel", { kind: "receipt", docNo: r2.body.receiptNo, reason: "TEST ยกเลิกใบเสร็จ" });
    const invCx = (await db.doc(`companies/${C}/invoices/${b1.body.invoiceNo}`).get()).data();
    ok("cancel receipt restores balance and VAT realised", cx.status === 200 && near(invCx.vatRealized, expVat1) && near(invCx.balance, 51650), JSON.stringify([cx.body, invCx.vatRealized, invCx.balance]));
    const r3 = await acct("/api/finance/receipts", { customerId: CUS, paymentDate: today, paymentMethod: "CASH", lines: [{ invoiceDocId: b1.body.invoiceNo, amount: 51650, whtRate: 1 }] });
    if (r3.body.receiptNo) made.receipts.push(r3.body.receiptNo);

    // ---- เบิกคืนเงินประกัน ----
    const rel = await acct("/api/projects/billing", { action: "releaseRetention", projectDocId: PRJ });
    if (rel.body.invoiceNo) made.invoices.push(rel.body.invoiceNo);
    const invR = rel.body.invoiceNo ? (await db.doc(`companies/${C}/invoices/${rel.body.invoiceNo}`).get()).data() : {};
    const jR = invR.journalId ? (await db.doc(`companies/${C}/journal_entries/${invR.journalId}`).get()).data() : {};
    ok("retention release bill 5,000 + VAT 350; journal clears retention receivable", rel.status === 200 && invR.grandTotal === 5350 && invR.docKind === "retention" && line(jR, "1133-00").credit === 5000 && line(jR, "2123-00").credit === 350, JSON.stringify([rel.body, jR.items]));
    ok("nothing left to release", (await acct("/api/projects/billing", { action: "releaseRetention", projectDocId: PRJ })).status === 409);

    // ---- งวด 2 + ลำดับการยกเลิก ----
    const b2 = await acct("/api/projects/billing", { action: "bill", projectDocId: PRJ, milestoneId: "m2" });
    if (b2.body.invoiceNo) made.invoices.push(b2.body.invoiceNo);
    ok("cancel progress bill blocked while a retention release exists", (await acct("/api/projects/billing", { action: "cancel", projectDocId: PRJ, invoiceDocId: b2.body.invoiceNo, reason: "TEST" })).status === 409);
    ok("cancel unpaid retention bill", (await acct("/api/projects/billing", { action: "cancel", projectDocId: PRJ, invoiceDocId: rel.body.invoiceNo, reason: "TEST" })).status === 200);
    const c2 = await acct("/api/projects/billing", { action: "cancel", projectDocId: PRJ, invoiceDocId: b2.body.invoiceNo, reason: "TEST ยอดผิด" });
    const j2 = (await db.doc(`companies/${C}/journal_entries/${(await db.doc(`companies/${C}/invoices/${b2.body.invoiceNo}`).get()).data().journalId}`).get()).data();
    ok("cancel progress bill voids its draft journal", c2.status === 200 && c2.body.journal === "voided" && j2.status === "cancelled", JSON.stringify(c2.body));
    const st1 = await acct("/api/projects/billing", { action: "status", projectDocId: PRJ });
    ok("summary: m2 billable again, retention outstanding 5,000 + 2,500 cancelled -> 5,000", st1.body.summary.unbilledAmount === 53500 && st1.body.summary.retentionOutstanding === 5000, JSON.stringify(st1.body.summary));

    // ---- PDF ----
    const p1 = await acct("/api/documents/pdf", { type: "invoice", id: b1.body.invoiceNo, format: "json" });
    ok("progress bill PDF: not a tax invoice, shows retention", /งวดงาน/.test(p1.body.document?.title) && p1.body.document.notes[0].includes("ไม่ใช่ใบกำกับภาษี") && p1.body.document.totals.some((t) => t.amount === -5000), JSON.stringify(p1.body.document?.totals));
    const p2 = await acct("/api/documents/pdf", { type: "receipt", id: r1.body.receiptNo, format: "json" });
    ok("receipt PDF titled tax invoice with VAT row", p2.body.document?.title === "ใบเสร็จรับเงิน / ใบกำกับภาษี" && p2.body.document.party.taxId === "0994000000000" && p2.body.document.totals.some((t) => /ภาษีมูลค่าเพิ่ม/.test(t.label)), JSON.stringify(p2.body.document?.totals));
    for (const [type, id] of [["invoice", b1.body.invoiceNo], ["receipt", r1.body.receiptNo]]) {
      const r = await fetch(E2E_BASE + "/api/documents/pdf", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + toks[U.acct] }, body: JSON.stringify({ companyId: C, type, id }) });
      const buf = Buffer.from(await r.arrayBuffer()); require("fs").writeFileSync(`${E2E_OUT}/p6-${type}.pdf`, buf);
      ok(`PDF ${type}`, r.status === 200 && buf.slice(0, 4).toString() === "%PDF");
    }
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    const refs = new Set([...made.invoices, ...made.receipts]);
    for (const n of made.invoices) await db.doc(`companies/${C}/invoices/${n}`).delete();
    for (const n of made.receipts) await db.doc(`companies/${C}/receipts/${n}`).delete();
    for (const r of refs) for (const d of (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", r).get()).docs) await d.ref.delete();
    for (const r of made.receipts) for (const d of (await db.collection(`companies/${C}/cheques`).where("docNo", "==", r).get()).docs) await d.ref.delete();
    await db.doc(`companies/${C}/projects/${PRJ}`).delete();
    await db.doc(`companies/${C}/customers/${CUS}`).delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
