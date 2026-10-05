const admin = require('firebase-admin');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    envVars[match[1].trim()] = val;
  }
});

const privateKey = (envVars.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const clientEmail = envVars.FIREBASE_CLIENT_EMAIL;
const projectId = envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

const db = admin.firestore();

async function checkCustomers() {
  console.log('=== Firestore Customers Report ===');
  console.log('Project ID:', projectId);

  console.log('\n--- Root "customers" collection ---');
  const rootSnap = await db.collection('customers').get();
  console.log(`Root customers count: ${rootSnap.size}`);
  rootSnap.forEach(doc => {
    const d = doc.data();
    console.log(`[Root Doc] ID: "${doc.id}" | Name: "${d.customerName || d.name || d.companyName}" | TaxID: "${d.taxId || d.customerTaxId}" | companyId: "${d.companyId}"`);
  });

  console.log('\n--- "companies" collection ---');
  const compSnap = await db.collection('companies').get();
  console.log(`Companies count: ${compSnap.size}`);
  for (const compDoc of compSnap.docs) {
    const cCustSnap = await db.collection(`companies/${compDoc.id}/customers`).get();
    console.log(`Company "${compDoc.id}" subcollection customers count: ${cCustSnap.size}`);
    cCustSnap.forEach(doc => {
      const d = doc.data();
      console.log(`  [Company SubDoc] ID: "${doc.id}" | Name: "${d.customerName || d.name || d.companyName}" | TaxID: "${d.taxId || d.customerTaxId}"`);
    });
  }
}

checkCustomers().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
