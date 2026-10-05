const fs = require('fs');
const admin = require('firebase-admin');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    acc[k] = v.join('=').trim().replace(/^"|"$/g, '');
  }
  return acc;
}, {});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

const db = admin.firestore();

const ROOT_COLLECTIONS = [
  'counters',
  'journal_entries',
  'sales_orders',
  'products',
  'companies',
  'users',
  'customers',
  'quotations',
  'projects',
  'purchase_orders',
  'goods_receipts',
  'audit_logs',
  'stock_ledgers',
  'serial_numbers'
];

async function runDeepAudit() {
  console.log("=== STARTING DEEP READ-ONLY AUDIT (ROOT & COLLECTION GROUPS) ===");
  
  const results = [];

  // 1. Audit Root Collections
  for (const collName of ROOT_COLLECTIONS) {
    try {
      const snap = await db.collection(collName).get();
      let hasCompanyIdSnake = 0;
      let hasCompanyIdCamel = 0;

      snap.forEach(doc => {
        const data = doc.data();
        if ('company_id' in data) hasCompanyIdSnake++;
        if ('companyId' in data) hasCompanyIdCamel++;
      });

      results.push({
        type: 'Root Collection',
        path: collName,
        totalDocs: snap.size,
        company_id_count: hasCompanyIdSnake,
        companyId_count: hasCompanyIdCamel
      });
    } catch (err) {
      results.push({ type: 'Root Collection', path: collName, error: err.message });
    }
  }

  // 2. Audit Collection Groups (Nested Sub-collections)
  const SUB_COLLECTION_NAMES = [
    'counters',
    'journal_entries',
    'sales_orders',
    'products',
    'quotations',
    'purchase_orders',
    'stock_movements',
    'serial_numbers',
    'auditLogs'
  ];

  for (const subName of SUB_COLLECTION_NAMES) {
    try {
      const groupSnap = await db.collectionGroup(subName).get();
      let hasCompanyIdSnake = 0;
      let hasCompanyIdCamel = 0;

      groupSnap.forEach(doc => {
        const data = doc.data();
        if ('company_id' in data) hasCompanyIdSnake++;
        if ('companyId' in data) hasCompanyIdCamel++;
      });

      results.push({
        type: 'Collection Group',
        path: `collectionGroup(${subName})`,
        totalDocs: groupSnap.size,
        company_id_count: hasCompanyIdSnake,
        companyId_count: hasCompanyIdCamel
      });
    } catch (err) {
      results.push({ type: 'Collection Group', path: `collectionGroup(${subName})`, error: err.message });
    }
  }

  console.log("\n=== DEEP AUDIT RESULTS SUMMARY ===");
  console.table(results);
  
  fs.writeFileSync(
    'scratch/audit_results_deep.json',
    JSON.stringify(results, null, 2),
    'utf8'
  );
  process.exit(0);
}

runDeepAudit();
