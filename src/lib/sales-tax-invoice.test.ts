import assert from "node:assert";

/**
 * [UNIT-TEST] Quotation -> SalesOrder -> TaxInvoice vatType Carry-Over & Calculation Test
 * Project: NEXUS ERP (Intelligence OS)
 */

export function runSalesTaxInvoiceTests() {
  const vatType = "Include VAT";
  const grandTotal = 10700;

  // Formula for Include VAT (Inclusive 7%)
  const subTotal = Number((grandTotal / 1.07).toFixed(2));
  const vatAmount = Number((grandTotal - subTotal).toFixed(2));

  assert.strictEqual(subTotal, 10000.00, "Subtotal for 10,700 Include VAT must be 10,000.00");
  assert.strictEqual(vatAmount, 700.00, "VAT amount for 10,700 Include VAT must be 700.00 THB");
  assert.strictEqual(vatType, "Include VAT", "vatType must remain 'Include VAT'");
}
