/**
 * Official Firebase Security Rules Unit Testing Suite
 * Executes against local Firebase Firestore Emulator using @firebase/rules-unit-testing
 * Tests Data Seeding, Multi-tenant Isolation, Cross-tenant Denial, Unauthenticated Denial,
 * Product Write RBAC (Nested & Root), and Quotation Approval Gate Transitions.
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

async function runOfficialRulesTest() {
  console.log('================================================================');
  console.log('🔥 RUNNING OFFICIAL FIREBASE RULES UNIT TESTING ENGINE');
  console.log('================================================================\n');

  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log(`📁 Loaded rule file: ${rulesPath} (${rulesContent.length} bytes)`);

  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [ip, portStr] = host.split(':');

  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'nexus-erp-official-test',
    firestore: {
      rules: rulesContent,
      host: ip || '127.0.0.1',
      port: parseInt(portStr || '8080', 10)
    }
  });

  const companyId = 'COM-NEXUS-01';
  const otherCompanyId = 'COM-OTHER-99';

  try {
    // -------------------------------------------------------------
    // SEED INITIAL DATA WITH SECURITY RULES DISABLED
    // -------------------------------------------------------------
    console.log('\n🌱 Seeding initial documents via admin context...');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      
      // Seed Nested Product
      await db.doc(`companies/${companyId}/products/PRD-001`).set({
        name: 'Initial Nested Product',
        companyId: companyId,
        sku: 'SKU-001'
      });

      // Seed Root Product
      await db.doc(`products/PRD-001`).set({
        name: 'Initial Root Product',
        companyId: companyId,
        sku: 'SKU-ROOT-001'
      });

      // Seed Quotations
      await db.doc(`companies/${companyId}/quotations/QT-PENDING`).set({
        quotationNumber: 'QT-2026-001',
        status: 'PENDING_APPROVAL',
        grandTotal: 150000,
        companyId: companyId
      });

      await db.doc(`companies/${companyId}/quotations/QT-DRAFT`).set({
        quotationNumber: 'QT-2026-002',
        status: 'DRAFT',
        grandTotal: 80000,
        companyId: companyId
      });
    });
    console.log('   ✅ Seeding completed successfully');

    // -------------------------------------------------------------
    // SETUP AUTHENTICATED CONTEXTS & FIRESTORE INSTANCES
    // -------------------------------------------------------------
    const salesContext = testEnv.authenticatedContext('u_sales', { companyId, role: 'SALES' });
    const managerContext = testEnv.authenticatedContext('u_manager', { companyId, role: 'MANAGER' });
    const adminContext = testEnv.authenticatedContext('u_admin', { companyId, role: 'ADMIN' });
    const crossTenantManagerContext = testEnv.authenticatedContext('u_other_mgr', { companyId: otherCompanyId, role: 'MANAGER' });
    const unauthContext = testEnv.unauthenticatedContext();

    const salesDb = salesContext.firestore();
    const managerDb = managerContext.firestore();
    const adminDb = adminContext.firestore();
    const crossTenantManagerDb = crossTenantManagerContext.firestore();
    const unauthDb = unauthContext.firestore();

    // -------------------------------------------------------------
    // TEST 1: Multi-tenant & Unauthenticated Isolation
    // -------------------------------------------------------------
    console.log('\n📌 [TEST 1] Multi-tenant & Unauthenticated Security Isolation');

    // 1a. Unauthenticated user reading nested product -> MUST FAIL
    await assertFails(unauthDb.doc(`companies/${companyId}/products/PRD-001`).get());
    console.log('   ✅ Unauthenticated read nested product: DENIED (assertFails Passed)');

    // 1b. Unauthenticated user updating nested product -> MUST FAIL
    await assertFails(unauthDb.doc(`companies/${companyId}/products/PRD-001`).update({ name: 'Hacked' }));
    console.log('   ✅ Unauthenticated write nested product: DENIED (assertFails Passed)');

    // 1c. Cross-Tenant Manager trying to read different tenant -> MUST FAIL
    await assertFails(crossTenantManagerDb.doc(`companies/${companyId}/products/PRD-001`).get());
    console.log('   ✅ Cross-tenant Manager read: DENIED (assertFails Passed)');

    // 1d. Cross-Tenant Manager trying to update different tenant -> MUST FAIL
    await assertFails(crossTenantManagerDb.doc(`companies/${companyId}/products/PRD-001`).update({ name: 'Cross Attack' }));
    console.log('   ✅ Cross-tenant Manager write: DENIED (assertFails Passed)');


    // -------------------------------------------------------------
    // TEST 2: Nested Products Write RBAC (companies/{companyId}/products)
    // -------------------------------------------------------------
    console.log('\n📌 [TEST 2] Nested Products Write RBAC (companies/{companyId}/products)');

    // 2a. Role SALES -> MUST FAIL
    await assertFails(salesDb.doc(`companies/${companyId}/products/PRD-001`).update({ name: 'Product by Sales' }));
    console.log('   ✅ Role SALES update nested product: DENIED (assertFails Passed)');

    // 2b. Role MANAGER -> MUST SUCCEED
    await assertSucceeds(managerDb.doc(`companies/${companyId}/products/PRD-001`).update({ name: 'Product by Manager' }));
    console.log('   ✅ Role MANAGER update nested product: ALLOWED (assertSucceeds Passed)');

    // 2c. Role ADMIN -> MUST SUCCEED
    await assertSucceeds(adminDb.doc(`companies/${companyId}/products/PRD-001`).update({ name: 'Product by Admin' }));
    console.log('   ✅ Role ADMIN update nested product: ALLOWED (assertSucceeds Passed)');


    // -------------------------------------------------------------
    // TEST 3: Root Products Write RBAC (products/{productId})
    // -------------------------------------------------------------
    console.log('\n📌 [TEST 3] Root Products Write RBAC (products/{productId})');

    // 3a. Role SALES -> MUST FAIL
    await assertFails(salesDb.doc(`products/PRD-001`).update({ name: 'Root Product by Sales' }));
    console.log('   ✅ Role SALES update root product: DENIED (assertFails Passed)');

    // 3b. Cross-tenant Manager -> MUST FAIL
    await assertFails(crossTenantManagerDb.doc(`products/PRD-001`).update({ name: 'Root Product by Cross Tenant' }));
    console.log('   ✅ Cross-tenant Manager update root product: DENIED (assertFails Passed)');

    // 3c. Role MANAGER (same tenant) -> MUST SUCCEED
    await assertSucceeds(managerDb.doc(`products/PRD-001`).update({ name: 'Root Product by Manager' }));
    console.log('   ✅ Role MANAGER update root product: ALLOWED (assertSucceeds Passed)');


    // -------------------------------------------------------------
    // TEST 4: Quotation Approval Gate & State Transition Checks
    // -------------------------------------------------------------
    console.log('\n📌 [TEST 4] Quotation Approval Gate (DRAFT -> PENDING_APPROVAL -> SENT)');

    // 4a. Role SALES: Direct create with status SENT -> MUST FAIL
    await assertFails(salesDb.collection(`companies/${companyId}/quotations`).add({
      quotationNumber: 'QT-DIRECT-SENT',
      status: 'SENT',
      grandTotal: 100000,
      companyId: companyId
    }));
    console.log('   ✅ Role SALES direct create with SENT status: DENIED (assertFails Passed)');

    // 4b. Role SALES: Bypass PENDING_APPROVAL by transitioning DRAFT -> SENT -> MUST FAIL
    await assertFails(salesDb.doc(`companies/${companyId}/quotations/QT-DRAFT`).update({ status: 'SENT' }));
    console.log('   ✅ Role SALES direct transition DRAFT -> SENT (bypassing approval): DENIED (assertFails Passed)');

    // 4c. Role SALES: Transition PENDING_APPROVAL -> SENT -> MUST FAIL
    await assertFails(salesDb.doc(`companies/${companyId}/quotations/QT-PENDING`).update({ status: 'SENT' }));
    console.log('   ✅ Role SALES status transition PENDING_APPROVAL -> SENT: DENIED (assertFails Passed)');

    // 4d. Role MANAGER: Transition PENDING_APPROVAL -> SENT -> MUST SUCCEED
    await assertSucceeds(managerDb.doc(`companies/${companyId}/quotations/QT-PENDING`).update({ status: 'SENT' }));
    console.log('   ✅ Role MANAGER status transition PENDING_APPROVAL -> SENT: ALLOWED (assertSucceeds Passed)');

    // 4e. Role ADMIN: Transition PENDING_APPROVAL -> SENT -> MUST SUCCEED
    await assertSucceeds(adminDb.doc(`companies/${companyId}/quotations/QT-PENDING`).update({ status: 'SENT' }));
    console.log('   ✅ Role ADMIN status transition PENDING_APPROVAL -> SENT: ALLOWED (assertSucceeds Passed)');

    // 4f. Attempting to modify documentNumber on non-draft quotation -> MUST FAIL
    await assertFails(salesDb.doc(`companies/${companyId}/quotations/QT-PENDING`).update({ documentNumber: 'QT-HACKED-001' }));
    console.log('   ✅ Modifying documentNumber on non-draft document: DENIED (assertFails Passed)');

    console.log('\n================================================================');
    console.log('🎉 ALL OFFICIAL FIREBASE RULES UNIT TESTS PASSED 100% CLEANLY!');
    console.log('================================================================\n');

  } finally {
    await testEnv.cleanup();
  }
}

runOfficialRulesTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
