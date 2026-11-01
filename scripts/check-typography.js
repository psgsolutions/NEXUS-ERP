const fs = require('fs');
const path = require('path');

/**
 * NEXUS ERP — Typography Guard (C-22, docs/TYPOGRAPHY_LANGUAGE_STANDARD.md)
 * - ตัวอักษรบนหน้าจอไม่ต่ำกว่า 11px (ป้ายกำกับ) · ไม่มีขนาดครึ่งพิกเซล (11.5px, 12.5px …)
 * - ห้ามตัวเอียง [TYP-01]: คลาส italic ใน className (not-italic ได้)
 * ยกเว้นเอกสาร PDF (src/lib/pdf) ซึ่งใช้หน่วย pt ของกระดาษ
 */

const TOO_SMALL = /(?<![\w-])text-\[(\d+(?:\.\d+)?)px\]/g;
const ITALIC = /className=(?:"[^"]*(?<![\w-])italic(?![\w-])[^"]*"|\{[^}]*["'`\s]italic["'`\s][^}]*\})/;

function scanDirectory(dir, occurrences = []) {
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, file.name);
    const relPath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\\/g, '/');
    if (relPath.includes('src/lib/pdf/')) continue;
    if (file.isDirectory()) { scanDirectory(fullPath, occurrences); continue; }
    if (!/\.tsx$/.test(file.name)) continue;
    fs.readFileSync(fullPath, 'utf8').split('\n').forEach((line, index) => {
      for (const m of line.matchAll(TOO_SMALL)) {
        const px = Number(m[1]);
        if (px < 11) occurrences.push({ file: relPath, line: index + 1, message: `text-[${m[1]}px] เล็กกว่า 11px → ใช้ text-[11px]` });
        else if (!Number.isInteger(px)) occurrences.push({ file: relPath, line: index + 1, message: `text-[${m[1]}px] ครึ่งพิกเซล → ปัดเป็นขนาดเต็ม (11/12/14px)` });
      }
      if (ITALIC.test(line)) occurrences.push({ file: relPath, line: index + 1, message: 'ห้ามตัวเอียง (italic) [TYP-01]' });
    });
  }
  return occurrences;
}

console.log('🔤 Running NEXUS ERP Typography Guard: min 11px, whole-pixel sizes, no italics in src/...');
const violations = scanDirectory(path.join(__dirname, '..', 'src'));
if (violations.length) {
  console.error('\n❌ TYPOGRAPHY CHECK FAILED!');
  violations.forEach((v) => console.error(`  - ${v.file}:${v.line} => ${v.message}`));
  process.exit(1);
}
console.log('✅ TYPOGRAPHY CHECK PASSED!');
process.exit(0);
