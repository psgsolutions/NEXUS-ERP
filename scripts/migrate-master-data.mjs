// ย้ายข้อมูลหลักจาก root collection เข้า companies/{companyId}/{collection}
//
//   node scripts/migrate-master-data.mjs                 จำลอง (dry-run) อ่านอย่างเดียว ไม่แก้ข้อมูล
//   node scripts/migrate-master-data.mjs --report=out.json   บันทึกรายงานละเอียดเป็นไฟล์
//
// ขั้นตอนเขียนจริง (--apply) ยังไม่เปิดใช้: ต้องปรับโค้ดหน้าจอ/API ให้อ่านจากที่ใหม่ก่อน และผู้ใช้ยืนยันรายงานนี้
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
require(path.join(root, "node_modules/@next/env")).loadEnvConfig(root);
const admin = require(path.join(root, "node_modules/firebase-admin"));

if (process.argv.includes("--apply")) {
  console.error("ยังไม่เปิดใช้ --apply: ต้องได้รับการยืนยันรายงาน dry-run และปรับโค้ดให้อ่านจากที่ใหม่ก่อน");
  process.exit(2);
}
const reportArg = process.argv.find((a) => a.startsWith("--report="));

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});
const db = admin.firestore();

const MASTER = ["customers", "products", "suppliers", "contractors", "kits", "warehouses"];
const ACCOUNT_OK = /^\d{4}-\d{2}$/;

const companies = new Map((await db.collection("companies").get()).docs.map((d) => [d.id, d.data().name || d.data().companyName || ""]));
const report = { generatedAt: new Date().toISOString(), projectId: admin.app().options.credential?.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, companies: Object.fromEntries(companies), collections: {}, accountCodes: {} };

for (const col of MASTER) {
  const snap = await db.collection(col).get();
  const r = { rootDocs: snap.size, byCompany: {}, noCompanyId: [], unknownCompany: [], deleted: 0, samples: 0, conflicts: [], identicalInTarget: 0, subcollections: {}, targetExisting: {}, bytes: 0 };
  for (const d of snap.docs) {
    const data = d.data();
    r.bytes += Buffer.byteLength(JSON.stringify(data));
    if (data.isDeleted === true) r.deleted++;
    if (data.isSample === true) r.samples++;
    const c = data.companyId;
    if (!c) { r.noCompanyId.push(d.id); continue; }
    if (!companies.has(c)) { r.unknownCompany.push(`${d.id} (${c})`); continue; }
    r.byCompany[c] = (r.byCompany[c] || 0) + 1;
    // warehouses ใช้ id แบบ {companyId}_{code} — ที่ปลายทางใช้ id เดิมเพื่อไม่ให้ลิงก์เสีย
    const target = await db.doc(`companies/${c}/${col}/${d.id}`).get();
    if (target.exists) {
      if (JSON.stringify(target.data()) === JSON.stringify(data)) r.identicalInTarget++;
      else r.conflicts.push(d.id);
    }
    const subs = await d.ref.listCollections();
    for (const s of subs) {
      const n = (await s.count().get()).data().count;
      r.subcollections[s.id] = (r.subcollections[s.id] || 0) + n;
    }
  }
  for (const c of companies.keys()) {
    const n = (await db.collection(`companies/${c}/${col}`).count().get()).data().count;
    if (n) r.targetExisting[c] = n;
  }
  report.collections[col] = r;
}

// รหัสบัญชีที่ไม่ใช่รูปแบบ XXXX-XX (รุ่นเก่า 5/6 หลัก) ในบันทึกบัญชีทั้ง root และของบริษัท
const scanJournals = async (label, q) => {
  const snap = await q.get();
  for (const d of snap.docs) {
    const lines = Array.isArray(d.data().items) ? d.data().items : Array.isArray(d.data().lines) ? d.data().lines : [];
    for (const l of lines) {
      const code = String(l.accountCode ?? l.accountId ?? l.code ?? "").trim();
      if (!code || ACCOUNT_OK.test(code)) continue;
      const k = `${code}`;
      const e = (report.accountCodes[k] ||= { count: 0, names: new Set(), where: new Set(), status: new Set() });
      e.count++; if (l.accountName) e.names.add(String(l.accountName)); e.where.add(label); e.status.add(String(d.data().status || "posted"));
    }
  }
  return snap.size;
};
report.journalDocsScanned = { root: await scanJournals("root journal_entries", db.collection("journal_entries")) };
for (const c of companies.keys()) report.journalDocsScanned[c] = await scanJournals(`companies/${c}/journal_entries`, db.collection(`companies/${c}/journal_entries`));
for (const v of Object.values(report.accountCodes)) { v.names = [...v.names].slice(0, 3); v.where = [...v.where]; v.status = [...v.status]; }

// ---------- สรุป ----------
console.log(`\nจำลองการย้ายข้อมูลหลัก (อ่านอย่างเดียว) — โปรเจกต์ ${report.projectId}`);
console.log(`บริษัทในระบบ: ${[...companies].map(([id, n]) => `${id}${n ? ` (${n})` : ""}`).join(", ")}\n`);
console.log("collection     root  ย้ายได้  ไม่มีบริษัท  บริษัทไม่รู้จัก  ชนกับปลายทาง  ซ้ำเหมือนเดิม  ถูกลบ  ตัวอย่าง  subcollection");
for (const [col, r] of Object.entries(report.collections)) {
  const movable = Object.values(r.byCompany).reduce((a, b) => a + b, 0) - r.conflicts.length - r.identicalInTarget;
  const subs = Object.entries(r.subcollections).map(([k, v]) => `${k}:${v}`).join(" ") || "-";
  console.log(`${col.padEnd(13)} ${String(r.rootDocs).padStart(5)} ${String(movable).padStart(8)} ${String(r.noCompanyId.length).padStart(11)} ${String(r.unknownCompany.length).padStart(16)} ${String(r.conflicts.length).padStart(13)} ${String(r.identicalInTarget).padStart(14)} ${String(r.deleted).padStart(6)} ${String(r.samples).padStart(9)}  ${subs}`);
  if (Object.keys(r.targetExisting).length) console.log(`  มีข้อมูลอยู่ที่ปลายทางแล้ว: ${JSON.stringify(r.targetExisting)}`);
  if (r.noCompanyId.length) console.log(`  ไม่มี companyId: ${r.noCompanyId.slice(0, 8).join(", ")}${r.noCompanyId.length > 8 ? " …" : ""}`);
  if (r.unknownCompany.length) console.log(`  companyId ไม่มีในระบบ: ${r.unknownCompany.slice(0, 8).join(", ")}${r.unknownCompany.length > 8 ? " …" : ""}`);
  if (r.conflicts.length) console.log(`  ชน (ข้อมูลต่างกัน): ${r.conflicts.slice(0, 8).join(", ")}${r.conflicts.length > 8 ? " …" : ""}`);
}
const codes = Object.entries(report.accountCodes).sort((a, b) => b[1].count - a[1].count);
console.log(`\nรหัสบัญชีรูปแบบเก่าในบันทึกบัญชี (สแกน ${Object.values(report.journalDocsScanned).reduce((a, b) => a + b, 0)} รายการ): ${codes.length} รหัส`);
for (const [code, v] of codes.slice(0, 40)) console.log(`  ${code.padEnd(10)} ${String(v.count).padStart(5)} บรรทัด  ${v.names.join(" / ")}  [${v.status.join(",")}] ${v.where.join(", ")}`);
if (reportArg) { writeFileSync(reportArg.slice(9), JSON.stringify(report, null, 2)); console.log(`\nบันทึกรายงานที่ ${reportArg.slice(9)}`); }
process.exit(0);
