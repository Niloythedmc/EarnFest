import admin from 'firebase-admin';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
const serviceAccountPath = join(__dirname, '../source.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  console.log(`Loaded service account for Firebase project: ${serviceAccount.project_id}`);
} catch (err) {
  console.error(`Error loading serviceAccountKey from ${serviceAccountPath}:`, err.message);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const firestore = admin.firestore();

// Initialize MongoDB
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("Error: MONGODB_URI is not set in .env");
  process.exit(1);
}

const mongoClient = new MongoClient(mongoUri);

async function run() {
  try {
    await mongoClient.connect();
    console.log("Connected to MongoDB successfully!");
    const db = mongoClient.db();

    // Get all collections dynamically from Firestore
    const collections = await firestore.listCollections();
    console.log(`Found ${collections.length} root collections in Firestore.`);

    for (const colRef of collections) {
      const colName = colRef.id;
      console.log(`\n--- Migrating collection: ${colName} ---`);

      const mongoCol = db.collection(colName);
      
      // Clear existing records in MongoDB for a fresh transfer
      await mongoCol.deleteMany({});
      console.log(`Cleared existing documents in MongoDB collection '${colName}'`);

      const snap = await colRef.get();
      console.log(`Found ${snap.size} documents in Firestore collection '${colName}'`);

      if (snap.empty) {
        console.log(`Skipping empty collection '${colName}'`);
        continue;
      }

      const batch = [];
      snap.forEach(doc => {
        const data = doc.data();
        
        // Preserve all fields and assign doc.id to _id
        const cleanedDoc = { _id: doc.id, ...data };
        batch.push(cleanedDoc);
      });

      // Insert in chunks of 500
      const BATCH_SIZE = 500;
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const chunk = batch.slice(i, i + BATCH_SIZE);
        await mongoCol.insertMany(chunk);
        console.log(`Inserted batch ${i / BATCH_SIZE + 1} (${chunk.length} docs) into MongoDB '${colName}'`);
      }
      
      console.log(`Finished migrating collection '${colName}'!`);
    }

    console.log("\n*** DATABASE MIGRATION COMPLETED SUCCESSFULLY ***");

  } catch (error) {
    console.error("Migration Failed:", error);
  } finally {
    await mongoClient.close();
    process.exit();
  }
}

run();
