const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const filesToModify = [];
walkDir('d:/NEXUS-ERP/src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('alert(') || content.includes('confirm(') || content.includes('window.confirm(') || content.includes('window.alert(')) {
      filesToModify.push(filePath);
    }
  }
});

filesToModify.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Skip if already imported DialogContext
  if (!content.includes('useSystemDialog')) {
    // Add import right after the last import
    const importMatch = content.match(/^import .*?from ['"].*?['"];?$/gm);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      content = content.replace(lastImport, lastImport + '\nimport { useSystemDialog } from "@/context/DialogContext";');
    } else {
       content = 'import { useSystemDialog } from "@/context/DialogContext";\n' + content;
    }
    
    // Inject hook
    // Look for export function ComponentName(
    const funcMatch = content.match(/(export\s+(?:default\s+)?function\s+[A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{)/);
    if (funcMatch) {
      content = content.replace(funcMatch[1], funcMatch[1] + '\n  const { showAlert, showConfirm } = useSystemDialog();\n');
    }
  }

  // Replace window.confirm
  content = content.replace(/if\s*\(\s*window\.confirm\(([^)]+)\)\s*\)/g, 'if (await showConfirm($1))');
  
  // Replace handleClose = () => with handleClose = async () => if it uses showConfirm
  content = content.replace(/const\s+handleClose\s*=\s*\(\)\s*=>\s*\{([^}]*showConfirm[^}]*)\}/g, 'const handleClose = async () => {$1}');

  // Replace confirm(...) without window.
  content = content.replace(/if\s*\(\s*!confirm\(([^)]+)\)\s*\)/g, 'if (!(await showConfirm($1)))');
  content = content.replace(/const\s+handle([A-Za-z]+)\s*=\s*\(([^)]*)\)\s*=>\s*\{([^}]*showConfirm[^}]*)\}/g, 'const handle$1 = async ($2) => {$3}');
  
  // For async functions that don't have const handle (like simple functions)
  content = content.replace(/function\s+handle([A-Za-z]+)\s*\(([^)]*)\)\s*\{([^}]*showConfirm[^}]*)\}/g, 'async function handle$1($2) {$3}');

  // Replace return alert(...) -> return void showAlert(...)
  content = content.replace(/return\s+alert\(([^)]+)\)/g, 'return void showAlert($1)');
  
  // Replace alert(...) inside arrow functions e.g. onClick={() => alert(...)}
  content = content.replace(/=>\s*alert\(([^)]+)\)/g, '=> showAlert($1)');
  
  // Replace standalone alert
  content = content.replace(/(?<!\.)alert\(([^)]+)\)/g, 'showAlert($1)');

  fs.writeFileSync(file, content, 'utf-8');
});
console.log('Modified files:', filesToModify.length);
