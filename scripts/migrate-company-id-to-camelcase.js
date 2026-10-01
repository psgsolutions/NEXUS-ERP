/**
 * Migration Script: company_id (snake_case) to companyId (camelCase)
 * Dual-writes companyId field for existing counters & journal_entries collections.
 */

const admin = require('firebase-admin');

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

async function migrateCollection(collectionName) {
  console.log(`Starting migration for collection: ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  let migratedCount = 0;

  const batchSize = 400;
  let batch = db.batch();
  let operationCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Check if document has company_id but missing companyId or company_id != companyId
    if (data.company_id && (!data.companyId || data.companyId !== data.company_id)) {
      batch.update(doc.ref, {
        companyId: data.company_id,
        // Keep company_id as dual-write during 1-sprint deprecation period
      });
      migratedCount++;
      operationCount++;

      if (operationCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  console.log(`Finished migration for ${collectionName}: ${migratedCount} documents updated.`);
}

async function run() {
  try {
    await migrateCollection('counters');
    await migrateCollection('journal_entries');
    console.log('Dual-write migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

run();
