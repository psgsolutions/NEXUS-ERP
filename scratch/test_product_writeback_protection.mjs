import assert from 'node:assert';

/**
 * Helper simulating product write-back payload builder
 */
function buildProductWriteBackPayload(item, userRole, saveToProductRequested) {
  const canEdit = ["SUPERADMIN", "ADMIN", "ENGINEER"].includes((userRole || "").toUpperCase()) && saveToProductRequested;
  if (!canEdit) return null;

  const updatePayload = {};
  if (item.details && item.details.trim()) {
    updatePayload.technicalSpecs = item.details.trim();
  }
  if (item.datasheetUrl && item.datasheetUrl.trim()) {
    updatePayload.datasheetUrl = item.datasheetUrl.trim();
  }

  // Return payload only if there are fields to update
  if (Object.keys(updatePayload).length === 0) {
    return null; // NO UPDATE to Firestore if fields are blank
  }
  return updatePayload;
}

// === UNIT TEST CASES ===
console.log("=== RUNNING PRODUCT WRITE-BACK PROTECTION TESTS ===");

// Existing Product in DB
const dbProductBefore = {
  id: "PRD-2606-0001",
  technicalSpecs: "Original High Precision 12V 10A Sensor Grade Specs",
  datasheetUrl: "https://nexus.com/datasheets/prd-0001.pdf"
};

// Case 1: Checkbox checked, but details and datasheetUrl left empty
const itemBlankDetails = {
  productId: "PRD-2606-0001",
  details: "",
  datasheetUrl: "  ",
  saveToProductMaster: true
};

const payload1 = buildProductWriteBackPayload(itemBlankDetails, "ADMIN", true);
console.log("Test 1 - Blank details payload:", payload1);
assert.strictEqual(payload1, null, "Payload MUST be null (NO update) when details are blank so existing specs are NOT overwritten!");

// Simulate applying payload to DB product
const dbProductAfter1 = { ...dbProductBefore, ...payload1 };
assert.strictEqual(dbProductAfter1.technicalSpecs, dbProductBefore.technicalSpecs, "Existing technicalSpecs MUST remain untouched!");

// Case 2: Checkbox checked, only details entered
const itemWithDetails = {
  productId: "PRD-2606-0001",
  details: "Updated Heavy Duty Aluminum Casing",
  datasheetUrl: "",
  saveToProductMaster: true
};

const payload2 = buildProductWriteBackPayload(itemWithDetails, "ADMIN", true);
console.log("Test 2 - With details payload:", payload2);
assert.deepStrictEqual(payload2, { technicalSpecs: "Updated Heavy Duty Aluminum Casing" });

// Case 3: Role is SALES (unauthorized)
const payload3 = buildProductWriteBackPayload(itemWithDetails, "SALES", true);
console.log("Test 3 - SALES role payload:", payload3);
assert.strictEqual(payload3, null, "SALES role MUST NOT generate write-back payload!");

console.log("✅ ALL PRODUCT WRITE-BACK PROTECTION TESTS PASSED SUCCESSFULLY! 🎉");
