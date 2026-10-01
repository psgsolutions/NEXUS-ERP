import assert from 'node:assert';

/**
 * Test: Warranty Expiration MA Proposal Cron & Deduplication Engine
 * Verifies that serial numbers expiring within 30 days trigger draft MA proposal generation,
 * and subsequent cron runs on next days SKIP already-drafted serials.
 */

async function runTest() {
  console.log("=== START TEST: Warranty Expiration MA Proposal Cron Flow ===");

  const companyId = "COMP-001";
  const now = new Date();
  
  // Serial number expiring in 25 days
  const expiry25Days = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Mock Database state
  const mockSerialNumbers = [
    {
      id: "SN-DOC-001",
      sn: "SN-2026-X1",
      companyId: "COMP-001",
      isDeleted: false,
      warrantyStatus: "active",
      warrantyEndDate: expiry25Days,
      customerId: "CUST-100",
      salesOwnerId: "SALES-OFFICER-01",
      maDrafted: false,
      maProposalId: null
    }
  ];

  const mockQuotations = [];

  // Cron Simulation Engine
  function runCronJob() {
    const results = [];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    for (const snDoc of mockSerialNumbers) {
      if (snDoc.companyId !== companyId || snDoc.isDeleted) continue;
      if (snDoc.warrantyStatus !== "active") continue;

      // Deduplication check
      if (snDoc.maDrafted) {
        results.push({
          sn: snDoc.sn,
          status: "SKIPPED_ALREADY_DRAFTED",
          proposalId: snDoc.maProposalId
        });
        continue;
      }

      const expiryDate = new Date(snDoc.warrantyEndDate);
      if (expiryDate >= new Date() && expiryDate <= thirtyDaysLater) {
        // Create draft MA proposal
        const propId = `QT-MA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        mockQuotations.push({
          id: propId,
          docNo: propId,
          title: `ข้อเสนอสัญญาบริการบำรุงรักษาอุปกรณ์ (MA) - Serial ${snDoc.sn}`,
          type: "MA_PROPOSAL",
          serialNo: snDoc.sn,
          customerId: snDoc.customerId,
          salesOwnerId: snDoc.salesOwnerId,
          status: "DRAFT",
          companyId
        });

        // Update serial record flag
        snDoc.maDrafted = true;
        snDoc.maProposalId = propId;

        results.push({
          sn: snDoc.sn,
          status: "CREATED",
          proposalId: propId
        });
      }
    }
    return results;
  }

  // --- DAY 1 RUN ---
  console.log("--> Executing Day 1 Cron Run:");
  const day1Results = runCronJob();
  console.log("Day 1 Results:", day1Results);

  assert.strictEqual(day1Results.length, 1, "Day 1 should process 1 serial number");
  assert.strictEqual(day1Results[0].status, "CREATED", "Day 1 should create draft MA proposal");
  assert.strictEqual(mockQuotations.length, 1, "Exactly 1 draft MA quotation should be created");
  assert.strictEqual(mockSerialNumbers[0].maDrafted, true, "Serial record maDrafted flag should be set to true");

  // --- DAY 2 RUN (Simulating next day cron execution) ---
  console.log("--> Executing Day 2 Cron Run (Next Day):");
  const day2Results = runCronJob();
  console.log("Day 2 Results:", day2Results);

  assert.strictEqual(day2Results.length, 1, "Day 2 should evaluate serial number");
  assert.strictEqual(day2Results[0].status, "SKIPPED_ALREADY_DRAFTED", "Day 2 should skip already drafted serial");
  assert.strictEqual(mockQuotations.length, 1, "Quotations count should still be 1 (No duplicates generated!)");

  console.log("✓ All warranty MA proposal cron assertions passed successfully!");
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
