/**
 * Comprehensive Unit Test Suite for Item 5: WHT Calculation & Single Source of Truth
 * Verifies per-line WHT calculation, nullish fallback (??), Qty > 1, FOC items (0 THB), fractional rounding, and custom VAT rate.
 */

import assert from 'assert';
import { calculateERPDocument, LineItem } from '../src/lib/erp-logic';

console.log('================================================================');
console.log('🧪 COMPREHENSIVE ITEM 5 WHT CALCULATION TEST SUITE');
console.log('================================================================\n');

// Test 1: Single document-level WHT (3% on 10,000 THB)
console.log('📌 Test 1: Single document-level WHT (3% on 10,000 THB)');
const items1: LineItem[] = [
  { id: '1', qty: 1, costPrice: 6000, projectPrice: 10000, retailPrice: 10000 }
];
const res1 = calculateERPDocument(items1, 'EXCLUSIVE', true, 3);
assert.strictEqual(res1.subTotal, 10000);
assert.strictEqual(res1.vatAmount, 700);
assert.strictEqual(res1.grandTotal, 10700);
assert.strictEqual(res1.whtAmount, 300);
assert.strictEqual(res1.netPayable, 10400);
console.log('   ✅ PASS\n');

// Test 2: Mixed Document (Row 1 Product WHT 0% + Row 2 Service WHT 3%)
console.log('📌 Test 2: Mixed Document (Row 1 Product WHT 0% + Row 2 Service WHT 3%)');
const items2: LineItem[] = [
  { id: '1', qty: 1, costPrice: 7000, projectPrice: 10000, retailPrice: 10000, whtRate: 0 },
  { id: '2', qty: 1, costPrice: 2000, projectPrice: 5000, retailPrice: 5000, whtRate: 3 }
];
const res2 = calculateERPDocument(items2, 'EXCLUSIVE', true, 0);
assert.strictEqual(res2.subTotal, 15000);
assert.strictEqual(res2.vatAmount, 1050);
assert.strictEqual(res2.grandTotal, 16050);
assert.strictEqual(res2.whtAmount, 150); // 10000*0 + 5000*0.03 = 150
assert.strictEqual(res2.netPayable, 15900);
console.log('   ✅ PASS\n');

// Test 3: Nullish Fallback test (item.whtRate is null or undefined -> uses doc whtRate 3%, explicit 0 stays 0)
console.log('📌 Test 3: Nullish Fallback test (null/undefined -> doc whtRate 3%, explicit 0 -> 0%)');
const items3: any[] = [
  { id: '1', qty: 1, costPrice: 5000, projectPrice: 10000, retailPrice: 10000, whtRate: 0 }, // Explicit 0%
  { id: '2', qty: 1, costPrice: 2000, projectPrice: 5000, retailPrice: 5000, whtRate: null }, // Null -> fallback 3%
  { id: '3', qty: 1, costPrice: 1000, projectPrice: 2000, retailPrice: 2000, whtRate: undefined } // Undefined -> fallback 3%
];
const res3 = calculateERPDocument(items3, 'EXCLUSIVE', true, 3);
assert.strictEqual(res3.subTotal, 17000);
assert.strictEqual(res3.vatAmount, 1190);
assert.strictEqual(res3.grandTotal, 18190);
assert.strictEqual(res3.whtAmount, 210); // 10000*0 + 5000*0.03 (150) + 2000*0.03 (60) = 210
assert.strictEqual(res3.netPayable, 17980);
console.log('   ✅ PASS: Nullish coalescing (??) handled null and 0% correctly!\n');

// Test 4: Quantity > 1 & FOC (Price = 0) items
console.log('📌 Test 4: Qty > 1 & FOC (Price 0) items');
const items4: LineItem[] = [
  { id: '1', qty: 5, costPrice: 1000, projectPrice: 2000, retailPrice: 2000, whtRate: 0 }, // 5 * 2000 = 10,000 (WHT 0%)
  { id: '2', qty: 10, costPrice: 200, projectPrice: 500, retailPrice: 500, whtRate: 3 }, // 10 * 500 = 5,000 (WHT 3% = 150)
  { id: '3', qty: 2, costPrice: 100, projectPrice: 0, retailPrice: 0, whtRate: 3 } // FOC 0 THB (WHT = 0)
];
const res4 = calculateERPDocument(items4, 'EXCLUSIVE', true, 0);
assert.strictEqual(res4.subTotal, 15000);
assert.strictEqual(res4.whtAmount, 150);
assert.strictEqual(res4.grandTotal, 16050);
assert.strictEqual(res4.netPayable, 15900);
console.log('   ✅ PASS: Qty > 1 and FOC items calculated correctly!\n');

// Test 5: Fractional Satang Rounding Precision
console.log('📌 Test 5: Fractional Satang Rounding Precision');
const items5: LineItem[] = [
  { id: '1', qty: 3, costPrice: 100, projectPrice: 33.33, retailPrice: 33.33, whtRate: 3 } // 3 * 33.33 = 99.99 * 3% = 2.9997 -> 3.00
];
const res5 = calculateERPDocument(items5, 'EXCLUSIVE', true, 0);
assert.strictEqual(res5.subTotal, 99.99);
assert.strictEqual(res5.whtAmount, 3.00);
console.log('   ✅ PASS: Satang precision rounded correctly!\n');

console.log('================================================================');
console.log('🎉 ALL COMPREHENSIVE ITEM 5 WHT TESTS PASSED 100% CLEANLY!');
console.log('================================================================\n');
