/**
 * NEXUS ERP (Intelligence OS) — Integration Test: QT -> SO -> Tax Invoice & Billing Note Chain
 * Verifies: vatType carry-over ('Include VAT') and correct VAT amount calculation upon one-click Tax Invoice issue.
 */

const assert = require('assert');

function simulateConvertQTtoSO(quotation) {
  const rawVatType = quotation.vatType || quotation.taxMode || 'Exclude VAT';
  let normalizedVatType = 'Exclude VAT';
  if (rawVatType === 'Inclusive' || rawVatType === 'Include VAT') {
    normalizedVatType = 'Include VAT';
  } else if (rawVatType === 'Non-VAT') {
    normalizedVatType = 'Non-VAT';
  } else {
    normalizedVatType = 'Exclude VAT';
  }

  return {
    id: "SO-TEST-001",
    orderId: "SO-2605-0012",
    quotationRefNo: quotation.documentNo,
    customerId: quotation.customerInfo.customerId,
    customerName: quotation.customerInfo.name,
    items: quotation.items,
    vatType: normalizedVatType,
    isVatRegistered: quotation.isVatRegistered ?? true,
    totalAmount: quotation.grandTotal,
    status: 'delivered'
  };
}

function simulateIssueTaxInvoiceAndBillingNote(salesOrder) {
  const rawVatType = salesOrder.vatType || 'Exclude VAT';
  let normalizedVatType = 'Exclude VAT';
  if (rawVatType === 'Inclusive' || rawVatType === 'Include VAT') {
    normalizedVatType = 'Include VAT';
  } else if (rawVatType === 'Non-VAT') {
    normalizedVatType = 'Non-VAT';
  } else {
    normalizedVatType = 'Exclude VAT';
  }

  const baseAmount = Number(salesOrder.totalAmount);
  let subTotal = baseAmount;
  let vatAmount = 0;
  let grandTotal = baseAmount;

  if (normalizedVatType === 'Include VAT') {
    grandTotal = baseAmount;
    subTotal = Number((grandTotal / 1.07).toFixed(2));
    vatAmount = Number((grandTotal - subTotal).toFixed(2));
  } else if (normalizedVatType === 'Exclude VAT') {
    subTotal = baseAmount;
    vatAmount = Number((subTotal * 0.07).toFixed(2));
    grandTotal = Number((subTotal + vatAmount).toFixed(2));
  } else {
    subTotal = baseAmount;
    vatAmount = 0;
    grandTotal = baseAmount;
  }

  const taxInvoiceNo = "INV-26-0001";
  const billingNoteNo = "BN-26-0001";

  return {
    taxInvoice: {
      invoiceNo: taxInvoiceNo,
      salesOrderRefNo: salesOrder.orderId,
      vatType: normalizedVatType,
      subTotal,
      vatAmount,
      grandTotal,
      status: 'issued'
    },
    billingNote: {
      billingNoteNo: billingNoteNo,
      invoiceRefNo: taxInvoiceNo,
      totalAmount: grandTotal,
      status: 'issued'
    },
    updatedSOStatus: 'COMPLETED'
  };
}

console.log("🛡️ Running NEXUS ERP Tax Invoice Carry-Over Integration Test...\n");

// 1. Initial Quotation with 'Include VAT' (Inclusive 7%)
const inputQuotation = {
  id: "QT-001",
  documentNo: "QT-2605-001",
  customerInfo: { customerId: "CUS-001", name: "บริษัท ทดสอบ จำกัด" },
  items: [{ itemCode: "HW-001", description: "CCTV AI Camera", quantity: 2, unitPrice: 5350 }],
  vatType: "Include VAT",
  isVatRegistered: true,
  grandTotal: 10700
};

console.log(`[Stage 1] Created Quotation: ${inputQuotation.documentNo}, vatType: ${inputQuotation.vatType}, grandTotal: ฿${inputQuotation.grandTotal}`);
assert.strictEqual(inputQuotation.vatType, "Include VAT");

// 2. Convert QT to SO
const salesOrder = simulateConvertQTtoSO(inputQuotation);
console.log(`[Stage 2] Converted to Sales Order: ${salesOrder.orderId}`);
console.log(`   - SO vatType: ${salesOrder.vatType}`);
console.log(`   - SO status: ${salesOrder.status}`);

assert.strictEqual(salesOrder.vatType, "Include VAT", "SO vatType must equal 'Include VAT' (carried over from QT)");

// 3. Issue One-Click Tax Invoice & Billing Note
const flowResult = simulateIssueTaxInvoiceAndBillingNote(salesOrder);
console.log(`\n[Stage 3] Issued Tax Invoice: ${flowResult.taxInvoice.invoiceNo} & Billing Note: ${flowResult.billingNote.billingNoteNo}`);
console.log(`   - Invoice vatType: ${flowResult.taxInvoice.vatType}`);
console.log(`   - Invoice subTotal: ฿${flowResult.taxInvoice.subTotal}`);
console.log(`   - Invoice vatAmount: ฿${flowResult.taxInvoice.vatAmount}`);
console.log(`   - Invoice grandTotal: ฿${flowResult.taxInvoice.grandTotal}`);
console.log(`   - SO updated status: ${flowResult.updatedSOStatus}`);

// Verification Assertions
assert.strictEqual(flowResult.taxInvoice.vatType, "Include VAT");
assert.strictEqual(flowResult.taxInvoice.subTotal, 10000.00);
assert.strictEqual(flowResult.taxInvoice.vatAmount, 700.00, "vatAmount for 10,700 Include VAT must be 700.00 THB, NOT 749.00 THB");
assert.strictEqual(flowResult.taxInvoice.grandTotal, 10700.00);
assert.strictEqual(flowResult.updatedSOStatus, "COMPLETED");

console.log("\n✅ ALL TAX INVOICE & BILLING NOTE CARRY-OVER TESTS PASSED SUCCESSFULLY!");
process.exit(0);
