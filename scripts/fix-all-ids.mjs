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
  const runningNum = String(index).padStart(4, "0"); // 4 digits according to sequence-engine.ts
  return `${prefix}-${yy}${mm}-${runningNum}`;
}

async function fixAllIds() {
  const compId = 'COM-NEXUS-01';
  console.log('Fixing Running Numbers (4 digits) for Flat and Subcollections...');

  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dateTag = `${yy}${mm}`;

  const config = [
    { col: 'customers', idField: 'customerId', prefix: 'CUS' },
    { col: 'employees', idField: 'employeeId', prefix: 'EMP' },
    { col: 'contractors', idField: 'contractorId', prefix: 'SUB' },
    { col: 'suppliers', idField: 'supplierId', prefix: 'SUP' },
    { col: 'products', idField: 'sku', prefix: 'PRD' }
  ];

  for (const { col, idField, prefix } of config) {
    let idx = 1;
    
    // Fix Flat Collection
    const flatRef = db.collection(col);
    const flatSnap = await flatRef.where('companyId', '==', compId).get();
    
    const flatBatch = db.batch();
    for (const doc of flatSnap.docs) {
      flatBatch.update(doc.ref, { [idField]: getPrefix(prefix, idx++) });
    }
    if (flatSnap.size > 0) await flatBatch.commit();
    console.log(`Updated ${flatSnap.size} ${col} in Flat Collection`);

    // Fix Subcollection
    let subIdx = 1;
    const subRef = db.collection('companies').doc(compId).collection(col);
    const subSnap = await subRef.get();
    
    const subBatch = db.batch();
    for (const doc of subSnap.docs) {
      subBatch.update(doc.ref, { [idField]: getPrefix(prefix, subIdx++) });
    }
    if (subSnap.size > 0) await subBatch.commit();
    console.log(`Updated ${subSnap.size} ${col} in Subcollection`);

    // Determine the max sequence used
    const maxSeqUsed = Math.max(idx - 1, subIdx - 1);
    
    if (maxSeqUsed > 0) {
      // Update the sequence counter
      const counterRef = db.collection('companies').doc(compId).collection('counters').doc(prefix);
      await counterRef.set({
        lastSeq: maxSeqUsed,
        lastDate: dateTag,
        updatedAt: new Date()
      }, { merge: true });
      console.log(`Initialized Counter for ${prefix} to ${maxSeqUsed}`);
    }
  }

  process.exit(0);
}

fixAllIds().catch(console.error);
