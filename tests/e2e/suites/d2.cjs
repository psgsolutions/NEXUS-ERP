// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// D2: เอกสารภาษี — เลขชุดใหม่, ข้อมูลผู้ขาย ณ วันออก, PDF ทุกประเภท, ยกเลิก/ออกใบแทน, POS ออกเลขในทรานแซกชัน
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

(async () => {
  const s = Date.now(); const U = `test-d2-${s}`; const SO = `TEST-SO-D2-${s}`; const PRD = `TEST-D2P-${s}`;
  await db.doc(`users/${U}`).set({ companyId: C, roles: ["SALES", "ACCOUNTANT", "EXECUTIVE"], role: "ACCOUNTANT", status: "ACTIVE" });
  const t = await tok(U);
  const call = async (url, b) => { const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ companyId: C, ...b }) }); const ct = r.headers.get("content-type") || ""; return { status: r.status, body: ct.includes("json") ? await r.json() : { pdfBytes: (await r.arrayBuffer()).byteLength, ct } }; };
  const doc = (type, id) => call("/api/documents/pdf", { type, id, format: "json" });
  const pdf = (type, id) => call("/api/documents/pdf", { type, id });
  const KEYS = ["IV", "BL", "CN", "DBN", "RE", "POS"];
  const counters = {}; for (const k of KEYS) counters[k] = (await db.doc(`companies/${C}/counters/${k}`).get()).data() || null;
  await db.doc(`companies/${C}/sales_orders/${SO}`).set({ companyId: C, documentNo: SO, status: "DELIVERED", customerId: "CUS-D2", customerName: "TEST ผู้ซื้อ เดิม", customerSnapshot: { name: "TEST ผู้ซื้อ เดิม", taxId: "0105555000111", branch: "00000", address: "ที่อยู่เดิม" }, vatType: "Exclude VAT", subTotal: 10000, grandTotal: 10700, paymentTermDays: 30, items: [{ name: "TEST ค่าติดตั้งระบบ", qty: 2, unit: "งาน", price: 5000 }], isDeleted: false });
  await db.doc(`products/${PRD}`).set({ companyId: C, name: "TEST สินค้า D2", sku: PRD, itemType: "PRODUCT", pricing: { pricePOS: 100, costWAC: 50 }, stockStatus: { onHand: 5, reserved: 0, available: 5 } });
  const made = { inv: [], bn: [], cn: [], re: [], pos: [] };
  try {
    const iv = await call("/api/sales/tax-invoice", { salesOrderId: SO });
    made.inv.push(iv.body.taxInvoiceId); made.bn.push(iv.body.billingNoteId);
    const inv1 = (await db.doc(`companies/${C}/invoices/${iv.body.taxInvoiceId}`).get()).data();
    ok("tax invoice uses IV series + seller snapshot", iv.status === 200 && /^IV-/.test(iv.body.taxInvoiceNo) && /^BL-/.test(iv.body.billingNoteNo) && inv1.sellerSnapshot?.taxId?.length === 13 && !inv1.sellerSnapshot.logo, JSON.stringify(iv.body));
    const d1 = await doc("invoice", iv.body.taxInvoiceId);
    const m1 = d1.body.document;
    ok("invoice model: ม.86/4 title, seller/buyer tax IDs, VAT row", m1?.title === "ใบกำกับภาษี / ใบแจ้งหนี้" && m1.seller.taxId.length === 13 && m1.party.taxId === "0105555000111" && m1.totals.some((r) => r.label === "ภาษีมูลค่าเพิ่ม 7%" && r.amount === 700) && m1.totals.find((r) => r.strong).amount === 10700, JSON.stringify(m1 && m1.totals));
    const p1 = await pdf("invoice", iv.body.taxInvoiceId);
    ok("invoice PDF renders", p1.status === 200 && p1.body.pdfBytes > 5000, JSON.stringify(p1.body));
    const pb = await pdf("billing_note", iv.body.billingNoteId);
    ok("billing note PDF renders", pb.status === 200 && pb.body.pdfBytes > 5000);

    // ยกเลิกและออกใบแทน (แก้ข้อมูลผู้ซื้อ)
    const bad = await call("/api/sales/tax-invoice/cancel", { invoiceDocId: iv.body.taxInvoiceId, reason: "x" });
    ok("cancel needs reason", bad.status === 400);
    const rp = await call("/api/sales/tax-invoice/cancel", { invoiceDocId: iv.body.taxInvoiceId, reason: "ชื่อผู้ซื้อไม่ถูกต้อง", replace: true, customer: { name: "TEST ผู้ซื้อ ใหม่ จำกัด", taxId: "0105555000222", branch: "00001", address: "ที่อยู่ใหม่" } });
    if (rp.body.newInvoiceDocId) made.inv.push(rp.body.newInvoiceDocId);
    const old = (await db.doc(`companies/${C}/invoices/${iv.body.taxInvoiceId}`).get()).data();
    const nw = rp.body.newInvoiceDocId ? (await db.doc(`companies/${C}/invoices/${rp.body.newInvoiceDocId}`).get()).data() : {};
    const so1 = (await db.doc(`companies/${C}/sales_orders/${SO}`).get()).data();
    const j = (await db.doc(`companies/${C}/journal_entries/${inv1.journalId}`).get()).data();
    ok("replace: old cancelled, new same date/amount, buyer corrected, journal moved", rp.status === 200 && old.status === "cancelled" && old.replacedByNo === rp.body.newInvoiceNo && nw.replacesInvoiceNo === iv.body.taxInvoiceNo && nw.issueDate === inv1.issueDate && nw.grandTotal === 10700 && nw.customerSnapshot.taxId === "0105555000222" && nw.journalId === inv1.journalId && j.reference === rp.body.newInvoiceNo && so1.invoiceNo === rp.body.newInvoiceNo, JSON.stringify(rp.body));
    const bns = (await db.collection(`companies/${C}/billing_notes`).where("invoiceDocId", "in", [iv.body.taxInvoiceId, rp.body.newInvoiceDocId]).get()).docs.map((d) => { made.bn.push(d.id); return d.data(); });
    ok("old billing note cancelled, new one issued", bns.some((b) => b.status === "cancelled") && bns.some((b) => b.status === "issued" && b.invoiceRefNo === rp.body.newInvoiceNo));
    const dn = await doc("invoice", rp.body.newInvoiceDocId); const dold = await doc("invoice", iv.body.taxInvoiceId);
    ok("PDFs: new shows 'ออกแทน', old has cancelled watermark", dn.body.document.notes.some((n) => n.includes(`ออกแทนฉบับเดิมเลขที่ ${iv.body.taxInvoiceNo}`)) && dn.body.document.party.branchCode === "00001" && dold.body.document.watermark === "ยกเลิก", JSON.stringify([dn.body.document.notes, dold.body.document.watermark]));
    const again = await call("/api/sales/tax-invoice/cancel", { invoiceDocId: iv.body.taxInvoiceId, reason: "ซ้ำซ้ำ" });
    ok("cannot cancel twice", again.status === 409);

    // ลดหนี้บนใบใหม่ -> ใบนั้นยกเลิกไม่ได้
    const cn = await call("/api/sales/cndn", { type: "CN", invoiceDocId: rp.body.newInvoiceDocId, amount: 1000, reason: "ลดราคาสินค้า/บริการ" });
    if (cn.body.id) made.cn.push(cn.body.id);
    const dc = await doc("cndn", cn.body.id);
    ok("credit note: CN series + ม.86/10 fields", cn.status === 200 && /^CN-/.test(cn.body.docNo) && dc.body.document.title === "ใบลดหนี้" && dc.body.document.totals.some((r) => r.label === "มูลค่าที่ถูกต้อง" && r.amount === 9000) && dc.body.document.meta[0].value === rp.body.newInvoiceNo, JSON.stringify(cn.body));
    const blocked = await call("/api/sales/tax-invoice/cancel", { invoiceDocId: rp.body.newInvoiceDocId, reason: "ทดสอบยกเลิก" });
    ok("invoice with credit note cannot be cancelled", blocked.status === 409 && /ใบลดหนี้/.test(blocked.body.error), JSON.stringify(blocked.body));

    // ใบเสร็จ
    const re = await call("/api/finance/receipts", { customerId: "CUS-D2", paymentDate: today, paymentMethod: "CASH", lines: [{ invoiceDocId: rp.body.newInvoiceDocId, amount: 1000, whtRate: 0 }] });
    if (re.body.receiptNo) made.re.push(re.body.receiptNo);
    const dr = await doc("receipt", re.body.receiptNo);
    ok("receipt PDF model: payer from invoice snapshot, seller snapshot", re.status === 200 && dr.body.document?.party.name === "TEST ผู้ซื้อ ใหม่ จำกัด" && dr.body.document.lines[0].description.includes(rp.body.newInvoiceNo) && (await db.doc(`companies/${C}/receipts/${re.body.receiptNo}`).get()).data().sellerSnapshot?.name, JSON.stringify(re.body));

    // POS ออกเลขในทรานแซกชัน
    const ps = await call("/api/pos/checkout", { items: [{ id: PRD, qty: 2 }], paymentMethod: "CASH", cashReceived: 500 });
    if (ps.body.transactionNo) made.pos.push(ps.body.transactionNo);
    const tx = ps.body.transactionNo ? (await db.doc(`companies/${C}/sales_transactions/${ps.body.transactionNo}`).get()).data() : null;
    const mv = ps.body.transactionNo ? await db.collection(`companies/${C}/stock_movements`).where("referenceId", "==", ps.body.transactionNo).get() : { size: 0 };
    ok("POS: number from POS series, movements reference it, seller snapshot", ps.status === 200 && /^POS-/.test(ps.body.transactionNo) && tx?.sellerSnapshot?.taxId && mv.size === 1, JSON.stringify(ps.body).slice(0, 200));
    const posCounter = (await db.doc(`companies/${C}/counters/POS`).get()).data();
    const over = await call("/api/pos/checkout", { items: [{ id: PRD, qty: 99 }], paymentMethod: "CASH", cashReceived: 99999 });
    const posCounter2 = (await db.doc(`companies/${C}/counters/POS`).get()).data();
    ok("failed POS sale does not consume a number", over.status === 500 && posCounter2.lastSeq === posCounter.lastSeq, JSON.stringify([over.body, posCounter, posCounter2]));
    const dp = await pdf("pos", ps.body.transactionNo);
    ok("POS A4 receipt PDF renders", dp.status === 200 && dp.body.pdfBytes > 5000);
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    const refs = new Set();
    for (const id of made.inv) { const d = (await db.doc(`companies/${C}/invoices/${id}`).get()).data(); if (d) { refs.add(d.invoiceNo); if (d.journalId) await db.doc(`companies/${C}/journal_entries/${d.journalId}`).delete(); if (d.reversalJournalId) await db.doc(`companies/${C}/journal_entries/${d.reversalJournalId}`).delete(); } await db.doc(`companies/${C}/invoices/${id}`).delete(); }
    for (const id of made.bn) await db.doc(`companies/${C}/billing_notes/${id}`).delete();
    for (const id of made.cn) { const d = (await db.doc(`companies/${C}/cndn/${id}`).get()).data(); if (d?.journalId) await db.doc(`companies/${C}/journal_entries/${d.journalId}`).delete(); await db.doc(`companies/${C}/cndn/${id}`).delete(); }
    for (const no of made.re) { const d = (await db.doc(`companies/${C}/receipts/${no}`).get()).data(); if (d?.journalId) await db.doc(`companies/${C}/journal_entries/${d.journalId}`).delete(); await db.doc(`companies/${C}/receipts/${no}`).delete(); }
    for (const no of made.pos) { await db.doc(`companies/${C}/sales_transactions/${no}`).delete(); for (const col of ["stock_movements", "journal_entries"]) { const q = await db.collection(`companies/${C}/${col}`).where(col === "stock_movements" ? "referenceId" : "reference", "==", no).get(); for (const d of q.docs) await d.ref.delete(); } }
    for (const r of refs) { const q = await db.collection(`companies/${C}/journal_entries`).where("reference", "==", r).get(); for (const d of q.docs) await d.ref.delete(); }
    await db.doc(`companies/${C}/sales_orders/${SO}`).delete(); await db.doc(`products/${PRD}`).delete();
    for (const k of KEYS) counters[k] ? await db.doc(`companies/${C}/counters/${k}`).set(counters[k]) : await db.doc(`companies/${C}/counters/${k}`).delete();
    await db.doc(`users/${U}`).delete(); await admin.auth().deleteUser(U).catch(() => {});
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
