// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// ตัวช่วยผู้ใช้ใหม่: popup ต้อนรับตามตำแหน่ง, รายการเริ่มต้นใช้งาน, แผงวิธีใช้, โหมดพื้นฐาน, กล่องสิ่งที่จะเกิดขึ้น/ⓘ, การบันทึกความคืบหน้า
require("@next/env").loadEnvConfig(E2E_ROOT);
const path = require("path");
const admin = require("firebase-admin");
const { chromium } = require("playwright");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY; const OUT = E2E_OUT; const B = E2E_BASE;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
(async () => {
  const s = Date.now(); const uid = `test-guide-${s}`;
  await admin.auth().createUser({ uid, email: `${uid}@example.com` });
  await db.doc(`users/${uid}`).set({ companyId: "COM-NEXUS-01", roles: ["SALES", "WAREHOUSE"], role: "SALES", status: "ACTIVE", email: `${uid}@example.com`, name: "สมใจ ทดสอบ" });
  const b = await chromium.launch();
  try {
    const r = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json();
    const record = { uid, email: `${uid}@example.com`, emailVerified: false, isAnonymous: false, providerData: [], stsTokenManager: { refreshToken: r.refreshToken, accessToken: r.idToken, expirationTime: Date.now() + 3500e3 }, createdAt: String(s), lastLoginAt: String(s), apiKey: KEY, appName: "[DEFAULT]" };
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = []; p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(B + "/login", { waitUntil: "domcontentloaded", timeout: 300000 });
    await p.evaluate(async ({ record, key }) => {
      localStorage.setItem("selectedCompanyId", "COM-NEXUS-01");
      await new Promise((res, rej) => { const q = indexedDB.open("firebaseLocalStorageDb", 1); q.onupgradeneeded = () => q.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" }); q.onsuccess = () => { const tx = q.result.transaction("firebaseLocalStorage", "readwrite"); tx.objectStore("firebaseLocalStorage").put({ fbase_key: key, value: record }); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }; q.onerror = () => rej(q.error); });
    }, { record, key: `firebase:authUser:${KEY}:[DEFAULT]` });
    const shot = (n) => p.screenshot({ path: path.join(OUT, `guide-${n}.png`) });

    await p.goto(B + "/dashboard", { waitUntil: "domcontentloaded", timeout: 300000 });
    await p.getByRole("dialog", { name: "ยินดีต้อนรับ" }).waitFor({ timeout: 120000 });
    const welcome = await p.getByRole("dialog", { name: "ยินดีต้อนรับ" }).innerText();
    ok("welcome popup: name + both roles", /คุณสมใจ ทดสอบ/.test(welcome) && /ฝ่ายขาย/.test(welcome) && /คลังสินค้า/.test(welcome), welcome.slice(0, 300));
    await shot("1-welcome");
    await p.getByRole("button", { name: "เริ่มใช้งาน" }).click();
    await p.getByText("เริ่มต้นใช้งาน", { exact: true }).waitFor({ timeout: 30000 });
    ok("no fake quick-action button", (await p.locator("text=AI: พยากรณ์ความต้องการสต็อก").count()) === 0);
    const menu = await p.getByRole("button", { name: /สร้างรายการใหม่/ }).count();
    if (menu) { await p.getByRole("button", { name: /สร้างรายการใหม่/ }).click(); await p.waitForTimeout(400); ok("create menu hides purchase order for sales/warehouse", (await p.getByText("ใบสั่งซื้อ", { exact: true }).count()) === 0); await p.keyboard.press("Escape"); await p.getByRole("button", { name: /สร้างรายการใหม่/ }).click(); }
    await shot("2-checklist");

    // วิธีใช้หน้านี้
    await p.goto(B + "/sales", { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: "วิธีใช้หน้านี้", exact: true }).click({ timeout: 60000 });
    const help = await p.getByRole("dialog", { name: "วิธีใช้หน้านี้" }).innerText();
    ok("help panel shows sales guide", /งานขาย/.test(help) && /ใบกำกับภาษีออกแล้วแก้หรือลบไม่ได้/.test(help), help.slice(0, 200));
    ok("breadcrumb shows current page", (await p.locator("nav").filter({ hasText: "งานขาย" }).count()) > 0);
    await shot("3-help");
    await p.keyboard.press("Escape");
    ok("sales pipeline hidden behind advanced chip", (await p.getByRole("button", { name: /เครื่องมือขั้นสูง 1 รายการ/ }).count()) === 1 && (await p.getByRole("button", { name: "ติดตามงานขาย" }).count()) === 0);

    // คลัง: โหมดพื้นฐาน + เปิดเครื่องมือขั้นสูง
    await p.goto(B + "/inventory", { waitUntil: "domcontentloaded" });
    const adv = p.getByRole("button", { name: /เครื่องมือขั้นสูง 3 รายการ/ });
    await adv.waitFor({ timeout: 60000 });
    ok("inventory basic mode hides 3 tools", (await p.getByRole("button", { name: "หมายเลขซีเรียล" }).count()) === 0);
    await adv.click();
    await p.getByRole("button", { name: "หมายเลขซีเรียล" }).waitFor({ timeout: 10000 });
    ok("advanced chip reveals tools", true);
    await shot("4-inventory-advanced");

    // ใบรับชำระ: กล่องสิ่งที่จะเกิดขึ้น + ⓘ
    await p.goto(B + "/finance/receipts/new", { waitUntil: "domcontentloaded" });
    await p.getByText("เมื่อกดบันทึก ระบบจะ").waitFor({ timeout: 60000 });
    await p.getByRole("button", { name: "คำอธิบาย" }).first().hover();
    await p.waitForTimeout(400);
    ok("info tip opens on hover", (await p.getByText(/เงินสด = เข้าบัญชีเงินสด/).count()) > 0);
    await shot("5-receipt");

    // ความคืบหน้าถูกบันทึก (เปิดวิธีใช้ + เปิดหน้าบัญชีคุมสินค้า)
    await p.goto(B + "/inventory/stock-card", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3000);
    const ob = (await db.doc(`users/${uid}`).get()).data().onboarding || {};
    ok("onboarding progress saved (welcomed, help, visit, advanced)", ob.welcomed === true && ob.helpOpened === true && (ob.visited || []).includes("/inventory/stock-card") && ob.advanced === true, JSON.stringify(ob));
    ok("no page errors", errors.length === 0, errors.join(" | "));
  } catch (e) { fails++; console.log("ERROR", e.message); } finally {
    await b.close();
    await db.doc(`users/${uid}`).delete(); await admin.auth().deleteUser(uid).catch(() => {});
    const logs = await db.collection("logs").where("userId", "==", uid).get(); for (const d of logs.docs) await d.ref.delete();
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
