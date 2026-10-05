const fs = require('fs');
const admin = require('firebase-admin');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    acc[k] = v.join('=').trim().replace(/^"|"$/g, '');
  }
  return acc;
}, {});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

const db = admin.firestore();

async function inspectCounters() {
  const groupSnap = await db.collectionGroup('counters').get();
  console.log(`Found ${groupSnap.size} counters docs across collectionGroup`);
  groupSnap.forEach(doc => {
    console.log(`Path: ${doc.ref.path} => Data:`, doc.data());
  });
  process.exit(0);
}

inspectCounters();
