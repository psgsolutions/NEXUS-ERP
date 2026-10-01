import assert from "node:assert";
import { exportPP30ToCSV, PP30TaxData } from "./tax-filing-service";

/**
 * Unit test for ภ.พ.30 Tax Filing Export
 */
export function testPP30ExportFormat() {
  const data: PP30TaxData = {
    companyId: "COMP-001",
    yearMonth: "2026-09",
    salesBase: 30000,
    outputVat: 2100,
    purchaseBase: 20000,
    inputVat: 1400,
    netVatPayable: 700,
    journalCount: 4
  };

  const csv = exportPP30ToCSV(data);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("2100.00"));
  assert.ok(csv.includes("1400.00"));
  assert.ok(csv.includes("700.00"));
}
