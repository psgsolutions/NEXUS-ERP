/**
 * Unit Test Script for Item 5: WHT Calculation & Single Source of Truth
 * Verifies that calculateERPDocument computes per-line WHT correctly for mixed documents
 */

const assert = require('assert');
const { calculateERPDocument } = require('../src/lib/erp-logic');

console.log('================================================================');
console.log('🧪 RUNNING ITEM 5: WHT PER-LINE CALCULATION TEST SUITE');
console.log('================================================================\n');

// Case 1: Standard Single Document-level WHT (3% across all items)
console.log('📌 Test 1: Single document-level WHT (3% on 10,000 THB)');
const itemsCase1 = [
  { id: '1', qty: 1, costPrice: 6000, projectPrice: 10000, retailPrice: 10000 }
];
const result1 = calculateERPDocument(itemsCase1, 'EXCLUSIVE', true, 3);
console.log('   - SubTotal:', result1.subTotal);
console.log('   - VAT 7%:', result1.vatAmount);
console.log('   - GrandTotal:', result1.grandTotal);
console.log('   - WHT 3%:', result1.whtAmount);
console.log('   - NetPayable:', result1.netPayable);
assert.strictEqual(result1.subTotal, 10000);
assert.strictEqual(result1.vatAmount, 700);
assert.strictEqual(result1.grandTotal, 10700);
assert.strictEqual(result1.whtAmount, 300);
assert.strictEqual(result1.netPayable, 10400);
console.log('   ✅ PASS\n');

// Case 2: Mixed Document (Row 1: Product 10,000 THB @ WHT 0%, Row 2: Service 5,000 THB @ WHT 3%)
console.log('📌 Test 2: Mixed Document (Row 1 Product WHT 0% + Row 2 Service WHT 3%)');
const itemsCase2 = [
  { id: '1', qty: 1, costPrice: 7000, projectPrice: 10000, retailPrice: 10000, whtRate: 0 },
  { id: '2', qty: 1, costPrice: 2000, projectPrice: 5000, retailPrice: 5000, whtRate: 3 }
];
const result2 = calculateERPDocument(itemsCase2, 'EXCLUSIVE', true, 0);
console.log('   - SubTotal:', result2.subTotal);
console.log('   - VAT 7%:', result2.vatAmount);
console.log('   - GrandTotal:', result2.grandTotal);
console.log('   - WHT Amount:', result2.whtAmount, '(Expected: 150 THB, NOT 450 THB)');
console.log('   - NetPayable:', result2.netPayable);
assert.strictEqual(result2.subTotal, 15000);
assert.strictEqual(result2.vatAmount, 1050);
assert.strictEqual(result2.grandTotal, 16050);
assert.strictEqual(result2.whtAmount, 150); // 10000*0 + 5000*0.03 = 150
assert.strictEqual(result2.netPayable, 15900);
console.log('   ✅ PASS: Mixed WHT calculated correctly per line!\n');

// Case 3: Mixed Document with INCLUSIVE VAT (Row 1: Product 10,700 THB @ WHT 0%, Row 2: Service 5,350 THB @ WHT 3%)
console.log('📌 Test 3: Mixed Document with INCLUSIVE VAT');
const itemsCase3 = [
  { id: '1', qty: 1, costPrice: 7000, projectPrice: 10700, retailPrice: 10700, whtRate: 0 },
  { id: '2', qty: 1, costPrice: 2000, projectPrice: 5350, retailPrice: 5350, whtRate: 3 }
];
const result3 = calculateERPDocument(itemsCase3, 'INCLUSIVE', true, 0);
console.log('   - SubTotal (ex-VAT):', result3.subTotal);
console.log('   - VAT 7%:', result3.vatAmount);
console.log('   - GrandTotal:', result3.grandTotal);
console.log('   - WHT Amount:', result3.whtAmount, '(Expected: 150 THB on 5,000 THB ex-VAT service)');
console.log('   - NetPayable:', result3.netPayable);
assert.strictEqual(result3.subTotal, 15000);
assert.strictEqual(result3.vatAmount, 1050);
assert.strictEqual(result3.grandTotal, 16050);
assert.strictEqual(result3.whtAmount, 150); // 5000 * 0.03 = 150
assert.strictEqual(result3.netPayable, 15900);
console.log('   ✅ PASS: Inclusive VAT mixed WHT calculated correctly per line!\n');

console.log('================================================================');
console.log('🎉 ALL ITEM 5 WHT CALCULATION TESTS PASSED 100% CLEANLY!');
console.log('================================================================');
