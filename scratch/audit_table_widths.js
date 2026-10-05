const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const files = getAllFiles(path.join(__dirname, '../src'));
const occurrences = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');

  lines.forEach((line, index) => {
    if ((line.includes('<th') || line.includes('<td') || line.includes('NexusTableCell') || line.includes('SmartTableColumn') || line.includes('col')) && /\bw-(20|24|28|32|36|40|48|56|64)\b/.test(line)) {
      occurrences.push({
        file: relPath,
        line: index + 1,
        snippet: line.trim()
      });
    }
  });
});

console.log(`Found ${occurrences.length} table column hardcoded fixed width occurrences.`);
fs.writeFileSync(path.join(__dirname, 'table_widths.json'), JSON.stringify(occurrences, null, 2));
