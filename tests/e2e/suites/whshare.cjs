// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// ขั้น 4: คลังที่ใช้ร่วมในเครือ + เจ้าของช่อง (บริษัท/เครือ TEST ชั่วคราว ลบทั้งหมดเมื่อจบ)
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;

(async () => {
  const s = Date.now(); const CA = `TEST-WA-${s}`, CB = `TEST-WB-${s}`, G = `TEST-WG-${s}`;
  const U = { a: `test-ws-a-${s}`, b: `test-ws-b-${s}` };
  await db.doc(`companies/${CA}`).set({ name: "TEST คลัง A", shortName: "A", groupId: G });
  await db.doc(`companies/${CB}`).set({ name: "TEST คลัง B", shortName: "B", groupId: G });
  await db.doc(`groups/${G}`).set({ name: "TEST เครือคลัง", adminUids: [] });
  for (const [u, c] of [[U.a, CA], [U.b, CB]]) await db.doc(`users/${u}`).set({ companyId: c, roles: ["WAREHOUSE"], role: "WAREHOUSE", status: "ACTIVE" });
  const PB = db.doc(`products/TEST-WP-${s}`);
  await PB.set({ companyId: CB, name: "TEST สินค้า B", sku: `TEST-WP-${s}`, itemType: "PRODUCT", stockStatus: { onHand: 5, reserved: 0, available: 5 }, pricing: { costWAC: 10 } });
  const call = (uid, c, url) => async (b) => { const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await tok(uid)) }, body: JSON.stringify({ companyId: c, ...b }) }); return { status: r.status, body: await r.json() }; };
  const whA = call(U.a, CA, "/api/inventory/warehouses"), whB = call(U.b, CB, "/api/inventory/warehouses"), putB = call(U.b, CB, "/api/inventory/putaway"), grB = call(U.b, CB, "/api/inventory/goods-receipt");
  try {
    const cr = await whA({ action: "create", code: "WH-T1", name: "TEST คลังร่วม" });
    ok("A creates group warehouse", cr.status === 200 && cr.body.id === "group:WH-T1" && (await db.doc(`groups/${G}/warehouses/WH-T1`).get()).data()?.ownerCompanyId === CA, JSON.stringify(cr.body));
    const dup = await whB({ action: "create", code: "WH-T1", name: "ซ้ำ" });
    ok("B cannot create same warehouse code in group", dup.status === 409);
    const zones = [{ code: "A", racks: [{ code: "R01", levels: 1, bins: 2, binOwners: { "L1-B02": CB } }] }];
    const sv = await whA({ action: "saveLayout", warehouseId: "group:WH-T1", zones });
    ok("A saves layout giving bin B02 to B", sv.status === 200, JSON.stringify(sv.body));
    const bad = await whA({ action: "saveLayout", warehouseId: "group:WH-T1", zones: [{ code: "A", racks: [{ code: "R01", levels: 1, bins: 2, owner: "COM-OUTSIDE" }] }] });
    ok("owner outside group rejected", bad.status === 400);
    const ls = await whB({ action: "list" });
    const b02 = ls.body.locations?.find((l) => l.code === "WH-T1-A-R01-L1-B02"); const b01 = ls.body.locations?.find((l) => l.code === "WH-T1-A-R01-L1-B01");
    ok("B sees shared warehouse with owners", ls.body.multiCompany === true && b02?.owner === CB && b01?.owner === CA, JSON.stringify({ b01, b02 }));

    const p1 = await putB({ fromLocation: "UNASSIGNED", toLocation: "WH-T1-A-R01-L1-B01", lines: [{ productId: PB.id, qty: 2 }] });
    ok("B cannot put away into A's bin", p1.status === 400 && /บริษัทอื่น/.test(p1.body.error), JSON.stringify(p1.body));
    const p2 = await putB({ fromLocation: "UNASSIGNED", toLocation: "WH-T1-A-R01-L1-B02", lines: [{ productId: PB.id, qty: 2 }] });
    const bal = (await db.doc(`companies/${CB}/inventory_balance/WH-T1-A-R01-L1-B02_${PB.id}`).get()).data();
    ok("B puts away into own bin", p2.status === 200 && bal?.quantity === 2, JSON.stringify(p2.body));
    const gr = await grB({ supplier: "TEST", warehouse: "WH-T1-A-R01-L1-B01", items: [{ productId: PB.id, qty: 1, unitPrice: 10 }] });
    ok("B cannot receive goods into A's bin", gr.status === 400 && /บริษัทอื่น/.test(gr.body.error), JSON.stringify(gr.body));

    const steal = await whA({ action: "saveLayout", warehouseId: "group:WH-T1", zones: [{ code: "A", racks: [{ code: "R01", levels: 1, bins: 2 }] }] });
    ok("A cannot take back bin that holds B's stock", steal.status === 409 && /เปลี่ยนเจ้าของ/.test(steal.body.error), JSON.stringify(steal.body));
    const shrink = await whA({ action: "saveLayout", warehouseId: "group:WH-T1", zones: [{ code: "A", racks: [{ code: "R01", levels: 1, bins: 1 }] }] });
    ok("A cannot remove location holding B's stock", shrink.status === 409 && /ลบตำแหน่ง/.test(shrink.body.error), JSON.stringify(shrink.body));
    const add = await whA({ action: "saveLayout", warehouseId: "group:WH-T1", zones: [{ code: "A", racks: [{ code: "R01", levels: 2, bins: 2, binOwners: { "L1-B02": CB } }] }] });
    ok("adding a level keeps B's bin", add.status === 200 && add.body.reowned === 0, JSON.stringify(add.body));
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const c of [CA, CB]) {
      for (const col of ["inventory_balance", "stock_movements", "goods_receipts", "journal_entries", "counters"]) { const q = await db.collection(`companies/${c}/${col}`).get(); for (const d of q.docs) await d.ref.delete(); }
      await db.doc(`companies/${c}`).delete();
    }
    const w = await db.collection(`groups/${G}/warehouses`).get(); for (const d of w.docs) await d.ref.delete();
    await db.doc(`groups/${G}`).delete(); await PB.delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    const left = (await db.collection("companies").get()).docs.filter((d) => d.id.startsWith("TEST")).length + (await db.collection("groups").get()).size;
    console.log("leftover test companies/groups:", left);
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
