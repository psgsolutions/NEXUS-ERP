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
  const compId = 'COM-NEXUS-01';
  
  console.log('\n--- Flat Customers ---');
  (await db.collection('customers').limit(2).get()).forEach(d => console.log(d.id, d.data().customerId, d.data().name));
  
  console.log('\n--- Sub Customers ---');
  (await db.collection('companies').doc(compId).collection('customers').limit(2).get()).forEach(d => console.log(d.id, d.data().customerId, d.data().name));
  
  console.log('\n--- Flat Employees ---');
  (await db.collection('employees').limit(2).get()).forEach(d => console.log(d.id, d.data().employeeId, d.data().name));
  
  console.log('\n--- Sub Employees ---');
  (await db.collection('companies').doc(compId).collection('employees').limit(2).get()).forEach(d => console.log(d.id, d.data().employeeId, d.data().name));

  console.log('\n--- Flat Suppliers ---');
  (await db.collection('suppliers').limit(2).get()).forEach(d => console.log(d.id, d.data().supplierId, d.data().name));
  
  process.exit(0);
}
check();
