// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// ทดสอบ /api/master-data กับฐานข้อมูลจริง ด้วยบริษัท/เครือ TEST ชั่วคราว แล้วลบทั้งหมด
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;

(async () => {
  const s = Date.now();
  const SOLO = `TEST-SOLO-${s}`, CA = `TEST-CA-${s}`, CB = `TEST-CB-${s}`, G = `TEST-G-${s}`;
  const U = { solo: `test-md-solo-${s}`, a: `test-md-a-${s}`, b: `test-md-b-${s}`, gadmin: `test-md-ga-${s}`, salesA: `test-md-sa-${s}` };
  await db.doc(`companies/${SOLO}`).set({ name: "TEST เดี่ยว" });
  await db.doc(`companies/${CA}`).set({ name: "TEST เครือ A", groupId: G });
  await db.doc(`companies/${CB}`).set({ name: "TEST เครือ B", groupId: G });
  await db.doc(`groups/${G}`).set({ name: "TEST เครือ", adminUids: [U.gadmin] });
  const mkUser = (uid, c, roles) => db.doc(`users/${uid}`).set({ companyId: c, roles, role: roles[0], status: "ACTIVE", name: uid });
  await mkUser(U.solo, SOLO, ["WAREHOUSE"]); await mkUser(U.a, CA, ["WAREHOUSE"]); await mkUser(U.b, CB, ["WAREHOUSE", "SALES"]); await mkUser(U.gadmin, CA, ["WAREHOUSE"]); await mkUser(U.salesA, CA, ["SALES"]);
  const mk = (uid, c) => async (b) => { const t = await tok(uid); const r = await fetch(E2E_BASE + "/api/master-data", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ companyId: c, ...b }) }); return { status: r.status, body: await r.json() }; };
  const solo = mk(U.solo, SOLO), a = mk(U.a, CA), b = mk(U.b, CB), ga = mk(U.gadmin, CA), salesA = mk(U.salesA, CA);
  try {
    // บริษัทเดี่ยว
    const cx = await solo({ action: "context" });
    ok("solo company is its own group, can edit master", cx.body.groupId === SOLO && cx.body.companyCount === 1 && cx.body.canEditMaster.products === true, JSON.stringify(cx.body));
    const c1 = await solo({ action: "create", entity: "products", id: "TP1", data: { sku: "TEST-SKU-1", barcode: "TEST885001", name: "TEST กล้อง 4MP", category: "CCTV", price: 3500, minStock: 2 } });
    const m1 = (await db.doc(`groups/${SOLO}/products/TP1`).get()).data(); const l1 = (await db.doc(`companies/${SOLO}/products/TP1`).get()).data();
    ok("create splits master/company", c1.status === 200 && m1.sku === "TEST-SKU-1" && m1.name === "TEST กล้อง 4MP" && m1.price === undefined && l1.price === 3500 && l1.sku === undefined, JSON.stringify(c1.body));
    const dup = await solo({ action: "create", entity: "products", data: { sku: " test-sku-1 ", name: "ซ้ำ" } });
    ok("duplicate SKU (case/space-insensitive) rejected", dup.status === 409, JSON.stringify(dup.body));
    const stock = await solo({ action: "update", entity: "products", id: "TP1", changes: { stock: 999 }, scope: "company" });
    ok("stock cannot be edited via master API", stock.status === 400);
    const up = await solo({ action: "update", entity: "products", id: "TP1", changes: { sku: "TEST-SKU-1B", name: "TEST กล้อง IP 4MP" }, scope: "group" });
    const m1b = (await db.doc(`groups/${SOLO}/products/TP1`).get()).data();
    const oldKey = await db.doc(`groups/${SOLO}/unique_keys/products__sku__TEST-SKU-1`).get();
    const newKey = await db.doc(`groups/${SOLO}/unique_keys/products__sku__TEST-SKU-1B`).get();
    ok("solo company edits master; unique key moves", up.status === 200 && m1b.sku === "TEST-SKU-1B" && !oldKey.exists && newKey.exists, JSON.stringify(up.body));
    const hist = await db.collection(`groups/${SOLO}/products/TP1/history`).get();
    ok("master changes keep history", hist.size === 2);

    // เครือหลายบริษัท
    const cxa = await a({ action: "context" });
    ok("group of 2: normal user cannot edit master", cxa.body.groupId === G && cxa.body.companyCount === 2 && cxa.body.canEditMaster.products === false, JSON.stringify(cxa.body));
    const ca = await a({ action: "create", entity: "products", id: "TG1", data: { sku: "TEST-G-SKU", name: "TEST กล้อง IP 4MP Hikvision", price: 3500 } });
    ok("any company in group can create new item", ca.status === 200, JSON.stringify(ca.body));
    const dupB = await b({ action: "create", entity: "products", data: { sku: "TEST-G-SKU", name: "B สร้างซ้ำ" } });
    ok("sister company cannot create same SKU", dupB.status === 409 && /TG1/.test(dupB.body.error), dupB.body.error);
    const chk = await b({ action: "checkDuplicate", entity: "products", data: { sku: "test-g-sku" } });
    ok("checkDuplicate finds sister's item", chk.body.duplicates?.[0]?.id === "TG1");
    const ad = await b({ action: "adopt", entity: "products", id: "TG1", data: { name: "TEST กล้องวงจรปิดภายนอก 4 ล้าน", internalCode: "B-CCTV-04", price: 3900 } });
    ok("sister adopts item with own name/code/price", ad.status === 200, JSON.stringify(ad.body));
    const gb = await b({ action: "get", entity: "products", id: "TG1" }); const gA = await a({ action: "get", entity: "products", id: "TG1" });
    ok("each company sees own name & price, same SKU", gb.body.record.name === "TEST กล้องวงจรปิดภายนอก 4 ล้าน" && gb.body.record.price === 3900 && gA.body.record.name === "TEST กล้อง IP 4MP Hikvision" && gA.body.record.price === 3500 && gb.body.record.sku === gA.body.record.sku, JSON.stringify([gA.body.record, gb.body.record]));
    const bm = await b({ action: "update", entity: "products", id: "TG1", changes: { name: "B แก้ชื่อกลาง" }, scope: "group" });
    ok("non-admin cannot edit shared name in multi-company group", bm.status === 403, JSON.stringify(bm.body));
    const bsku = await b({ action: "update", entity: "products", id: "TG1", changes: { sku: "B-SKU" }, scope: "company" });
    ok("identity field (SKU) always needs master rights", bsku.status === 403);
    const gam = await ga({ action: "update", entity: "products", id: "TG1", changes: { name: "TEST กล้อง IP 4MP (กลาง)" }, scope: "group" });
    const gA2 = await a({ action: "get", entity: "products", id: "TG1" }); const gb2 = await b({ action: "get", entity: "products", id: "TG1" });
    ok("group admin edits master: A (no override) follows, B keeps own name", gam.status === 200 && gA2.body.record.name === "TEST กล้อง IP 4MP (กลาง)" && gb2.body.record.name === "TEST กล้องวงจรปิดภายนอก 4 ล้าน");
    const rs = await b({ action: "resetLocal", entity: "products", id: "TG1", fields: ["name"] });
    const gb3 = await b({ action: "get", entity: "products", id: "TG1" });
    ok("reset company name -> back to master", rs.status === 200 && gb3.body.record.name === "TEST กล้อง IP 4MP (กลาง)" && gb3.body.record.internalCode === "B-CCTV-04", JSON.stringify(gb3.body.record));
    const sc = await salesA({ action: "create", entity: "products", data: { sku: "TEST-S", name: "x" } });
    ok("sales role cannot create products", sc.status === 403);
    const cust = await salesA({ action: "create", entity: "customers", data: { name: "TEST ลูกค้า", taxId: "0105599999999", creditLimit: 50000 } });
    const custB = await mk(U.b, CB)({ action: "checkDuplicate", entity: "customers", data: { taxId: "0105599999999", branchCode: "" } });
    ok("customer created; tax ID + HQ branch unique in group", cust.status === 200 && custB.body.duplicates?.length === 1, JSON.stringify([cust.body, custB.body]));
    const solocross = await solo({ action: "get", entity: "products", id: "TG1" });
    ok("other group's item not visible", solocross.status === 404);
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const g of [SOLO, G]) {
      for (const col of ["products", "customers", "unique_keys"]) {
        const q = await db.collection(`groups/${g}/${col}`).get();
        for (const d of q.docs) { const h = await d.ref.collection("history").get(); for (const x of h.docs) await x.ref.delete(); await d.ref.delete(); }
      }
      await db.doc(`groups/${g}`).delete();
    }
    for (const c of [SOLO, CA, CB]) { for (const col of ["products", "customers"]) { const q = await db.collection(`companies/${c}/${col}`).get(); for (const d of q.docs) await d.ref.delete(); } await db.doc(`companies/${c}`).delete(); }
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    const left = (await db.collection("groups").get()).docs.map((d) => d.id).filter((id) => id.startsWith("TEST"));
    console.log("leftover test groups:", left.length);
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
