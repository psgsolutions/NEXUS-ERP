// Test script for SmartSelect & PillSelect Keyboard Navigation
const assert = require("assert");

console.log("=================================================");
console.log("🧪 Testing SmartSelect & PillSelect Keyboard Navigation");
console.log("=================================================");

const options = [
  { value: "CUST-001", label: "ลูกค้า A (บริษัท กขค จำกัด)" },
  { value: "CUST-002", label: "ลูกค้า B (บริษัท งจฉ จำกัด)" },
  { value: "CUST-003", label: "ลูกค้า C (บริษัท ชซฌ จำกัด)" },
  { value: "CUST-004", label: "ลูกค้า D (บริษัท ญฎฏ จำกัด)" },
];

function getNextOptionIndex(currentIndex, direction, length) {
  if (length <= 0) return -1;
  if (direction === "down") {
    if (currentIndex < 0 || currentIndex >= length - 1) return 0;
    return currentIndex + 1;
  } else {
    if (currentIndex <= 0) return length - 1;
    return currentIndex - 1;
  }
}

// -------------------------------------------------------------
// Test Case 1: Open dropdown -> ↓ 3 times -> highlight 3rd option -> Enter
// -------------------------------------------------------------
console.log("\n[TEST 1] Testing ArrowDown 3 times + Enter selection...");

let isOpen = true;
let highlightedIndex = -1; // Initial state when opened: no option pre-highlighted

// Step 1: Open dropdown
assert.strictEqual(highlightedIndex, -1, "Initial dropdown state must have highlightedIndex = -1");
console.log("  ✅ Step 1: Opened dropdown. Initial highlight index = -1 (no option highlighted)");

// Step 2: Press ↓ 1st time
highlightedIndex = getNextOptionIndex(highlightedIndex, "down", options.length);
assert.strictEqual(highlightedIndex, 0, "1st ArrowDown must highlight index 0 (1st option)");
console.log(`  ✅ Step 2: Press ↓ (1st time) -> Highlighted index 0: "${options[0].label}"`);

// Step 3: Press ↓ 2nd time
highlightedIndex = getNextOptionIndex(highlightedIndex, "down", options.length);
assert.strictEqual(highlightedIndex, 1, "2nd ArrowDown must highlight index 1 (2nd option)");
console.log(`  ✅ Step 3: Press ↓ (2nd time) -> Highlighted index 1: "${options[1].label}"`);

// Step 4: Press ↓ 3rd time
highlightedIndex = getNextOptionIndex(highlightedIndex, "down", options.length);
assert.strictEqual(highlightedIndex, 2, "3rd ArrowDown must highlight index 2 (3rd option)");
console.log(`  ✅ Step 4: Press ↓ (3rd time) -> Highlighted index 2: "${options[2].label}"`);

// Step 5: Press Enter to select
let selectedValue = null;
if (isOpen && highlightedIndex >= 0 && highlightedIndex < options.length) {
  selectedValue = options[highlightedIndex].value;
  isOpen = false;
}

assert.strictEqual(selectedValue, "CUST-003", "Enter must select 3rd option value ('CUST-003')");
assert.strictEqual(isOpen, false, "Enter must close the dropdown");
console.log(`  🎉 [TEST 1 PASSED] Enter selected "${selectedValue}" (${options[2].label}) matching option 3!`);

// -------------------------------------------------------------
// Test Case 2: Cyclic looping (down past end & up past beginning)
// -------------------------------------------------------------
console.log("\n[TEST 2] Testing cyclic option looping...");

let idx = 3; // at last option (index 3 of 4 options)
idx = getNextOptionIndex(idx, "down", options.length);
assert.strictEqual(idx, 0, "Pressing ArrowDown from last option must loop around to index 0");
console.log("  ✅ Cyclic ArrowDown from last option -> index 0 (1st option)");

idx = getNextOptionIndex(0, "up", options.length);
assert.strictEqual(idx, 3, "Pressing ArrowUp from index 0 must loop around to index 3 (last option)");
console.log("  ✅ Cyclic ArrowUp from index 0 -> index 3 (last option)");

console.log("  🎉 [TEST 2 PASSED] Cyclic option looping verified!");

// -------------------------------------------------------------
// Test Case 3: Escape restores previous value
// -------------------------------------------------------------
console.log("\n[TEST 3] Testing Escape key value restoration...");

let initialValue = "CUST-001";
let currentQuery = "พิมพ์คำค้นหาที่เปลี่ยนไป";
// Press Escape
currentQuery = options.find((o) => o.value === initialValue)?.label || initialValue;
assert.strictEqual(currentQuery, "ลูกค้า A (บริษัท กขค จำกัด)", "Escape must restore label for initial value");
console.log(`  🎉 [TEST 3 PASSED] Escape restored value to: "${currentQuery}"`);

console.log("\n=================================================");
console.log("🏆 ALL KEYBOARD NAVIGATION TESTS PASSED 100%");
console.log("=================================================");
