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

async function patchData() {
  console.log('Patching products...');
  const snapshot = await db.collection('products').where('companyId', '==', 'COMP-001').get();
  
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    const updates = {
      isDeleted: false,
      updatedAt: data.updatedAt || new Date(),
    };
    
    if (!data.stockStatus && data.stock !== undefined) {
      updates.stockStatus = {
        onHand: data.stock || 0,
        reserved: 0,
        available: data.stock || 0
      };
    }
    
    if (!data.pricing && data.cost !== undefined) {
      updates.pricing = {
        costWAC: data.cost || 0,
        pricePOS: data.price || 0,
        priceProject: (data.price || 0) * 1.2
      };
    }
    
    await doc.ref.update(updates);
    count++;
  }
  console.log(`Patched ${count} products.`);
  process.exit(0);
}

patchData().catch(console.error);
