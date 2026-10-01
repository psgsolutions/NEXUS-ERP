const fs = require('fs');
const path = require('path');

/**
 * NEXUS ERP — Surface Elevation Token Guard
 * Ensures no hardcoded near-black background hex colors (e.g. #0D0D0D, #0A0A0C, #0F0F12, #14141A, #1A1A1A, #111111) exist in `src/`.
 * Exceptions: src/app/globals.css and tailwind.config.ts (the token source declarations), and PDF print documents.
 */

const darkHexPatterns = [
  /#0[dD]0[dD]0[dD]\b/,
  /#0[aA]0[aA]0[cC]\b/,
  /#0[fF]0[fF]12\b/,
  /#14141[aA]\b/,
  /#1[aA]1[aA]1[aA]\b/,
  /#1[aA]1[aA]20\b/,
  /#0[aA]1118\b/,
  /#050508\b/,
  /#080809\b/,
  /#0[eE]0[eE]11\b/,
  /#0[cC]0[cC]0[eE]\b/
];

function scanDirectory(dir, occurrences = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    const relPath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\\/g, '/');

    // Skip token declaration files and PDF rendering templates
    if (
      relPath === 'src/app/globals.css' ||
      relPath === 'tailwind.config.ts' ||
      relPath.includes('src/lib/pdf/') ||
      relPath.includes('DocumentPDFViewer.tsx') ||
      relPath.includes('ReportExporter.tsx')
    ) {
      continue;
    }

    if (file.isDirectory()) {
      scanDirectory(fullPath, occurrences);
    } else if (file.isFile() && /\.(ts|tsx|css)$/.test(file.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Only check background / color classes, ignoring standard text/transparent comments
        if (line.includes('bg-[#') || line.includes('from-[#') || line.includes('via-[#') || line.includes('to-[#')) {
          for (const pattern of darkHexPatterns) {
            if (pattern.test(line)) {
              occurrences.push({
                file: relPath,
                line: index + 1,
                content: line.trim()
              });
              break;
            }
          }
        }
      });
    }
  }

  return occurrences;
}

console.log("🛡️ Running NEXUS ERP Surface Token Guard: Checking for hardcoded near-black background hex colors in src/...");

const srcDir = path.join(__dirname, '..', 'src');
const violations = scanDirectory(srcDir);

if (violations.length > 0) {
  console.error("\n❌ REGRESSION CHECK FAILED! Found hardcoded near-black hex color references:");
  violations.forEach(v => {
    console.error(`  - ${v.file}:${v.line} => ${v.content}`);
  });
  console.error("\n⚠️ All background surfaces MUST use elevation tokens: bg-surface-0 (#0D0D0D), bg-surface-1 (#0F0F12), or bg-surface-2 (#14141A).\n");
  process.exit(1);
} else {
  console.log("✅ REGRESSION CHECK PASSED! Zero hardcoded near-black background hex colors found in src/ codebase.");
  process.exit(0);
}
