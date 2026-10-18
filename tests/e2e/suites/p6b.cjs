// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// Phase 6B: เงินล่วงหน้า (มัดจำ) ของโครงการ — ออกก่อนงวดแรก หักคืนตามสัดส่วน งวดสุดท้ายหักที่เหลือ
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const near = (a, b) => Math.abs(a - b) < 0.011;
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
let T = "";
const call = async (url, b) => {
  const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + T }, body: JSON.stringify({ companyId: C, ...b }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const line = (j, code) => (j.items || []).find((x) => x.accountCode === code) || {};

(async () => {
  const s = Date.now();
  const U = `test-p6b-${s}`;
  await db.doc(`users/${U}`).set({ companyId: C, roles: ["ACCOUNTANT"], role: "ACCOUNTANT", status: "ACTIVE" });
  T = await tok(U);
  const CUS = `TEST-CUS-P6B-${s}`, PRJ = `TEST-PRJ-P6B-${s}`;
  const made = { invoices: [], receipts: [] };
  const bill = async (body) => { const r = await call("/api/projects/billing", { projectDocId: PRJ, ...body }); if (r.body.invoiceNo) made.invoices.push(r.body.invoiceNo); return r; };
  const inv = async (no) => (await db.doc(`companies/${C}/invoices/${no}`).get()).data();
  const jr = async (id) => (await db.doc(`companies/${C}/journal_entries/${id}`).get()).data();
  try {
    await db.doc(`companies/${C}/customers/${CUS}`).set({ companyId: C, name: "TEST หน่วยงาน P6B", taxId: "0994000000001", address: "TEST", isDeleted: false });
    await db.doc(`companies/${C}/projects/${PRJ}`).set({ companyId: C, projectId: PRJ, projectName: "TEST โครงการเงินล่วงหน้า", customerId: CUS, status: "Approved", isDeleted: false,
      milestones: [{ id: "m1", name: "งวด 1", amount: 107000, weight: 66.67 }, { id: "m2", name: "งวด 2", amount: 53500, weight: 33.33 }] });

    ok("advance > 50% rejected", (await call("/api/projects/billing", { action: "settings", projectDocId: PRJ, retentionPercent: 5, advancePercent: 60 })).status === 400);
    ok("settings: retention 5%, advance 15%", (await call("/api/projects/billing", { action: "settings", projectDocId: PRJ, retentionPercent: 5, advancePercent: 15, whtRate: 1 })).status === 200);

    const a = await bill({ action: "billAdvance" });
    const ai = a.body.invoiceNo ? await inv(a.body.invoiceNo) : {};
    const aj = ai.journalId ? await jr(ai.journalId) : {};
    ok("advance bill: 160,500/1.07 × 15% = 22,500 + VAT 1,575 = 24,075", a.status === 200 && ai.docKind === "advance" && ai.subTotal === 22500 && ai.vatAmount === 1575 && ai.grandTotal === 24075 && ai.advanceAmount === 22500, JSON.stringify(a.body));
    ok("advance journal: Dr AR / Cr advance received 2151 + Cr undue VAT", line(aj, "1131-00").debit === 24075 && line(aj, "2151-00").credit === 22500 && line(aj, "2123-00").credit === 1575, JSON.stringify(aj.items));
    ok("advance cannot be billed twice", (await bill({ action: "billAdvance" })).status === 409);
    ok("advance % locked after advance bill", (await call("/api/projects/billing", { action: "settings", projectDocId: PRJ, retentionPercent: 5, advancePercent: 10 })).status === 409);

    // รับเงินล่วงหน้า -> ใบเสร็จ/ใบกำกับภาษี
    const r = await call("/api/finance/receipts", { customerId: CUS, paymentDate: today, paymentMethod: "CASH", lines: [{ invoiceDocId: a.body.invoiceNo, amount: 24075, whtRate: 1 }] });
    if (r.body.receiptNo) made.receipts.push(r.body.receiptNo);
    const rc = r.body.receiptNo ? (await db.doc(`companies/${C}/receipts/${r.body.receiptNo}`).get()).data() : {};
    ok("advance receipt is a tax invoice with VAT 1,575", r.status === 200 && rc.isTaxInvoice && near(rc.vatAmount, 1575) && near(rc.totalWht, 225), JSON.stringify([r.body, rc.vatAmount]));

    const b1 = await bill({ action: "bill", milestoneId: "m1" });
    const i1 = b1.body.invoiceNo ? await inv(b1.body.invoiceNo) : {};
    const j1 = i1.journalId ? await jr(i1.journalId) : {};
    ok("m1: W 100,000 − R 5,000 − D 15,000 = 80,000 + VAT 5,600", b1.status === 200 && i1.advanceAmount === 15000 && i1.subTotal === 80000 && i1.vatAmount === 5600 && i1.grandTotal === 85600, JSON.stringify(b1.body));
    ok("m1 journal debits advance received 15,000 and balances", line(j1, "2151-00").debit === 15000 && line(j1, "4112-00").credit === 100000 && near(j1.totalDebit, j1.totalCredit), JSON.stringify(j1.items));
    ok("advance bill cannot be cancelled after deductions (also paid)", (await call("/api/projects/billing", { action: "cancel", projectDocId: PRJ, invoiceDocId: a.body.invoiceNo, reason: "TEST" })).status === 409);

    const b2 = await bill({ action: "bill", milestoneId: "m2" });
    const i2 = b2.body.invoiceNo ? await inv(b2.body.invoiceNo) : {};
    ok("last milestone recovers the remaining 7,500", b2.status === 200 && i2.advanceAmount === 7500 && i2.subTotal === 40000 && i2.vatAmount === 2800, JSON.stringify(b2.body));
    const st = await call("/api/projects/billing", { action: "status", projectDocId: PRJ });
    ok("summary: advance fully recovered", near(st.body.summary.advanceOutstanding, 0) && st.body.summary.advanceBilled === 22500 && st.body.summary.advanceRecovered === 22500, JSON.stringify(st.body.summary));

    // ยกเลิกงวด 2 -> เงินล่วงหน้าคงเหลือกลับมา
    const c2 = await call("/api/projects/billing", { action: "cancel", projectDocId: PRJ, invoiceDocId: b2.body.invoiceNo, reason: "TEST" });
    const st2 = await call("/api/projects/billing", { action: "status", projectDocId: PRJ });
    ok("cancel m2 restores advance outstanding 7,500", c2.status === 200 && near(st2.body.summary.advanceOutstanding, 7500), JSON.stringify(st2.body.summary));

    const pdf = await call("/api/documents/pdf", { type: "invoice", id: b1.body.invoiceNo, format: "json" });
    ok("m1 PDF shows advance recovery row", pdf.body.document?.totals.some((t) => t.label === "หักคืนเงินล่วงหน้า" && t.amount === -15000), JSON.stringify(pdf.body.document?.totals));
    const apdf = await call("/api/documents/pdf", { type: "invoice", id: a.body.invoiceNo, format: "json" });
    ok("advance PDF title", apdf.body.document?.title === "ใบแจ้งหนี้ (เงินล่วงหน้า)", apdf.body.document?.title);

    // โครงการที่เรียกเก็บงวดไปแล้ว ออกใบเงินล่วงหน้าไม่ได้ (ทดสอบด้วยการยกเลิกใบเงินล่วงหน้าไม่ได้ -> ใช้โครงการเดิม: มีงวด 1 แล้ว)
    ok("advance after first milestone is blocked", (await bill({ action: "billAdvance" })).status === 409);
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    const refs = new Set([...made.invoices, ...made.receipts]);
    for (const n of made.invoices) await db.doc(`companies/${C}/invoices/${n}`).delete();
    for (const n of made.receipts) await db.doc(`companies/${C}/receipts/${n}`).delete();
    for (const x of refs) for (const d of (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", x).get()).docs) await d.ref.delete();
    await db.doc(`companies/${C}/projects/${PRJ}`).delete();
    await db.doc(`companies/${C}/customers/${CUS}`).delete();
    await db.doc(`users/${U}`).delete(); await admin.auth().deleteUser(U).catch(() => {});
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
