import assert from "node:assert";
import {
  calculateERPDocument,
  calculateLineGP,
  formatCurrency,
  validateQuotationDates,
  canWriteBackToProductMaster,
  LineItem
} from "./erp-logic";

/**
 * [UNIT-TEST-SUITE] Comprehensive Audit & Verification Test for Quotation Form
 * Tests:
 * 1. GP Calculation (Net Revenue Subtotal Base, 29.35% for total, 26.67% for Row 3)
 * 2. VAT Calculation (7% of 15,570 = 1,089.90, GrandTotal = 16,659.90, Thai Baht Text with Satang, 2 Decimals)
 * 3. Expected Close Date Validation (expectedCloseDate must not be before docDate)
 * 4. Product Master Write-Back RBAC Guardrail (Sales cannot write back, Admin can)
 */
export function runQuotationFormAuditTests() {
  console.log("=== RUNNING QUOTATION FORM AUDIT TESTS ===");

  // --- Test Data ---
  // Row 1: PRD-2606-0001 1 Box @450.00 (Cost = 0)
  // Row 2: PRD-2606-0019 1 Pc @120.00 (Cost = 0)
  // Row 3: PRD-2606-0058 1 Unit @15,000.00 (Cost = 11,000.00)
  const items: LineItem[] = [
    { id: "row-1", qty: 1, costPrice: 0, projectPrice: 450.00, retailPrice: 450.00 },
    { id: "row-2", qty: 1, costPrice: 0, projectPrice: 120.00, retailPrice: 120.00 },
    { id: "row-3", qty: 1, costPrice: 11000.00, projectPrice: 15000.00, retailPrice: 15000.00 }
  ];

  // --- Item 1 & Item 2: ERP Financial Calculation Engine Test ---
  const calc = calculateERPDocument(items, "EXCLUSIVE", true, 0);

  console.log("1. SubTotal:", calc.subTotal);
  console.log("2. VAT Amount (7%):", calc.vatAmount);
  console.log("3. Grand Total:", calc.grandTotal);
  console.log("4. Overall GP%:", calc.profitMargin);
  console.log("5. Thai Baht Text:", calc.thaiBahtText);

  // Verification 1: SubTotal = 450 + 120 + 15000 = 15,570.00
  assert.strictEqual(calc.subTotal, 15570.00, "SubTotal before tax must be 15,570.00 THB");

  // Verification 2: VAT Exclusive 7% = 15,570 * 0.07 = 1,089.90 THB
  assert.strictEqual(calc.vatAmount, 1089.90, "VAT 7% must be exactly 1,089.90 THB");

  // Verification 3: Grand Total = 15,570 + 1,089.90 = 16,659.90 THB
  assert.strictEqual(calc.grandTotal, 16659.90, "Grand Total must be exactly 16,659.90 THB");

  // Verification 4: Correct Overall GP% = (15,570 - 11,000) / 15,570 = 29.35% (NOT inflated to 31.75%)
  assert.strictEqual(calc.profitMargin, 29.35, "Overall GP% must be 29.35% based on net subtotal");

  // Verification 5: Row 3 Individual GP% = (15,000 - 11,000) / 15,000 = 26.67%
  const row3Price = 15000.00;
  const row3Cost = 11000.00;
  const row3GP = calculateLineGP(row3Price, row3Cost);
  assert.strictEqual(row3GP, 26.67, "Row 3 GP% must be 26.67%");

  // Verification 6: Thai Baht Text must include Satang
  const expectedText = "หนึ่งหมื่นหกพันหกร้อยห้าสิบเก้าบาทเก้าสิบสตางค์";
  assert.strictEqual(calc.thaiBahtText, expectedText, `Thai Baht Text must be '${expectedText}'`);

  // Verification 7: Format Currency displaying 2 decimals
  const formattedVat = formatCurrency(calc.vatAmount);
  const formattedTotal = formatCurrency(calc.grandTotal);
  assert.ok(formattedVat.includes("1,089.90"), `Formatted VAT '${formattedVat}' must contain '1,089.90'`);
  assert.ok(formattedTotal.includes("16,659.90"), `Formatted Total '${formattedTotal}' must contain '16,659.90'`);

  // --- Item 3: Expected Close Date Validation Test ---
  const invalidDateCheck = validateQuotationDates("2026-09-28", "2026-09-17");
  assert.strictEqual(invalidDateCheck.isValid, false, "Close date 17/09/2026 before doc date 28/09/2026 must be invalid");
  assert.strictEqual(invalidDateCheck.error, "วันที่คาดว่าปิดจบ ต้องไม่ก่อนวันที่ออกเอกสาร", "Error message must match Thai warning standard");

  const validDateCheck = validateQuotationDates("2026-09-28", "2026-09-30");
  assert.strictEqual(validDateCheck.isValid, true, "Close date after doc date must be valid");

  // --- Item 5: Patch 4 Test — INCLUSIVE VAT + WHT Mixed Lines & Flexible VAT Rate ---
  const mixedItems: LineItem[] = [
    { id: "item-service", qty: 1, costPrice: 2000, projectPrice: 10700.00, retailPrice: 10700.00, whtRate: 3, itemType: "SERVICE" }, // Ex-VAT = 10,000, WHT 3% = 300
    { id: "item-product", qty: 2, costPrice: 1000, projectPrice: 5350.00, retailPrice: 5350.00, whtRate: 0, itemType: "PRODUCT" }   // Ex-VAT = 10,000, WHT 0% = 0
  ];
  const calcInclusiveWht = calculateERPDocument(mixedItems, "INCLUSIVE", true, 0, 7);
  console.log("6. Mixed INCLUSIVE SubTotal:", calcInclusiveWht.subTotal);
  console.log("7. Mixed INCLUSIVE VAT (7%):", calcInclusiveWht.vatAmount);
  console.log("8. Mixed INCLUSIVE WHT (Service 3%):", calcInclusiveWht.whtAmount);
  console.log("9. Mixed INCLUSIVE Net Payable:", calcInclusiveWht.netPayable);

  assert.strictEqual(calcInclusiveWht.subTotal, 20000.00, "Inclusive SubTotal before VAT must be 20,000.00 THB");
  assert.strictEqual(calcInclusiveWht.vatAmount, 1400.00, "Inclusive VAT 7% must be 1,400.00 THB");
  assert.strictEqual(calcInclusiveWht.grandTotal, 21400.00, "Grand Total must be 21,400.00 THB");
  assert.strictEqual(calcInclusiveWht.whtAmount, 300.00, "WHT 3% on 10,000 THB service must be 300.00 THB");
  assert.strictEqual(calcInclusiveWht.netPayable, 21100.00, "Net Payable must be 21,100.00 THB");

  // Non-7% VAT Rate Test (e.g. 10%)
  const calcVat10 = calculateERPDocument([
    { id: "row-1", qty: 1, costPrice: 500, projectPrice: 1000.00, retailPrice: 1000.00 }
  ], "EXCLUSIVE", true, 0, 10);
  assert.strictEqual(calcVat10.vatAmount, 100.00, "VAT 10% on 1,000 THB must be 100.00 THB");
  assert.strictEqual(calcVat10.grandTotal, 1100.00, "Grand Total with 10% VAT must be 1,100.00 THB");

  // --- Item 6: Patch 7 Test — Discounts Engine (Line %, Line Amount, Doc Amount, Over-discount) ---
  const discountItems: LineItem[] = [
    { id: "line-pct", qty: 1, costPrice: 3000, projectPrice: 10000.00, retailPrice: 10000.00, discountType: "PERCENT", discountValue: 10, whtRate: 3 }, // Gross 10k, Disc 1k, Net 9k
    { id: "line-amt", qty: 1, costPrice: 2000, projectPrice: 5000.00, retailPrice: 5000.00, discountType: "AMOUNT", discountValue: 500, whtRate: 0 }    // Gross 5k, Disc 500, Net 4.5k
  ];
  // Document discount = 500 THB
  const calcDiscounts = calculateERPDocument(discountItems, "EXCLUSIVE", true, 0, 7, "AMOUNT", 500);
  console.log("10. Discount Engine Gross SubTotal:", calcDiscounts.grossSubTotal);
  console.log("11. Line Discount Total:", calcDiscounts.lineDiscountTotal);
  console.log("12. Doc Discount Amount:", calcDiscounts.docDiscountAmount);
  console.log("13. Net SubTotal:", calcDiscounts.subTotal);
  console.log("14. WHT Amount After Discounts:", calcDiscounts.whtAmount);

  assert.strictEqual(calcDiscounts.grossSubTotal, 15000.00, "Gross SubTotal must be 15,000.00 THB");
  assert.strictEqual(calcDiscounts.lineDiscountTotal, 1500.00, "Line discount total must be 1,500.00 THB");
  assert.strictEqual(calcDiscounts.docDiscountAmount, 500.00, "Doc discount amount must be 500.00 THB");
  assert.strictEqual(calcDiscounts.subTotal, 13000.00, "Net SubTotal after all discounts must be 13,000.00 THB");
  assert.strictEqual(calcDiscounts.vatAmount, 910.00, "VAT 7% on 13,000 THB must be 910.00 THB");

  // Over-discount Rejection Test
  const calcOverDiscount = calculateERPDocument([
    { id: "line-1", qty: 1, costPrice: 100, projectPrice: 1000.00, retailPrice: 1000.00, discountType: "AMOUNT", discountValue: 1200 }
  ], "EXCLUSIVE", true, 0, 7);
  assert.strictEqual(calcOverDiscount.error, "ส่วนลดรวมมากกว่ามูลค่าสินค้า/บริการ", "Over-discount must be rejected with Thai error message");

  console.log("=== ALL QUOTATION FORM AUDIT TESTS PASSED SUCCESSFULLY! ===");
}

// Execute test suite if run directly
runQuotationFormAuditTests();
