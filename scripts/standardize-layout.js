const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../src/app/(authenticated)');

function standardizeFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // 1. Grid layout to Flex layout conversion
  // Often it looks like: <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
  content = content.replace(/className="[^"]*grid grid-cols-1 lg:grid-cols-4 gap-[68][^"]*"/g, (match) => {
    let newClass = match.replace('grid grid-cols-1 lg:grid-cols-4', 'flex flex-col lg:flex-row items-start');
    newClass = newClass.replace(/gap-[68]/, 'gap-4');
    return newClass;
  });

  // 2. col-span-3 to flex-1 (Left content)
  content = content.replace(/className="[^"]*lg:col-span-3[^"]*"/g, (match) => {
    let newClass = match.replace('lg:col-span-3', 'flex-1 w-full');
    newClass = newClass.replace(/space-y-[68]/, 'space-y-4');
    return newClass;
  });

  // 3. col-span-1 to fixed width (Right content)
  content = content.replace(/className="[^"]*lg:col-span-1[^"]*"/g, (match) => {
    let newClass = match.replace('lg:col-span-1', 'w-full lg:w-[280px] shrink-0');
    newClass = newClass.replace(/space-y-[68]/, 'space-y-4');
    return newClass;
  });

  // 4. Update existing flex layouts (like inventory/page.tsx)
  content = content.replace(/className="[^"]*flex flex-col lg:flex-row gap-[68][^"]*"/g, (match) => {
    return match.replace(/gap-[68]/, 'gap-4');
  });

  content = content.replace(/className="[^"]*lg:w-\[[0-9]+px\][^"]*"/g, (match) => {
    // only if it's the right sidebar
    if (match.includes('shrink-0')) {
      let newClass = match.replace(/lg:w-\[[0-9]+px\]/, 'lg:w-[280px]');
      newClass = newClass.replace(/space-y-[68]/, 'space-y-4');
      return newClass;
    }
    return match;
  });

  // 5. General space and padding reductions
  // Reduce space-y-8 to space-y-4 inside main layouts
  // But be careful not to break everything. Let's do it targeted:
  content = content.replace(/className="([^"]*)space-y-[68]([^"]*)"/g, (match, p1, p2) => {
    return `className="${p1}space-y-4${p2}"`;
  });
  
  content = content.replace(/className="([^"]*)p-[68]([^"]*)"/g, (match, p1, p2) => {
    return `className="${p1}p-5${p2}"`; // reduce p-6 or p-8 to p-5 for cards
  });
  
  content = content.replace(/className="([^"]*)gap-[68]([^"]*)"/g, (match, p1, p2) => {
    // skip grids that are inside small components, just standard gaps
    return `className="${p1}gap-4${p2}"`;
  });

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
      standardizeFile(fullPath);
    }
  }
}

walkDir(targetDir);
console.log('Layout standardization complete.');
