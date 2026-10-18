// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// ขั้น 3: ลูกค้า ผู้ขาย ผู้รับเหมา ผ่าน /api/master-data (ทั้งรุ่นเก่าและแบบใหม่) — ลบข้อมูล TEST ทั้งหมด
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const G = C; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;

(async () => {
  const s = Date.now(); const T = String(s).slice(-9);
  const U = { sales: `test-pt-s-${s}`, buy: `test-pt-b-${s}`, wh: `test-pt-w-${s}` };
  await db.doc(`users/${U.sales}`).set({ companyId: C, roles: ["SALES"], role: "SALES", status: "ACTIVE" });
  await db.doc(`users/${U.buy}`).set({ companyId: C, roles: ["PURCHASING"], role: "PURCHASING", status: "ACTIVE" });
  await db.doc(`users/${U.wh}`).set({ companyId: C, roles: ["WAREHOUSE"], role: "WAREHOUSE", status: "ACTIVE" });
  const call = (uid) => async (b) => { const r = await fetch(E2E_BASE + "/api/master-data", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await tok(uid)) }, body: JSON.stringify({ companyId: C, ...b }) }); return { status: r.status, body: await r.json() }; };
  const sales = call(U.sales), buy = call(U.buy), wh = call(U.wh);
  const LEG_C = `TEST-LC-${s}`, LEG_S = `TEST-LS-${s}`;
  const legacyCust = db.doc(`companies/${C}/customers/${LEG_C}`);
  await legacyCust.set({ companyId: C, name: "TEST ลูกค้าเดิม", taxId: `0105${T}`, creditLimit: 100000 });
  const legacySup = db.doc(`suppliers/${LEG_S}`);
  await legacySup.set({ companyId: C, name: "TEST ผู้ขายเดิม", tax_id: `0205${T}`, bank_name: "กสิกร" });
  const created = { customers: [], suppliers: [], contractors: [] };
  try {
    // ลูกค้ารุ่นเก่า (อยู่ใต้บริษัท ยังไม่มีข้อมูลกลาง)
    const dupC = await sales({ action: "create", entity: "customers", data: { name: "ซ้ำ", taxId: `0105${T}` } });
    ok("new customer with legacy customer's tax ID rejected", dupC.status === 409 && dupC.body.error.includes(LEG_C), JSON.stringify(dupC.body));
    const br = await sales({ action: "create", entity: "customers", data: { name: "TEST สาขา 1", taxId: `0105${T}`, branchCode: "00001" } });
    if (br.body.id) created.customers.push(br.body.id);
    ok("same tax ID, different branch allowed", br.status === 200, JSON.stringify(br.body));
    const upC = await sales({ action: "update", entity: "customers", id: LEG_C, scope: "group", changes: { name: "TEST ลูกค้าเดิม (แก้)", creditLimit: 50000 } });
    const lc = (await legacyCust.get()).data();
    ok("legacy customer updated in place", upC.status === 200 && upC.body.legacy === true && lc.name === "TEST ลูกค้าเดิม (แก้)" && lc.creditLimit === 50000, JSON.stringify(upC.body));

    // ลูกค้าใหม่: ข้อมูลกลาง + วงเงินของบริษัท
    const nc = await sales({ action: "create", entity: "customers", data: { name: "TEST ลูกค้าใหม่", customerName: "TEST ลูกค้าใหม่", taxId: `0107${T}`, address: "กรุงเทพ", creditLimit: 30000, creditTermDays: 30 } });
    if (nc.body.id) created.customers.push(nc.body.id);
    const ncm = (await db.doc(`groups/${G}/customers/${nc.body.id}`).get()).data(); const ncl = (await db.doc(`companies/${C}/customers/${nc.body.id}`).get()).data();
    ok("new customer: name/tax/address shared, credit company-only", nc.status === 200 && ncm.taxId === `0107${T}` && ncm.address === "กรุงเทพ" && ncm.creditLimit === undefined && ncl.creditLimit === 30000, JSON.stringify({ ncm, ncl }));

    // ผู้ขายรุ่นเก่า (root) + ผู้ขาย/ผู้รับเหมาใหม่ใช้รหัสเดียวกัน
    const dupS = await buy({ action: "create", entity: "suppliers", data: { name: "ซ้ำ", tax_id: `0205${T}` } });
    ok("supplier tax_id (snake case) duplicate of legacy root supplier rejected", dupS.status === 409 && dupS.body.error.includes(LEG_S), JSON.stringify(dupS.body));
    const ns = await buy({ action: "create", entity: "suppliers", data: { name: "TEST ช่างแอร์", tax_id: `0305${T}`, bank_name: "ไทยพาณิชย์", account_number: "1234567890", payment_method: "TRANSFER" } });
    if (ns.body.id) created.suppliers.push(ns.body.id);
    const nct = await buy({ action: "create", entity: "contractors", id: ns.body.id, data: { name: "TEST ช่างแอร์", tax_id: `0305${T}` } });
    if (nct.body.id) created.contractors.push(nct.body.id);
    const nsm = (await db.doc(`groups/${G}/suppliers/${ns.body.id}`).get()).data(); const nsl = (await db.doc(`companies/${C}/suppliers/${ns.body.id}`).get()).data();
    ok("supplier: taxId normalized, bank shared, payment method company-only; contractor same id", ns.status === 200 && nct.status === 200 && nct.body.id === ns.body.id && nsm.taxId === `0305${T}` && nsm.bank_name === "ไทยพาณิชย์" && nsl.payment_method === "TRANSFER", JSON.stringify({ nsm, nsl }));
    const g = await buy({ action: "get", entity: "suppliers", id: LEG_S });
    ok("legacy root supplier readable via API", g.status === 200 && g.body.record._legacy === true && g.body.record.bank_name === "กสิกร");
    const whs = await wh({ action: "create", entity: "suppliers", data: { name: "x", taxId: "9999999999999" } });
    ok("warehouse role cannot create suppliers", whs.status === 403);

    // ลบ = ซ่อนรายการของบริษัท
    const rm = await sales({ action: "remove", entity: "customers", id: nc.body.id });
    const rml = (await db.doc(`companies/${C}/customers/${nc.body.id}`).get()).data();
    const gm = await sales({ action: "get", entity: "customers", id: nc.body.id });
    ok("remove hides company record, master kept", rm.status === 200 && rml.isDeleted === true && (await db.doc(`groups/${G}/customers/${nc.body.id}`).get()).exists, JSON.stringify(rm.body));
    const ad = await sales({ action: "adopt", entity: "customers", id: nc.body.id, data: { creditLimit: 1000 } });
    ok("removed customer can be adopted back", ad.status === 200 && (await db.doc(`companies/${C}/customers/${nc.body.id}`).get()).data().isDeleted === false, JSON.stringify(ad.body));
    void gm;
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const [ent, ids] of Object.entries(created)) for (const id of ids) {
      const h = await db.collection(`groups/${G}/${ent}/${id}/history`).get(); for (const d of h.docs) await d.ref.delete();
      await db.doc(`groups/${G}/${ent}/${id}`).delete(); await db.doc(`companies/${C}/${ent}/${id}`).delete();
    }
    const keys = await db.collection(`groups/${G}/unique_keys`).get();
    const all = new Set(Object.values(created).flat()); for (const d of keys.docs) if (all.has(d.data().id)) await d.ref.delete();
    await legacyCust.delete(); await legacySup.delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    const left = (await db.collection(`groups/${G}/customers`).get()).size + (await db.collection(`groups/${G}/suppliers`).get()).size + (await db.collection(`groups/${G}/contractors`).get()).size + (await db.collection(`groups/${G}/unique_keys`).get()).size;
    console.log("leftover group docs:", left);
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
