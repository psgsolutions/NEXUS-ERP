// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// งานให้ตรงโครงสร้างจริง (P1–P4): สิทธิ์วิศวกร/แอดมินการเงิน, วงเงินอนุมัติใบเสนอราคา, โปรไฟล์เอกสารลูกค้า,
// ใบวางบิลเว้นวันที่+เอกสารแนบ, สัญญา/หลักประกัน, แจ้งเตือนรอบวางบิลและสัญญา (cron), ขอซื้อตาม BOQ
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const G = C; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY; const S = process.env.CRON_SECRET;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

(async () => {
  const s = Date.now(); const T = String(s).slice(-9); const M = `TEST-FIT-${s}`;
  const today = new Date(s + 7 * 3600e3).toISOString().slice(0, 10);
  const U = { eng: `test-fit-e-${s}`, fin: `test-fit-f-${s}`, exe: `test-fit-x-${s}` };
  const ROLES = { eng: ["ENGINEER"], fin: ["ACCOUNTANT", "PURCHASING"], exe: ["EXECUTIVE"] };
  for (const [k, uid] of Object.entries(U)) await db.doc(`users/${uid}`).set({ companyId: C, roles: ROLES[k], role: ROLES[k][0], status: "ACTIVE", onboarding: { welcomed: true } });
  const toks = {}; for (const [k, uid] of Object.entries(U)) toks[k] = await tok(uid);
  const call = (who, url, b) => fetch(E2E_BASE + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + toks[who] }, body: JSON.stringify({ companyId: C, ...b }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const made = { customer: "", quotations: [], project: `${M}-PRJ`, bn: `${M}-BN`, inv: `${M}-IV`, prs: [], advances: [] };
  try {
    // ---- โปรไฟล์เอกสารลูกค้า ----
    const cust = await call("eng", "/api/master-data", { action: "create", entity: "customers", data: { name: `${M} กรมทดสอบ`, taxId: `0994${T}` } });
    made.customer = cust.body.id;
    ok("engineer creates customer", cust.status === 200, JSON.stringify(cust.body));
    const billDay = Number(addDays(today, 1).slice(8));
    const prof = await call("eng", "/api/master-data", { action: "update", entity: "customers", id: made.customer, scope: "group", changes: { docProfile: { orgType: "GOV", billingDay: billDay, attachments: ["ใบส่งของ", "หนังสือส่งมอบงาน"], notes: { billingNote: "อ้างอิงใบสั่งจ้าง TEST" }, evil: 1 } } });
    const local = (await db.doc(`companies/${C}/customers/${made.customer}`).get()).data();
    ok("profile saved per company, normalized, stamped", prof.status === 200 && local.docProfile?.orgType === "GOV" && local.docProfile.billingDay === billDay && !("evil" in local.docProfile) && !!local.docProfile.updatedBy, JSON.stringify(local?.docProfile));
    const finProf = await call("fin", "/api/master-data", { action: "update", entity: "customers", id: made.customer, changes: { docProfile: { ...local.docProfile, paymentDay: 5 } } });
    const finName = await call("fin", "/api/master-data", { action: "update", entity: "customers", id: made.customer, changes: { name: "แก้ชื่อ" } });
    ok("finance admin may edit only the document profile", finProf.status === 200 && finName.status === 403, JSON.stringify([finProf.body, finName.body]));

    // ---- วงเงินอนุมัติใบเสนอราคา ----
    const quote = (who, price, extra = {}) => call(who, "/api/quotations/create", { submit: true, ...extra, header: { customerId: made.customer, customerName: `${M} กรมทดสอบ`, projectName: M, taxType: "EXCLUSIVE", grandTotal: 100, docDiscountAmount: 0 }, lines: [{ itemType: "PRODUCT", productName: `${M} อุปกรณ์`, qty: 1, unitPrice: price, costPrice: price * 0.5, uom: "ชุด" }] });
    const big = await quote("eng", 1_000_000); // ยอดจริง 1,070,000 แต่หน้าจอส่ง grandTotal 100
    if (big.body.quotationId || big.body.id) made.quotations.push(big.body.quotationId || big.body.id);
    const bigId = made.quotations[0];
    const bigDoc = bigId ? (await db.doc(`companies/${C}/quotations/${bigId}`).get()).data() : null;
    ok("engineer quote over 1M (even with forged total) waits for approval", big.status === 200 && bigDoc?.status === "PENDING_APPROVAL", JSON.stringify(big.body));
    const engApprove = await call("eng", `/api/quotations/${bigId}/approval`, { decision: "approve" });
    const exeApprove = await call("exe", `/api/quotations/${bigId}/approval`, { decision: "approve" });
    ok("engineer cannot approve it, executive can", engApprove.status === 403 && /เกินวงเงิน/.test(engApprove.body.error || "") && exeApprove.status === 200 && exeApprove.body.status === "SENT", JSON.stringify([engApprove.body, exeApprove.body]));
    const small = await quote("eng", 500_000, { requiresApproval: true });
    const smallId = small.body.quotationId || small.body.id; if (smallId) made.quotations.push(smallId);
    const engSmall = await call("eng", `/api/quotations/${smallId}/approval`, { decision: "approve" });
    ok("engineer approves quotation within 1M", engSmall.status === 200 && engSmall.body.status === "SENT", JSON.stringify(engSmall.body));

    // ---- วิศวกรวางบิล/รับเงินไม่ได้ ----
    const ti = await call("eng", "/api/sales/tax-invoice", { salesOrderId: "none" });
    const rc = await call("eng", "/api/finance/receipts", { customerId: made.customer, lines: [{ invoiceDocId: "x", amount: 1 }] });
    ok("engineer cannot issue tax invoices or receipts", ti.status === 403 && rc.status === 403, JSON.stringify([ti.status, rc.status]));

    // ---- ใบวางบิลตามโปรไฟล์ลูกค้า ----
    await db.doc(`companies/${C}/invoices/${made.inv}`).set({ companyId: C, invoiceNo: made.inv, customerId: made.customer, customerName: `${M} กรมทดสอบ`, grandTotal: 107000, balance: 107000, paymentStatus: "unpaid", issueDate: today, dueDate: addDays(today, 30), status: "issued", isDeleted: false });
    await db.doc(`companies/${C}/billing_notes/${made.bn}`).set({ companyId: C, billingNoteNo: made.bn, customerId: made.customer, customerName: `${M} กรมทดสอบ`, invoiceRefNo: made.inv, totalAmount: 107000, issueDate: today, dueDate: addDays(today, 30), isDeleted: false });
    const bnJson = await call("fin", "/api/documents/pdf", { type: "billing_note", id: made.bn, format: "json" });
    const bnDated = await call("fin", "/api/documents/pdf", { type: "billing_note", id: made.bn, format: "json", dateMode: "dated" });
    const notes = (bnJson.body.document?.notes || []).join(" | ");
    ok("government billing note: undated, customer note + attachment list; can print dated", bnJson.body.document?.date === "" && notes.includes("อ้างอิงใบสั่งจ้าง TEST") && notes.includes("เอกสารแนบ: ใบส่งของ, หนังสือส่งมอบงาน") && bnDated.body.document?.date === today && bnJson.body.document?.dateOption?.profileUndated === true, JSON.stringify([bnJson.body.document?.date, notes, bnDated.body.document?.date]));

    // ---- สัญญา / หลักประกัน ----
    await db.doc(`companies/${C}/projects/${made.project}`).set({ companyId: C, projectCode: made.project, projectName: `${M} โครงการ`, customerName: `${M} กรมทดสอบ`, sectorType: "Government", status: "In Progress", warrantyMonths: 24, budgetSummary: { grandTotalWithVat: 1_070_000 }, isDeleted: false });
    const ct = await call("eng", "/api/projects/contract", { projectDocId: made.project, contract: { contractNo: "TEST-12/2569", dueDate: addDays(today, 3), penaltyRatePct: 0.1, guarantees: [{ type: "PERFORMANCE", expiryDate: addDays(today, 10), number: "TEST-LG" }] } });
    const ctDoc = (await db.doc(`companies/${C}/projects/${made.project}`).get()).data().contract;
    ok("contract saved: e-bidding suggested, 5% guarantee, warranty from project", ct.status === 200 && ctDoc.method === "EBIDDING" && ctDoc.guarantees[0].amount === 53500 && ctDoc.warrantyMonths === 24 && ctDoc.contractValue === 1_070_000, JSON.stringify(ct.body));
    const badCt = await call("eng", "/api/projects/contract", { projectDocId: made.project, contract: { startDate: today, dueDate: addDays(today, -1) } });
    ok("due date before start rejected", badCt.status === 400);

    // ---- แจ้งเตือนประจำวัน ----
    const cron = await fetch(`${E2E_BASE}/api/cron/daily?today=${today}&company=${C}&email=0`, { headers: { Authorization: `Bearer ${S}` } }).then((r) => r.json());
    const bill = await db.doc(`companies/${C}/notifications/CUSTREM-billing-${made.customer}-${addDays(today, 1)}`).get();
    const due = await db.doc(`companies/${C}/notifications/CTREM-${made.project}-due-${addDays(today, 3)}`).get();
    const gexp = (await db.collection(`companies/${C}/notifications`).where("targetDocId", "==", made.project).get()).docs.filter((d) => d.id.includes("-gexp-"));
    ok("cron: billing-day reminder with attachments, delivery due, guarantee expiry", cron.success && bill.exists && /แนบ: ใบส่งของ/.test(bill.data().message) && due.exists && gexp.length === 1, JSON.stringify({ cron: cron.billing || cron, bill: bill.data()?.message, due: due.exists, gexp: gexp.length }));

    // ---- ขอซื้อตาม BOQ ----
    const pr = await call("eng", "/api/procurement/purchase-requests", { action: "create", header: { requester: "TEST", department: "โครงการ", requestDate: today, requiredDate: today, priority: "NORMAL", projectId: made.project, projectName: `${M} โครงการ`, reason: `ขอซื้อตาม BOQ ${M}` }, items: [{ name: `${M} สาย LAN`, qty: 10, unit: "เส้น", price: 100, cost: 100 }] });
    const prDoc = pr.body.prCode ? (await db.collection(`companies/${C}/purchase_requests`).where("prCode", "==", pr.body.prCode).get()).docs[0] : null;
    if (prDoc) made.prs.push(prDoc.ref);
    ok("engineer creates PR linked to project; cannot create PO", pr.status === 200 && prDoc?.data().projectId === made.project, JSON.stringify(pr.body));
    const po = await call("eng", "/api/procurement/purchase-orders", { action: "create", header: {}, items: [] });
    ok("engineer cannot create purchase orders", po.status === 403, String(po.status));

    // ---- เงินทดรองจ่าย ----
    const adv = await call("eng", "/api/finance/cash-advances", { action: "request", amount: 2000, purpose: `${M} ซื้ออุปกรณ์หน้างาน`, projectId: made.project, requesterName: "TEST วิศวกร" });
    if (adv.body.advanceNo) made.advances.push(adv.body.advanceNo);
    const engPay = await call("eng", "/api/finance/cash-advances", { action: "pay", id: adv.body.advanceNo, method: "CASH" });
    const finPay = await call("fin", "/api/finance/cash-advances", { action: "pay", id: adv.body.advanceNo, method: "CASH", paymentDate: today });
    ok("engineer requests advance, only finance pays", adv.status === 200 && engPay.status === 403 && finPay.status === 200, JSON.stringify([adv.body, engPay.status, finPay.body]));
    const clr = await call("eng", "/api/finance/cash-advances", { action: "clear", id: adv.body.advanceNo, clearDate: today, items: [{ description: "สายไฟ", amount: 1070, vat: 70, taxInvoiceNo: "TEST-IV" }, { description: "น้ำมัน", amount: 500, vat: 0 }] });
    const advJ = (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", adv.body.advanceNo || "-").get()).docs.map((d) => d.data());
    const clearJ = advJ.find((j) => j.bookType === "JV");
    const line = (code) => clearJ?.items.find((l) => l.accountCode === code);
    ok("clearing: WIP 1,500 to project, input VAT 70, refund 430, credit advance 2,000", clr.status === 200 && clr.body.difference === 430 && advJ.length === 2 && line("1161-00")?.debit === 1500 && line("1151-00")?.debit === 70 && line("1111-00")?.debit === 430 && line("1134-00")?.credit === 2000 && clearJ.projectId === made.project, JSON.stringify({ clr: clr.body, items: clearJ?.items }));
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    const del = async (q) => { for (const d of (await q.get()).docs) await d.ref.delete(); };
    for (const id of made.quotations) { for (const sub of ["lines", "audit_logs"]) await del(db.collection(`companies/${C}/quotations/${id}/${sub}`)); await db.doc(`companies/${C}/quotations/${id}`).delete(); }
    for (const r of made.prs) await r.delete();
    for (const no of made.advances) { await del(db.collection(`companies/${C}/journal_entries`).where("reference", "==", no)); await db.doc(`companies/${C}/cash_advances/${no}`).delete(); }
    await db.doc(`companies/${C}/billing_notes/${made.bn}`).delete(); await db.doc(`companies/${C}/invoices/${made.inv}`).delete(); await db.doc(`companies/${C}/projects/${made.project}`).delete();
    const notes = (await db.collection(`companies/${C}/notifications`).get()).docs.filter((d) => { const x = d.data(); return [made.customer, made.project, made.inv, ...made.quotations].some((id) => id && (d.id.includes(id) || String(x.link || "").includes(id) || x.targetDocId === id)); });
    for (const d of notes) await d.ref.delete();
    if (made.customer) {
      await del(db.collection(`groups/${G}/customers/${made.customer}/history`));
      await db.doc(`groups/${G}/customers/${made.customer}`).delete(); await db.doc(`companies/${C}/customers/${made.customer}`).delete();
      for (const d of (await db.collection(`groups/${G}/unique_keys`).get()).docs) if (d.data().id === made.customer) await d.ref.delete();
    }
    for (const uid of Object.values(U)) { await db.doc(`users/${uid}`).delete(); await admin.auth().deleteUser(uid).catch(() => {}); }
    console.log(`cleaned ${notes.length} notifications`);
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
