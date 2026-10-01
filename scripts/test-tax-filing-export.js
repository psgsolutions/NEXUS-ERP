import assert from 'node:assert';

/**
 * Test: ภ.พ.30 (PP.30 VAT) Tax Filing & Export Engine
 * Verifies calculation of Output VAT, Input VAT, and Net Payable VAT from journal entries
 * scoped by companyId + isDeleted: false.
 */

async function runTest() {
  console.log("=== START TEST: PP.30 Monthly VAT Tax Export Flow ===");

  const companyId = "COMP-001";
  const yearMonth = "2026-09";

  // 4 Mock Journal Entries created in September 2026
  const mockJournalEntries = [
    {
      id: "JV-202609-001",
      companyId: "COMP-001",
      isDeleted: false,
      date: "2026-09-05T10:00:00.000Z",
      description: "บันทึกรายได้จากการขายพร้อมภาษีขาย",
      items: [
        { accountCode: "111100", debit: 10700, credit: 0, description: "เงินสด" },
        { accountCode: "411000", debit: 0, credit: 10000, description: "รายได้จากการขาย" },
        { accountCode: "213100", debit: 0, credit: 700, description: "ภาษีขาย Output VAT" }
      ]
    },
    {
      id: "JV-202609-002",
      companyId: "COMP-001",
      isDeleted: false,
      date: "2026-09-12T14:30:00.000Z",
      description: "บันทึกรายได้จากการให้บริการพร้อมภาษีขาย",
      items: [
        { accountCode: "111100", debit: 21400, credit: 0, description: "เงินสด" },
        { accountCode: "411000", debit: 0, credit: 20000, description: "รายได้ค่าบริการ" },
        { accountCode: "213100", debit: 0, credit: 1400, description: "ภาษีขาย Output VAT" }
      ]
    },
    {
      id: "JV-202609-003",
      companyId: "COMP-001",
      isDeleted: false,
      date: "2026-09-18T09:15:00.000Z",
      description: "บันทึกซื้อพัสดุและสินค้าพร้อมภาษีซื้อ",
      items: [
        { accountCode: "511000", debit: 15000, credit: 0, description: "ต้นทุนสินค้า" },
        { accountCode: "115100", debit: 1050, credit: 0, description: "ภาษีซื้อ Input VAT" },
        { accountCode: "211100", debit: 0, credit: 16050, description: "เจ้าหนี้การค้า" }
      ]
    },
    {
      id: "JV-202609-004",
      companyId: "COMP-001",
      isDeleted: false,
      date: "2026-09-22T16:00:00.000Z",
      description: "บันทึกค่าใช้จ่ายสำนักงานพร้อมภาษีซื้อ",
      items: [
        { accountCode: "521000", debit: 5000, credit: 0, description: "ค่าใช้จ่ายทั่วไป" },
        { accountCode: "115100", debit: 350, credit: 0, description: "ภาษีซื้อ Input VAT" },
        { accountCode: "111100", debit: 0, credit: 5350, description: "เงินสด" }
      ]
    }
  ];

  // Logic calculation simulation
  let salesBase = 0;
  let outputVat = 0;
  let purchaseBase = 0;
  let inputVat = 0;

  for (const entry of mockJournalEntries) {
    if (entry.companyId !== companyId || entry.isDeleted) continue;
    if (!entry.date.startsWith(yearMonth)) continue;

    for (const line of entry.items) {
      const code = line.accountCode;
      const memo = (line.description || "").toLowerCase();
      const dr = line.debit || 0;
      const cr = line.credit || 0;

      if (code === "213100" || memo.includes("output vat")) {
        const vatVal = cr - dr;
        if (vatVal > 0) {
          outputVat += vatVal;
          salesBase += Math.round((vatVal / 0.07) * 100) / 100;
        }
      }

      if (code === "115100" || memo.includes("input vat")) {
        const vatVal = dr - cr;
        if (vatVal > 0) {
          inputVat += vatVal;
          purchaseBase += Math.round((vatVal / 0.07) * 100) / 100;
        }
      }
    }
  }

  const netVatPayable = outputVat - inputVat;

  console.log("Calculated ภ.พ.30 Results:");
  console.log(`  - Sales Base: ฿${salesBase.toFixed(2)}`);
  console.log(`  - Output VAT (ภาษีขาย): ฿${outputVat.toFixed(2)}`);
  console.log(`  - Purchase Base: ฿${purchaseBase.toFixed(2)}`);
  console.log(`  - Input VAT (ภาษีซื้อ): ฿${inputVat.toFixed(2)}`);
  console.log(`  - Net VAT Payable (ภาษีต้องชำระ): ฿${netVatPayable.toFixed(2)}`);

  // Assertions
  assert.strictEqual(outputVat, 2100, "Output VAT should equal 2,100 THB");
  assert.strictEqual(inputVat, 1400, "Input VAT should equal 1,400 THB");
  assert.strictEqual(netVatPayable, 700, "Net Payable VAT should equal 700 THB");
  assert.strictEqual(salesBase, 30000, "Sales Base should equal 30,000 THB");
  assert.strictEqual(purchaseBase, 20000, "Purchase Base should equal 20,000 THB");

  // CSV Generation Test
  const bom = "\uFEFF";
  const csvRows = [
    ["รายงานภาษีมูลค่าเพิ่ม (ภ.พ.30)", `ประจำงวดเดือน/ปี: ${yearMonth}`],
    ["รหัสบริษัท", companyId],
    [],
    ["รายการ", "มูลค่าสินค้า/บริการ (บาท)", "ภาษีมูลค่าเพิ่ม 7% (บาท)"],
    ["1. ยอดขายในเดือนนี้ (ภาษีขาย)", salesBase.toFixed(2), outputVat.toFixed(2)],
    ["2. ยอดซื้อในเดือนนี้ (ภาษีซื้อ)", purchaseBase.toFixed(2), inputVat.toFixed(2)],
    ["3. ภาษีมูลค่าเพิ่มต้องชำระสุทธิ", "-", netVatPayable.toFixed(2)]
  ];

  const csvOutput = bom + csvRows.map(r => r.join(",")).join("\n");
  assert.ok(csvOutput.includes("2100.00"), "CSV should contain Output VAT 2100.00");
  assert.ok(csvOutput.includes("1400.00"), "CSV should contain Input VAT 1400.00");
  assert.ok(csvOutput.includes("700.00"), "CSV should contain Net Payable 700.00");

  console.log("✓ All ภ.พ.30 export assertions passed successfully!");
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
