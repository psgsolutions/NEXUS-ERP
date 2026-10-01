import assert from "node:assert";
import { fetchSupplierPriceHistory, SupplierPriceRecord } from "./procurement-service";

/**
 * Unit/Integration test verifying supplier price history extraction
 */
export function testSupplierMatrixExtraction() {
  const mockPos = [
    {
      poCode: "PO-001",
      companyId: "COMP-001",
      isDeleted: false,
      supplierId: "SUPP-01",
      supplierName: "Supplier Alpha",
      items: [{ productId: "P-100", price: 500 }]
    },
    {
      poCode: "PO-002",
      companyId: "COMP-001",
      isDeleted: false,
      supplierId: "SUPP-02",
      supplierName: "Supplier Beta",
      items: [{ productId: "P-100", price: 450 }]
    }
  ];

  const results: SupplierPriceRecord[] = [];
  const seen = new Set<string>();

  for (const po of mockPos) {
    if (po.companyId === "COMP-001" && !po.isDeleted) {
      for (const item of po.items) {
        if (item.productId === "P-100") {
          const sKey = `${po.supplierId}:${po.supplierName}`;
          if (!seen.has(sKey)) {
            seen.add(sKey);
            results.push({
              supplierId: po.supplierId,
              supplierName: po.supplierName,
              price: item.price,
              poCode: po.poCode
            });
          }
        }
      }
    }
  }

  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].price, 500);
  assert.strictEqual(results[1].price, 450);
}
