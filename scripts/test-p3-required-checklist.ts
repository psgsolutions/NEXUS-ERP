import { 
  getRequiredFieldsStatus, 
  checkSkuDuplicate, 
  ProductFormDataLike 
} from "../src/lib/product-validation";
import {
  initializeTestEnvironment,
  RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";
import { doc, setDoc, getDoc } from "firebase/firestore";

async function runTests() {
  console.log("\n========================================================");
  console.log("🚀 STARTING PATCH 3 (P3) UNIT & INTEGRATION TESTS");
  console.log("========================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // --- Test 1: Empty form shows 0/4 and lists 4 missing fields ---
  console.log("--- 1. Testing Empty Form Status ---");
  const emptyForm: ProductFormDataLike = {
    name: "",
    category: "",
    cost: 0,
    price: 0,
    qty: null,
    warehouseId: "",
    sku: ""
  };
  const emptyStatus = getRequiredFieldsStatus(emptyForm);
  assert(emptyStatus.totalCount === 4, "Empty form has totalCount = 4");
  assert(emptyStatus.filledCount === 0, "Empty form has filledCount = 0 (0/4)");
  assert(emptyStatus.isComplete === false, "Empty form isComplete = false");
  assert(emptyStatus.missingFields.length === 4, "Empty form has 4 missing fields");
  assert(
    emptyStatus.missingFields.map(f => f.key).sort().join(",") === "category,cost,name,price",
    "Missing fields are category, cost, name, price"
  );

  // --- Test 2: Step-by-step filling (1/4 -> 2/4 -> 3/4 -> 4/4) ---
  console.log("\n--- 2. Testing Step-by-step Incremental Filling ---");
  
  // 1/4: Add Name
  const form1: ProductFormDataLike = { ...emptyForm, name: "Hikvision CCTV 4K" };
  const status1 = getRequiredFieldsStatus(form1);
  assert(status1.filledCount === 1 && status1.totalCount === 4, "1/4 when Name is filled");
  assert(!status1.isComplete, "1/4 is not complete");

  // 2/4: Add Category
  const form2: ProductFormDataLike = { ...form1, category: "cctv" };
  const status2 = getRequiredFieldsStatus(form2);
  assert(status2.filledCount === 2 && status2.totalCount === 4, "2/4 when Category is filled");
  assert(!status2.isComplete, "2/4 is not complete");

  // 3/4: Add Cost
  const form3: ProductFormDataLike = { ...form2, cost: 2500 };
  const status3 = getRequiredFieldsStatus(form3);
  assert(status3.filledCount === 3 && status3.totalCount === 4, "3/4 when Cost > 0 is filled");
  assert(!status3.isComplete, "3/4 is not complete");

  // 4/4: Add Price
  const form4: ProductFormDataLike = { ...form3, price: 3800 };
  const status4 = getRequiredFieldsStatus(form4);
  assert(status4.filledCount === 4 && status4.totalCount === 4, "4/4 when Price > 0 is filled");
  assert(status4.isComplete === true, "4/4 is complete");
  assert(status4.missingFields.length === 0, "4/4 has 0 missing fields");

  // --- Test 3: Adding initial stock increases denominator to 5 (4/5) ---
  console.log("\n--- 3. Testing Dynamic Initial Qty & Warehouse Requirement ---");
  const formWithQty: ProductFormDataLike = { ...form4, qty: 10, warehouseId: "" };
  const statusWithQty = getRequiredFieldsStatus(formWithQty);
  assert(statusWithQty.totalCount === 5, "When qty > 0, totalCount increases to 5");
  assert(statusWithQty.filledCount === 4, "Filled count is 4/5 without warehouse");
  assert(statusWithQty.isComplete === false, "4/5 is not complete");
  assert(
    statusWithQty.missingFields.length === 1 && statusWithQty.missingFields[0].key === "warehouseId",
    "Single missing field is warehouseId (คลังสินค้า)"
  );

  // --- Test 4: Selecting Warehouse completes 5/5 ---
  const formWithWarehouse: ProductFormDataLike = { ...formWithQty, warehouseId: "WH-MAIN-01" };
  const statusWithWarehouse = getRequiredFieldsStatus(formWithWarehouse);
  assert(statusWithWarehouse.totalCount === 5, "5/5 totalCount is 5");
  assert(statusWithWarehouse.filledCount === 5, "5/5 filledCount is 5");
  assert(statusWithWarehouse.isComplete === true, "5/5 is complete");
  assert(statusWithWarehouse.missingFields.length === 0, "5/5 has 0 missing fields");

  // --- Test 5: Removing initial stock reverts denominator back to 4 (4/4) ---
  const formQtyRemoved: ProductFormDataLike = { ...formWithQty, qty: null, warehouseId: "" };
  const statusQtyRemoved = getRequiredFieldsStatus(formQtyRemoved);
  assert(statusQtyRemoved.totalCount === 4, "When qty is null/0, totalCount reverts to 4");
  assert(statusQtyRemoved.filledCount === 4, "Filled count reverts to 4/4");
  assert(statusQtyRemoved.isComplete === true, "4/4 is complete");

  // --- Test 6: SKU Duplicate Checks ---
  console.log("\n--- 4. Testing SKU Uniqueness & Duplication Logic ---");
  const mockExistingProducts = [
    { id: "p1", sku: "PRD-2610-001", companyId: "COMP-A", isDeleted: false },
    { id: "p2", sku: "PRD-2610-002", companyId: "COMP-A", isDeleted: true }, // deleted
    { id: "p3", sku: "PRD-2610-003", companyId: "COMP-B", isDeleted: false }  // different company
  ];

  // Empty SKU
  assert(!checkSkuDuplicate("", mockExistingProducts, "COMP-A"), "Empty SKU is not marked duplicate");
  
  // Existing active SKU in same company -> duplicate!
  assert(
    checkSkuDuplicate("PRD-2610-001", mockExistingProducts, "COMP-A") === true,
    "Existing active SKU in same company is detected as duplicate"
  );
  assert(
    checkSkuDuplicate("prd-2610-001", mockExistingProducts, "COMP-A") === true,
    "Case-insensitive SKU duplicate detection works"
  );

  // Existing deleted SKU in same company -> not duplicate!
  assert(
    checkSkuDuplicate("PRD-2610-002", mockExistingProducts, "COMP-A") === false,
    "Deleted SKU is ignored and not considered duplicate"
  );

  // Existing SKU in different company -> not duplicate (multi-tenancy safe)!
  assert(
    checkSkuDuplicate("PRD-2610-003", mockExistingProducts, "COMP-A") === false,
    "SKU in different company is not considered duplicate in COMP-A"
  );

  // Brand new unique SKU -> not duplicate!
  assert(
    checkSkuDuplicate("PRD-2610-999", mockExistingProducts, "COMP-A") === false,
    "Brand new SKU is verified unique"
  );

  // --- Test 7: Firestore Emulator Save Integration ---
  console.log("\n--- 5. Testing Emulator Integration for Valid Product Save ---");
  const rulesPath = path.resolve(__dirname, "../firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf8");

  const host = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const [ip, portStr] = host.split(":");

  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: "nexus-erp-p3-test",
    firestore: {
      rules: rulesContent,
      host: ip || "127.0.0.1",
      port: parseInt(portStr || "8080", 10)
    }
  });

  const companyId = "COMP-TEST-P3";
  const adminContext = testEnv.authenticatedContext("u_admin_p3", { companyId, role: "ADMIN" });
  const db = adminContext.firestore();

  const testProdId = `PROD-P3-${Date.now()}`;
  const prodDocRef = doc(db, "products", testProdId);

  await setDoc(prodDocRef, {
    id: testProdId,
    companyId: companyId,
    sku: "PRD-2610-088",
    name: formWithWarehouse.name,
    category: formWithWarehouse.category,
    cost: formWithWarehouse.cost,
    price: formWithWarehouse.price,
    warehouseId: formWithWarehouse.warehouseId,
    stockStatus: {
      onHand: 10,
      reserved: 0,
      available: 10
    },
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const snap = await getDoc(prodDocRef);
  assert(snap.exists(), "Product document written and verified on Firestore Emulator");
  assert(snap.data()?.name === "Hikvision CCTV 4K", "Saved name matches");
  assert(snap.data()?.warehouseId === "WH-MAIN-01", "Saved warehouseId matches");
  assert(snap.data()?.stockStatus?.onHand === 10, "Saved stockStatus.onHand is 10");

  await testEnv.cleanup();

  console.log("\n========================================================");
  console.log(`🎉 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!`);
  console.log("========================================================\n");
}

runTests().catch(err => {
  console.error("❌ Test run encountered error:", err);
  process.exit(1);
});
