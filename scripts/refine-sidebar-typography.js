const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../src/app/(authenticated)');

function refineFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // We want to target the right sidebar cards. We know the sidebar starts with:
  // lg:w-[280px]
  // We can just find that block. A simple way in JS is to split by lg:w-[280px]
  // and only modify the content after it (since it's usually at the end of the page).
  
  const parts = content.split('lg:w-[280px]');
  if (parts.length > 1) {
    // The first part is everything before the sidebar
    // The rest is the sidebar and onwards
    
    let sidebarContent = parts.slice(1).join('lg:w-[280px]');
    
    // typography adjustments in sidebar
    sidebarContent = sidebarContent.replace(/text-\[8px\]/g, 'text-[10px]');
    sidebarContent = sidebarContent.replace(/text-\[9px\]/g, 'text-xs');
    sidebarContent = sidebarContent.replace(/text-\[10px\]/g, 'text-sm');
    sidebarContent = sidebarContent.replace(/text-\[11px\]/g, 'text-sm');
    
    sidebarContent = sidebarContent.replace(/font-black/g, 'font-medium');
    sidebarContent = sidebarContent.replace(/font-bold/g, 'font-medium');
    
    // padding and margin adjustments in sidebar
    sidebarContent = sidebarContent.replace(/p-5/g, 'p-4');
    sidebarContent = sidebarContent.replace(/space-y-4/g, 'space-y-3');
    sidebarContent = sidebarContent.replace(/gap-4/g, 'gap-3');
    
    // Reassemble
    content = parts[0] + 'lg:w-[280px]' + sidebarContent;
  }

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
      refineFile(fullPath);
    }
  }
}

walkDir(targetDir);
console.log('Typography and spacing refinement complete.');
