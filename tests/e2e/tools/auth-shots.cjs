// เปิดหน้าจอด้วยการล็อกอินจริง (ADMIN) ผ่าน custom token แล้วถ่ายภาพ
// usage: node tests/e2e/tools/auth-shots.cjs <outDir> <path1,path2,...> [widths]  (SHOT_H, SHOT_MOBILE, SCROLL_TEXT, PROBE)
const path = require("path"); const fs = require("fs"); const root = path.resolve(__dirname, "../../..");
require("@next/env").loadEnvConfig(root);
const admin = require("firebase-admin");
const { chromium } = require("playwright");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10)) }) });
const db = admin.firestore(); const C = "COM-NEXUS-01";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function authUserRecord() {
  const user = (await db.collection("users").where("companyId", "==", C).where("role", "==", "ADMIN").limit(1).get()).docs[0];
  const custom = await admin.auth().createCustomToken(user.id);
  const r = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }) })).json();
  const rec = await admin.auth().getUser(user.id);
  return {
    uid: user.id, email: rec.email, emailVerified: !!rec.emailVerified, isAnonymous: false, providerData: [],
    stsTokenManager: { refreshToken: r.refreshToken, accessToken: r.idToken, expirationTime: Date.now() + 3500 * 1000 },
    createdAt: String(Date.parse(rec.metadata.creationTime)), lastLoginAt: String(Date.now()), apiKey: API_KEY, appName: "[DEFAULT]",
  };
}

module.exports.shoot = async function shoot(outDir, pages, widths = [1280, 1920]) {
  fs.mkdirSync(outDir, { recursive: true });
  const record = await authUserRecord();
  const b = await chromium.launch();
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: Number(process.env.SHOT_H) || Math.round(w * 0.625) }, ...(process.env.SHOT_MOBILE ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const p = await ctx.newPage();
    await p.goto((process.env.E2E_BASE || "http://localhost:3000") + "/login", { waitUntil: "domcontentloaded", timeout: 240000 });
    await p.evaluate(async ({ record, key }) => {
      localStorage.setItem("selectedCompanyId", "COM-NEXUS-01");
      await new Promise((res, rej) => {
        const req = indexedDB.open("firebaseLocalStorageDb", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
        req.onsuccess = () => {
          const tx = req.result.transaction("firebaseLocalStorage", "readwrite");
          tx.objectStore("firebaseLocalStorage").put({ fbase_key: key, value: record });
          tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
        };
        req.onerror = () => rej(req.error);
      });
    }, { record, key: `firebase:authUser:${API_KEY}:[DEFAULT]` });
    for (const spec of pages) {
      // "path#click:ข้อความ" -> คลิกปุ่มที่มีข้อความนั้นหลังโหลดหน้า
      const [pg, clickText] = spec.split("#click:");
      await p.goto((process.env.E2E_BASE || "http://localhost:3000") + "" + pg, { waitUntil: "domcontentloaded", timeout: 240000 });
      await p.waitForSelector("aside", { timeout: 120000 }).catch(() => {});
      await p.waitForTimeout(4000);
      if (clickText) { await p.getByRole("button", { name: clickText }).or(p.getByLabel(clickText)).first().click().catch((e) => console.log("click failed", e.message)); await p.waitForTimeout(1500); }
      const file = path.join(outDir, `${(pg + (clickText ? "_" + clickText : "")).replace(/[\/?=&# ]/g, "_")}_${w}.png`);
      if (process.env.SCROLL_TEXT) {
        await p.evaluate((t) => { const el = Array.from(document.querySelectorAll("h3,h2,h4")).find((e) => e.textContent.includes(t)); el && el.scrollIntoView({ block: "start" }); }, process.env.SCROLL_TEXT);
        await p.waitForTimeout(600);
        await p.screenshot({ path: file });
      } else await p.screenshot({ path: file, fullPage: true });
      console.log("shot", file);
      if (process.env.PROBE) console.log("probe:", JSON.stringify(await p.evaluate(process.env.PROBE)));
    }
    await ctx.close();
  }
  await b.close();
};

if (require.main === module) {
  module.exports.shoot(process.argv[2], process.argv[3].split(","), process.argv[4] ? process.argv[4].split(",").map(Number) : undefined)
    .then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports.authUserRecord = authUserRecord;
