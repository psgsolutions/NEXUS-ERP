const fs = require('fs');
const path = require('path');

const summaryData = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit_summary.json'), 'utf8'));

const allGroupA = [...summaryData.groupA, ...summaryData.ambiguous];

const categorized = {
  tableHeader: [],      // .table-header-label
  formLabel: [],        // .form-field-label
  modalTitle: [],       // .modal-header-title
  cardSectionTitle: [], // .card-section-title
  tabOptionLabel: [],   // .tab-option-label
  toolbarControl: [],   // .toolbar-control-label
  itemEntityTitle: [],  // .item-entity-title
  inlineFallback: []    // Specific unique inline elements
};

allGroupA.forEach((item) => {
  const line = item.snippet;
  const lower = line.toLowerCase();
  const file = item.file;

  if (file.includes('Table') || lower.includes('<th') || lower.includes('headers.map') || lower.includes('headers')) {
    categorized.tableHeader.push(item);
  } else if (file.includes('Modal') && (lower.includes('title') || lower.includes('header') || lower.includes('<h3') || lower.includes('sparkles'))) {
    categorized.modalTitle.push(item);
  } else if (lower.includes('<label') || lower.includes('label') || lower.includes('placeholder') || lower.includes('asterisk')) {
    categorized.formLabel.push(item);
  } else if (lower.includes('tab') || lower.includes('pilltabs') || lower.includes('nav')) {
    categorized.tabOptionLabel.push(item);
  } else if (file.includes('Builder') || file.includes('Ribbon') || lower.includes('toolbar') || lower.includes('button')) {
    categorized.toolbarControl.push(item);
  } else if (lower.includes('<h3') || lower.includes('<h4') || lower.includes('<h5') || lower.includes('section') || lower.includes('card')) {
    categorized.cardSectionTitle.push(item);
  } else if (lower.includes('name') || lower.includes('title') || lower.includes('cell') || lower.includes('item')) {
    categorized.itemEntityTitle.push(item);
  } else {
    categorized.inlineFallback.push(item);
  }
});

console.log("=== DETAILED SHARED CLASS CATEGORIZATION ===");
console.log(`1. .table-header-label:     ${categorized.tableHeader.length} occurrences`);
console.log(`2. .form-field-label:       ${categorized.formLabel.length} occurrences`);
console.log(`3. .modal-header-title:     ${categorized.modalTitle.length} occurrences`);
console.log(`4. .card-section-title:     ${categorized.cardSectionTitle.length} occurrences`);
console.log(`5. .tab-option-label:       ${categorized.tabOptionLabel.length} occurrences`);
console.log(`6. .toolbar-control-label:  ${categorized.toolbarControl.length} occurrences`);
console.log(`7. .item-entity-title:      ${categorized.itemEntityTitle.length} occurrences`);
console.log(`8. Inline Fallbacks:        ${categorized.inlineFallback.length} occurrences`);
console.log(`Total Group A items:        ${allGroupA.length}`);
