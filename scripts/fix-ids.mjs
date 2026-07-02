import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
      value = value.replace(/\\n/g, '\n');
      process.env[key] = value;
    }
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

function getPrefix(prefix, index) {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const runningNum = String(index).padStart(3, "0");
  return `${prefix}-${yy}${mm}-${runningNum}`;
}

async function fixIds() {
  console.log('Fixing Running Numbers...');
  const companyId = 'COMP-PREVIEW-01';

  // 1. Fix Products SKU
  const products = await db.collection('products').where('companyId', '==', companyId).get();
  let pIdx = 1;
  const pBatch = db.batch();
  for (const doc of products.docs) {
    pBatch.update(doc.ref, { sku: getPrefix('PRD', pIdx++) });
  }
  await pBatch.commit();
  console.log(`Updated ${pIdx - 1} Products SKUs.`);

  // 2. Fix Customers ID
  const customers = await db.collection('customers').where('companyId', '==', companyId).get();
  let cIdx = 1;
  const cBatch = db.batch();
  for (const doc of customers.docs) {
    cBatch.update(doc.ref, { customerId: getPrefix('CUS', cIdx++) });
  }
  await cBatch.commit();
  console.log(`Updated ${cIdx - 1} Customers IDs.`);

  // 3. Fix Employees ID
  const employees = await db.collection('employees').where('companyId', '==', companyId).get();
  let eIdx = 1;
  const eBatch = db.batch();
  for (const doc of employees.docs) {
    eBatch.update(doc.ref, { employeeId: getPrefix('EMP', eIdx++) });
  }
  await eBatch.commit();
  console.log(`Updated ${eIdx - 1} Employees IDs.`);

  // 4. Fix Contractors ID
  const contractors = await db.collection('contractors').where('companyId', '==', companyId).get();
  let ctIdx = 1;
  const ctBatch = db.batch();
  for (const doc of contractors.docs) {
    ctBatch.update(doc.ref, { contractorId: getPrefix('SUB', ctIdx++) });
  }
  await ctBatch.commit();
  console.log(`Updated ${ctIdx - 1} Contractors IDs.`);
  
  process.exit(0);
}

fixIds().catch(console.error);
