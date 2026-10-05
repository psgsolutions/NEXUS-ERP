const fs = require('fs');
const path = require('path');

const summaryData = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit_summary.json'), 'utf8'));

console.log(`=== AUDIT SUMMARY ===`);
console.log(`Group A (Labels / Headers / Titles -> Change to font-semibold): ${summaryData.summary.groupACount}`);
console.log(`Group B (Key Numbers / Grand Totals / KPIs -> Keep font-black): ${summaryData.summary.groupBCount}`);
console.log(`Ambiguous (4 items for user decision): ${summaryData.summary.ambiguousCount}`);

// File-level breakdown for Group A
const fileGroupA = {};
summaryData.groupA.forEach(item => {
  if (!fileGroupA[item.file]) fileGroupA[item.file] = 0;
  fileGroupA[item.file]++;
});

console.log("\n=== GROUP A FILES BREAKDOWN (Top Files) ===");
Object.entries(fileGroupA).sort((a,b) => b[1] - a[1]).slice(0, 25).forEach(([file, count]) => {
  console.log(`${count} occurrences: ${file}`);
});
