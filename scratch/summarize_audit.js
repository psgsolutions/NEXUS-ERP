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

const colorMap = {};

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');

  lines.forEach((line, index) => {
    let match;
    while ((match = hexRegex.exec(line)) !== null) {
      let rawHex = '#' + match[1].toUpperCase();
      let normHex = rawHex;
      if (rawHex.length === 4) {
        normHex = '#' + rawHex[1] + rawHex[1] + rawHex[2] + rawHex[2] + rawHex[3] + rawHex[3];
      }
      
      if (!colorMap[normHex]) {
        colorMap[normHex] = [];
      }
      
      let usage = "Other";
      if (line.includes("bg-") || line.includes("background")) usage = "Background";
      else if (line.includes("border-") || line.includes("border")) usage = "Border";
      else if (line.includes("text-") || line.includes("color:")) usage = "Text";
      else if (line.includes("shadow")) usage = "Shadow/Glow";
      else if (file.endsWith(".css")) usage = "CSS Token";

      colorMap[normHex].push({
        file: relPath,
        line: index + 1,
        usage,
        snippet: line.trim()
      });
    }
  });
});

const darkHexes = Object.keys(colorMap).filter(hex => {
  if (hex.length === 7) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return r <= 0x25 && g <= 0x25 && b <= 0x25;
  }
  return false;
});

darkHexes.sort((a, b) => colorMap[b].length - colorMap[a].length);

darkHexes.forEach(hex => {
  const occs = colorMap[hex];
  const filesList = [...new Set(occs.map(o => o.file))];
  const usages = [...new Set(occs.map(o => o.usage))].join(", ");
  console.log(`\n========================================`);
  console.log(`[HEX: ${hex}] - Total Count: ${occs.length} | Primary Usages: ${usages}`);
  console.log(`Unique Files (${filesList.length}): ${filesList.join(", ")}`);
  console.log(`Sample snippets:`);
  occs.slice(0, 10).forEach(o => {
    console.log(`  L${o.line} in ${o.file}: ${o.snippet}`);
  });
});
