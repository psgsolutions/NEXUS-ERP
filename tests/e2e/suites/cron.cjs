// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
const path = require("path"); const root = E2E_ROOT;
require("@next/env").loadEnvConfig(root);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10)) }) });
const db = admin.firestore(); const C = "COM-NEXUS-01";
const S = process.env.CRON_SECRET;
const run = () => fetch(E2E_BASE + "/api/cron/quotation-expiry-check", { headers: { Authorization: "Bearer " + S } }).then((r) => r.json());
(async () => {
  const Q = db.doc(`companies/${C}/quotations/TEST-CRON-Q`);
  const v = new Date(Date.now() + 7 * 3600e3 + 2 * 86400e3).toISOString().slice(0, 10);
  const N = db.doc(`companies/${C}/notifications/QEXP-TEST-CRON-Q-${v}`);
  try {
    await Q.set({ companyId: C, documentNo: "QT-TEST-CRON", status: "SENT", validUntil: v, customerName: "ลูกค้าทดสอบ", isDeleted: false });
    const r1 = await run(); const n1 = await N.get();
    console.log(r1.expiringCount >= 1 && n1.exists ? "PASS  notification created" : "FAIL  create", JSON.stringify(r1.notifications));
    await N.update({ isRead: true });
    await run(); const n2 = (await N.get()).data();
    console.log(n2.isRead === true ? "PASS  second run keeps read status (no duplicate)" : "FAIL  reset");
  } finally { await Q.delete(); await N.delete(); console.log("cleaned up"); process.exit(0); }
})();
