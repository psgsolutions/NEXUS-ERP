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
  const aiProducts = await db.collection('products').where('brand', '==', 'Cisco').limit(1).get();
  console.log('--- AI GENERATED PRODUCT ---');
  aiProducts.forEach(doc => console.log(JSON.stringify(doc.data(), null, 2)));

  const sysProducts = await db.collection('products').where('brand', '==', 'NEXUS').limit(1).get();
  console.log('\n--- SYSTEM GENERATED PRODUCT ---');
  sysProducts.forEach(doc => console.log(JSON.stringify(doc.data(), null, 2)));
  
  process.exit(0);
}
check();
