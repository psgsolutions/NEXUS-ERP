/**
 * ตั้ง/ถอนสิทธิ์ SUPERADMIN ด้วย custom claim บน Firebase Auth (แทน uid/อีเมลที่เขียนตายตัวในโค้ด)
 *
 *   node scripts/set-superadmin-claim.mjs <อีเมล>            # ตรวจอย่างเดียว: แสดง claim ปัจจุบัน
 *   node scripts/set-superadmin-claim.mjs <อีเมล> --apply    # ตั้ง superadmin: true
 *   node scripts/set-superadmin-claim.mjs <อีเมล> --revoke   # ถอนสิทธิ์
 *
 * ผู้ใช้ต้องออกจากระบบแล้วเข้าใหม่ (หรือรอ token ต่ออายุไม่เกิน 1 ชั่วโมง) จึงได้สิทธิ์ใหม่
 * ใช้ service account จาก .env.local (FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const admin = require("firebase-admin");

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("ระบุอีเมล เช่น node scripts/set-superadmin-claim.mjs sadmin@admin.com --apply");
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});

const user = await admin.auth().getUserByEmail(email);
const claims = user.customClaims || {};
console.log(`ผู้ใช้ ${user.email} (uid ${user.uid}) claim ปัจจุบัน:`, JSON.stringify(claims));
if (flag === "--apply" || flag === "--revoke") {
  const next = { ...claims };
  if (flag === "--apply") next.superadmin = true; else delete next.superadmin;
  await admin.auth().setCustomUserClaims(user.uid, next);
  console.log(`${flag === "--apply" ? "ตั้ง" : "ถอน"}สิทธิ์ SUPERADMIN แล้ว:`, JSON.stringify(next), "— ให้ผู้ใช้ออกจากระบบแล้วเข้าใหม่");
} else {
  console.log("ตรวจอย่างเดียว (เพิ่ม --apply เพื่อตั้งสิทธิ์ หรือ --revoke เพื่อถอน)");
}
process.exit(0);
