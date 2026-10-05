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

async function check() {
  const targetSkus = ['PRD-2606-0001', 'PRD-2606-0019', 'PRD-2606-0058'];
  
  console.log("=== TARGET PRODUCTS DIRECT FIRESTORE QUERY ===");
  const groupSnapshot = await db.collectionGroup('products').get();
  groupSnapshot.forEach(doc => {
    const d = doc.data();
    if (targetSkus.includes(d.sku) || targetSkus.includes(doc.id)) {
      console.log(`\n----------------------------------------`);
      console.log(`Document Path: ${doc.ref.path}`);
      console.log(`Document ID:   ${doc.id}`);
      console.log(`SKU:           ${d.sku}`);
      console.log(`Name:          ${d.name}`);
      console.log(`cost:          ${d.cost} (type: ${typeof d.cost})`);
      console.log(`costWAC:       ${d.costWAC} (type: ${typeof d.costWAC})`);
      console.log(`costPrice:     ${d.costPrice} (type: ${typeof d.costPrice})`);
      console.log(`sellingPrice:  ${d.sellingPrice} (type: ${typeof d.sellingPrice})`);
      console.log(`price:         ${d.price} (type: ${typeof d.price})`);
      console.log(`FULL JSON DATA:`, JSON.stringify(d, null, 2));
    }
  });

  process.exit(0);
}

check().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
