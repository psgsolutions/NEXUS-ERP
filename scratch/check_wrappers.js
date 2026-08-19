const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('d:/NEXUS-ERP/src/app/(authenticated)/*/page.tsx');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let match = content.match(/<div className=\"([^\"]*overflow-y-auto[^\"]*)\">[\s\S]*?<div className=\"([^\"]*)\">/);
  if (match) {
    console.log(path.basename(path.dirname(file)) + ': ' + match[2]);
  } else {
    console.log(path.basename(path.dirname(file)) + ': NOT FOUND');
  }
});
