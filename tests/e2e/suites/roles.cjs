// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
const path = require("path"); const root = E2E_ROOT;
require("@next/env").loadEnvConfig(root);
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10)) }) });
const db = admin.firestore(); const C = "COM-NEXUS-01";
const BASE = process.env.BASE_URL || E2E_BASE + "";
let fails = 0;
const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const tokenFor = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const mk = (tok) => (url, body, method = "POST") => fetch(`${BASE}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(method === "GET" ? {} : { body: JSON.stringify({ companyId: C, ...body }) }) }).then(async (x) => ({ status: x.status, body: await x.json().catch(() => ({})) }));
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const P = (c, id) => db.doc(`companies/${C}/${c}/${id}`);
const line = (qty, price) => ({ description: "TEST รายการ", name: "TEST รายการ", qty, unit: "ชิ้น", price });

(async () => {
  const stamp = Date.now();
  const mkUser = async (key, roles) => { const uid = `test-${key}-${stamp}`; await db.doc(`users/${uid}`).set({ companyId: C, role: roles[0], roles, name: `TEST ${key}`, status: "ACTIVE" }); return uid; };
  const U = {
    acct: await mkUser("acct", ["ACCOUNTANT"]),
    exec: await mkUser("exec", ["EXECUTIVE"]),
    buyer: await mkUser("buyer", ["PURCHASING"]),
    sales: await mkUser("sales", ["SALES"]),
    sysadmin: await mkUser("sysadmin", ["ADMIN"]),
    multi: await mkUser("multi", ["ACCOUNTANT", "EXECUTIVE"]),
    target: await mkUser("target", ["SALES"]),
  };
  const call = {}; for (const [k, uid] of Object.entries(U)) call[k] = mk(await tokenFor(uid));
  const superUser = await admin.auth().getUserByEmail("sadmin@admin.com");
  const callSuper = mk(await tokenFor(superUser.uid));
  const supplier = (await db.collection("suppliers").where("companyId", "==", C).limit(1).get()).docs[0];
  const customer = (await db.collection(`companies/${C}/customers`).limit(20).get()).docs.find((d) => !(Number(d.data().creditLimit) > 0));

  const counterIds = ["PR", "PO", "SO"];
  const counters = {};
  for (const id of counterIds) counters[id] = (await db.doc(`companies/${C}/counters/${id}`).get()).data() || null;
  const made = [];
  try {
    // ---------- ใบสั่งซื้อ: จัดซื้อสร้าง, อนุมัติตามวงเงิน ----------
    const po = (c, price) => c("/api/procurement/purchase-orders", { action: "create", items: [line(1, price)], header: { orderType: "STOCK", supplierId: supplier.id, date: today, vatType: "none", currency: "THB", exchangeRate: 1 } });
    const p1 = await po(call.buyer, 400000); if (p1.body.poCode) made.push(["purchase_orders", p1.body.poCode]);
    ok("PURCHASING creates PO", p1.status === 200, JSON.stringify(p1.body));
    const p2 = await po(call.buyer, 600000); if (p2.body.poCode) made.push(["purchase_orders", p2.body.poCode]);
    const sp = await po(call.sales, 1000); if (sp.body.poCode) made.push(["purchase_orders", sp.body.poCode]);
    ok("SALES cannot create PO", sp.status === 403, JSON.stringify(sp.body));
    const ap = (c, poId) => c("/api/procurement/purchase-orders", { action: "approve", poId });
    const b1 = await ap(call.buyer, p1.body.poCode);
    ok("PURCHASING cannot approve PO", b1.status === 403, JSON.stringify(b1.body));
    const a2 = await ap(call.acct, p2.body.poCode);
    ok("ACCOUNTANT blocked over 500,000", a2.status === 403 && /500,000/.test(a2.body.error), JSON.stringify(a2.body));
    const a1 = await ap(call.acct, p1.body.poCode);
    ok("ACCOUNTANT approves 400,000", a1.status === 200, JSON.stringify(a1.body));
    const e2 = await ap(call.exec, p2.body.poCode);
    ok("EXECUTIVE approves 600,000", e2.status === 200, JSON.stringify(e2.body));
    const sa = await po(call.sysadmin, 1000); if (sa.body.poCode) made.push(["purchase_orders", sa.body.poCode]);
    ok("ADMIN (system only) cannot create PO", sa.status === 403, JSON.stringify(sa.body));

    // ---------- ใบขอซื้อ ----------
    const pr = await call.sales("/api/procurement/purchase-requests", { action: "create", items: [line(1, 100)], header: { requester: "TEST", requiredDate: today, reason: "TEST roles", vatMode: "none" } });
    if (pr.body.prCode) made.push(["purchase_requests", pr.body.prCode]);
    ok("SALES requests purchase", pr.status === 200, JSON.stringify(pr.body));
    const prB = await call.buyer("/api/procurement/purchase-requests", { action: "approve", prId: pr.body.prCode });
    ok("PURCHASING cannot approve PR", prB.status === 403, JSON.stringify(prB.body));
    const prA = await call.acct("/api/procurement/purchase-requests", { action: "approve", prId: pr.body.prCode });
    ok("ACCOUNTANT approves PR", prA.status === 200, JSON.stringify(prA.body));

    // ---------- ขาย ----------
    const so = await call.sales("/api/sales/orders", { status: "Draft", items: [line(1, 100)], header: { customerId: customer.id, docDate: today, vatType: "Non-VAT", paymentTermDays: 0 } });
    if (so.body.soId) made.push(["sales_orders", so.body.soId]);
    ok("SALES creates SO", so.status === 200, JSON.stringify(so.body));
    const soA = await call.sysadmin("/api/sales/orders", { status: "Draft", items: [line(1, 100)], header: { customerId: customer.id, docDate: today } });
    if (soA.body.soId) made.push(["sales_orders", soA.body.soId]);
    ok("ADMIN (system only) cannot create SO", soA.status === 403, JSON.stringify(soA.body));
    const soAcc = await call.acct("/api/sales/orders", { status: "Draft", items: [line(1, 100)], header: { customerId: customer.id, docDate: today } });
    if (soAcc.body.soId) made.push(["sales_orders", soAcc.body.soId]);
    ok("ACCOUNTANT cannot create SO", soAcc.status === 403, JSON.stringify(soAcc.body));
    const delSo = await call.sales("/api/documents/delete", { kind: "sales_order", id: so.body.soId });
    ok("SALES deletes own draft SO", delSo.status === 200, JSON.stringify(delSo.body));

    // ---------- บัญชี ----------
    const jE = await call.exec("/api/accounting/post-journal", { description: "TEST", items: [{ accountCode: "5310-00", debit: 1, credit: 0 }, { accountCode: "1591-00", debit: 0, credit: 1 }] });
    if (jE.body.journalId) made.push(["journal_entries", jE.body.journalId]);
    ok("EXECUTIVE (view only) cannot create journal", jE.status === 403, JSON.stringify(jE.body));
    const jA = await call.acct("/api/accounting/post-journal", { description: "TEST", items: [{ accountCode: "5310-00", debit: 1, credit: 0 }, { accountCode: "1591-00", debit: 0, credit: 1 }] });
    if (jA.body.journalId) made.push(["journal_entries", jA.body.journalId]);
    ok("ACCOUNTANT creates journal", jA.status === 200, JSON.stringify(jA.body));
    const jP = await call.multi("/api/accounting/journal-post", { journalId: jA.body.journalId });
    ok("ACCOUNTANT+EXECUTIVE (multi) posts other's journal", jP.status === 200, JSON.stringify(jP.body));

    // ---------- จัดการผู้ใช้ ----------
    const lst = await call.sysadmin("/api/admin/users", null, "GET");
    ok("ADMIN lists users", lst.status === 200 && Array.isArray(lst.body.users) && lst.body.users.some((u) => Array.isArray(u.roles)), JSON.stringify(lst.body).slice(0, 120));
    const lstS = await call.sales("/api/admin/users", null, "GET");
    ok("SALES cannot list users", lstS.status === 403, JSON.stringify(lstS.body));
    const setA = await call.sysadmin("/api/admin/users", { uid: U.target, action: "setRoles", roles: ["EXECUTIVE"] });
    ok("ADMIN cannot assign positions", setA.status === 403, JSON.stringify(setA.body));
    const setBad = await callSuper("/api/admin/users", { uid: U.target, action: "setRoles", roles: ["BOSS"] });
    ok("invalid position rejected", setBad.status === 400, JSON.stringify(setBad.body));
    const setS = await callSuper("/api/admin/users", { uid: U.target, action: "setRoles", roles: ["SALES", "WAREHOUSE"] });
    const tgt = (await db.doc(`users/${U.target}`).get()).data();
    ok("SUPERADMIN assigns multiple positions", setS.status === 200 && JSON.stringify(tgt.roles) === JSON.stringify(["SALES", "WAREHOUSE"]) && tgt.role === "SALES", JSON.stringify({ b: setS.body, r: tgt.roles, p: tgt.role }));
  } catch (e) {
    fails++; console.log("ERROR", e);
  } finally {
    for (const [c, id] of made) await P(c, id).delete().catch(() => {});
    for (const id of counterIds) counters[id] ? await db.doc(`companies/${C}/counters/${id}`).set(counters[id]) : await db.doc(`companies/${C}/counters/${id}`).delete();
    for (const uid of Object.values(U)) { await db.doc(`users/${uid}`).delete(); await admin.auth().deleteUser(uid).catch(() => {}); }
    console.log(`cleanup: ${made.length} docs. ${fails ? fails + " FAILED" : "ALL PASS"}`);
    process.exit(0);
  }
})();
