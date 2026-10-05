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
    if (line.includes('font-black')) {
      occurrences.push({
        file: relPath,
        line: index + 1,
        snippet: line.trim()
      });
    }
  });
});

console.log(`Total occurrences of 'font-black': ${occurrences.length}`);
fs.writeFileSync(path.join(__dirname, 'font_black_matches.json'), JSON.stringify(occurrences, null, 2));
