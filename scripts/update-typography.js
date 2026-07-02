const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../src/app/(authenticated)');

function updateTypography(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // 1. Text sizes and font weights (targeting small hard-to-read text)
  // We want to bump sizes up and reduce weight from black to bold or medium
  content = content.replace(/text-\[8px\] font-black/g, 'text-[10px] font-medium');
  content = content.replace(/text-\[9px\] font-black/g, 'text-xs font-medium');
  content = content.replace(/text-\[10px\] font-black/g, 'text-sm font-medium');
  content = content.replace(/text-\[11px\] font-black/g, 'text-sm font-medium');
  
  content = content.replace(/text-\[8px\]/g, 'text-[10px]');
  content = content.replace(/text-\[9px\]/g, 'text-xs');
  
  // also target cases where font-black is separate
  content = content.replace(/text-\[10px\]([^"]*)font-black/g, 'text-xs$1font-medium');
  content = content.replace(/text-\[11px\]([^"]*)font-black/g, 'text-sm$1font-medium');
  
  // change remaining font-black in small text contexts (assuming it's mostly labels)
  // Just blanket replace font-black with font-bold to soften it overall
  content = content.replace(/font-black/g, 'font-bold');

  // 2. Reduce margin and padding in cards further
  // GlassCard p-5 -> p-4
  content = content.replace(/<GlassCard([^>]*)p-5/g, '<GlassCard$1p-4');
  content = content.replace(/<GlassCard([^>]*)p-6/g, '<GlassCard$1p-4');
  
  // space-y-4 -> space-y-3 in card contents
  content = content.replace(/className="([^"]*)space-y-4([^"]*)"/g, 'className="$1space-y-3$2"');
  
  // Ensure right sidebar is 280px (some missed it previously)
  content = content.replace(/lg:w-\[[34][0-9]{2}px\]/g, 'lg:w-[280px]');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (file === 'page.tsx') {
      updateTypography(fullPath);
    }
  }
}

walkDir(targetDir);
console.log('Typography update complete.');
