import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;
let auth = null;

if (!admin.apps.length) {
  try {
    const serviceAccountPath = join(__dirname, '../../serviceAccountKey.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase initialized successfully from serviceAccountKey.json');
  } catch (error) {
    console.error('Firebase initialization error from file, falling back to env vars:', error.message);

    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing core Firebase environment variables');
      }

      // Check if the user accidentally pasted the whole JSON
      if (privateKey.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey);
          if (parsed.private_key) {
            privateKey = parsed.private_key;
            console.log('Detected full JSON in FIREBASE_PRIVATE_KEY, extracted private_key');
          }
        } catch (e) {
          console.warn('Attempted to parse privateKey as JSON but failed');
        }
      }

      console.log('Processing Private Key...');

      privateKey = privateKey.trim().replace(/^['"]|['"]$/g, '');
      privateKey = privateKey.replace(/\\n/g, '\n');

      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}`;
      }
      if (!privateKey.includes('-----END PRIVATE KEY-----')) {
        privateKey = `${privateKey}\n-----END PRIVATE KEY-----`;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID || 'manual-id',
          privateKey: privateKey.trim(),
          clientEmail,
        }),
      });
      console.log('Firebase initialized from environment variables');
    } catch (envError) {
      console.error('Firebase final initialization failure:', envError.message);
      console.warn('Continuing without Firebase - some features may not work');
    }
  }
}

if (admin.apps.length > 0) {
  db = admin.firestore();
  auth = admin.auth();
}

export { db, auth };
export default admin;
