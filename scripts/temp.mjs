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

async function fix() {
  const compId = 'COM-NEXUS-01';
  console.log('Fetching quotes...');
  const quotes = await db.collection('companies').doc(compId).collection('quotations').get();
  
  const map = {
    '0dhGP7ENfutKawsLtdFU': 'CUS-2606-0001',
    '3h2oaJwwVvIPjh9Blt4W': 'CUS-2606-0002'
  };

  let count = 0;
  for (const doc of quotes.docs) {
    const data = doc.data();
    const payload = {};
    if (data.customer && map[data.customer]) {
      payload.customer = map[data.customer];
    }
    if (data.customerId && map[data.customerId]) {
      payload.customerId = map[data.customerId];
    }

    if (Object.keys(payload).length > 0) {
      await doc.ref.update(payload);
      console.log('Updated quote', doc.id, payload);
      count++;
    }
  }
  
  console.log('Fixed', count, 'records');
  process.exit(0);
}
fix();
