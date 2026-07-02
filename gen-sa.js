const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) {
    acc[k] = v.join('=').trim().replace(/^"|"$/g, '');
  }
  return acc;
}, {});

const sa = {
  type: "service_account",
  project_id: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  private_key_id: "fake-id",
  private_key: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: env.FIREBASE_CLIENT_EMAIL,
  client_id: "fake-id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(env.FIREBASE_CLIENT_EMAIL)}`
};

fs.writeFileSync('temp-sa.json', JSON.stringify(sa, null, 2));
console.log('temp-sa.json created');
