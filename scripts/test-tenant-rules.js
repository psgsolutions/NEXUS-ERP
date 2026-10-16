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
    await setDoc(doc(db, 'users/adminR'), { companyId: 'A', role: 'ADMIN', roles: ['ADMIN', 'HR'] });
    await setDoc(doc(db, 'users/acctA'), { companyId: 'A', role: 'ACCOUNTANT', roles: ['ACCOUNTANT'] });
    await setDoc(doc(db, 'users/buyerA'), { companyId: 'A', role: 'PURCHASING', roles: ['PURCHASING'] });
    await setDoc(doc(db, 'users/legacyAcct'), { companyId: 'A', role: 'accountant' });
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
    await setDoc(doc(db, 'companies/A/invoices/inv1'), { companyId: 'A', invoiceNo: 'INV-26-0001' });
    await setDoc(doc(db, 'companies/A/invoices/invSample'), { companyId: 'A', isSample: true });
    await setDoc(doc(db, 'employees/eB'), { companyId: 'B', name: 'B' });
    await setDoc(doc(db, 'companies/A/projects/P1'), { companyId: 'A', status: 'In Progress' });
    await setDoc(doc(db, 'companies/A/customer_refunds/RF-1'), { companyId: 'A', amount: 100 });
    await setDoc(doc(db, 'companies/A/counters/RE'), { lastSeq: 5 });
    await setDoc(doc(db, 'companies/A/journal_entries/J1'), { companyId: 'A', status: 'draft' });
    await setDoc(doc(db, 'taxFilings/T1'), { companyId: 'A' });
    await setDoc(doc(db, 'companies/A/payrolls/P1'), { companyId: 'A' });
    await setDoc(doc(db, 'companies/A/payments/PV1'), { companyId: 'A' });
    for (const c of ['purchase_requests', 'purchase_orders', 'expenses', 'withholding_taxes', 'sales_orders', 'work_orders']) {
      await setDoc(doc(db, `companies/A/${c}/D1`), { companyId: 'A', status: 'PENDING_APPROVAL' });
    }
    await setDoc(doc(db, 'companies/A/projects/P1/change_orders/co1'), { status: 'PENDING' });
  });

  const anon = testEnv.unauthenticatedContext().firestore();
  const stranger = testEnv.authenticatedContext('stranger', { email: 'x@evil.com' }).firestore();
  const userA = testEnv.authenticatedContext('userA', { email: 'a@a.com' }).firestore();
  const adminA = testEnv.authenticatedContext('adminA', { email: 'admin@a.com' }).firestore();
  const adminR = testEnv.authenticatedContext('adminR', { email: 'adminr@a.com' }).firestore();
  const acctA = testEnv.authenticatedContext('acctA', { email: 'acct@a.com' }).firestore();
  const buyerA = testEnv.authenticatedContext('buyerA', { email: 'buyer@a.com' }).firestore();
  const legacyAcct = testEnv.authenticatedContext('legacyAcct', { email: 'legacy@a.com' }).firestore();
  const userB = testEnv.authenticatedContext('userB', { email: 'b@b.com' }).firestore();
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
    ['member writes own company subcollection', () => assertSucceeds(setDoc(doc(userA, 'companies/A/site_notes/n1'), { companyId: 'A' }))],
    ['member cannot write other company subcollection', () => assertFails(setDoc(doc(userA, 'companies/B/site_notes/n1'), { companyId: 'B' }))],
    ['member cannot create a company', () => assertFails(setDoc(doc(userA, 'companies/C'), { name: 'C' }))],

    // Users / privilege escalation
    ['user reads own profile', () => assertSucceeds(getDoc(doc(userA, 'users/userA')))],
    ['user queries users of own company', () => assertSucceeds(byCompany(userA, 'users', 'A'))],
    ['user cannot read other company profile', () => assertFails(getDoc(doc(userA, 'users/userB')))],
    ['user cannot change own role', () => assertFails(updateDoc(doc(userA, 'users/userA'), { role: 'ADMIN' }))],
    ['user cannot change own company', () => assertFails(updateDoc(doc(userA, 'users/userA'), { companyId: 'B' }))],
    ['stranger cannot create own profile', () => assertFails(setDoc(doc(stranger, 'users/stranger'), { companyId: 'A', role: 'ADMIN' }))],
    // บัญชีและตำแหน่ง: สร้าง/กำหนดผ่าน API (SUPERADMIN) เท่านั้น
    ['company admin cannot create user directly', () => assertFails(setDoc(doc(adminA, 'users/newA'), { companyId: 'A', role: 'SALES' }))],
    ['company admin cannot change user roles', () => assertFails(updateDoc(doc(adminA, 'users/userA'), { roles: ['EXECUTIVE'] }))],
    ['company admin cannot change user legacy role', () => assertFails(updateDoc(doc(adminA, 'users/userA'), { role: 'ADMIN' }))],
    ['company admin cannot change user status', () => assertFails(updateDoc(doc(adminA, 'users/userA'), { status: 'ACTIVE' }))],
    ['company admin edits user name', () => assertSucceeds(updateDoc(doc(adminA, 'users/userA'), { name: 'สมชาย' }))],
    ['roles-array admin edits user name', () => assertSucceeds(updateDoc(doc(adminR, 'users/userA'), { phone: '081' }))],
    ['user cannot grant self roles', () => assertFails(updateDoc(doc(userA, 'users/userA'), { roles: ['ADMIN'] }))],
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
    // ข้อมูลพนักงาน (เงินเดือน/บัญชีธนาคาร) อ่านได้เฉพาะ HR/บัญชี/ผู้บริหาร
    ['HR reads own-company employee', () => assertSucceeds(getDoc(doc(adminR, 'employees/eA')))],
    ['accountant reads own-company employee', () => assertSucceeds(getDoc(doc(acctA, 'employees/eA')))],
    ['sales cannot read employee record', () => assertFails(getDoc(doc(userA, 'employees/eA')))],
    ['accountant cannot read other-company employee', () => assertFails(getDoc(doc(acctA, 'employees/eB')))],
    ['member cannot edit employee (salary) directly', () => assertFails(updateDoc(doc(adminA, 'employees/eA'), { salary: 999999 }))],
    ['member cannot write attendance directly', () => assertFails(addDoc(collection(userA, 'attendance'), { companyId: 'A', type: 'IN' }))],

    // Journals & tax filings: API only (posting needs role, period and separation-of-duties checks)
    // ข้อมูลการเงินอ่านตามตำแหน่ง
    ['accountant reads journal', () => assertSucceeds(getDoc(doc(acctA, 'companies/A/journal_entries/J1')))],
    ['legacy lowercase accountant reads journal', () => assertSucceeds(getDoc(doc(legacyAcct, 'companies/A/journal_entries/J1')))],
    ['legacy admin reads journal', () => assertSucceeds(getDoc(doc(adminA, 'companies/A/journal_entries/J1')))],
    ['sales cannot read journal', () => assertFails(getDoc(doc(userA, 'companies/A/journal_entries/J1')))],
    ['system admin (roles) cannot read journal', () => assertFails(getDoc(doc(adminR, 'companies/A/journal_entries/J1')))],
    ['sales cannot read payment voucher', () => assertFails(getDoc(doc(userA, 'companies/A/payments/PV1')))],
    ['accountant reads payment voucher', () => assertSucceeds(getDoc(doc(acctA, 'companies/A/payments/PV1')))],
    ['HR reads payroll', () => assertSucceeds(getDoc(doc(adminR, 'companies/A/payrolls/P1')))],
    ['sales cannot read payroll', () => assertFails(getDoc(doc(userA, 'companies/A/payrolls/P1')))],
    ['purchasing cannot read payroll', () => assertFails(getDoc(doc(buyerA, 'companies/A/payrolls/P1')))],
    ['purchasing reads expenses', () => assertSucceeds(getDoc(doc(buyerA, 'companies/A/expenses/D1')))],
    ['sales cannot read expenses', () => assertFails(getDoc(doc(userA, 'companies/A/expenses/D1')))],
    ['sales cannot list journal subcollection', () => assertFails(getDoc(doc(userA, 'companies/A/journal_entries/J1/notes/n1')))],
    ['sales cannot read legacy root journal', () => assertFails(getDoc(doc(userA, 'journal_entries/x')))],
    ['member cannot create journal directly', () => assertFails(setDoc(doc(userA, 'companies/A/journal_entries/J2'), { companyId: 'A', status: 'posted' }))],
    ['admin cannot post journal directly', () => assertFails(updateDoc(doc(adminA, 'companies/A/journal_entries/J1'), { status: 'posted' }))],
    ['admin cannot delete journal', () => assertFails(deleteDoc(doc(adminA, 'companies/A/journal_entries/J1')))],
    ['member cannot write legacy root journal', () => assertFails(setDoc(doc(userA, 'journal_entries/x'), { companyId: 'A' }))],
    ['accountant reads own tax filing', () => assertSucceeds(getDoc(doc(acctA, 'taxFilings/T1')))],
    ['sales cannot read tax filing', () => assertFails(getDoc(doc(userA, 'taxFilings/T1')))],
    ['member cannot create tax filing', () => assertFails(setDoc(doc(userA, 'taxFilings/T2'), { companyId: 'A' }))],
    ['member cannot fake tax filing lock', () => assertFails(setDoc(doc(userA, 'companies/A/tax_filing_locks/L1'), { isLocked: true }))],
    // จัดซื้อ / ค่าใช้จ่าย / ขาย / งานบริการ: อ่านได้ เขียนผ่าน API เท่านั้น
    ...['purchase_requests', 'purchase_orders', 'expenses', 'withholding_taxes', 'sales_orders', 'work_orders'].flatMap((c) => [
      [`member reads ${c}`, () => assertSucceeds(getDoc(doc(['expenses', 'withholding_taxes'].includes(c) ? acctA : userA, `companies/A/${c}/D1`)))],
      [`member cannot create ${c}`, () => assertFails(setDoc(doc(userA, `companies/A/${c}/D2`), { companyId: 'A' }))],
      [`admin cannot approve ${c} directly`, () => assertFails(updateDoc(doc(adminA, `companies/A/${c}/D1`), { status: 'APPROVED' }))],
      [`admin cannot delete ${c} directly`, () => assertFails(deleteDoc(doc(adminA, `companies/A/${c}/D1`)))],
    ]),
    ['member uploads work order photo', () => assertSucceeds(setDoc(doc(userA, 'companies/A/work_orders/D1/attachments/after'), { companyId: 'A', type: 'after' }))],
    ['member cannot upload photo to other company work order', () => assertFails(setDoc(doc(userA, 'companies/B/work_orders/D1/attachments/after'), { companyId: 'B' }))],
    ['member cannot write other work order subcollection', () => assertFails(setDoc(doc(userA, 'companies/A/work_orders/D1/logs/x'), { companyId: 'A' }))],
    ['member cannot write depreciation run', () => assertFails(setDoc(doc(userA, 'assetDepreciations/A_2026-10'), { companyId: 'A' }))],

    // Company document counters: API only (tax numbers RE/QT/RF live here)
    ["member reads company counter", () => assertSucceeds(getDoc(doc(userA, "companies/A/counters/RE")))],
    ["member cannot bump company counter", () => assertFails(setDoc(doc(userA, "companies/A/counters/RE"), { lastSeq: 1 }))],
    ["admin cannot reset company counter", () => assertFails(updateDoc(doc(adminA, "companies/A/counters/RE"), { lastSeq: 0 }))],

    // Customer refunds: API only
    ['accountant reads customer refund', () => assertSucceeds(getDoc(doc(acctA, 'companies/A/customer_refunds/RF-1')))],
    ['sales cannot read customer refund', () => assertFails(getDoc(doc(userA, 'companies/A/customer_refunds/RF-1')))],
    ['member cannot create customer refund directly', () => assertFails(setDoc(doc(userA, 'companies/A/customer_refunds/RF-2'), { amount: 1 }))],
    ['admin cannot edit customer refund', () => assertFails(updateDoc(doc(adminA, 'companies/A/customer_refunds/RF-1'), { amount: 999 }))],

    // Project change orders: API only; other project subcollections stay client-writable
    ['member reads project change order', () => assertSucceeds(getDoc(doc(userA, 'companies/A/projects/P1/change_orders/co1')))],
    ['member cannot create change order directly', () => assertFails(setDoc(doc(userA, 'companies/A/projects/P1/change_orders/co2'), { status: 'APPROVED' }))],
    ['admin cannot approve change order directly', () => assertFails(updateDoc(doc(adminA, 'companies/A/projects/P1/change_orders/co1'), { status: 'APPROVED' }))],
    ['member writes other project subcollection', () => assertSucceeds(setDoc(doc(userA, 'companies/A/projects/P1/notes/n1'), { text: 'x' }))],
    ['member writes project document', () => assertSucceeds(updateDoc(doc(userA, 'companies/A/projects/P1'), { note: 'x' }))],
    ['other company cannot read change order', () => assertFails(getDoc(doc(userB, 'companies/A/projects/P1/change_orders/co1')))],

    // Tax documents
    ['member reads invoice', () => assertSucceeds(getDoc(doc(userA, 'companies/A/invoices/inv1')))],
    ['member cannot create invoice directly', () => assertFails(setDoc(doc(userA, 'companies/A/invoices/inv2'), { companyId: 'A' }))],
    ['member cannot edit invoice balance', () => assertFails(updateDoc(doc(userA, 'companies/A/invoices/inv1'), { balance: 0 }))],
    ['member cannot delete real invoice', () => assertFails(deleteDoc(doc(userA, 'companies/A/invoices/inv1')))],
    ['member deletes sample invoice', () => assertSucceeds(deleteDoc(doc(userA, 'companies/A/invoices/invSample')))],
    ['member cannot write credit note directly', () => assertFails(setDoc(doc(userA, 'companies/A/cndn/c1'), { companyId: 'A' }))],
    ['member cannot write billing note directly', () => assertFails(setDoc(doc(userA, 'companies/A/billing_notes/b1'), { companyId: 'A' }))],

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
