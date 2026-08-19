const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('src/app/\\(authenticated\\)/*/page.tsx');
let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  content = content.replace(
    /className="flex flex-col lg:flex-row items-start gap-4"/g,
    'className="flex flex-col xl:flex-row items-start gap-4"'
  );

  if (file.includes('customers')) {
      content = content.replace(/<\/div>\s*<div className="space-y-3">\s*\{activeTab === "list"/g, '</div>\n\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">\n          {activeTab === "list"');
  } else if (file.includes('finance')) {
      content = content.replace(/\{\/\* Right Sidebar Status \*\/\}\s*<div className="space-y-3">/g, '{/* Right Sidebar Status */}\n          <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">');
  } else if (file.includes('hr')) {
      content = content.replace(/\{\/\* Right Sidebar \*\/\}\s*<div className="space-y-4">/g, '{/* Right Sidebar */}\n          <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">');
  } else if (file.includes('procurement')) {
      content = content.replace(/<\/div>\s*<div className="space-y-3">\s*\{activeTab === "vendors"/g, '</div>\n\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">\n          {activeTab === "vendors"');
  } else if (file.includes('products')) {
      content = content.replace(/<\/div>\s*<div className="space-y-3">\s*\{activeTab === "list"/g, '</div>\n\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">\n          {activeTab === "list"');
  } else if (file.includes('projects')) {
      content = content.replace(/<\/div>\s*<div className="space-y-3">\s*<GlassCard/g, '</div>\n\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-3">\n          <GlassCard');
  } else if (file.includes('support')) {
      content = content.replace(/<\/div>\s*<div className="space-y-4">/g, '</div>\n\n        <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4">');
  } else if (file.includes('inventory')) {
      // Inventory page has different layout
      content = content.replace(/<div className="w-full lg:w-\[65%\] flex flex-col/g, '<div className="flex-1 flex flex-col');
      content = content.replace(/<div className="w-full lg:w-\[35%\] flex flex-col/g, '<div className="xl:w-[25%] shrink-0 sticky top-[96px] flex flex-col');
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Modified ${modifiedCount} files.`);
