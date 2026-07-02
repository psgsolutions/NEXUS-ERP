const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('d:/NEXUS-ERP/src', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content
      // 9px to 10px font-normal
      .replace(/text-\[9px\]([^>]*?)font-black/g, 'text-[10px]$1font-normal')
      .replace(/font-black([^>]*?)text-\[9px\]/g, 'font-normal$1text-[10px]')
      // 10px to 11px font-medium
      .replace(/text-\[10px\]([^>]*?)font-black/g, 'text-[11px]$1font-medium')
      .replace(/font-black([^>]*?)text-\[10px\]/g, 'font-medium$1text-[11px]')
      // 11px to 12px font-medium
      .replace(/text-\[11px\]([^>]*?)font-black/g, 'text-[12px]$1font-medium')
      .replace(/font-black([^>]*?)text-\[11px\]/g, 'font-medium$1text-[12px]')
      // 12px to 13px font-medium
      .replace(/text-\[12px\]([^>]*?)font-black/g, 'text-[13px]$1font-medium')
      .replace(/font-black([^>]*?)text-\[12px\]/g, 'font-medium$1text-[13px]')
      // 13px font-bold to 14px font-medium
      .replace(/text-\[13px\]([^>]*?)font-bold/g, 'text-[14px]$1font-medium')
      .replace(/font-bold([^>]*?)text-\[13px\]/g, 'font-medium$1text-[14px]')
      // xs to 13px font-medium
      .replace(/text-xs([^>]*?)font-black/g, 'text-[13px]$1font-medium')
      .replace(/font-black([^>]*?)text-xs/g, 'font-medium$1text-[13px]');

    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
