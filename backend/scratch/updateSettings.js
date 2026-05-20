import admin from 'firebase-admin';
import serviceAccount from './serviceAccount.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateSettings() {
  const settingsRef = db.collection('admin').doc('settings');
  await settingsRef.set({
    tierLimits: {
      free: 10000,
      cash: 8000,
      reward: 6000,
      bonus: 4000,
      profit: 2000
    },
    updatedAt: new Date().toISOString()
  });
  console.log('Settings updated successfully!');
  process.exit(0);
}

updateSettings();
