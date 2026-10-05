const fs = require('fs');
const path = require('path');

const summaryData = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit_summary.json'), 'utf8'));

// Build set of Group A file/line targets
const groupATargets = new Set();
summaryData.groupA.forEach(item => {
  groupATargets.add(`${item.file}:${item.line}`);
});
// Add ambiguous items (user approved converting all 4 to Group A)
summaryData.ambiguous.forEach(item => {
  groupATargets.add(`${item.file}:${item.line}`);
});

console.log(`Targeting ${groupATargets.size} Group A lines for font-weight adjustment...`);

// Group targets by file
const fileMap = {};
groupATargets.forEach(target => {
  const lastColon = target.lastIndexOf(':');
  const file = target.substring(0, lastColon);
  const line = parseInt(target.substring(lastColon + 1), 10);
  if (!fileMap[file]) fileMap[file] = [];
  fileMap[file].push(line);
});

let modifiedFiles = 0;
let modifiedLines = 0;

Object.entries(fileMap).forEach(([relFile, linesToFix]) => {
  const fullPath = path.join(__dirname, '..', relFile);
  if (!fs.existsSync(fullPath)) return;

  const content = fs.readFileSync(fullPath, 'utf8');
  const fileLines = content.split('\n');
  let fileChanged = false;

  linesToFix.forEach(lineNum => {
    const idx = lineNum - 1;
    if (idx >= 0 && idx < fileLines.length) {
      let origLine = fileLines[idx];
      // Convert font-black -> font-semibold in Group A target line
      if (origLine.includes('font-black')) {
        let newLine = origLine.replace(/\bfont-black\b/g, 'font-semibold');
        if (newLine !== origLine) {
          fileLines[idx] = newLine;
          fileChanged = true;
          modifiedLines++;
        }
      }
    }
  });

  if (fileChanged) {
    fs.writeFileSync(fullPath, fileLines.join('\n'), 'utf8');
    modifiedFiles++;
    console.log(`Updated ${linesToFix.length} lines in: ${relFile}`);
  }
});

console.log(`\nSuccessfully updated ${modifiedLines} lines across ${modifiedFiles} files!`);
