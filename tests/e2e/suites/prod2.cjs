// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// ขั้น 2: สินค้าแบบใหม่ (ข้อมูลกลาง + ของบริษัท) และสินค้ารุ่นเก่า (root) ผ่าน API — ข้อมูล TEST ลบทั้งหมด คืนตัวนับ
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const G = C; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;

(async () => {
  const s = Date.now(); const NEW = `TEST-NP-${s}`; const OLD = `TEST-OP-${s}`;
  const U = { wh: `test-p2-wh-${s}`, sales: `test-p2-s-${s}` };
  await db.doc(`users/${U.wh}`).set({ companyId: C, roles: ["WAREHOUSE"], role: "WAREHOUSE", status: "ACTIVE" });
  await db.doc(`users/${U.sales}`).set({ companyId: C, roles: ["SALES"], role: "SALES", status: "ACTIVE" });
  const call = (uid, url) => async (b) => { const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await tok(uid)) }, body: JSON.stringify({ companyId: C, ...b }) }); return { status: r.status, body: await r.json() }; };
  const md = call(U.wh, "/api/master-data"), pos = call(U.sales, "/api/pos/checkout");
  const counters = {}; for (const id of ["POS", "INV"]) counters[id] = (await db.doc(`companies/${C}/counters/${id}`).get()).data() || null;
  const oldRef = db.doc(`products/${OLD}`);
  await oldRef.set({ companyId: C, name: "TEST สินค้าเก่า", sku: `TEST-OLD-${s}`, unit: "ชิ้น", itemType: "PRODUCT", pricing: { pricePOS: 50, costWAC: 30 }, stockStatus: { onHand: 5, reserved: 0, available: 5 } });
  const txs = [];
  try {
    // สร้างสินค้าใหม่พร้อมยอดยกมา
    const c = await md({ action: "create", entity: "products", id: NEW, data: { sku: `TEST-NEW-${s}`, barcode: `TESTBC${s}`, name: "TEST สายแลน CAT6", unit: "เส้น", itemType: "PRODUCT", category: "Network", pricing: { pricePOS: 120, priceProject: 150, costWAC: 999 }, costPrice: 70, stockStatus: { onHand: 999 } }, openingStock: { qty: 10, unitCost: 70 } });
    const m = (await db.doc(`groups/${G}/products/${NEW}`).get()).data(); const l = (await db.doc(`companies/${C}/products/${NEW}`).get()).data();
    ok("create: master has identity/shared only", c.status === 200 && m && m.sku === `TEST-NEW-${s}` && m.name === "TEST สายแลน CAT6" && m.pricing === undefined && m.stockStatus === undefined, JSON.stringify(c.body));
    ok("opening stock via stock engine (client stock/costWAC ignored)", l && l.stockStatus?.onHand === 10 && l.pricing?.pricePOS === 120 && l.pricing?.costWAC === 70, JSON.stringify(l && { st: l.stockStatus, pr: l.pricing }));
    const oj = (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", `OPEN-${NEW}`).get()).docs.map((d) => d.data());
    ok("opening journal draft Dr 1141 / Cr 3211 = 700", oj.length === 1 && oj[0].status === "draft" && oj[0].items[0].debit === 700 && oj[0].items[1].accountCode === "3211-00", JSON.stringify(oj));
    const dupOld = await md({ action: "create", entity: "products", data: { sku: `test-old-${s}`.toUpperCase(), name: "ซ้ำของเก่า" } });
    ok("SKU of not-yet-migrated product counts as duplicate", dupOld.status === 409 && dupOld.body.error.includes(OLD), JSON.stringify(dupOld.body));

    // ขาย POS สินค้าแบบใหม่: ตัดสต็อกที่ข้อมูลของบริษัท
    const p1 = await pos({ items: [{ id: NEW, qty: 3 }], paymentMethod: "CASH", cashReceived: 1000 });
    if (p1.body.transactionNo) txs.push(p1.body.transactionNo);
    const l2 = (await db.doc(`companies/${C}/products/${NEW}`).get()).data();
    ok("POS sells new-structure product, stock 10 -> 7 at company layer", p1.status === 200 && p1.body.items?.[0]?.price === 120 && l2.stockStatus.onHand === 7 && !(await db.doc(`products/${NEW}`).get()).exists, JSON.stringify(p1.body).slice(0, 200));

    // สินค้ารุ่นเก่าที่ยังอยู่ root ยังขายได้และตัดสต็อกที่ root
    const p2 = await pos({ items: [{ id: OLD, qty: 2 }], paymentMethod: "CASH", cashReceived: 500 });
    if (p2.body.transactionNo) txs.push(p2.body.transactionNo);
    ok("POS still sells legacy root product (5 -> 3)", p2.status === 200 && (await oldRef.get()).data().stockStatus.onHand === 3, JSON.stringify(p2.body).slice(0, 200));

    // แก้สินค้ารุ่นเก่าผ่าน API: ราคาเปลี่ยน ต้นทุนเฉลี่ยห้ามถูกเขียนทับ/หาย
    const u = await md({ action: "update", entity: "products", id: OLD, scope: "group", changes: { name: "TEST สินค้าเก่า (แก้)", pricing: { pricePOS: 55, costWAC: 1 }, stockStatus: { onHand: 999 } } });
    const od = (await oldRef.get()).data();
    ok("legacy update keeps costWAC & stock, merges pricing", u.status === 200 && u.body.legacy === true && od.name === "TEST สินค้าเก่า (แก้)" && od.pricing.pricePOS === 55 && od.pricing.costWAC === 30 && od.stockStatus.onHand === 3, JSON.stringify({ u: u.body, od: { p: od.pricing, s: od.stockStatus } }));
    const g = await md({ action: "get", entity: "products", id: OLD });
    ok("get works for legacy product", g.status === 200 && g.body.record._legacy === true && g.body.record.name === "TEST สินค้าเก่า (แก้)");

    // แก้สินค้าใหม่ (เครือบริษัทเดียว แก้ค่ากลางได้)
    const u2 = await md({ action: "update", entity: "products", id: NEW, scope: "group", changes: { name: "TEST สายแลน CAT6 UTP", pricing: { pricePOS: 125, priceProject: 150 } } });
    const m2 = (await db.doc(`groups/${G}/products/${NEW}`).get()).data(); const l3 = (await db.doc(`companies/${C}/products/${NEW}`).get()).data();
    ok("single-company group edits shared name; price stays company-only; WAC intact", u2.status === 200 && m2.name === "TEST สายแลน CAT6 UTP" && l3.pricing.pricePOS === 125 && l3.pricing.costWAC === 70, JSON.stringify(u2.body));

    const salesCreate = await call(U.sales, "/api/master-data")({ action: "create", entity: "products", data: { sku: "X", name: "x" } });
    ok("sales cannot create products", salesCreate.status === 403);
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const n of txs) { await db.doc(`companies/${C}/sales_transactions/${n}`).delete(); for (const col of ["stock_movements", "journal_entries"]) { const q = await db.collection(`companies/${C}/${col}`).where(col === "stock_movements" ? "referenceId" : "reference", "==", n).get(); for (const d of q.docs) await d.ref.delete(); } }
    for (const ref of [`OPEN-${NEW}`]) { for (const col of ["stock_movements", "journal_entries"]) { const q = await db.collection(`companies/${C}/${col}`).where(col === "stock_movements" ? "referenceId" : "reference", "==", ref).get(); for (const d of q.docs) await d.ref.delete(); } }
    const h = await db.collection(`groups/${G}/products/${NEW}/history`).get(); for (const d of h.docs) await d.ref.delete();
    await db.doc(`groups/${G}/products/${NEW}`).delete(); await db.doc(`companies/${C}/products/${NEW}`).delete(); await oldRef.delete();
    const keys = await db.collection(`groups/${G}/unique_keys`).get(); for (const d of keys.docs) if (d.data().id === NEW) await d.ref.delete();
    const leftG = (await db.collection(`groups/${G}/products`).get()).size + (await db.collection(`groups/${G}/unique_keys`).get()).size;
    for (const id of Object.keys(counters)) counters[id] ? await db.doc(`companies/${C}/counters/${id}`).set(counters[id]) : await db.doc(`companies/${C}/counters/${id}`).delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log("leftover group docs:", leftG);
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
