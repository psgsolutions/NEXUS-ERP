// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
const path = require("path"); const root = E2E_ROOT;
require("@next/env").loadEnvConfig(root);
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10)) }) });
const db = admin.firestore(); const C = "COM-NEXUS-01";
let fails = 0;
const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const tokenFor = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const mk = (tok) => (url, body) => fetch(`${E2E_BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ companyId: C, ...body }) }).then(async (x) => ({ status: x.status, body: await x.json() }));
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const P = (c, id) => db.doc(`companies/${C}/${c}/${id}`);
const get = async (c, id) => (await P(c, id).get()).data();

(async () => {
  const adminUser = (await db.collection("users").where("companyId", "==", C).where("role", "==", "ADMIN").limit(1).get()).docs[0];
  const supplier = (await db.collection("suppliers").where("companyId", "==", C).limit(1).get()).docs[0];
  const employee = (await db.collection("employees").where("companyId", "==", C).limit(1).get()).docs[0];
  const customer = (await db.collection(`companies/${C}/customers`).limit(20).get()).docs.find((d) => !(Number(d.data().creditLimit) > 0));
  if (!adminUser || !supplier || !employee || !customer) throw new Error("missing seed data");

  const stamp = Date.now();
  const temp = { sales: `test-sales-${stamp}`, tech: `test-tech-${stamp}`, tech2: `test-tech2-${stamp}` };
  await db.doc(`users/${temp.sales}`).set({ companyId: C, role: "SALES", name: "TEST SALES", status: "ACTIVE" });
  await db.doc(`users/${temp.tech}`).set({ companyId: C, role: "TECHNICIAN", name: "TEST TECH", status: "ACTIVE" });
  await db.doc(`users/${temp.tech2}`).set({ companyId: C, role: "TECHNICIAN", name: "TEST TECH2", status: "ACTIVE" });
  const call = mk(await tokenFor(adminUser.id));
  const callSales = mk(await tokenFor(temp.sales));
  const callTech = mk(await tokenFor(temp.tech));
  const callTech2 = mk(await tokenFor(temp.tech2));

  // เลขเอกสารที่จะถูกใช้ระหว่างทดสอบ -> คืนค่าหลังจบ
  const counterIds = ["PR", "PO", "EXP", "WHT", "SO", "WO", "INV"];
  const counters = {};
  for (const id of counterIds) counters[id] = (await db.doc(`companies/${C}/counters/${id}`).get()).data() || null;

  const made = []; // [collection, id]
  const product = db.collection("products").doc(`TEST-PROD-${stamp}`);
  const line = (qty, price, extra = {}) => ({ description: "TEST รายการ", name: "TEST รายการ", qty, unit: "ชิ้น", price, ...extra });

  try {
    // ---------- ใบขอซื้อ ----------
    const pr = await call("/api/procurement/purchase-requests", { action: "create", items: [line(2, 1000)], header: { requester: "TEST", requiredDate: today, reason: "TEST phase2", vatMode: "exclusive" } });
    const prId = pr.body.prCode; if (prId) made.push(["purchase_requests", prId]);
    ok("PR create", pr.status === 200 && !!prId, JSON.stringify(pr.body));
    const prDoc = await get("purchase_requests", prId);
    ok("PR totals on server + pending", prDoc?.status === "PENDING_APPROVAL" && Number(prDoc?.grandTotal ?? prDoc?.totalAmount) === 2140, JSON.stringify({ st: prDoc?.status, g: prDoc?.grandTotal, t: prDoc?.totalAmount }));
    const selfAp = await call("/api/procurement/purchase-requests", { action: "approve", prId });
    ok("PR self-approve blocked", selfAp.status === 403, selfAp.body.error);
    await P("purchase_requests", prId).update({ createdBy: "someone-else", requesterUid: "someone-else" });
    const salesAp = await callSales("/api/procurement/purchase-requests", { action: "approve", prId });
    ok("SALES cannot approve PR", salesAp.status === 403, salesAp.body.error);
    const ap = await call("/api/procurement/purchase-requests", { action: "approve", prId });
    ok("PR approve", ap.status === 200 && (await get("purchase_requests", prId)).status === "APPROVED", JSON.stringify(ap.body));

    // ---------- ใบสั่งซื้อ ----------
    const poBody = { action: "create", prId, items: [line(2, 1000, { productId: `TEST-NOPROD-${stamp}` })], header: { orderType: "STOCK", supplierId: supplier.id, date: today, vatType: "exclusive", currency: "THB", exchangeRate: 1 } };
    const po = await call("/api/procurement/purchase-orders", poBody);
    const poId = po.body.poCode; if (poId) made.push(["purchase_orders", poId]);
    ok("PO create from PR", po.status === 200 && !!poId, JSON.stringify(po.body));
    ok("PR converted", (await get("purchase_requests", prId)).status === "CONVERTED");
    const po2 = await call("/api/procurement/purchase-orders", poBody);
    if (po2.body.poCode) made.push(["purchase_orders", po2.body.poCode]);
    ok("PR cannot convert twice", po2.status === 409, JSON.stringify(po2.body));

    // ---------- รับสินค้า: อัปเดตใบสั่งซื้อที่ server ----------
    const gr = (qty) => call("/api/inventory/goods-receipt", { poRef: poId, poDocPath: `companies/${C}/purchase_orders/${poId}`, receiptDate: today, items: [{ productId: `TEST-NOPROD-${stamp}`, qtyReceived: qty, unitPrice: 1000, poLineIndex: 0 }] });
    const g1 = await gr(1);
    ok("GR blocked on unapproved PO", g1.status >= 400 && /ยังไม่อนุมัติ/.test(g1.body.error), JSON.stringify(g1.body));
    const poAp = await call("/api/procurement/purchase-orders", { action: "approve", poId });
    ok("PO approve", poAp.status === 200 && (await get("purchase_orders", poId)).status === "Approved", JSON.stringify(poAp.body));
    const g2 = await gr(5);
    ok("GR over-receive blocked", g2.status >= 400 && /เกินจำนวนคงค้าง/.test(g2.body.error), JSON.stringify(g2.body));
    const g3 = await gr(1);
    const poAfter = await get("purchase_orders", poId);
    ok("GR failure leaves PO untouched", g3.status >= 400 && poAfter.status === "Approved" && !(Number(poAfter.items?.[0]?.qtyReceived) > 0), JSON.stringify({ s: g3.status, e: g3.body.error, st: poAfter.status }));
    const badPath = await call("/api/inventory/goods-receipt", { poDocPath: `companies/OTHER/purchase_orders/${poId}`, items: [{ productId: "x", qtyReceived: 1, unitPrice: 1 }] });
    ok("GR rejects other company PO path", badPath.status === 400, JSON.stringify(badPath.body));

    // ---------- ตั้งเบิกจากใบสั่งซื้อ + หนังสือรับรอง ----------
    const ex = await call("/api/finance/expenses", { action: "fromPO", poId });
    const expId = ex.body.expenseId; if (expId) made.push(["expenses", expId]);
    ok("expense from PO", ex.status === 200 && !!expId && (await get("purchase_orders", poId)).expenseId === expId, JSON.stringify(ex.body));
    const ex2 = await call("/api/finance/expenses", { action: "fromPO", poId });
    ok("expense from PO twice blocked", ex2.status === 409, JSON.stringify(ex2.body));
    const delPo1 = await call("/api/documents/delete", { kind: "purchase_order", id: poId });
    ok("delete PO with expense blocked", delPo1.status === 409, JSON.stringify(delPo1.body));
    const whtOver = await call("/api/finance/wht-certificates", { expenseId: expId, whtRate: 3, baseAmount: 999999 });
    ok("WHT base over pre-VAT blocked", whtOver.status === 400, JSON.stringify(whtOver.body));
    const wht = await call("/api/finance/wht-certificates", { expenseId: expId, whtRate: 3 });
    const whtId = wht.body.whtId; if (whtId) made.push(["withholding_taxes", whtId]);
    ok("WHT issue (3% of 2,000 = 60)", wht.status === 200 && wht.body.whtAmount === 60, JSON.stringify(wht.body));
    const wht2 = await call("/api/finance/wht-certificates", { expenseId: expId, whtRate: 3 });
    ok("WHT twice blocked", wht2.status === 409, JSON.stringify(wht2.body));
    const delExp1 = await call("/api/documents/delete", { kind: "expense", id: expId });
    ok("delete expense with WHT blocked", delExp1.status === 409, JSON.stringify(delExp1.body));
    const salesDel = await callSales("/api/documents/delete", { kind: "wht", id: whtId });
    ok("SALES cannot delete", salesDel.status === 403, JSON.stringify(salesDel.body));
    const delWht = await call("/api/documents/delete", { kind: "wht", id: whtId });
    const whtAfter = (await P("withholding_taxes", whtId).get()).data();
    ok("cancel WHT (kept, Cancelled) clears expense link", delWht.status === 200 && whtAfter?.status === "Cancelled" && !(await get("expenses", expId)).whtId, JSON.stringify(delWht.body));
    await P("expenses", expId).update({ paidAmount: 100 });
    const delExpPaid = await call("/api/documents/delete", { kind: "expense", id: expId });
    ok("delete paid expense blocked", delExpPaid.status === 409, JSON.stringify(delExpPaid.body));
    await P("expenses", expId).update({ paidAmount: 0 });
    const delExp = await call("/api/documents/delete", { kind: "expense", id: expId });
    ok("delete expense clears PO link", delExp.status === 200 && !(await get("purchase_orders", poId)).expenseId, JSON.stringify(delExp.body));
    const delPo = await call("/api/documents/delete", { kind: "purchase_order", id: poId });
    const prBack = await get("purchase_requests", prId);
    ok("delete PO reverts PR to APPROVED", delPo.status === 200 && prBack.status === "APPROVED" && !prBack.poCode, JSON.stringify({ d: delPo.body, pr: prBack.status }));

    // ---------- เบิกค่าใช้จ่ายพนักงาน ----------
    const claim = await call("/api/finance/expenses", { action: "claim", employeeId: employee.id, expenseAccountCode: "5300-00", description: "TEST claim", hasVat: true, subtotal: 100 });
    if (claim.body.expenseId) made.push(["expenses", claim.body.expenseId]);
    const cd = claim.body.expenseId ? await get("expenses", claim.body.expenseId) : null;
    ok("expense claim with VAT", claim.status === 200 && Number(cd?.totalAmount) === 107, JSON.stringify({ b: claim.body, t: cd?.totalAmount }));

    // ---------- ใบสั่งขาย ----------
    const soCreate = (status) => call("/api/sales/orders", { status, items: [line(1, 500)], header: { customerId: customer.id, docDate: today, vatType: "Exclude VAT", paymentTermDays: 30, billingAddress: "TEST" } });
    const so1 = await soCreate("Draft");
    const so1Id = so1.body.soId; if (so1Id) made.push(["sales_orders", so1Id]);
    ok("SO create draft (totals 535)", so1.status === 200 && Number((await get("sales_orders", so1Id))?.grandTotal) === 535, JSON.stringify(so1.body));
    const dlvDraft = await call("/api/sales/orders/status", { soId: so1Id, action: "deliver" });
    ok("deliver draft blocked", dlvDraft.status === 409, JSON.stringify(dlvDraft.body));
    const conf = await callSales("/api/sales/orders/status", { soId: so1Id, action: "confirm" });
    ok("SALES confirms SO", conf.status === 200 && (await get("sales_orders", so1Id)).status === "Confirmed", JSON.stringify(conf.body));
    const delConfirmed = await call("/api/documents/delete", { kind: "sales_order", id: so1Id });
    ok("delete confirmed SO blocked", delConfirmed.status === 409, JSON.stringify(delConfirmed.body));
    const cancel = await call("/api/sales/orders/status", { soId: so1Id, action: "cancel" });
    ok("cancel SO", cancel.status === 200 && (await get("sales_orders", so1Id)).status === "CANCELLED", JSON.stringify(cancel.body));
    const delSo1 = await call("/api/documents/delete", { kind: "sales_order", id: so1Id });
    ok("delete cancelled SO", delSo1.status === 200 && !(await P("sales_orders", so1Id).get()).exists, JSON.stringify(delSo1.body));

    // คืนยอดจองสินค้าเมื่อยกเลิก
    await product.set({ companyId: C, name: "TEST สินค้า", isSample: true, stockStatus: { onHand: 10, reserved: 5, available: 5 } });
    const so2 = await soCreate("Draft");
    const so2Id = so2.body.soId; if (so2Id) made.push(["sales_orders", so2Id]);
    await P("sales_orders", so2Id).update({ status: "Confirmed", stockReserved: true, items: [line(3, 500, { productId: product.id, itemType: "PRODUCT" })] });
    const dlvPick = await call("/api/sales/orders/status", { soId: so2Id, action: "deliver" });
    ok("deliver blocked when picking needed", dlvPick.status === 409, JSON.stringify(dlvPick.body));
    const cancel2 = await call("/api/sales/orders/status", { soId: so2Id, action: "cancel" });
    const ps = (await product.get()).data().stockStatus;
    ok("cancel releases reservation", cancel2.status === 200 && ps.reserved === 2 && ps.available === 8, JSON.stringify({ b: cancel2.body, ps }));

    // ---------- ใบสั่งงาน ----------
    const so3 = await soCreate("Confirmed");
    const so3Id = so3.body.soId; if (so3Id) made.push(["sales_orders", so3Id]);
    ok("SO create confirmed (no credit limit)", so3.status === 200, JSON.stringify(so3.body));
    const wo = await call("/api/service/work-orders", { soId: so3Id, technicianUid: temp.tech, scheduleDate: today, items: [line(1, 500)] });
    const woId = wo.body.woCode; if (woId) made.push(["work_orders", woId]);
    ok("WO create", wo.status === 200 && !!woId, JSON.stringify(wo.body));
    const delSo3 = await call("/api/sales/orders/status", { soId: so3Id, action: "deliver" });
    if (delSo3.body.deliveryNoteNo) made.push(["delivery_notes", delSo3.body.deliveryNoteNo]);
    ok("deliver service-only SO", delSo3.status === 200 && (await get("sales_orders", so3Id)).status === "DELIVERED", JSON.stringify(delSo3.body));
    const delWithWo = await call("/api/documents/delete", { kind: "sales_order", id: so3Id });
    ok("delete delivered SO blocked", delWithWo.status === 409, JSON.stringify(delWithWo.body));
    const techWo = await callTech("/api/service/work-orders", { soId: so3Id, technicianUid: temp.tech, items: [line(1, 1)] });
    ok("TECHNICIAN cannot create WO", techWo.status === 403, JSON.stringify(techWo.body));
    const early = await callTech("/api/service/work-orders", { action: "complete", woId });
    ok("complete before check-in blocked", early.status === 409, JSON.stringify(early.body));
    const other = await callTech2("/api/service/work-orders", { action: "checkin", woId });
    ok("other technician blocked", other.status === 403, JSON.stringify(other.body));
    const ci = await callTech("/api/service/work-orders", { action: "checkin", woId, gps: { lat: 13.75, lng: 100.5, accuracy: 12.4 } });
    const wd = await get("work_orders", woId);
    ok("assigned technician checks in", ci.status === 200 && wd.status === "IN_PROGRESS" && wd.checkIn?.gps?.lat === 13.75 && wd.checkIn?.by === temp.tech, JSON.stringify(ci.body));
    const ci2 = await callTech("/api/service/work-orders", { action: "checkin", woId });
    ok("check-in twice blocked", ci2.status === 409, JSON.stringify(ci2.body));
    const noProof = await callTech("/api/service/work-orders", { action: "complete", woId });
    ok("complete without photo/signature blocked", noProof.status === 409, JSON.stringify(noProof.body));
    for (const t of ["after", "signature"]) await P("work_orders", woId).collection("attachments").doc(t).set({ companyId: C, type: t, dataUrl: "data:,TEST" });
    const done = await callTech("/api/service/work-orders", { action: "complete", woId, gps: { lat: "bad" } });
    const wd2 = await get("work_orders", woId);
    ok("complete with proof", done.status === 200 && wd2.status === "COMPLETED" && wd2.checkOut?.gps === null, JSON.stringify(done.body));

    // ค่าแรงผู้รับเหมาช่วงจากใบสั่งขาย
    const sub = await call("/api/finance/expenses", { action: "subcontract", soId: so3Id, subcontractorName: "TEST ช่าง", items: [{ description: "ค่าแรง", payoutAmount: 1000 }] });
    if (sub.body.expenseId) made.push(["expenses", sub.body.expenseId]);
    ok("subcontract expense", sub.status === 200 && !!sub.body.expenseId, JSON.stringify(sub.body));
  } catch (e) {
    fails++; console.log("ERROR", e);
  } finally {
    for (const [c, id] of made) {
      if (c === "work_orders") for (const a of (await P(c, id).collection("attachments").get()).docs) await a.ref.delete();
      await P(c, id).delete();
    }
    await product.delete();
    for (const id of counterIds) counters[id] ? await db.doc(`companies/${C}/counters/${id}`).set(counters[id]) : await db.doc(`companies/${C}/counters/${id}`).delete();
    for (const uid of Object.values(temp)) { await db.doc(`users/${uid}`).delete(); await admin.auth().deleteUser(uid).catch(() => {}); }
    console.log(`cleanup: ${made.length} docs, counters restored. ${fails ? fails + " FAILED" : "ALL PASS"}`);
    process.exit(0);
  }
})();
