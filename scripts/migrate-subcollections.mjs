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

async function migrateSubcollections() {
  console.log('Migrating subcollections from COMP-001 to COM-NEXUS-01...');
  
  const subColNames = [
    'customers', 'quotations', 'sales_orders', 'opportunities',
    'serial_numbers', 'counters', 'inventory_balance', 'stock_movements',
    'journal_entries', 'purchase_orders'
  ];
  
  let totalMigrated = 0;
  const sourceCompanyId = 'COMP-001';
  const targetCompanyId = 'COM-NEXUS-01';

  for (const col of subColNames) {
    const sourceRef = db.collection(`companies/${sourceCompanyId}/${col}`);
    const targetRef = db.collection(`companies/${targetCompanyId}/${col}`);
    
    const snapshot = await sourceRef.get();
    let count = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Ensure companyId inside the data is updated
      if (data.companyId === sourceCompanyId || data.companyId === 'COMP-PREVIEW-01') {
        data.companyId = targetCompanyId;
      }
      
      // I am generating a new ID or keeping the old ID
      await targetRef.doc(doc.id).set(data, { merge: true });
      
      // Update IDs if it has customerId or similar (re-run logic from previous script)
      // I'll just copy it over first.
      count++;
      totalMigrated++;
    }
    console.log(`Migrated ${count} documents in subcollection '${col}'.`);
  }
  
  // Wait, I also should migrate COMP-PREVIEW-01 just in case something was saved there
  for (const col of subColNames) {
    const sourceRef = db.collection(`companies/COMP-PREVIEW-01/${col}`);
    const targetRef = db.collection(`companies/${targetCompanyId}/${col}`);
    
    const snapshot = await sourceRef.get();
    let count = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.companyId === 'COMP-PREVIEW-01') {
        data.companyId = targetCompanyId;
      }
      await targetRef.doc(doc.id).set(data, { merge: true });
      count++;
      totalMigrated++;
    }
    if (count > 0) {
      console.log(`Migrated ${count} documents from COMP-PREVIEW-01 in subcollection '${col}'.`);
    }
  }

  console.log(`\nSubcollection migration complete. Total documents moved: ${totalMigrated}`);
  process.exit(0);
}

migrateSubcollections().catch(console.error);
