/**
 * [E2E] รันชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server
 *   npm run test:e2e                 ทุกชุด
 *   npm run test:e2e -- d2 p6 pos    เฉพาะชุดที่ระบุ
 *   npm run test:e2e -- --list       รายชื่อชุด
 *
 * ขั้นตอน: ตรวจ server -> รันทีละชุด (เก็บ/คืนตัวนับเลขเอกสารของบริษัทรอบชุดนั้น) -> ตรวจข้อมูลค้าง/ตัวนับ -> ล้าง audit log ของผู้ใช้ทดสอบ (สำรองก่อน)
 * ข้อควรระวัง: ระหว่างรันชุดหนึ่ง ถ้ามีผู้ใช้จริงออกเลขเอกสาร เลขนั้นจะถูกคืนค่าทับ (ระบบกันเลขซ้ำด้วย create แต่เอกสารถัดไปจะออกไม่ได้จนกว่าจะแก้ตัวนับ)
 * จึงควรรันนอกเวลาทำงาน — เครื่องมือตรวจตัวนับด้านท้ายจะรายงานถ้าเกิดกรณีนี้
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { db, COMPANY } = require("./tools/db.cjs");
const { leftovers, counters, testLogs } = require("./tools/checks.cjs");

const SUITES_DIR = path.join(__dirname, "suites");
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const all = fs.readdirSync(SUITES_DIR).filter((f) => f.endsWith(".cjs")).map((f) => f.replace(/\.cjs$/, "")).sort();

function runSuite(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(SUITES_DIR, `${name}.cjs`)], { env: { ...process.env, E2E_BASE: BASE }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => { child.kill(); out += "\nERROR timeout 10 min"; }, 10 * 60e3);
    child.on("close", () => { clearTimeout(timer); resolve(out); });
  });
}

(async () => {
  const args = process.argv.slice(2);
  if (args.includes("--list")) { console.log(all.join("\n")); process.exit(0); }
  const pick = args.filter((a) => !a.startsWith("--"));
  const unknown = pick.filter((n) => !all.includes(n));
  if (unknown.length) { console.error(`ไม่พบชุดทดสอบ: ${unknown.join(", ")} (ดู --list)`); process.exit(2); }
  const suites = pick.length ? pick : all;

  // ป้องกันยิงใส่ production โดยไม่ตั้งใจ
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) && process.env.E2E_ALLOW_REMOTE !== "1") {
    console.error(`E2E_BASE=${BASE} ไม่ใช่เครื่องนี้ — ตั้ง E2E_ALLOW_REMOTE=1 ถ้าตั้งใจทดสอบเครื่องอื่น`); process.exit(2);
  }
  const health = await fetch(`${BASE}/login`).then((r) => r.status).catch(() => 0);
  if (health !== 200) { console.error(`dev server ไม่ตอบที่ ${BASE} (เปิด npm run dev ก่อน)`); process.exit(2); }
  console.log(`E2E -> ${BASE} · project ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID} · company ${COMPANY} · ${suites.length} ชุด\n`);

  const counterCol = db.collection(`companies/${COMPANY}/counters`);
  let failed = 0;
  const started = Date.now();
  for (const name of suites) {
    const before = new Map((await counterCol.get()).docs.map((d) => [d.id, d.data()]));
    const t0 = Date.now();
    const out = await runSuite(name);
    // คืนตัวนับเลขเอกสารของบริษัท (ชุดทดสอบออกเลขจริงผ่าน API)
    for (const d of (await counterCol.get()).docs) {
      if (!before.has(d.id)) await d.ref.delete(); else await d.ref.set(before.get(d.id));
    }
    const pass = (out.match(/^PASS/gm) || []).length;
    const fail = (out.match(/^FAIL|^ERROR|\d+ FAILED/gm) || []).length;
    if (fail || !pass) failed++;
    console.log(`${fail || !pass ? "✗" : "✓"} ${name.padEnd(10)} pass ${String(pass).padStart(3)}  fail ${fail}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (fail || !pass) out.split("\n").filter((l) => /^FAIL|^ERROR/.test(l) || (!pass && l.trim())).slice(0, 6).forEach((l) => console.log(`    ${l.slice(0, 300)}`));
  }

  console.log("\nตรวจข้อมูลหลังทดสอบ");
  const [l, c, t] = [await leftovers(), await counters(), await testLogs(true)];
  console.log(`  เอกสาร TEST ค้าง: ${l.length}${l.length ? ` -> ${l.slice(0, 10).join(", ")}` : ""}`);
  console.log(`  ตัวนับต่ำกว่าเลขจริง: ${c.length}${c.length ? ` -> ${c.map((x) => x.prefix).join(", ")}` : ""}`);
  console.log(`  audit log ของการทดสอบ: ลบ ${t.count}${t.backup ? ` (สำรอง ${path.relative(process.cwd(), t.backup)})` : ""}`);
  console.log(`\n${failed ? `${failed} ชุดไม่ผ่าน` : "ผ่านทุกชุด"} · ${((Date.now() - started) / 60e3).toFixed(1)} นาที`);
  process.exit(failed || l.length || c.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
