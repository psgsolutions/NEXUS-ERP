const fs = require('fs');
const path = require('path');

/**
 * NEXUS ERP — Thai-Only UI Label Guard Script (Patch 5)
 * Checks for banned English UI string patterns in JSX components.
 */

const forbiddenLabelPatterns = [
  { pattern: /HEALTHY MARGIN/i, message: "Use 'กำไรมาตรฐาน (ดี)' instead of HEALTHY MARGIN" },
  { pattern: /STRATEGIC MARGIN/i, message: "Use 'กำไรเหนือชั้น (ดีเยี่ยม)' instead of STRATEGIC MARGIN" },
  { pattern: /TACTICAL MARGIN/i, message: "Use 'กำไรแข่งขัน (ปานกลาง)' instead of TACTICAL MARGIN" },
  { pattern: /CRITICAL MARGIN/i, message: "Use 'กำไรวิกฤต (ต่ำ)' instead of CRITICAL MARGIN" },
  { pattern: /NEGATIVE MARGIN/i, message: "Use 'กำไรติดลบ' instead of NEGATIVE MARGIN" },
  { pattern: /Database Connected/i, message: "Use 'เชื่อมต่อฐานข้อมูลแล้ว' instead of Database Connected" },
  { pattern: /OPERATIONS\)/i, message: "Remove English brackets (OPERATIONS) from NavGroup title" },
  { pattern: /MANAGEMENT\)/i, message: "Remove English brackets (MANAGEMENT) from NavGroup title" },
  { pattern: /SYSTEM\)/i, message: "Remove English brackets (SYSTEM) from NavGroup title" }
];

function scanDirectory(dir, occurrences = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    const relPath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\\/g, '/');

    if (
      relPath.includes('node_modules') ||
      relPath.includes('.next') ||
      relPath.includes('src/lib/pdf/') ||
      relPath.includes('check-thai-labels.js')
    ) {
      continue;
    }

    if (file.isDirectory()) {
      scanDirectory(fullPath, occurrences);
    } else if (file.isFile() && /\.(tsx|jsx)$/.test(file.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const item of forbiddenLabelPatterns) {
          if (item.pattern.test(line)) {
            occurrences.push({
              file: relPath,
              line: index + 1,
              message: item.message,
              content: line.trim()
            });
          }
        }
      });
    }
  }

  return occurrences;
}

console.log("🇹🇭 Running NEXUS ERP Thai-Only UI Label Guard: Scanning JSX labels in src/...");

const srcDir = path.join(__dirname, '..', 'src');
const violations = scanDirectory(srcDir);

if (violations.length > 0) {
  console.error("\n❌ THAI LABEL CHECK FAILED! Found forbidden English UI strings:");
  violations.forEach(v => {
    console.error(`  - ${v.file}:${v.line} => ${v.message} (${v.content})`);
  });
  console.error("\n⚠️ All UI labels MUST be written in Thai language only per Rule 2.\n");
  process.exit(1);
} else {
  console.log("✅ THAI LABEL CHECK PASSED! All UI labels adhere to Thai-only standard.");
  process.exit(0);
}
