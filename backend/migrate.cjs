const admin = require('firebase-admin');

// Initialize Source
const sourceApp = admin.initializeApp({
    credential: admin.credential.cert(require('./source.json'))
}, 'source');

// Initialize Destination
const destApp = admin.initializeApp({
    credential: admin.credential.cert(require('./destination.json'))
}, 'destination');

const sourceDb = sourceApp.firestore();
const destDb = destApp.firestore();

async function migrateDocument(sourceDoc, destinationCollectionRef) {
    const data = sourceDoc.data();
    const docRef = destinationCollectionRef.doc(sourceDoc.id);

    // Set the data in destination
    await docRef.set(data);

    // Check for sub-collections
    const subCollections = await sourceDoc.ref.listCollections();
    for (const subCol of subCollections) {
        const subSnap = await subCol.get();
        for (const subDoc of subSnap.docs) {
            await migrateDocument(subDoc, docRef.collection(subCol.id));
        }
    }
}

async function run() {
    try {
        // List of top-level collections from your screenshot
        const collections = ['admin', 'promo_claims', 'promocodes', 'tasks', 'users', 'withdrawals'];

        for (const colName of collections) {
            console.log(`--- Migrating: ${colName} ---`);
            const snapshot = await sourceDb.collection(colName).get();

            for (const doc of snapshot.docs) {
                await migrateDocument(doc, destDb.collection(colName));
            }
            console.log(`Done with ${colName}`);
        }

        console.log('--- SUCCESS! Eid Fest migration finished. ---');
    } catch (error) {
        console.error('Migration Error:', error.message);
        if (error.message.includes('NOT_FOUND')) {
            console.log('TIP: Check if Firestore is "Enabled/Created" in your destination project console.');
        }
    }
}

run();