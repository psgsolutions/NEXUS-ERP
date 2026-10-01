const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

async function runUnitTests() {
  console.log("==========================================================================");
  console.log("🔥 REAL FIRESTORE RULES ENGINE UNIT TEST SUITE (@firebase/rules-unit-testing)");
  console.log("==========================================================================\n");

  const rulesPath = path.join(__dirname, '..', 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  // Initialize test environment with ACTUAL firestore.rules file content loaded into the real engine
  const testEnv = await initializeTestEnvironment({
    projectId: 'nexus-erp-rules-unit-test',
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8080
    }
  });

  console.log("📜 Loaded ACTUAL firestore.rules content directly into Firebase Rules Engine!\n");

  let passed = 0;
  let total = 0;

  async function runTest(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`✅ [TEST ${total} PASS] ${name}`);
    } catch (err) {
      console.error(`❌ [TEST ${total} FAIL] ${name}:`, err.message);
      process.exitCode = 1;
    }
  }

  // Seed initial test documents using security rules disabled context
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('companies/COMP-001/quotations/QT-001').set({ 
      companyId: 'COMP-001', 
      status: 'draft', 
      documentNumber: 'QT-2026-0001' 
    });
    await db.doc('companies/COMP-001/quotations/QT-002').set({ 
      companyId: 'COMP-001', 
      status: 'draft', 
      documentNumber: 'QT-2026-0002' 
    });
    await db.doc('companies/COMP-001/quotations/QT-APPROVED').set({ 
      companyId: 'COMP-001', 
      status: 'approved', 
      documentNumber: 'QT-2026-0099' 
    });
    await db.doc('companies/COMP-001/products/PRD-001').set({
      companyId: 'COMP-001',
      sku: 'PRD-001',
      name: 'Test Product',
      technicalSpecs: 'Original Spec',
      datasheetUrl: 'https://original.com/spec.pdf'
    });
  });

  // Case 1: Cross-Company Access (Tenant Isolation)
  await runTest("Reject Cross-Company Read (User COMP-002 accessing COMP-001 document)", async () => {
    const userComp2 = testEnv.authenticatedContext('usr-2', { companyId: 'COMP-002', role: 'ACCOUNTANT' });
    const db = userComp2.firestore();
    await assertFails(db.doc('companies/COMP-001/quotations/QT-001').get());
  });

  // Case 2: Delete by Non-ADMIN/MANAGER in same company (Role RBAC Check)
  await runTest("Reject Document Delete by ACCOUNTANT (Non-ADMIN/MANAGER in same company)", async () => {
    const accountant = testEnv.authenticatedContext('usr-1', { companyId: 'COMP-001', role: 'ACCOUNTANT' });
    const db = accountant.firestore();
    await assertFails(db.doc('companies/COMP-001/quotations/QT-001').delete());
  });

  // Case 3: Delete by ADMIN in same company
  await runTest("Allow Document Delete by ADMIN in same company", async () => {
    const admin = testEnv.authenticatedContext('usr-admin', { companyId: 'COMP-001', role: 'ADMIN' });
    const db = admin.firestore();
    await assertSucceeds(db.doc('companies/COMP-001/quotations/QT-001').delete());
  });

  // Case 4: Delete by MANAGER in same company
  await runTest("Allow Document Delete by MANAGER in same company", async () => {
    const manager = testEnv.authenticatedContext('usr-mgr', { companyId: 'COMP-001', role: 'MANAGER' });
    const db = manager.firestore();
    await assertSucceeds(db.doc('companies/COMP-001/quotations/QT-002').delete());
  });

  // Case 5: Direct Client Write to Root Collection /projects/PRJ-001
  await runTest("Reject Direct Client Write to Root Collection /projects/PRJ-001", async () => {
    const admin = testEnv.authenticatedContext('usr-admin', { companyId: 'COMP-001', role: 'ADMIN' });
    const db = admin.firestore();
    await assertFails(db.doc('projects/PRJ-001').set({ projectName: 'Unauthorized Direct Project' }));
  });

  // Case 6: Document Number Modification on Approved Document (Immutable Document Number)
  await runTest("Reject DocumentNumber Modification on Approved Document (Immutable Document Number)", async () => {
    const accountant = testEnv.authenticatedContext('usr-1', { companyId: 'COMP-001', role: 'ACCOUNTANT' });
    const db = accountant.firestore();
    await assertFails(db.doc('companies/COMP-001/quotations/QT-APPROVED').update({
      documentNumber: 'QT-MUTATED-9999'
    }));
  });

  // Case 7: Direct Client Write to Root Collection /counters/QT
  await runTest("Reject Direct Client Write to Root Collection /counters/QT", async () => {
    const admin = testEnv.authenticatedContext('usr-admin', { companyId: 'COMP-001', role: 'ADMIN' });
    const db = admin.firestore();
    await assertFails(db.doc('counters/QT').set({ value: 9999 }));
  });

  // Case 8: Reject Product Master Update by SALES role (Server-side RBAC Guardrail)
  await runTest("Reject Product Master Update by SALES role (Direct client write to products)", async () => {
    const sales = testEnv.authenticatedContext('usr-sales', { companyId: 'COMP-001', role: 'SALES' });
    const db = sales.firestore();
    await assertFails(db.doc('companies/COMP-001/products/PRD-001').update({
      technicalSpecs: 'Hacked Spec by Sales User',
      datasheetUrl: 'https://hacked.com/spec.pdf'
    }));
  });

  // Case 9: Allow Product Master Update by ADMIN role
  await runTest("Allow Product Master Update by ADMIN role", async () => {
    const admin = testEnv.authenticatedContext('usr-admin', { companyId: 'COMP-001', role: 'ADMIN' });
    const db = admin.firestore();
    await assertSucceeds(db.doc('companies/COMP-001/products/PRD-001').update({
      technicalSpecs: 'Valid Admin Spec',
      datasheetUrl: 'https://official.com/spec.pdf'
    }));
  });

  console.log("==========================================================================");
  console.log(`REAL FIRESTORE RULES ENGINE TEST SUMMARY: ${passed} / ${total} Test Cases Passed! 🎉`);
  console.log("==========================================================================\n");

  await testEnv.cleanup();
}

runUnitTests().catch(err => {
  console.error("Rules Unit Test Error:", err);
  process.exit(1);
});
