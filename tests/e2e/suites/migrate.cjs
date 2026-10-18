// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// ทดสอบสคริปต์ย้ายข้อมูลกับบริษัท TEST ชั่วคราว: เตรียมข้อมูลแบบเก่า -> รัน --apply --company -> ตรวจผ่าน API -> ลบทั้งหมด
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
const { execFileSync } = require("node:child_process");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;

(async () => {
  const s = Date.now(); const C = `TEST-MG-${s}`; const U = `test-mg-${s}`; const P = `TEST-MGP-${s}`, S = `TEST-MGS-${s}`, K = `TEST-MGC-${s}`, P2 = `TEST-MGP2-${s}`;
  await db.doc(`companies/${C}`).set({ name: "TEST ย้ายข้อมูล" });
  await db.doc(`users/${U}`).set({ companyId: C, roles: ["SALES", "WAREHOUSE", "PURCHASING", "ACCOUNTANT"], role: "SALES", status: "ACTIVE" });
  await db.doc(`products/${P}`).set({ companyId: C, name: "TEST ปลั๊กไฟ", sku: `MG-${s}`, unit: "ชิ้น", category: "Electrical", itemType: "PRODUCT", pricing: { pricePOS: 100, costWAC: 60 }, stockStatus: { onHand: 10, reserved: 0, available: 10 } });
  await db.doc(`products/${P2}`).set({ companyId: C, name: "TEST ซ้ำ SKU", sku: `MG-${s}`, itemType: "PRODUCT", stockStatus: { onHand: 0 } });
  await db.doc(`companies/${C}/products/${P}`).set({ pricing: { priceProject: 150 } }); // ค่าที่บริษัทตั้งทับ (เช่นจากใบเสนอราคา)
  await db.doc(`suppliers/${S}`).set({ companyId: C, name: "TEST ผู้ขาย", tax_id: "0105500000001", bank_name: "กสิกร", payment_term: 30 });
  await db.doc(`companies/${C}/customers/${K}`).set({ companyId: C, name: "TEST ลูกค้า", taxId: "0105500000002", address: "ชลบุรี", creditLimit: 9000 });
  await db.doc(`customers/${K}-root`).set({ companyId: C, name: "TEST ลูกค้า (สำเนาเก่า)" });
  await db.doc(`warehouses/${C}_WH-01`).set({ companyId: C, code: "WH-01", name: "TEST คลัง", zones: [{ code: "A", racks: [{ code: "R01", levels: 1, bins: 2 }] }] });
  const call = async (url, b) => { const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await tok(U)) }, body: JSON.stringify({ companyId: C, ...b }) }); return { status: r.status, body: await r.json() }; };
  const backupFile = `${E2E_OUT}/mg-backup-${s}.json`;
  const txs = [];
  try {
    const out = execFileSync("node", [require("path").join(E2E_ROOT, "scripts/migrate-master-data.mjs"), "--apply", `--company=${C}`, `--backup=${backupFile}`, "--delete-root-customers"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    ok("script ran", /เสร็จ/.test(out), out.slice(-400));
    ok("duplicate SKU reported, not indexed twice", /ซ้ำกับ/.test(out));
    const m = (await db.doc(`groups/${C}/products/${P}`).get()).data(); const l = (await db.doc(`companies/${C}/products/${P}`).get()).data();
    ok("product split: master identity/shared, company keeps stock/price + overlay", m?.sku === `MG-${s}` && m.name === "TEST ปลั๊กไฟ" && !m.pricing && l?.stockStatus?.onHand === 10 && l.pricing?.pricePOS === 100 && l.pricing?.costWAC === 60 && l.pricing?.priceProject === 150 && !l.name, JSON.stringify({ m, l }));
    ok("root product kept with migratedTo", (await db.doc(`products/${P}`).get()).data()?.migratedTo === `groups/${C}/products/${P}`);
    const sm = (await db.doc(`groups/${C}/suppliers/${S}`).get()).data(); const sl = (await db.doc(`companies/${C}/suppliers/${S}`).get()).data();
    ok("supplier: taxId normalised in master, payment term company-only", sm?.taxId === "0105500000001" && sm.bank_name === "กสิกร" && sl?.payment_term === 30 && !sl.name, JSON.stringify({ sm, sl }));
    const km = (await db.doc(`groups/${C}/customers/${K}`).get()).data(); const kl = (await db.doc(`companies/${C}/customers/${K}`).get()).data();
    ok("customer: shared fields moved up, credit stays", km?.taxId === "0105500000002" && km.address === "ชลบุรี" && kl?.creditLimit === 9000 && kl.name === undefined && kl.address === undefined, JSON.stringify({ km, kl }));
    ok("root duplicate customer deleted", !(await db.doc(`customers/${K}-root`).get()).exists);
    const wm = (await db.doc(`groups/${C}/warehouses/WH-01`).get()).data();
    ok("warehouse moved to group with owner", wm?.ownerCompanyId === C && wm.zones?.[0]?.racks?.[0]?.bins === 2 && !wm.companyId);
    ok("unique keys created", (await db.doc(`groups/${C}/unique_keys/products__sku__MG-${s}`).get()).data()?.id === P);

    // ระบบทำงานกับข้อมูลที่ย้ายแล้ว
    const g = await call("/api/master-data", { action: "get", entity: "products", id: P });
    ok("API reads migrated product (merged)", g.body.record?.name === "TEST ปลั๊กไฟ" && g.body.record.stockStatus?.onHand === 10 && !g.body.record._legacy, JSON.stringify(g.body).slice(0, 200));
    const pos = await call("/api/pos/checkout", { items: [{ id: P, qty: 2 }], paymentMethod: "CASH", cashReceived: 500 });
    if (pos.body.transactionNo) txs.push(pos.body.transactionNo);
    ok("POS sells migrated product, stock on company layer 10 -> 8", pos.status === 200 && pos.body.items?.[0]?.price === 100 && (await db.doc(`companies/${C}/products/${P}`).get()).data().stockStatus.onHand === 8 && (await db.doc(`products/${P}`).get()).data().stockStatus.onHand === 10, JSON.stringify(pos.body).slice(0, 200));
    const wl = await call("/api/inventory/warehouses", { action: "list" });
    ok("warehouse list uses group copy only", wl.body.warehouses?.length === 1 && wl.body.warehouses[0].id === "group:WH-01", JSON.stringify(wl.body.warehouses));
    const kc = await call("/api/master-data", { action: "get", entity: "customers", id: K });
    ok("customer readable after split", kc.body.record?.name === "TEST ลูกค้า" && kc.body.record.creditLimit === 9000 && kc.body.record._localFields?.length === 0, JSON.stringify(kc.body));
    const rerun = execFileSync("node", [require("path").join(E2E_ROOT, "scripts/migrate-master-data.mjs"), `--company=${C}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    ok("re-run is idempotent (0 writes)", /ย้าย 0 รายการ/.test(rerun) && /การเขียน 0 ครั้ง/.test(rerun), rerun.slice(-300));
  } catch (e) { fails++; console.log("ERROR", e.stdout || "", e.stderr || e); } finally {
    for (const n of txs) { await db.doc(`companies/${C}/sales_transactions/${n}`).delete(); }
    await db.recursiveDelete(db.doc(`companies/${C}`)); await db.recursiveDelete(db.doc(`groups/${C}`));
    for (const p of [`products/${P}`, `products/${P2}`, `suppliers/${S}`, `customers/${K}-root`, `warehouses/${C}_WH-01`]) await db.doc(p).delete();
    const logs = await db.collection("logs").where("companyId", "==", C).get(); for (const d of logs.docs) await d.ref.delete();
    await db.doc(`users/${U}`).delete(); await admin.auth().deleteUser(U).catch(() => {});
    try { require("fs").unlinkSync(backupFile); } catch {}
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
