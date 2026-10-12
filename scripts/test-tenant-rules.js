/**
 * Tenant-isolation tests for firestore.rules (runs against the Firestore Emulator only)
 *
 *   npx firebase emulators:exec --only firestore --project demo-nexus "node scripts/test-tenant-rules.js"
 */
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc, writeBatch } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const SUPERADMIN_UID = 'fgIglIug2dh4aNMMeachaugIyFM2';

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-nexus',
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/adminA'), { companyId: 'A', role: 'ADMIN' });
    await setDoc(doc(db, 'users/userA'), { companyId: 'A', role: 'SALES' });
    await setDoc(doc(db, 'users/userB'), { companyId: 'B', role: 'ADMIN' });
    await setDoc(doc(db, 'companies/A'), { name: 'Company A' });
    await setDoc(doc(db, 'companies/B'), { name: 'Company B' });
    await setDoc(doc(db, 'companies/A/quotations/q1'), { companyId: 'A' });
    await setDoc(doc(db, 'companies/B/quotations/q2'), { companyId: 'B' });
    await setDoc(doc(db, 'companies/A/auditLogs/l1'), { companyId: 'A' });
    await setDoc(doc(db, 'products/pA'), { companyId: 'A', name: 'A product' });
    await setDoc(doc(db, 'products/pB'), { companyId: 'B', name: 'B product' });
    await setDoc(doc(db, 'logs/logA'), { companyId: 'A' });
    await setDoc(doc(db, 'periodClosings/A_2026_01'), { companyId: 'A', status: 'closed' });
    await setDoc(doc(db, 'companies/A/quotations/qDraft'), { companyId: 'A', status: 'DRAFT' });
    await setDoc(doc(db, 'companies/A/quotations/qSent'), { companyId: 'A', status: 'SENT' });
    await setDoc(doc(db, 'companies/A/quotations/qSent/lines/l1'), { qty: 1 });
    await setDoc(doc(db, 'companies/A/receipts/RE-1'), { companyId: 'A', status: 'posted' });
    await setDoc(doc(db, 'employees/eA'), { companyId: 'A', name: 'A' });
    await setDoc(doc(db, 'employees/eB'), { companyId: 'B', name: 'B' });
  });

  const anon = testEnv.unauthenticatedContext().firestore();
  const stranger = testEnv.authenticatedContext('stranger', { email: 'x@evil.com' }).firestore();
  const userA = testEnv.authenticatedContext('userA', { email: 'a@a.com' }).firestore();
  const adminA = testEnv.authenticatedContext('adminA', { email: 'admin@a.com' }).firestore();
  const superUid = testEnv.authenticatedContext(SUPERADMIN_UID, {}).firestore();
  const superEmail = testEnv.authenticatedContext('other-uid', { email: 'sadmin@admin.com' }).firestore();

  const byCompany = (db, col, c) => getDocs(query(collection(db, col), where('companyId', '==', c)));

  const cases = [
    // Membership
    ['anonymous cannot read products', () => assertFails(getDoc(doc(anon, 'products/pA')))],
    ['user without profile cannot read products', () => assertFails(getDoc(doc(stranger, 'products/pA')))],
    ['user without profile cannot query products', () => assertFails(byCompany(stranger, 'products', 'A'))],
    ['user without profile cannot write company tree', () => assertFails(setDoc(doc(stranger, 'companies/A/quotations/x'), { companyId: 'A' }))],

    // Root collections
    ['member reads own-company product', () => assertSucceeds(getDoc(doc(userA, 'products/pA')))],
    ['member cannot read other-company product', () => assertFails(getDoc(doc(userA, 'products/pB')))],
    ['member can check a non-existent doc', () => assertSucceeds(getDoc(doc(userA, 'products/none')))],
    ['member queries products filtered by own company', () => assertSucceeds(byCompany(userA, 'products', 'A'))],
    ['member cannot query products without company filter', () => assertFails(getDocs(collection(userA, 'products')))],
    ['member cannot query other company products', () => assertFails(byCompany(userA, 'products', 'B'))],
    ['member creates own-company product', () => assertSucceeds(addDoc(collection(userA, 'products'), { companyId: 'A' }))],
    ['member cannot create product for other company', () => assertFails(addDoc(collection(userA, 'products'), { companyId: 'B' }))],
    ['member cannot update other company product', () => assertFails(updateDoc(doc(userA, 'products/pB'), { name: 'hacked' }))],
    ['member cannot move own product to other company', () => assertFails(updateDoc(doc(userA, 'products/pA'), { companyId: 'B' }))],
    ['member cannot delete other company product', () => assertFails(deleteDoc(doc(userA, 'products/pB')))],

    // Company tree
    ['member reads own company doc', () => assertSucceeds(getDoc(doc(userA, 'companies/A')))],
    ['member cannot read other company doc', () => assertFails(getDoc(doc(userA, 'companies/B')))],
    ['member cannot list all companies', () => assertFails(getDocs(collection(userA, 'companies')))],
    ['member reads own company subcollection', () => assertSucceeds(getDoc(doc(userA, 'companies/A/quotations/q1')))],
    ['member cannot read other company subcollection', () => assertFails(getDoc(doc(userA, 'companies/B/quotations/q2')))],
    ['member writes own company subcollection', () => assertSucceeds(setDoc(doc(userA, 'companies/A/journal_entries/j1'), { companyId: 'A' }))],
    ['member cannot write other company subcollection', () => assertFails(setDoc(doc(userA, 'companies/B/journal_entries/j1'), { companyId: 'B' }))],
    ['member cannot create a company', () => assertFails(setDoc(doc(userA, 'companies/C'), { name: 'C' }))],

    // Users / privilege escalation
    ['user reads own profile', () => assertSucceeds(getDoc(doc(userA, 'users/userA')))],
    ['user queries users of own company', () => assertSucceeds(byCompany(userA, 'users', 'A'))],
    ['user cannot read other company profile', () => assertFails(getDoc(doc(userA, 'users/userB')))],
    ['user cannot change own role', () => assertFails(updateDoc(doc(userA, 'users/userA'), { role: 'ADMIN' }))],
    ['user cannot change own company', () => assertFails(updateDoc(doc(userA, 'users/userA'), { companyId: 'B' }))],
    ['stranger cannot create own profile', () => assertFails(setDoc(doc(stranger, 'users/stranger'), { companyId: 'A', role: 'ADMIN' }))],
    ['company admin creates user in own company', () => assertSucceeds(setDoc(doc(adminA, 'users/newA'), { companyId: 'A', role: 'SALES' }))],
    ['company admin cannot create SUPERADMIN', () => assertFails(setDoc(doc(adminA, 'users/newA2'), { companyId: 'A', role: 'SUPERADMIN' }))],
    ['company admin cannot create user in other company', () => assertFails(setDoc(doc(adminA, 'users/newB'), { companyId: 'B', role: 'SALES' }))],
    ['company admin cannot edit other company user', () => assertFails(updateDoc(doc(adminA, 'users/userB'), { role: 'SALES' }))],

    // Append-only and server-only
    ['member creates audit log', () => assertSucceeds(addDoc(collection(userA, 'companies/A/auditLogs'), { companyId: 'A' }))],
    ['audit log cannot be edited', () => assertFails(updateDoc(doc(userA, 'companies/A/auditLogs/l1'), { companyId: 'A', x: 1 }))],
    ['audit log cannot be deleted', () => assertFails(deleteDoc(doc(userA, 'companies/A/auditLogs/l1')))],
    ['member creates root log', () => assertSucceeds(addDoc(collection(userA, 'logs'), { companyId: 'A' }))],
    ['root log cannot be edited', () => assertFails(updateDoc(doc(userA, 'logs/logA'), { x: 1 }))],
    ['counters are server-only', () => assertFails(setDoc(doc(userA, 'counters/A_QT-26'), { seq: 1 }))],
    ['period closings readable by company', () => assertSucceeds(byCompany(userA, 'periodClosings', 'A'))],
    ['period closings are server-only', () => assertFails(setDoc(doc(userA, 'periodClosings/A_2026_02'), { companyId: 'A' }))],

    // Quotations: create on screen, edit via API only, delete only before sending
    ['member cannot create quotation directly (API only)', () => assertFails(setDoc(doc(userA, 'companies/A/quotations/qNew'), { companyId: 'A', status: 'DRAFT' }))],
    ['member cannot create quotation as APPROVED', () => assertFails(setDoc(doc(userA, 'companies/A/quotations/qBad'), { companyId: 'A', status: 'Approved' }))],
    ['member cannot update a quotation directly', () => assertFails(updateDoc(doc(userA, 'companies/A/quotations/qDraft'), { grandTotal: 1 }))],
    ['member cannot edit a sent quotation', () => assertFails(updateDoc(doc(userA, 'companies/A/quotations/qSent'), { grandTotal: 1 }))],
    ['member deletes draft quotation', () => assertSucceeds(deleteDoc(doc(userA, 'companies/A/quotations/qDraft')))],
    ['member cannot delete sent quotation', () => assertFails(deleteDoc(doc(userA, 'companies/A/quotations/qSent')))],
    ['cannot create quotation + lines in a batch from client', async () => {
      const b = writeBatch(userA);
      b.set(doc(userA, 'companies/A/quotations/qBatch'), { companyId: 'A', status: 'SENT' });
      b.set(doc(userA, 'companies/A/quotations/qBatch/lines/l1'), { qty: 2 });
      return assertFails(b.commit());
    }],
    ['cannot add lines to a sent quotation later', () => assertFails(setDoc(doc(userA, 'companies/A/quotations/qSent/lines/l2'), { qty: 9 }))],
    ['cannot change lines of a sent quotation', () => assertFails(updateDoc(doc(userA, 'companies/A/quotations/qSent/lines/l1'), { qty: 9 }))],
    ['client cannot write quotation audit log', () => assertFails(addDoc(collection(userA, 'companies/A/quotations/qSent/audit_logs'), { action: 'FAKE' }))],
    ['member reads sent quotation lines', () => assertSucceeds(getDocs(collection(userA, 'companies/A/quotations/qSent/lines')))],

    // Server-only business documents
    ['member reads receipt', () => assertSucceeds(getDoc(doc(userA, 'companies/A/receipts/RE-1')))],
    ['member cannot edit receipt', () => assertFails(updateDoc(doc(userA, 'companies/A/receipts/RE-1'), { status: 'cancelled' }))],
    ['member cannot create payment', () => assertFails(setDoc(doc(userA, 'companies/A/payments/PV-1'), { companyId: 'A' }))],
    ['member cannot write payroll', () => assertFails(setDoc(doc(userA, 'companies/A/payrolls/2026-10'), { companyId: 'A' }))],
    ['member reads own-company employee', () => assertSucceeds(getDoc(doc(userA, 'employees/eA')))],
    ['member cannot read other-company employee', () => assertFails(getDoc(doc(userA, 'employees/eB')))],
    ['member cannot edit employee (salary) directly', () => assertFails(updateDoc(doc(adminA, 'employees/eA'), { salary: 999999 }))],
    ['member cannot write attendance directly', () => assertFails(addDoc(collection(userA, 'attendance'), { companyId: 'A', type: 'IN' }))],

    // SUPERADMIN
    ['superadmin (uid) reads other company', () => assertSucceeds(getDoc(doc(superUid, 'companies/B/quotations/q2')))],
    ['superadmin (uid) lists all companies', () => assertSucceeds(getDocs(collection(superUid, 'companies')))],
    ['superadmin (uid) queries products without filter', () => assertSucceeds(getDocs(collection(superUid, 'products')))],
    ['superadmin (email) reads other company product', () => assertSucceeds(getDoc(doc(superEmail, 'products/pB')))],
    ['superadmin creates user with any role', () => assertSucceeds(setDoc(doc(superUid, 'users/boss'), { companyId: 'B', role: 'SUPERADMIN' }))],
  ];

  let passed = 0;
  for (const [name, fn] of cases) {
    try {
      await fn();
      passed++;
      console.log(`  PASS  ${name}`);
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${String(err.message || err).split('\n')[0]}`);
    }
  }

  await testEnv.cleanup();
  console.log(`\n${passed}/${cases.length} passed`);
  process.exit(passed === cases.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
