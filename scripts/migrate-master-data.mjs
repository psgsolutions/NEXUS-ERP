// ย้ายข้อมูลหลักเข้าโครงสร้างเครือบริษัท (ข้อมูลกลาง groups/{g} + ข้อมูลของบริษัท companies/{c})
//
//   node scripts/migrate-master-data.mjs                         จำลอง (dry-run) อ่านอย่างเดียว ไม่แก้ข้อมูล
//   node scripts/migrate-master-data.mjs --report=out.json       + บันทึกรายงานละเอียด
//   node scripts/migrate-master-data.mjs --apply --backup=b.json  เขียนจริง (ต้องได้รับการยืนยันจากเจ้าของระบบก่อน)
//        --company=ID                                            เฉพาะบริษัทเดียว (บริษัททดสอบ TEST-* ข้ามการตรวจกฎได้)
//        --delete-root-customers                                  ลบ root customers ที่ซ้ำกับลูกค้าของบริษัท (มีสำรองในไฟล์)
//
// สิ่งที่ทำ (ต่อบริษัท C ในเครือ g = companies/C.groupId หรือ C):
//  - สินค้า / ผู้ขาย / ผู้รับเหมา จาก root {entity} (companyId = C): ข้อมูลตัวตน+ค่ากลาง -> groups/g/{entity}/{id},
//    ที่เหลือ (ราคา สต็อก ต้นทุน เครดิต) -> companies/C/{entity}/{id}  (id เดิม เอกสารที่อ้างอิงไม่เสีย)
//    เอกสาร root เดิมไม่ลบ ใส่ migratedTo ไว้ (ระบบอ่านข้อมูลกลางก่อนเสมอ)
//  - ลูกค้า companies/C/customers: ย้ายตัวตน+ค่ากลางขึ้น groups/g/customers และลบฟิลด์เหล่านั้นออกจากเอกสารของบริษัท
//  - คลัง root warehouses/{C}_{code} -> groups/g/warehouses/{code} (เจ้าของ = C)
//  - ดัชนีห้ามซ้ำ (SKU/บาร์โค้ด/เลขผู้เสียภาษี+สาขา) ใน groups/g/unique_keys — ค่าที่ซ้ำกันเองจะรายงาน ไม่สร้างดัชนีให้รายการหลัง
// รันซ้ำได้: รายการที่มีข้อมูลกลางแล้วจะข้าม
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
require(path.join(root, "node_modules/@next/env")).loadEnvConfig(root);
const admin = require(path.join(root, "node_modules/firebase-admin"));
const { MASTER_SCHEMAS, groupIdOf, uniqueKeyValue, uniqueKeyDocId } = await import(pathToFileURL(path.join(root, "src/lib/master-data.ts")).href);

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const APPLY = process.argv.includes("--apply");
const DELETE_ROOT_CUSTOMERS = process.argv.includes("--delete-root-customers");
const reportFile = arg("report");
const onlyCompany = arg("company");
const backupFile = arg("backup");
if (APPLY && !backupFile) { console.error("--apply ต้องระบุ --backup=ไฟล์ สำหรับสำรองข้อมูลก่อนเขียน"); process.exit(2); }

const credential = admin.credential.cert({
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
});
admin.initializeApp({ credential });
const db = admin.firestore();
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// ---------- ตรวจความพร้อมก่อนเขียนจริง: กฎบนเว็บต้องรู้จักข้อมูลกลางของเครือแล้ว ----------
async function deployedRules() {
  const { access_token } = await credential.getAccessToken();
  const h = { Authorization: `Bearer ${access_token}` };
  const rel = await (await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, { headers: h })).json();
  if (!rel.rulesetName) return { ok: false, note: "อ่านกฎที่ deploy ไม่ได้" };
  const rs = await (await fetch(`https://firebaserules.googleapis.com/v1/${rel.rulesetName}`, { headers: h })).json();
  const src = rs.source?.files?.[0]?.content || "";
  return { ok: src.includes("match /groups/{groupId}") && src.includes("'products', 'customers', 'suppliers', 'contractors'"), updated: rel.updateTime };
}

const ENT = ["products", "suppliers", "contractors"]; // root รุ่นเก่า
const pick = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k, v]) => keys.includes(k) && v !== undefined));
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
/** รวมแบบลงลึกในก้อนย่อย (เช่น pricing) — ค่าที่บริษัทตั้งทับไม่ลบฟิลด์อื่นในก้อนเดียวกัน */
const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = isPlain(v) && isPlain(out[k]) ? deepMerge(out[k], v) : v;
  return out;
}
const SYSTEM = ["id", "companyId", "groupId", "migratedTo", "migratedAt"];

/** แยกเอกสารเดิมเป็นข้อมูลกลาง / ข้อมูลของบริษัท */
function split(entity, data) {
  const s = MASTER_SCHEMAS[entity];
  const keys = [...s.identity, ...s.shared];
  const norm = { ...data };
  if (entity !== "products") {
    const tax = String(norm.taxId ?? norm.tax_id ?? "").replace(/\D/g, "");
    if (tax) norm.taxId = tax;
    if (!norm.branchCode && norm.branch_code) norm.branchCode = String(norm.branch_code);
    if (!norm.name) norm.name = norm.customerName || norm.supplierName || norm.companyName || "";
  }
  return { master: pick(omit(norm, SYSTEM), keys), local: omit(norm, [...SYSTEM, ...keys]) };
}

const companies = (await db.collection("companies").get()).docs.filter((d) => d.data().isDeleted !== true && (!onlyCompany || d.id === onlyCompany));
const plan = { generatedAt: new Date().toISOString(), projectId, mode: APPLY ? "apply" : "dry-run", companies: {}, totals: {} };
const backup = { takenAt: plan.generatedAt, docs: {} };
const writes = []; // { op: "set"|"update"|"delete", path, data?, merge? }
const keyOwners = new Map(); // `${g}|${keyDocId}` -> id

async function existing(p) { return (await db.doc(p).get()).exists; }

for (const c of companies) {
  const C = c.id; const g = groupIdOf(c.data(), C);
  const rep = (plan.companies[C] = { name: c.data().name || "", groupId: g, entities: {}, warehouses: [], rootCustomerDuplicates: 0, issues: [] });
  const now = admin.firestore.FieldValue.serverTimestamp();

  const addKeys = async (entity, id, master) => {
    for (const fields of MASTER_SCHEMAS[entity].unique) {
      const v = uniqueKeyValue(fields, master);
      if (!v) continue;
      const kid = uniqueKeyDocId(entity, fields, v);
      const k = `${g}|${kid}`;
      const holder = keyOwners.get(k) ?? ((await db.doc(`groups/${g}/unique_keys/${kid}`).get()).data()?.id || null);
      if (holder && holder !== id) { rep.issues.push(`${MASTER_SCHEMAS[entity].label} ${id}: ${fields.join("+")} ${v} ซ้ำกับ ${holder} (ไม่สร้างดัชนี — ตรวจและรวมรายการภายหลัง)`); continue; }
      keyOwners.set(k, id);
      writes.push({ op: "set", path: `groups/${g}/unique_keys/${kid}`, data: { entity, fields, value: v, id } });
    }
  };

  // สินค้า / ผู้ขาย / ผู้รับเหมา จาก root
  for (const entity of ENT) {
    const r = (rep.entities[entity] = { source: 0, migrate: 0, alreadyMigrated: 0, deleted: 0, withLocalOverlay: 0 });
    const snap = await db.collection(entity).where("companyId", "==", C).get();
    r.source = snap.size;
    for (const d of snap.docs) {
      const data = d.data();
      if (await existing(`groups/${g}/${entity}/${d.id}`)) { r.alreadyMigrated++; continue; }
      if (data.isDeleted === true) r.deleted++;
      backup.docs[d.ref.path] = data;
      const localPath = `companies/${C}/${entity}/${d.id}`;
      const overlay = (await db.doc(localPath).get()).data();
      if (overlay) { r.withLocalOverlay++; backup.docs[localPath] = overlay; }
      const { master, local } = split(entity, data);
      // ค่าที่บริษัทเคยตั้งทับ (เช่น ราคาจากใบเสนอราคา) ยังมีผลเหนือข้อมูลเดิม
      writes.push({ op: "set", path: `groups/${g}/${entity}/${d.id}`, data: { ...master, groupId: g, createdByCompany: C, migratedFrom: d.ref.path, isDeleted: false, createdAt: data.createdAt || now, updatedAt: now } });
      writes.push({ op: "set", path: localPath, data: { ...deepMerge(local, overlay || {}), companyId: C, groupId: g, isDeleted: data.isDeleted === true, migratedFrom: d.ref.path, updatedAt: now } });
      writes.push({ op: "set", path: `groups/${g}/${entity}/${d.id}/history/migrate`, data: { at: now, by: "migration", companyId: C, action: "migrate", from: d.ref.path } });
      writes.push({ op: "update", path: d.ref.path, data: { migratedTo: `groups/${g}/${entity}/${d.id}`, migratedAt: now } });
      if (data.isDeleted !== true) await addKeys(entity, d.id, master);
      r.migrate++;
    }
  }

  // ลูกค้า (อยู่ใต้บริษัทแล้ว)
  {
    const r = (rep.entities.customers = { source: 0, migrate: 0, alreadyMigrated: 0, deleted: 0 });
    const snap = await db.collection(`companies/${C}/customers`).get();
    r.source = snap.size;
    const s = MASTER_SCHEMAS.customers;
    for (const d of snap.docs) {
      const data = d.data();
      if (await existing(`groups/${g}/customers/${d.id}`)) { r.alreadyMigrated++; continue; }
      if (data.isDeleted === true) r.deleted++;
      backup.docs[d.ref.path] = data;
      const { master } = split("customers", data);
      writes.push({ op: "set", path: `groups/${g}/customers/${d.id}`, data: { ...master, groupId: g, createdByCompany: C, migratedFrom: d.ref.path, isDeleted: false, createdAt: data.createdAt || now, updatedAt: now } });
      writes.push({ op: "set", path: `groups/${g}/customers/${d.id}/history/migrate`, data: { at: now, by: "migration", companyId: C, action: "migrate", from: d.ref.path } });
      // ฟิลด์ตัวตน/ค่ากลางย้ายขึ้นข้อมูลกลาง -> ลบออกจากเอกสารของบริษัท (ไม่งั้นจะกลายเป็นค่าที่บริษัทตั้งทับ)
      const remove = Object.keys(data).filter((k) => [...s.identity, ...s.shared].includes(k));
      writes.push({ op: "updateDelete", path: d.ref.path, fields: remove, data: { groupId: g, updatedAt: now } });
      if (data.isDeleted !== true) await addKeys("customers", d.id, master);
      r.migrate++;
    }
    // root customers ที่ซ้ำกับลูกค้าของบริษัท (ไม่มีเอกสารใดอ้างอิง)
    const rootCust = await db.collection("customers").where("companyId", "==", C).get();
    rep.rootCustomerDuplicates = rootCust.size;
    if (DELETE_ROOT_CUSTOMERS) for (const d of rootCust.docs) { backup.docs[d.ref.path] = d.data(); writes.push({ op: "delete", path: d.ref.path }); }
  }

  // คลัง
  const whs = await db.collection("warehouses").where("companyId", "==", C).get();
  for (const d of whs.docs) {
    const w = d.data();
    const code = w.code || d.id.replace(`${C}_`, "");
    if (await existing(`groups/${g}/warehouses/${code}`)) { rep.warehouses.push({ code, status: "มีที่เครือแล้ว (ข้าม)" }); continue; }
    if (w.isDeleted === true) continue;
    backup.docs[d.ref.path] = w;
    const zones = Array.isArray(w.zones) ? w.zones : [];
    const bins = zones.reduce((s, z) => s + (z.racks || []).reduce((t, r) => t + (Number(r.levels) || 1) * (Number(r.bins) || 1), 0), 0);
    writes.push({ op: "set", path: `groups/${g}/warehouses/${code}`, data: { ...omit(w, ["companyId"]), code, groupId: g, ownerCompanyId: C, migratedFrom: d.ref.path, updatedAt: now } });
    writes.push({ op: "update", path: d.ref.path, data: { migratedTo: `groups/${g}/warehouses/${code}`, migratedAt: now } });
    rep.warehouses.push({ code, name: w.name || code, zones: zones.length, bins, legacyRacks: (w.racks || []).length });
  }
}

// ---------- สรุป ----------
const tot = (k) => Object.values(plan.companies).reduce((s, c) => s + Object.values(c.entities).reduce((t, e) => t + (e[k] || 0), 0), 0);
plan.totals = { migrate: tot("migrate"), alreadyMigrated: tot("alreadyMigrated"), writes: writes.length };
console.log(`\n${APPLY ? "ย้ายข้อมูลจริง" : "จำลองการย้ายข้อมูล (อ่านอย่างเดียว)"} — โปรเจกต์ ${projectId}\n`);
for (const [C, r] of Object.entries(plan.companies)) {
  console.log(`บริษัท ${C} ${r.name} → เครือ ${r.groupId}`);
  for (const [e, x] of Object.entries(r.entities)) if (x.source) console.log(`  ${MASTER_SCHEMAS[e].label.padEnd(10)} ทั้งหมด ${x.source}  ย้าย ${x.migrate}  ย้ายแล้ว ${x.alreadyMigrated}${x.deleted ? `  (ถูกลบ ${x.deleted})` : ""}${x.withLocalOverlay ? `  (มีค่าที่บริษัทตั้งทับ ${x.withLocalOverlay})` : ""}`);
  for (const w of r.warehouses) console.log(`  คลัง ${w.code} ${w.name || ""} ${w.status || `→ คลังของเครือ (โซน ${w.zones}, ช่อง ${w.bins}${w.legacyRacks ? `, ผังแบบเก่า ${w.legacyRacks} ชั้นวาง` : ""})`}`);
  if (r.rootCustomerDuplicates) console.log(`  root customers ที่ซ้ำ: ${r.rootCustomerDuplicates} ${DELETE_ROOT_CUSTOMERS ? "→ ลบ" : "(คงไว้ ใช้ --delete-root-customers เพื่อลบ)"}`);
  for (const i of r.issues) console.log(`  ⚠ ${i}`);
}
console.log(`\nรวม: ย้าย ${plan.totals.migrate} รายการ, ย้ายแล้ว ${plan.totals.alreadyMigrated}, การเขียน ${writes.length} ครั้ง`);
if (reportFile) { writeFileSync(reportFile, JSON.stringify({ ...plan, writes: writes.map((w) => ({ op: w.op, path: w.path })) }, null, 2)); console.log(`รายงาน: ${reportFile}`); }

if (!APPLY) { console.log("\n(จำลองเท่านั้น ไม่มีการแก้ข้อมูล)"); process.exit(0); }

// ---------- เขียนจริง ----------
const rules = onlyCompany?.startsWith("TEST-") ? { ok: true } : await deployedRules();
if (!rules.ok) { console.error(`\nหยุด: กฎบนเว็บยังไม่รองรับข้อมูลกลางของเครือ (deploy เมื่อ ${rules.updated || "-"}) — deploy firestore.rules ก่อน`); process.exit(3); }
writeFileSync(backupFile, JSON.stringify(backup, (k, v) => (v && typeof v.toDate === "function" ? { _ts: v.toDate().toISOString() } : v), 2));
console.log(`สำรองข้อมูลเดิม ${Object.keys(backup.docs).length} เอกสาร -> ${backupFile}`);
for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const w of writes.slice(i, i + 400)) {
    const ref = db.doc(w.path);
    if (w.op === "set") batch.set(ref, w.data, { merge: true });
    else if (w.op === "update") batch.update(ref, w.data);
    else if (w.op === "delete") batch.delete(ref);
    else if (w.op === "updateDelete") batch.update(ref, { ...w.data, ...Object.fromEntries(w.fields.map((f) => [f, admin.firestore.FieldValue.delete()])) });
  }
  await batch.commit();
  console.log(`  เขียนแล้ว ${Math.min(i + 400, writes.length)}/${writes.length}`);
}
console.log("เสร็จ");
process.exit(0);
