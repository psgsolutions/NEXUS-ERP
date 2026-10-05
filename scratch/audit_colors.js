const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const files = getAllFiles(path.join(__dirname, '../src'));
const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;

const matchesMap = {};

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');

  lines.forEach((line, index) => {
    let match;
    while ((match = hexRegex.exec(line)) !== null) {
      const hex = '#' + match[1].toUpperCase();
      // Normalize #FFF -> #FFFFFF
      let normHex = hex;
      if (hex.length === 4) {
        normHex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      if (!matchesMap[normHex]) {
        matchesMap[normHex] = { count: 0, occurrences: [] };
      }
      matchesMap[normHex].count++;
      matchesMap[normHex].occurrences.push({
        file: relPath,
        line: index + 1,
        snippet: line.trim()
      });
    }
  });
});

console.log(JSON.stringify(matchesMap, null, 2));
