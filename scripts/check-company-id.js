const fs = require('fs');
const path = require('path');

/**
 * NEXUS ERP — Strict Field Naming Regression Guard
 * Ensures no snake_case `company_id` references exist in `src/` codebase.
 */

function scanDirectory(dir, occurrences = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      scanDirectory(fullPath, occurrences);
    } else if (file.isFile() && /\.(ts|tsx|js|jsx)$/.test(file.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes('company_id')) {
          occurrences.push({
            file: fullPath,
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }
  }

  return occurrences;
}

console.log("🛡️ Running NEXUS ERP Regression Guard: Checking for forbidden 'company_id' references in src/...");

const srcDir = path.join(__dirname, '..', 'src');
const violations = scanDirectory(srcDir);

if (violations.length > 0) {
  console.error("\n❌ REGRESSION CHECK FAILED! Found forbidden 'company_id' field references:");
  violations.forEach(v => {
    console.error(`  - ${v.file}:${v.line} => ${v.content}`);
  });
  console.error("\n⚠️ All tenant isolation fields must use camelCase 'companyId' strictly.\n");
  process.exit(1);
} else {
  console.log("✅ REGRESSION CHECK PASSED! Zero 'company_id' references found in src/ codebase.");
  process.exit(0);
}
