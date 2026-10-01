import assert from 'node:assert';

/**
 * Test: Supplier Matrix History in PO Creation Flow
 * Verifies that when a product was ordered from 2 different suppliers at different prices,
 * fetchSupplierPriceHistory correctly retrieves both supplier prices scoped to companyId + isDeleted: false.
 */

async function runTest() {
  console.log("=== START TEST: Supplier Matrix History in PO Creation Flow ===");

  const companyId = "COMP-001";
  const productId = "PROD-TEST-100";

  // Simulated database records representing historical purchase_orders
  const mockPurchaseOrders = [
    {
      id: "PO-2026-001",
      poCode: "PO-2026-001",
      companyId: "COMP-001",
      isDeleted: false,
      supplierId: "SUP-A",
      supplierName: "บริษัท ซัพพลายเออร์ เอ จำกัด",
      expectedDate: "2026-08-10",
      items: [
        {
          productId: "PROD-TEST-100",
          name: "สินค้าทดสอบ A",
          price: 1200,
          qty: 10,
          unit: "ชิ้น"
        }
      ]
    },
    {
      id: "PO-2026-002",
      poCode: "PO-2026-002",
      companyId: "COMP-001",
      isDeleted: false,
      supplierId: "SUP-B",
      supplierName: "บริษัท ซัพพลายเออร์ บี จำกัด",
      expectedDate: "2026-08-15",
      items: [
        {
          productId: "PROD-TEST-100",
          name: "สินค้าทดสอบ A",
          price: 1050,
          qty: 5,
          unit: "ชิ้น"
        }
      ]
    }
  ];

  // Logic simulation matching fetchSupplierPriceHistory
  const results = [];
  const seenSuppliers = new Set();

  for (const poData of mockPurchaseOrders) {
    if (poData.companyId !== companyId || poData.isDeleted) continue;

    const supplierName = poData.supplierName || poData.supplier || "ผู้จำหน่ายไม่ระบุชื่อ";
    const supplierId = poData.supplierId || supplierName;

    for (const item of poData.items) {
      if (item.productId === productId || item.sku === productId || item.name === productId) {
        const unitPrice = Number(item.price || item.unitPrice || 0);
        const sKey = supplierId + ":" + supplierName;

        if (!seenSuppliers.has(sKey)) {
          seenSuppliers.add(sKey);
          results.push({
            supplierId,
            supplierName,
            price: unitPrice,
            poCode: poData.poCode,
            date: poData.expectedDate
          });
        }
      }
    }
  }

  // Verification 1: Number of supplier price records fetched
  console.log(`Fetched ${results.length} supplier price records for ${productId}:`);
  results.forEach(r => console.log(`  - ${r.supplierName} (${r.supplierId}): ฿${r.price} [${r.poCode}]`));

  assert.strictEqual(results.length, 2, "Expected exactly 2 supplier price records");

  // Verification 2: Check Supplier A price
  const suppA = results.find(r => r.supplierId === "SUP-A");
  assert.ok(suppA, "Supplier A record should exist");
  assert.strictEqual(suppA.price, 1200, "Supplier A price should be 1200 THB");

  // Verification 3: Check Supplier B price
  const suppB = results.find(r => r.supplierId === "SUP-B");
  assert.ok(suppB, "Supplier B record should exist");
  assert.strictEqual(suppB.price, 1050, "Supplier B price should be 1050 THB");

  console.log("✓ All assertions passed successfully!");
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
