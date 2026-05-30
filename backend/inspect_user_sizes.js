import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();
const mongoUri = process.env.MONGODB_URI;

async function main() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db();

    const collections = await db.listCollections().toArray();
    console.log("--- Database Collections and Counts ---");
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments({});
      console.log(`- ${col.name}: ${count} docs`);
    }

    await client.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
