/**
 * กู้คืนข้อมูลจากไฟล์ที่ได้จาก scripts/backup-firestore.mjs
 *
 *   node scripts/restore-firestore.mjs <ไฟล์.jsonl.gz>                              ตรวจอย่างเดียว (dry-run): มี/หาย/ต่าง กี่เอกสาร
 *   node scripts/restore-firestore.mjs <ไฟล์> --only=companies/COM-NEXUS-01/invoices   เฉพาะ path ที่ขึ้นต้นด้วยค่านี้
 *   node scripts/restore-firestore.mjs <ไฟล์> --apply                                 สร้างเฉพาะเอกสารที่หายไป (ไม่ทับของที่มีอยู่)
 *   node scripts/restore-firestore.mjs <ไฟล์> --apply --overwrite                     เขียนทับเอกสารที่ต่างจากไฟล์ด้วย
 *
 * ข้อควรระวัง: กู้คืนบัญชี/เอกสารภาษีย้อนหลังอาจทำให้ยอดไม่ตรงกับเอกสารที่ออกหลังวันสำรอง — ตรวจ dry-run และใช้ --only ให้แคบที่สุด
 */
import { createRequire } from "node:module";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import path from "node:path";
import { decode, encode } from "./firestore-codec.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
require(path.join(root, "node_modules/@next/env")).loadEnvConfig(root);
const admin = require(path.join(root, "node_modules/firebase-admin"));

const file = process.argv[2];
if (!file || file.startsWith("--")) { console.error("ระบุไฟล์สำรอง: node scripts/restore-firestore.mjs <ไฟล์.jsonl.gz> [--only=path] [--apply] [--overwrite]"); process.exit(2); }
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7) || "";
const apply = process.argv.includes("--apply");
const overwrite = process.argv.includes("--overwrite");
if (overwrite && !apply) { console.error("--overwrite ต้องใช้คู่กับ --apply"); process.exit(2); }

admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n") }) });
const db = admin.firestore();
const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

const stats = { inFile: 0, missing: 0, same: 0, different: 0, written: 0 };
let batch = db.batch(), pending = 0;
const flush = async () => { if (pending) { await batch.commit(); batch = db.batch(); pending = 0; } };

const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const { path: p, data } = JSON.parse(line);
  if (only && !p.startsWith(only)) continue;
  stats.inFile++;
  const ref = db.doc(p);
  const cur = await ref.get();
  if (!cur.exists) {
    stats.missing++;
    if (apply) { batch.create(ref, decode(data, admin, db)); pending++; stats.written++; }
  } else if (stable(encode(cur.data(), admin)) === stable(data)) {
    stats.same++;
  } else {
    stats.different++;
    if (apply && overwrite) { batch.set(ref, decode(data, admin, db)); pending++; stats.written++; }
  }
  if (pending >= 400) await flush();
}
await flush();
console.log(`${apply ? "กู้คืน" : "ตรวจ (dry-run)"}${only ? ` เฉพาะ ${only}` : ""}`);
console.log(`  ในไฟล์ ${stats.inFile} · หายจากฐานข้อมูล ${stats.missing} · เหมือนเดิม ${stats.same} · ต่างจากไฟล์ ${stats.different}`);
console.log(apply ? `  เขียนแล้ว ${stats.written}${overwrite ? "" : " (ไม่ทับเอกสารที่ต่าง — ใช้ --overwrite ถ้าต้องการ)"}` : "  ยังไม่ได้เขียนอะไร — ใช้ --apply เพื่อกู้คืนเอกสารที่หายไป");
process.exit(0);
