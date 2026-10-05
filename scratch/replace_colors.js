const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const files = getAllFiles(path.join(__dirname, '../src'));

let totalReplacements = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Surface 0 (#0D0D0D / #050508)
  content = content.replace(/bg-\[#0[dD]0[dD]0[dD]\]/g, 'bg-surface-0');
  content = content.replace(/from-\[#0[dD]0[dD]0[dD]\]/g, 'from-surface-0');
  content = content.replace(/via-\[#0[dD]0[dD]0[dD]\]/g, 'via-surface-0');
  content = content.replace(/to-\[#0[dD]0[dD]0[dD]\]/g, 'to-surface-0');
  content = content.replace(/bg-\[#050508\]/g, 'bg-surface-0');

  // Surface 1 (#111111 / #111)
  content = content.replace(/bg-\[#111111\]/g, 'bg-surface-1');
  content = content.replace(/bg-\[#111\]/g, 'bg-surface-1');

  // Surface 2 (#1C1C24)
  content = content.replace(/bg-\[#1[cC]1[cC]24\]/g, 'bg-surface-2');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplacements++;
    console.log(`Updated: ${path.relative(path.join(__dirname, '..'), file)}`);
  }
});

console.log(`\nTotal additional files updated: ${totalReplacements}`);
