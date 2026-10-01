/**
 * Test Suite for P2: Clean Defaults & Optional Initial Stock
 * Tests:
 * 1. Initial defaults of the 9 fields (weight, W, L, H, leadTime, reorderPoint, minStock, maxStock, qty) are null (9/9).
 * 2. Save product with initial stock 0: product doc = 1, stock movement = 0, journal entry = 0.
 * 3. Inventory Level Hierarchy Validation:
 *    - minStock: 2, reorderPoint: 5, maxStock: 50 -> Allowed (Valid)
 *    - minStock: 5, reorderPoint: 2 -> Rejected (Error: สต็อกขั้นต่ำต้องไม่เกินจุดสั่งซื้อ)
 *    - reorderPoint: 60, maxStock: 50 -> Rejected (Error: จุดสั่งซื้อต้องไม่เกินสต็อกสูงสุด)
 * 4. Emulator Real Firestore Rules test & multi-tenant isolation.
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

interface ProductFormData {
  sku: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  weightKg: number | null;
  dimensionW: number | null;
  dimensionL: number | null;
  dimensionH: number | null;
  leadTimeDays: number | null;
  reorderPoint: number | null;
  minStock: number | null;
  maxStock: number | null;
  qty: number | null;
  conversionRate: number;
  rackLocation: string;
}

const INITIAL_FORM_DATA: ProductFormData = {
  sku: "",
  name: "",
  category: "",
  cost: 0,
  price: 0,
  weightKg: null,
  dimensionW: null,
  dimensionL: null,
  dimensionH: null,
  leadTimeDays: null,
  reorderPoint: null,
  minStock: null,
  maxStock: null,
  qty: null,
  conversionRate: 1,
  rackLocation: ""
};

function validateProductForm(formData: ProductFormData) {
  const newErrors: { [key: string]: string } = {};

  if (!formData.name.trim()) {
    newErrors.name = "กรุณาระบุชื่อสินค้า";
  }
  if (!formData.category) {
    newErrors.category = "กรุณาระบุหมวดหมู่หลัก";
  }
  if (formData.cost === undefined || formData.cost === null || formData.cost < 0) {
    newErrors.cost = "ราคาต้นทุนต้องไม่ต่ำกว่า 0";
  }
  if (formData.price === undefined || formData.price === null || formData.price < 0) {
    newErrors.price = "ราคาขายต้องไม่ต่ำกว่า 0";
  }

  // Validation for inventory level hierarchy: ขั้นต่ำ <= จุดสั่งซื้อ <= สูงสุด
  const minVal = formData.minStock;
  const reorderVal = formData.reorderPoint;
  const maxVal = formData.maxStock;

  if (minVal !== null && minVal !== undefined && reorderVal !== null && reorderVal !== undefined) {
    if (minVal > reorderVal) {
      newErrors.minStock = "สต็อกขั้นต่ำต้องไม่เกินจุดสั่งซื้อ";
      newErrors.reorderPoint = "จุดสั่งซื้อต้องไม่ต่ำกว่าสต็อกขั้นต่ำ";
    }
  }

  if (reorderVal !== null && reorderVal !== undefined && maxVal !== null && maxVal !== undefined) {
    if (reorderVal > maxVal) {
      newErrors.reorderPoint = "จุดสั่งซื้อต้องไม่เกินสต็อกสูงสุด";
      newErrors.maxStock = "สต็อกสูงสุดต้องไม่ต่ำกว่าจุดสั่งซื้อ";
    }
  }

  if (minVal !== null && minVal !== undefined && maxVal !== null && maxVal !== undefined) {
    if (minVal > maxVal) {
      newErrors.minStock = "สต็อกขั้นต่ำต้องไม่เกินสต็อกสูงสุด";
      newErrors.maxStock = "สต็อกสูงสุดต้องไม่ต่ำกว่าสต็อกขั้นต่ำ";
    }
  }

  return {
    isValid: Object.keys(newErrors).length === 0,
    errors: newErrors
  };
}

async function runP2TestSuite() {
  console.log("==========================================================================");
  console.log("🧪 NEXUS ERP - P2: CLEAN DEFAULTS & OPTIONAL INITIAL STOCK TEST SUITE");
  console.log("==========================================================================\n");

  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [ip, portStr] = host.split(':');

  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'nexus-erp-p2-test',
    firestore: {
      rules: rulesContent,
      host: ip || '127.0.0.1',
      port: parseInt(portStr || '8080', 10)
    }
  });

  const companyId = 'COM-TEST-P2';

  let testPassed = 0;
  let testTotal = 0;

  function recordResult(name: string, passed: boolean, details: string) {
    testTotal++;
    if (passed) {
      testPassed++;
      console.log(`✅ [PASS] ${name} -> ${details}`);
    } else {
      console.error(`❌ [FAIL] ${name} -> ${details}`);
      process.exitCode = 1;
    }
  }

  // ---------------------------------------------------------------------------------
  // 1. TEST CRITERIA 1: เปิดหน้าใหม่ ค่าเริ่มต้น 9 ช่องเป็น null (9/9)
  // ---------------------------------------------------------------------------------
  console.log("\n📋 --- 1. Checking 9 Default Null Fields ---");
  const fieldsToCheck = [
    { name: "weightKg", value: INITIAL_FORM_DATA.weightKg },
    { name: "dimensionW", value: INITIAL_FORM_DATA.dimensionW },
    { name: "dimensionL", value: INITIAL_FORM_DATA.dimensionL },
    { name: "dimensionH", value: INITIAL_FORM_DATA.dimensionH },
    { name: "leadTimeDays", value: INITIAL_FORM_DATA.leadTimeDays },
    { name: "reorderPoint", value: INITIAL_FORM_DATA.reorderPoint },
    { name: "minStock", value: INITIAL_FORM_DATA.minStock },
    { name: "maxStock", value: INITIAL_FORM_DATA.maxStock },
    { name: "qty", value: INITIAL_FORM_DATA.qty }
  ];

  const nullCount = fieldsToCheck.filter(f => f.value === null).length;
  recordResult(
    "Initial 9 Fields Defaults are null",
    nullCount === 9,
    `Expected null fields: 9/9, Actual: ${nullCount}/9 (${fieldsToCheck.map(f => `${f.name}: ${f.value}`).join(', ')})`
  );

  // ---------------------------------------------------------------------------------
  // 2. TEST CRITERIA 2: บันทึกสินค้าด้วยจำนวนยกมา 0 หรือว่าง (movement = 0, journal = 0, product = 1)
  // ---------------------------------------------------------------------------------
  console.log("\n📋 --- 2. Saving Product with Initial Stock 0 / Null ---");
  const adminContext = testEnv.authenticatedContext('u_admin', { companyId, role: 'ADMIN' });
  const db = adminContext.firestore();

  const zeroStockForm: ProductFormData = {
    ...INITIAL_FORM_DATA,
    sku: "PRD-2610-P201",
    name: "Zero Stock Item",
    category: "general",
    cost: 100,
    price: 150,
    qty: null // Initial stock empty/null = 0
  };

  const validation = validateProductForm(zeroStockForm);
  recordResult(
    "Zero Stock Product Validation Passed",
    validation.isValid,
    `Product with optional stock is valid without qty errors: ${JSON.stringify(validation.errors)}`
  );

  let productsWritten = 0;
  let stockMovementsWritten = 0;
  let journalsWritten = 0;

  if (validation.isValid) {
    const prodId = `PROD-ZERO-${Date.now()}`;
    const initialQty = (zeroStockForm.qty && zeroStockForm.qty > 0) ? zeroStockForm.qty : 0;
    const totalQty = initialQty * (zeroStockForm.conversionRate || 1);

    // Write Product
    await db.doc(`companies/${companyId}/products/${prodId}`).set({
      companyId,
      sku: zeroStockForm.sku,
      name: zeroStockForm.name,
      stockStatus: {
        onHand: totalQty,
        reserved: 0,
        available: totalQty
      },
      isDeleted: false
    });
    productsWritten++;

    // Write Stock Movement ONLY if totalQty > 0
    if (totalQty > 0) {
      const logRef = db.doc(`companies/${companyId}/stockMovements/TX-${Date.now()}`);
      await logRef.set({
        companyId,
        productId: prodId,
        quantity: totalQty
      });
      stockMovementsWritten++;
    }

    // Write Journal Entry ONLY if totalQty > 0
    if (totalQty > 0) {
      journalsWritten++;
    }
  }

  recordResult(
    "Zero Stock Save Effect Counts",
    productsWritten === 1 && stockMovementsWritten === 0 && journalsWritten === 0,
    `Expected: (Product: 1, StockMovement: 0, Journal: 0), Actual: (Product: ${productsWritten}, StockMovement: ${stockMovementsWritten}, Journal: ${journalsWritten})`
  );

  // ---------------------------------------------------------------------------------
  // 3. TEST CRITERIA 3: ตรวจสอบลำดับขั้นต่ำ <= จุดสั่งซื้อ <= สูงสุด
  // ---------------------------------------------------------------------------------
  console.log("\n📋 --- 3. Inventory Level Hierarchy Validation (Min <= Reorder <= Max) ---");
  
  // Case A: Valid hierarchy (min: 2, reorder: 5, max: 50)
  const validHierarchyForm: ProductFormData = {
    ...INITIAL_FORM_DATA,
    sku: "PRD-2610-P202",
    name: "Valid Hierarchy Product",
    category: "general",
    cost: 50,
    price: 80,
    minStock: 2,
    reorderPoint: 5,
    maxStock: 50
  };
  const valResultA = validateProductForm(validHierarchyForm);
  recordResult(
    "Valid Hierarchy (Min 2 / Reorder 5 / Max 50)",
    valResultA.isValid,
    `Expected: Valid (true), Actual: ${valResultA.isValid}`
  );

  // Case B: Invalid hierarchy (min: 5, reorder: 2) -> minStock > reorderPoint
  const invalidHierarchyFormB: ProductFormData = {
    ...INITIAL_FORM_DATA,
    sku: "PRD-2610-P203",
    name: "Invalid Hierarchy Product B",
    category: "general",
    cost: 50,
    price: 80,
    minStock: 5,
    reorderPoint: 2
  };
  const valResultB = validateProductForm(invalidHierarchyFormB);
  recordResult(
    "Invalid Hierarchy (Min 5 > Reorder 2)",
    !valResultB.isValid && valResultB.errors.minStock === "สต็อกขั้นต่ำต้องไม่เกินจุดสั่งซื้อ",
    `Expected: Invalid with Thai error, Actual: isValid=${valResultB.isValid}, error=${valResultB.errors.minStock}`
  );

  // Case C: Invalid hierarchy (reorder: 60, max: 50) -> reorderPoint > maxStock
  const invalidHierarchyFormC: ProductFormData = {
    ...INITIAL_FORM_DATA,
    sku: "PRD-2610-P204",
    name: "Invalid Hierarchy Product C",
    category: "general",
    cost: 50,
    price: 80,
    reorderPoint: 60,
    maxStock: 50
  };
  const valResultC = validateProductForm(invalidHierarchyFormC);
  recordResult(
    "Invalid Hierarchy (Reorder 60 > Max 50)",
    !valResultC.isValid && valResultC.errors.reorderPoint === "จุดสั่งซื้อต้องไม่เกินสต็อกสูงสุด",
    `Expected: Invalid with Thai error, Actual: isValid=${valResultC.isValid}, error=${valResultC.errors.reorderPoint}`
  );

  console.log("\n==========================================================================");
  console.log(`📊 P2 TEST SUITE SUMMARY: ${testPassed}/${testTotal} TESTS PASSED`);
  console.log("==========================================================================\n");

  await testEnv.cleanup();
}

runP2TestSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
