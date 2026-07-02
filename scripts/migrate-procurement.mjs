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

async function migrate() {
  const compId = 'COM-NEXUS-01';
  const subSuppliers = await db.collection('companies').doc(compId).collection('suppliers').get();
  
  const batch = db.batch();
  let count = 0;
  for (const doc of subSuppliers.docs) {
    const flatRef = db.collection('suppliers').doc(doc.id);
    batch.set(flatRef, doc.data());
    batch.delete(doc.ref);
    count++;
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`Migrated ${count} suppliers from subcollection to flat collection.`);
  } else {
    console.log('No suppliers found in subcollection.');
  }

  // Same for PR and PO
  const subPOs = await db.collection('companies').doc(compId).collection('purchase_orders').get();
  const batchPO = db.batch();
  let countPO = 0;
  for (const doc of subPOs.docs) {
    const flatRef = db.collection('purchase_orders').doc(doc.id);
    batchPO.set(flatRef, doc.data());
    batchPO.delete(doc.ref);
    countPO++;
  }
  if (countPO > 0) await batchPO.commit();

  const subPRs = await db.collection('companies').doc(compId).collection('purchase_requests').get();
  const batchPR = db.batch();
  let countPR = 0;
  for (const doc of subPRs.docs) {
    const flatRef = db.collection('purchase_requests').doc(doc.id);
    batchPR.set(flatRef, doc.data());
    batchPR.delete(doc.ref);
    countPR++;
  }
  if (countPR > 0) await batchPR.commit();

  process.exit(0);
}

migrate().catch(console.error);
