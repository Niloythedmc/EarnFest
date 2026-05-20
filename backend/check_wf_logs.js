import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load service account from env or file
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = JSON.parse(readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8'));
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkLogs() {
  console.log('Checking logs...');
  const snapshot = await db.collection('walletFatherLogs').orderBy('timestamp', 'desc').limit(5).get();
  if (snapshot.empty) {
    console.log('No logs found in walletFatherLogs.');
    return;
  }
  snapshot.forEach(doc => {
    console.log('--- Log Entry ---');
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

checkLogs().catch(console.error);
