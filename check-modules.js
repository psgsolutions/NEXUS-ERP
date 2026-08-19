const fs = require('fs');

const files = [
  'src/app/(authenticated)/dashboard/page.tsx',
  'src/app/(authenticated)/sales/page.tsx',
  'src/app/(authenticated)/projects/page.tsx',
  'src/app/(authenticated)/hr/page.tsx',
  'src/app/(authenticated)/inventory/page.tsx',
  'src/app/(authenticated)/procurement/page.tsx',
  'src/app/(authenticated)/finance/page.tsx',
  'src/app/(authenticated)/settings/page.tsx',
  'src/app/(authenticated)/customers/page.tsx',
  'src/app/(authenticated)/products/page.tsx'
];

let issues = [];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    issues.push(file + ' does not exist');
    return;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  
  // Checks
  const hasCompactHeader = content.includes('<header className="px-6 py-3 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-black/20 shrink-0">');
  const hasCompactTab = content.includes('<section className="px-6 py-2 bg-black/10 border-b border-white/5 shrink-0">');
  
  // Looking for the split layout
  const hasFlexRowSplit = content.includes('xl:flex-row items-start gap-4');
  const hasLeftContent = content.includes('flex-1 w-full space-y-4');
  const hasRightSidebar = content.includes('xl:w-[25%] shrink-0 sticky top-[96px] space-y-4');

  if (!hasCompactHeader) issues.push(file + ' is missing compact header');
  if (!hasCompactTab) issues.push(file + ' is missing compact tab section');
  if (!hasFlexRowSplit) issues.push(file + ' is missing flex-row split wrapper');
  if (!hasLeftContent) issues.push(file + ' is missing left content flex-1 wrapper');
  if (!hasRightSidebar) issues.push(file + ' is missing right sidebar 25% wrapper');
});

if (issues.length > 0) {
  console.log('Issues found:');
  console.log(issues.join('\\n'));
} else {
  console.log('All 10 modules perfectly match the layout standard!');
}
