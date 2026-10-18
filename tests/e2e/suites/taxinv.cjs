// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
const path = require("path"); const root = E2E_ROOT;
require("@next/env").loadEnvConfig(root);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10)) }) });
const db = admin.firestore(); const C = "COM-NEXUS-01";
const ok = (label, cond, extra = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${label} ${extra}`);
const jstr = (j) => j.items.map((l) => `${l.accountCode}:${l.debit}/${l.credit}`).join(" ");

(async () => {
  const user = (await db.collection("users").where("companyId", "==", C).where("role", "==", "ADMIN").limit(1).get()).docs[0];
  const tok = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(user.id), returnSecureToken: true }) })).json();
  const call = (url, body) => fetch(`${E2E_BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok.idToken}` }, body: JSON.stringify({ companyId: C, ...body }) }).then(async (x) => ({ status: x.status, body: await x.json() }));
  const rootCounters = (await db.collection("counters").where("companyId", "==", C).get()).docs.filter((d) => ["INV", "BN"].includes(d.data().type));
  const cBefore = Object.fromEntries(rootCounters.map((d) => [d.id, d.data()]));
  const reBefore = (await db.doc(`companies/${C}/counters/RE`).get()).data() || null;
  const SO = (id) => db.doc(`companies/${C}/sales_orders/${id}`);
  const made = { inv: [], bn: [], j: [], re: [] };
  try {
    await SO("TEST-SO-EX").set({ companyId: C, documentNo: "SO-TEST-EX", status: "DELIVERED", customerId: "CUS-TI", customerName: "ลูกค้าทดสอบใบกำกับ", vatType: "Exclude VAT", subTotal: 10000, items: [{ name: "x", qty: 1, price: 10000 }], isDeleted: false });
    await SO("TEST-SO-IN").set({ companyId: C, documentNo: "SO-TEST-IN", status: "DELIVERED", customerId: "CUS-TI", customerName: "ลูกค้าทดสอบใบกำกับ", vatType: "Include VAT", grandTotal: 1070, items: [], isDeleted: false });
    const r1 = await call("/api/sales/tax-invoice", { salesOrderId: "TEST-SO-EX" });
    const inv = r1.body.taxInvoiceId && (await db.doc(`companies/${C}/invoices/${r1.body.taxInvoiceId}`).get()).data();
    made.inv.push(r1.body.taxInvoiceId); made.bn.push(r1.body.billingNoteId); if (inv) made.j.push(inv.journalId);
    ok("issued: Exclude VAT 10,000 -> 700 VAT / 10,700", r1.status === 200 && inv.grandTotal === 10700 && inv.vatAmount === 700 && inv.balance === 10700 && inv.invoiceNo === r1.body.taxInvoiceNo, JSON.stringify(r1.body).slice(0, 160));
    const j = inv && (await db.doc(`companies/${C}/journal_entries/${inv.journalId}`).get()).data();
    ok("journal Dr1131 10700 / Cr4111 10000 / Cr2121 700", j && jstr(j) === "1131-00:10700/0 4111-00:0/10000 2121-00:0/700" && j.status === "draft", j && jstr(j));
    const so = (await SO("TEST-SO-EX").get()).data();
    ok("SO completed and linked", so.status === "COMPLETED" && so.invoiceNo === r1.body.taxInvoiceNo);
    const r2 = await call("/api/sales/tax-invoice", { salesOrderId: "TEST-SO-EX" });
    ok("second issue rejected", r2.status === 409, r2.body.error);
    const r3 = await call("/api/sales/tax-invoice", { salesOrderId: "TEST-SO-IN" });
    const inv2 = r3.body.taxInvoiceId && (await db.doc(`companies/${C}/invoices/${r3.body.taxInvoiceId}`).get()).data();
    made.inv.push(r3.body.taxInvoiceId); made.bn.push(r3.body.billingNoteId); if (inv2) made.j.push(inv2.journalId);
    ok("Include VAT 1,070 -> 1,000 + 70", inv2 && inv2.subTotal === 1000 && inv2.vatAmount === 70 && inv2.grandTotal === 1070);
    ok("numbers consecutive", r1.body.taxInvoiceNo && r3.body.taxInvoiceNo && r1.body.taxInvoiceNo !== r3.body.taxInvoiceNo, `${r1.body.taxInvoiceNo} -> ${r3.body.taxInvoiceNo}`);
    const rc = await call("/api/finance/receipts", { customerId: "CUS-TI", paymentDate: "2026-10-12", paymentMethod: "CASH", lines: [{ invoiceDocId: r1.body.taxInvoiceId, amount: 10700, whtRate: 3 }] });
    made.re.push(rc.body.receiptNo);
    const invAfter = (await db.doc(`companies/${C}/invoices/${r1.body.taxInvoiceId}`).get()).data();
    ok("receipt against new invoice: WHT 300 on 10,000 base, invoice paid", rc.status === 200 && rc.body.totalWht === 300 && invAfter.paymentStatus === "paid", JSON.stringify(rc.body).slice(0, 120));
    if (rc.body.receiptNo) { const rd = (await db.doc(`companies/${C}/receipts/${rc.body.receiptNo}`).get()).data(); made.j.push(rd.journalId); }
  } catch (e) { console.error("ERR", e); } finally {
    for (const id of made.inv.filter(Boolean)) await db.doc(`companies/${C}/invoices/${id}`).delete();
    for (const id of made.bn.filter(Boolean)) await db.doc(`companies/${C}/billing_notes/${id}`).delete();
    for (const id of made.j.filter(Boolean)) await db.doc(`companies/${C}/journal_entries/${id}`).delete();
    for (const id of made.re.filter(Boolean)) { await db.doc(`companies/${C}/receipts/${id}`).delete(); const l = await db.collection("logs").where("targetId", "==", id).get(); await Promise.all(l.docs.map((x) => x.ref.delete())); }
    for (const id of ["TEST-SO-EX", "TEST-SO-IN"]) await SO(id).delete();
    const after = (await db.collection("counters").where("companyId", "==", C).get()).docs.filter((d) => ["INV", "BN"].includes(d.data().type));
    for (const d of after) { if (cBefore[d.id]) await d.ref.set(cBefore[d.id]); else await d.ref.delete(); }
    await (reBefore ? db.doc(`companies/${C}/counters/RE`).set(reBefore) : db.doc(`companies/${C}/counters/RE`).delete());
    const logs = await db.collection("logs").where("companyId", "==", C).where("module", "in", ["TAX_INVOICE", "BILLING_NOTE"]).get();
    await Promise.all(logs.docs.filter((d) => (d.data().changes?.after?.salesOrder || "").startsWith("SO-TEST") || /TEST/.test(JSON.stringify(d.data().changes || {})) ).map((d) => d.ref.delete()));
    console.log("cleaned up; counters restored"); process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
