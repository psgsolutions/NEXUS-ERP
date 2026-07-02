const fs = require('fs');

let filePath = 'd:/NEXUS-ERP/src/app/(authenticated)/sales/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace duplicate
let badString = `           ) : activeTab === "orders" && selectedItem ? () : activeTab === "orders" && selectedItem ? (`
let badString2 = `) : activeTab === "orders" && selectedItem ? (\n) : activeTab === "orders" && selectedItem ? (`
let badString3 = `) : activeTab === "orders" && selectedItem ? () : activeTab === "orders" && selectedItem ? (`

content = content.replace(') : activeTab === "orders" && selectedItem ? () : activeTab === "orders" && selectedItem ? (', ') : activeTab === "orders" && selectedItem ? (');
content = content.replace(') : activeTab === "orders" && selectedItem ? (\\n) : activeTab === "orders" && selectedItem ? (', ') : activeTab === "orders" && selectedItem ? (');

// Let's do a more robust regex to remove any consecutive duplicates with optional whitespace
let regex = /\) : activeTab === "orders" && selectedItem \? \(\s*\) : activeTab === "orders" && selectedItem \? \(/g;
content = content.replace(regex, ') : activeTab === "orders" && selectedItem ? (');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Fixed duplicate!");
