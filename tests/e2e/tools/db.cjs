// การเชื่อมต่อฐานข้อมูลสำหรับเครื่องมือทดสอบ (ใช้ service account จาก .env.local)
const path = require("path");
const ROOT = path.resolve(__dirname, "../../..");
require("@next/env").loadEnvConfig(ROOT);
const admin = require("firebase-admin");
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }) });
}
module.exports = { admin, db: admin.firestore(), ROOT, COMPANY: process.env.E2E_COMPANY || "COM-NEXUS-01" };
