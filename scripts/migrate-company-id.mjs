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

async function migrateData() {
  console.log('Migrating companyId from COMP-PREVIEW-01 to COM-NEXUS-01...');
  
  const collections = [
    'products', 'customers', 'contractors', 'employees', 
    'stockMovements', 'assets', 'kits', 'serials',
    'projects', 'suppliers', 'purchase_orders', 'purchase_requests'
  ];
  
  let totalMigrated = 0;
  
  for (const col of collections) {
    const snapshot = await db.collection(col).where('companyId', '==', 'COMP-PREVIEW-01').get();
    
    let count = 0;
    const batchPromises = [];
    
    for (const doc of snapshot.docs) {
      batchPromises.push(doc.ref.update({ companyId: 'COM-NEXUS-01' }));
      count++;
      totalMigrated++;
    }
    
    await Promise.all(batchPromises);
    console.log(`Migrated ${count} documents in '${col}'.`);
  }
  
  console.log(`\nMigration complete. Total documents updated: ${totalMigrated}`);
  process.exit(0);
}

migrateData().catch(console.error);
