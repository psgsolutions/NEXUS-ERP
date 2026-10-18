/**
 * สำรองข้อมูล Firestore ทั้งหมด (ทุก collection และ subcollection) เป็นไฟล์ .jsonl.gz ในเครื่อง
 *
 *   node scripts/backup-firestore.mjs                       -> backups/firestore-<project>-<วันเวลา>.jsonl.gz
 *   node scripts/backup-firestore.mjs --out=D:/safe/place   เก็บที่โฟลเดอร์อื่น
 *   node scripts/backup-firestore.mjs --exclude=rate_limits,logs
 *
 * - อ่านอย่างเดียว ไม่แก้ข้อมูล ใช้ service account จาก .env.local
 * - ไฟล์มีข้อมูลทั้งระบบ (ลูกค้า พนักงาน เงินเดือน) เก็บในที่ปลอดภัย ห้าม commit (backups/ อยู่ใน .gitignore)
 * - แต่ละบรรทัด = { "path": "companies/X/invoices/Y", "data": {...} } ชนิดพิเศษเข้ารหัสด้วย scripts/firestore-codec.mjs
 * - กู้คืน: scripts/restore-firestore.mjs (ค่าเริ่มต้น dry-run)
 */
import { createRequire } from "node:module";
import { createWriteStream, mkdirSync, statSync } from "node:fs";
import { createGzip } from "node:zlib";
import path from "node:path";
import { encode } from "./firestore-codec.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
require(path.join(root, "node_modules/@next/env")).loadEnvConfig(root);
const admin = require(path.join(root, "node_modules/firebase-admin"));

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const exclude = new Set((arg("exclude") || "rate_limits").split(",").map((s) => s.trim()).filter(Boolean));
const outDir = path.resolve(arg("out") || path.join(root, "backups"));
const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

admin.initializeApp({ credential: admin.credential.cert({ projectId: project, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n") }) });
const db = admin.firestore();

mkdirSync(outDir, { recursive: true });
const stamp = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");
const file = path.join(outDir, `firestore-${project}-${stamp}.jsonl.gz`);
const gz = createGzip();
const out = createWriteStream(file);
gz.pipe(out);

const counts = new Map();
let total = 0;
async function dumpCollection(col) {
  // อ่านทีละหน้า (กันหน่วยความจำเต็มเมื่อข้อมูลมาก)
  let last = null;
  while (true) {
    let q = col.orderBy(admin.firestore.FieldPath.documentId()).limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      gz.write(JSON.stringify({ path: d.ref.path, data: encode(d.data(), admin) }) + "\n");
      total++;
      const key = col.path.split("/").filter((_, i) => i % 2 === 0).join("/*/");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const d of snap.docs) for (const sub of await d.ref.listCollections()) await dumpCollection(sub);
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
}

const t0 = Date.now();
for (const col of await db.listCollections()) {
  if (exclude.has(col.id)) continue;
  await dumpCollection(col);
}
// เอกสารว่างที่มีแต่ subcollection (เช่น groups/{g}) ไม่ถูก list โดย orderBy -> ค้นจาก listDocuments
for (const col of await db.listCollections()) {
  if (exclude.has(col.id)) continue;
  for (const ref of await col.listDocuments()) {
    const s = await ref.get();
    if (!s.exists) for (const sub of await ref.listCollections()) await dumpCollection(sub);
  }
}
gz.end();
await new Promise((r) => out.on("finish", r));

console.log(`สำรองแล้ว ${total.toLocaleString()} เอกสาร ใน ${((Date.now() - t0) / 1000).toFixed(0)} วินาที`);
console.log(`ไฟล์: ${file} (${(statSync(file).size / 1024).toFixed(0)} KB)`);
console.log([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `  ${String(n).padStart(6)}  ${k}`).join("\n"));
if (exclude.size) console.log(`ไม่สำรอง: ${[...exclude].join(", ")}`);
process.exit(0);
