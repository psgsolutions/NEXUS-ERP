// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// D2: ยกเลิกใบกำกับภาษีอย่างเดียว -> บัญชีถูกยกเลิก/กลับรายการ, ใบสั่งขายกลับไปออกใบใหม่ได้
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;

(async () => {
  const s = Date.now(); const U = `test-d2b-${s}`, US = `test-d2s-${s}`; const SO = `TEST-SO-D2B-${s}`;
  await db.doc(`users/${U}`).set({ companyId: C, roles: ["ACCOUNTANT"], role: "ACCOUNTANT", status: "ACTIVE" });
  await db.doc(`users/${US}`).set({ companyId: C, roles: ["SALES"], role: "SALES", status: "ACTIVE" });
  const mk = (uid) => async (url, b) => { const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await tok(uid)) }, body: JSON.stringify({ companyId: C, ...b }) }); return { status: r.status, body: await r.json() }; };
  const acct = mk(U), sales = mk(US);
  const counters = {}; for (const k of ["IV", "BL"]) counters[k] = (await db.doc(`companies/${C}/counters/${k}`).get()).data() || null;
  await db.doc(`companies/${C}/sales_orders/${SO}`).set({ companyId: C, documentNo: SO, status: "DELIVERED", customerName: "TEST ลูกค้า", customerSnapshot: { name: "TEST ลูกค้า" }, vatType: "Exclude VAT", subTotal: 2000, items: [{ name: "TEST", qty: 1, price: 2000 }], isDeleted: false });
  const invIds = [], bnIds = [], journals = [];
  try {
    const a = await acct("/api/sales/tax-invoice", { salesOrderId: SO }); invIds.push(a.body.taxInvoiceId); bnIds.push(a.body.billingNoteId);
    const inv = (await db.doc(`companies/${C}/invoices/${a.body.taxInvoiceId}`).get()).data(); journals.push(inv.journalId);
    const so0 = (await db.doc(`companies/${C}/sales_orders/${SO}`).get()).data();
    ok("SO remembers status before invoicing", so0.status === "COMPLETED" && so0.statusBeforeInvoice === "DELIVERED");
    const sc = await sales("/api/sales/tax-invoice/cancel", { invoiceDocId: a.body.taxInvoiceId, reason: "ทดสอบสิทธิ์" });
    ok("sales staff (no approve) cannot cancel tax invoice", sc.status === 403);
    const c = await acct("/api/sales/tax-invoice/cancel", { invoiceDocId: a.body.taxInvoiceId, reason: "ลูกค้ายกเลิกการสั่งซื้อ" });
    const inv2 = (await db.doc(`companies/${C}/invoices/${a.body.taxInvoiceId}`).get()).data();
    const j = (await db.doc(`companies/${C}/journal_entries/${inv.journalId}`).get()).data();
    const so1 = (await db.doc(`companies/${C}/sales_orders/${SO}`).get()).data();
    const bn = (await db.doc(`companies/${C}/billing_notes/${a.body.billingNoteId}`).get()).data();
    if (inv2.reversalJournalId) journals.push(inv2.reversalJournalId);
    ok("cancel only: invoice cancelled, draft journal voided, BN cancelled", c.status === 200 && c.body.mode === "cancelled" && inv2.status === "cancelled" && inv2.balance === 0 && ["voided", "reversed"].includes(c.body.journal) && (j.status === "voided" || j.status === "cancelled" || !!inv2.reversalJournalId) && bn.status === "cancelled", JSON.stringify([c.body, j.status]));
    ok("SO back to DELIVERED and can be invoiced again", so1.status === "DELIVERED" && !so1.invoiceNo && so1.cancelledInvoices?.includes(a.body.taxInvoiceNo));
    const b = await acct("/api/sales/tax-invoice", { salesOrderId: SO }); invIds.push(b.body.taxInvoiceId); bnIds.push(b.body.billingNoteId);
    const invB = b.body.taxInvoiceId ? (await db.doc(`companies/${C}/invoices/${b.body.taxInvoiceId}`).get()).data() : null; if (invB) journals.push(invB.journalId);
    ok("re-invoice gets the next number (old number not reused)", b.status === 200 && b.body.taxInvoiceNo !== a.body.taxInvoiceNo, JSON.stringify(b.body));
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const id of invIds.filter(Boolean)) await db.doc(`companies/${C}/invoices/${id}`).delete();
    for (const id of bnIds.filter(Boolean)) await db.doc(`companies/${C}/billing_notes/${id}`).delete();
    for (const id of journals.filter(Boolean)) await db.doc(`companies/${C}/journal_entries/${id}`).delete();
    await db.doc(`companies/${C}/sales_orders/${SO}`).delete();
    for (const k of Object.keys(counters)) counters[k] ? await db.doc(`companies/${C}/counters/${k}`).set(counters[k]) : await db.doc(`companies/${C}/counters/${k}`).delete();
    for (const u of [U, US]) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
