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

async function deployRules() {
  try {
    const rulesSource = fs.readFileSync('firestore.rules', 'utf8');
    const ruleset = await admin.securityRules().createRuleset({
      source: {
        files: [{
          name: 'firestore.rules',
          content: rulesSource
        }]
      }
    });
    
    await admin.securityRules().releaseFirestoreRuleset(ruleset.name);
    console.log('Successfully deployed firestore.rules via Admin SDK!');
    process.exit(0);
  } catch (err) {
    console.error('Error deploying rules:', err);
    process.exit(1);
  }
}

deployRules();
