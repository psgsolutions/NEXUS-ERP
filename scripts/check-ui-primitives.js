const fs = require('fs');
const path = require('path');

/**
 * NEXUS ERP — UI Primitive Guard (C-21)
 * 1) ปุ่ม/ช่องกรอกของคอมโพเนนต์กลาง (PillButton, PillInput, PillSelect) ใช้ความสูง 3 ขนาดเท่านั้น:
 *    h-8 ตาราง/แถบเครื่องมือ · h-9 ฟอร์ม · h-12 POS/มือถือ (ไม่ใส่ = ค่าตั้งต้น h-8)
 * 2) <button> <input> <select> <textarea> ดิบนอก src/components/ui ห้ามเพิ่มจากค่าฐาน (ui-primitives-baseline.json)
 *    ช่องที่ต้องดิบโดยธรรมชาติไม่นับ: input type file/range/checkbox/radio/color/hidden
 * ลดได้แล้ว: node scripts/check-ui-primitives.js --update เพื่อบันทึกค่าฐานใหม่
 */

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(__dirname, 'ui-primitives-baseline.json');
const ALLOWED_H = new Set(['h-8', 'h-9', 'h-12']);
const NATIVE_INPUT = /\btype=("|\{["'`]?)(file|range|checkbox|radio|color|hidden)\b/;

/** จุดจบของแท็กที่เริ่มที่ i (ข้าม {} และสตริง) */
function tagEnd(s, i) {
  let depth = 0, q = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === q && s[j - 1] !== '\\') q = null; continue; }
    if (c === '"' || (depth > 0 && (c === "'" || c === '`'))) { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return j;
  }
  return s.length - 1;
}

function scan(file) {
  const s = fs.readFileSync(file, 'utf8');
  const lineOf = (i) => s.slice(0, i).split('\n').length;
  const raw = { button: 0, input: 0, select: 0, textarea: 0 };
  const heights = [];
  const re = /<(button|input|select|textarea|PillButton|PillInput|PillSelect)(?=[\s/>])/g;
  let m;
  while ((m = re.exec(s))) {
    const tag = s.slice(m.index, tagEnd(s, m.index) + 1);
    if (m[1].startsWith('Pill')) {
      const cls = (tag.match(/className=("[^"]*"|\{[^}]*\})/) || [])[1] || '';
      for (const h of cls.match(/(?<![\w:\[-])h-(\d+|\[[^\]]+\])(?![\w\]-])/g) || []) {
        if (!ALLOWED_H.has(h)) heights.push(`${m[1]} ${h} (บรรทัด ${lineOf(m.index)})`);
      }
    } else if (!(m[1] === 'input' && NATIVE_INPUT.test(tag))) {
      raw[m[1]]++;
    }
  }
  return { raw, heights };
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(f.name)) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const files = walk(path.join(ROOT, 'src'));
const current = {};
const heightErrors = [];
for (const f of files) {
  const r = rel(f);
  const { raw, heights } = scan(f);
  heights.forEach((h) => heightErrors.push(`${r}: ${h}`));
  if (r.startsWith('src/components/ui/')) continue;
  const total = raw.button + raw.input + raw.select + raw.textarea;
  if (total) current[r] = raw;
}

console.log('🧩 Running NEXUS ERP UI Primitive Guard: PillButton/PillInput heights + raw controls vs baseline...');

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  const sum = Object.values(current).reduce((a, r) => a + r.button + r.input + r.select + r.textarea, 0);
  console.log(`📝 Baseline updated: ${Object.keys(current).length} files, ${sum} raw controls.`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const grew = [];
let improved = 0;
for (const [file, r] of Object.entries(current)) {
  const b = baseline[file] || { button: 0, input: 0, select: 0, textarea: 0 };
  for (const k of Object.keys(r)) {
    if (r[k] > (b[k] || 0)) grew.push(`${file}: raw <${k}> ${b[k] || 0} → ${r[k]} (ใช้ PillButton/PillInput/PillSelect จาก @/components/ui/Base)`);
    else if (r[k] < (b[k] || 0)) improved++;
  }
}

if (heightErrors.length || grew.length) {
  console.error('\n❌ UI PRIMITIVE CHECK FAILED!');
  heightErrors.forEach((e) => console.error(`  - ${e} → ใช้ h-8 (ตาราง/แถบเครื่องมือ), h-9 (ฟอร์ม) หรือ h-12 (POS/มือถือ)`));
  grew.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`✅ UI PRIMITIVE CHECK PASSED!${improved ? ` (${improved} counts below baseline — run with --update to lock in)` : ''}`);
process.exit(0);
