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
    let original = content;

    // Pattern: <NexusTableCell ...> \s* <StatusBadge ... /> \s* </NexusTableCell>
    // We want to add "text-center" to the NexusTableCell className if it doesn't have it.
    
    // We can just find instances of <NexusTableCell containing StatusBadge.
    // Since tags can be split across lines, let's use a regex that matches the opening tag, content, and closing tag.
    let regex = /<NexusTableCell([^>]*)>\s*<StatusBadge([^>]*)\/>\s*<\/NexusTableCell>/g;
    
    content = content.replace(regex, (match, classAttr, badgeAttr) => {
      if (classAttr.includes('text-center')) {
        return match;
      }
      if (classAttr.includes('className="')) {
        let newClassAttr = classAttr.replace('className="', 'className="text-center ');
        return `<NexusTableCell${newClassAttr}>\n        <StatusBadge${badgeAttr}/>\n      </NexusTableCell>`;
      } else {
        return `<NexusTableCell className="text-center"${classAttr}>\n        <StatusBadge${badgeAttr}/>\n      </NexusTableCell>`;
      }
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
