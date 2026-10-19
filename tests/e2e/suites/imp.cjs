// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// 7C: หน้านำเข้าข้อมูลจาก Excel (/data-import) — สร้างไฟล์ .xlsx ข้อมูล TEST อัปโหลดผ่านหน้าจอจริง ตรวจฐานข้อมูล แล้วลบทั้งหมด
require("@next/env").loadEnvConfig(E2E_ROOT);
const path = require("path");
const admin = require("firebase-admin");
const XLSX = require("xlsx");
const { chromium } = require("playwright");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const G = C; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };

async function login(page, uid) {
  const r = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json();
  const rec = await admin.auth().getUser(uid);
  const record = { uid, email: rec.email, emailVerified: false, isAnonymous: false, providerData: [], stsTokenManager: { refreshToken: r.refreshToken, accessToken: r.idToken, expirationTime: Date.now() + 3500e3 }, createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey: KEY, appName: "[DEFAULT]" };
  await page.goto(E2E_BASE + "/login", { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.evaluate(async ({ record, key }) => {
    localStorage.setItem("selectedCompanyId", "COM-NEXUS-01");
    await new Promise((res, rej) => {
      const req = indexedDB.open("firebaseLocalStorageDb", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
      req.onsuccess = () => { const tx = req.result.transaction("firebaseLocalStorage", "readwrite"); tx.objectStore("firebaseLocalStorage").put({ fbase_key: key, value: record }); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); };
      req.onerror = () => rej(req.error);
    });
  }, { record, key: `firebase:authUser:${KEY}:[DEFAULT]` });
}

function xlsxFile(name, aoa) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "ข้อมูล");
  const file = path.join(E2E_OUT, name);
  XLSX.writeFile(wb, file);
  return file;
}

(async () => {
  const s = Date.now(); const T = String(s).slice(-9); const M = `TEST-IMP-${s}`;
  const UID = `test-imp-${s}`;
  await admin.auth().createUser({ uid: UID, email: `${UID}@example.com` });
  await db.doc(`users/${UID}`).set({ companyId: C, roles: ["SALES", "PURCHASING"], role: "SALES", status: "ACTIVE", email: `${UID}@example.com`, name: "TEST นำเข้า", onboarding: { welcomed: true } });
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const status = async () => page.evaluate(() => document.body.innerText);
  const importFile = async (tab, file, expectReady, uncheck = false) => {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles(file);
    const btn = page.getByRole("button", { name: `นำเข้า ${expectReady} รายการ` });
    await btn.waitFor({ timeout: 30000 });
    if (uncheck) { await page.getByText("ลงบัญชียอดยกมาสินค้า", { exact: true }).click(); if (await page.getByLabel("ลงบัญชียอดยกมาสินค้า").isChecked()) throw new Error("checkbox still checked"); }
    await btn.click();
    await page.waitForFunction(() => !/กำลังนำเข้า/.test(document.body.innerText), null, { timeout: 120000 });
    await page.waitForTimeout(500);
  };
  try {
    await login(page, UID);
    await page.goto(E2E_BASE + "/data-import", { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.getByText("นำเข้าข้อมูลจาก Excel").first().waitFor({ timeout: 120000 });
    ok("sidebar shows import link for sales/purchasing user", await page.locator('aside a[href="/data-import"]').count() > 0);

    // ลูกค้า: เลขภาษีเป็นตัวเลข (0 นำหน้าหาย), แถวผิด, แถวซ้ำในไฟล์, แถวว่าง
    const tax = `0107${T}`;
    const custFile = xlsxFile(`imp-cust-${s}.xlsx`, [
      ["ชื่อลูกค้า*", "เลขประจำตัวผู้เสียภาษี", "โทรศัพท์", "อีเมล", "วงเงินเครดิต (บาท)", "เครดิต (วัน)", "คอลัมน์เก่า"],
      [`${M} ลูกค้า A`, Number(tax), 21234567, "a@example.com", "50,000", 45, "x"],
      [`${M} ลูกค้า B`, "", "081-111-1111", "bad-email", "", "", ""],
      [],
      [`${M} ลูกค้า C`, tax, "", "", "", "", ""],
      [`${M} ลูกค้า D`, "", "", "", "", 30, ""],
    ]);
    await importFile("ลูกค้า", custFile, 2);
    let txt = await status();
    ok("customers: unknown column reported, 2 imported, 2 invalid", /ข้ามคอลัมน์ที่ไม่รู้จัก: คอลัมน์เก่า/.test(txt) && /นำเข้าแล้ว\s*2/.test(txt) && /ไม่ผ่าน\s*2/.test(txt) && /ซ้ำกับแถว 2/.test(txt) && /อีเมล ไม่ถูกต้อง/.test(txt), txt.slice(0, 600));
    const custs = (await db.collection(`groups/${G}/customers`).get()).docs.filter((d) => String(d.data().name).startsWith(M));
    const a = custs.find((d) => d.data().name.endsWith("A"));
    const aLocal = a && (await db.doc(`companies/${C}/customers/${a.id}`).get()).data();
    ok("customer A: leading zeros restored, credit kept per company", custs.length === 2 && a.data().taxId === tax && a.data().branchCode === "00000" && /021234567/.test(JSON.stringify(a.data()) + JSON.stringify(aLocal)) && aLocal.creditLimit === 50000 && aLocal.creditTermDays === 45, JSON.stringify({ m: a?.data(), aLocal }));

    // นำเข้าไฟล์เดิมซ้ำ -> ระบบปฏิเสธรายการที่ซ้ำ (เลขภาษีเดียวกัน) แถวไม่มีเลขภาษีสร้างได้ (ชื่อซ้ำไม่ตรวจ)
    await page.goto(E2E_BASE + "/data-import", { waitUntil: "domcontentloaded" });
    await page.getByText("นำเข้าข้อมูลจาก Excel").first().waitFor({ timeout: 60000 });
    const dupFile = xlsxFile(`imp-cust-dup-${s}.xlsx`, [["ชื่อลูกค้า", "เลขประจำตัวผู้เสียภาษี"], [`${M} ลูกค้า A2`, tax]]);
    await importFile("ลูกค้า", dupFile, 1);
    txt = await status();
    ok("re-import of existing tax ID fails with reason", /ไม่สำเร็จ\s*1/.test(txt) && /ซ้ำ|มีอยู่แล้ว/.test(txt), txt.slice(0, 600));

    // ผู้ขาย -> ผู้ขาย + ผู้รับเหมารหัสเดียวกัน
    const supFile = xlsxFile(`imp-sup-${s}.xlsx`, [
      ["ชื่อผู้ขาย", "ประเภท", "เลขประจำตัวผู้เสียภาษี", "รหัสสาขา", "เครดิต (วัน)", "ธนาคาร", "เลขที่บัญชี"],
      [`${M} ร้านวัสดุ`, "ห้าง/ร้าน", `0207${T}`, 1, 60, "กสิกรไทย", "123-4-56789-0"],
      [`${M} ประเภทผิด`, "โรงงาน", "", "", "", "", ""],
    ]);
    await importFile("ผู้ขาย", supFile, 1);
    const sup = (await db.collection(`groups/${G}/suppliers`).get()).docs.find((d) => String(d.data().name).startsWith(M));
    const con = sup && (await db.doc(`groups/${G}/contractors/${sup.id}`).get());
    ok("supplier + contractor same id, branch padded, bank shared", !!sup && con.exists && sup.data().branchCode === "00001" && (await db.doc(`companies/${C}/suppliers/${sup.id}`).get()).data()?.entity_category === "STORE" && sup.data().bank_name === "กสิกรไทย", JSON.stringify({ con: con?.exists, br: sup?.data().branchCode, cat: sup?.data().entity_category, bank: sup?.data().bank_name }));
    ok("invalid supplier type reported", /ประเภท ต้องเป็น/.test(await status()));

    // สินค้า: ยอดยกมาโดยไม่บันทึกบัญชี (ยอดอยู่ในงบทดลองยกมา) + บริการ
    const prodFile = xlsxFile(`imp-prod-${s}.xlsx`, [
      ["รหัสสินค้า (SKU)*", "ชื่อสินค้า*", "ประเภท", "หน่วย*", "ราคาขาย (ก่อน VAT)", "ต้นทุนต่อหน่วย", "จำนวนคงเหลือยกมา"],
      [`${M}-1`, `${M} กล้อง`, "สินค้า", "ตัว", "2,500", 1800, 5],
      [`${M}-2`, `${M} ค่าติดตั้ง`, "บริการ", "งาน", 1500, "", ""],
      [`${M}-1`, `${M} ซ้ำ`, "", "ตัว", "", "", ""],
    ]);
    await importFile("สินค้า/บริการ", prodFile, 2, true);
    const prods = (await db.collection(`groups/${G}/products`).get()).docs.filter((d) => String(d.data().sku).startsWith(M));
    const cam = prods.find((d) => d.data().sku === `${M}-1`);
    const camLocal = cam && (await db.doc(`companies/${C}/products/${cam.id}`).get()).data();
    const mv = cam ? (await db.collection(`companies/${C}/stock_movements`).where("referenceId", "==", `OPEN-${cam.id}`).get()).size : 0;
    const jv = cam ? (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", `OPEN-${cam.id}`).get()).size : -1;
    ok("products: 2 created, opening stock 5 received without journal", prods.length === 2 && camLocal?.stockStatus?.onHand === 5 && mv === 1 && jv === 0, JSON.stringify({ n: prods.length, ss: camLocal?.stockStatus, mv, jv }));
    ok("duplicate SKU in file reported", /ซ้ำกับแถว 2/.test(await status()));
    await page.screenshot({ path: path.join(E2E_OUT, `imp-products-${s}.png`), fullPage: true });
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    await browser.close();
    const ids = new Set();
    for (const ent of ["customers", "suppliers", "contractors", "products"]) {
      const docs = (await db.collection(`groups/${G}/${ent}`).get()).docs.filter((d) => String(d.data().name || "").startsWith(M) || String(d.data().sku || "").startsWith(M));
      for (const d of docs) {
        ids.add(d.id);
        const h = await d.ref.collection("history").get(); for (const x of h.docs) await x.ref.delete();
        await d.ref.delete(); await db.doc(`companies/${C}/${ent}/${d.id}`).delete();
        if (ent === "products") for (const col of ["stock_movements", "journal_entries"]) { const q = await db.collection(`companies/${C}/${col}`).where(col === "stock_movements" ? "referenceId" : "reference", "==", `OPEN-${d.id}`).get(); for (const x of q.docs) await x.ref.delete(); }
      }
    }
    const keys = await db.collection(`groups/${G}/unique_keys`).get(); for (const d of keys.docs) if (ids.has(d.data().id)) await d.ref.delete();
    await db.doc(`users/${UID}`).delete(); await admin.auth().deleteUser(UID).catch(() => {});
    console.log("cleaned", ids.size, "records");
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
