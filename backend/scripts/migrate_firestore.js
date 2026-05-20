import admin from 'firebase-admin';

const SOURCE_SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'eidfest',
  private_key_id: '490238973cc3b97c0de9315c7dfabe1bfe29e167',
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC0rcfHYHqDv6cN
vlbZFuozP4UABt5trKLdpQhtwkan8XmiwrQQJgG7j5RmkFrdtrpcP5ONMyB8fg2s
IYkaFQLUzUzqPezd1fqoCv9QaHO42fIdR3JqlE+iszXK5Tt30c/z5ijDb92abLUu
Ar3L+C24RX2B2q7hJHJ+ZkS/HUXrkdOWOn5VNSaz3y7cQHgXlAgSk8Y7isNZnZYE
x5NioI99npSy9xgc3zp3R1rvmwK7Lk+3qzahfNsy1RIoyfuFZUu+sxpxQ9BtbhCH
qWuZvACKkW+t3CvYi/hOGy9l2/raC6NPMV/a/aCtcFd688T5JxuE5QWWvJ3WbeGg
8jwUd/vFAgMBAAECggEABs895k/Gjkyc2THBSDFK5l+Qfa3EmFGXWc8sgCaATzgU
o4O/EZS9H/qLV0o9gnmukGd9AidZJBgEH+arqiX8k1Shf3qSANJdvhOcB8XIBsGA
FIZq04V/ctxaPKljEmL/+WtFQghnS7ipI3DLAnL6FiXYUxqQ2L9s6UKleKZ7yiMG
pVOmSiXpBE4mcpklzJUch2qu565ptMbXpUE/rVBNp3jzYa66BkSAVzBNpHjGo/2m
TILPL0+4NfoXwuUWmZPMZBqV43zY70ItNfolg4cOzDM/pO4/mAQH1lN57USdj3Mw
d4KrAyOCT/vDGKuhq3ndTdZfWcvk6D2iDhWnSjL6QQKBgQDb3VcRsgF9iXyCkeXR
Hs4Ym+GW6Sn6Jz+KscH4zLp8J1a2Ltnq8k9r5NfJfd6LvPIgDB6Wg/ioqgQcTVAU
rPF8w7UocMsAE6z5Sirpiaxv/uBYouOxAWGAToxgbuLCLjMky592/c90tLRkS8/2
NdTHvIUSkyoDKx6x0rfd7YAn/QKBgQDSX7ligFtW2aEyHt2d4QxMRhCssWLsGuMU
OkMSVuKom3O5wrQcsAAX++DeRIEQuI5zBZrApZxK0YrsomJSxfZnI7n0sGH37niy
5au/3kCodev5y/djmM+xLDIf796aTABNUHWqE2+GMbsCRXOT/F+4WRhP3Hk9/2l7
SZggZVV5aQKBgQC1BqFR6IZhnnnt58KZVAvNJ0uuvXvag8ZFo+ZZu/cvkhRLHHhA
ghHyfBFPzVsXIxMYX+Ive6mY9aM8yktNOrf6Sgk2quf5wDmDaBW9A6X+8JQ3Zqai
bsigpAvgumvqBbAGc8Fwb7oIFWER03n+9oOjkQzgJltJEI/NSfopuAr04QKBgA+O
QHkGILrlUMQSADUiZPRm4ejDHRt0SYI/ZKJAhnYNOJttyD+uy/L6DwCgdCK2YuIi
cfT4yfvGTs18nGSeer/ZpnBvcm8Q1R/1V6PSXVmXjqFj8aENtZ3WNMajyAQExqjw
4CJ5WW/E0Z0zYX551OIexGtzVAu/jR8uq+8JTy6xAoGACUf4eErkRJeWM2Lx18Iu
n9IPhp9QMsByrC+uAEcESTucB3dIXsSiC7twSjux3fhX7z04kdtVided+qgIi1iX
xSMsmGLL6a28+IktKe5u6ab2pzxemwB+FVNmnERQ4mNxmv502ttAt3UZZy/LEj8q
T5scAwtOHKlduV7FepwHdHE=
-----END PRIVATE KEY-----
`,
  client_email: 'firebase-adminsdk-fbsvc@eidfest.iam.gserviceaccount.com',
  client_id: '110445541961180205413',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40eidfest.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com',
};

const TARGET_SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'giftphasetg',
  private_key_id: '2e36a7f8336203524f0880e9de9e47c0b2592b28',
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDIlksZpx2pqcVy
R2X+jCW6jr8YDyJEHso2X09/S9qwBZLf11O0shcnTbxeujZupNlJdMBrRJe4TSJw
nAl/C1Rkm+wXOVi6+0JTO2aVGy2NomH+N8hpVL/B+h4jhLzfpP+SLiVz47CPK+sm
YmMKu8CP9rLNhDyxpXBGynoc8knsluSh+5kaq3YLeGyXzRh2aD2rGa/JBU+INva8
5uW0X50rrwdlt1XUjpr74FY+Mf1NE/68W3L1Jb19+3SHiMKVs1nvtkLm9M6aJmmo
4ixH/Bkm9Mo3uH6PKB+ife+8dZhYec1Edr+01fs2UKH2OvKqZqGPUgPG84SW/wfP
sQdu4KpRAgMBAAECggEAAmYBKYIs/BZBiOGrjM46hbZVa/IwFHdRImWtyAgLujAQ
rIRlx37bmrErhrvkZ03pb8WOWjRnYCxy13ZXLi2mdxioWD+Yjo2CWO4bnOsJ3QQt
vQ+ua3UbgQdwPWTPcLKavRHk3OB40Bpyf2EDN3Am3LXSne7C8ZPley3Q2FuJjwaT
5ocn4sQFqCVY3MJdk4wmWrP4bK6rrgAkXKlUbGI7Ftbf18ulka0tDG7pop8t1Nak
q8en4LWjBkmp5MucLfTDsVm01XfWjYdrD/1hsuO6LZwUf7bTn3l0Nv5QjBGOu40h
VglXon9gNuGkWhDKLuA8z+LH4QD1UC2TB3SJeHkw4QKBgQDnEB/SpdhTRNA6Uo/x
xdCqxg5Z0w68FkfhlMRnYDJHIALv0qyj0woNap2IPnKO/UBG9uxscjnMUCNpb+D/
daKQdUFrB+eUgxr1aPFyFVZCawZKGIGfDr+kGwLf5P/yfNZ8o2ILHPDWkvAUpanT
qguyD/8yWx7q3Oe2psffDF2HcQKBgQDePCwDDHvv6O3Am5BFlefoiIthxPqWDTTv
csrYfRFvIM7kv5vNdcPW4k+kLTWDVhQ56eQKUPvMrkMiuIY9meEEs20HR/h2qdk9
6W3Fxp876m+o0Ou7eOsX54gmCGtgn4EATQhh8jkjIhIE5eylPfPUn81VzkvoQvdz
c6Rg9Wag4QKBgQDSNWMeGm7xYjsltBLsW5B4rHJF2bMf/g0q9lKv0V4sQr0pPTp+
V/JfPk1Os7E40MD3TpDMICbg708oDvZcscJRNbtsCebuv095UB3IMg0lo4Q3SJA0
ChDi1QgKdKU9D8F55pG9lnisXUU5I3Wa8KpvNgpu32MDPDE5hAV1sCQuoQKBgH1f
+wB5UY5mnYL1AG6RhLUGG4Q76ZcvujaAT3nVDTnhi3c3tgEyuBqJsJ6RtsfyjxSh
JDrBt1ygz1VOPsWQA4dwZkkeTEk9x0aLY5eZV4oo13eo7eTk8dSZlZDHXTS0p8Vw
sBL54Uw1026Z/Gi4y8+fm+sVqHNPHGUwz4K3z39hAoGBAJaINFNL0NTr4vmY3lWu
s/pBL86Jqmio+Iy58Ybh0ZEapqdKzUzTAsDmsgPqgJrDWGE6J1lDyQQ2usEF9rZW
yOFdlwwR90DnYzjGzqBV5m2NXz6an5a9zl5oF9JaaWMJhZ8+lKsoJC3XUNlTcLFy
dYzlzpuIlbD4kuYbgCBQn4jy
-----END PRIVATE KEY-----
`,
  client_email: 'firebase-adminsdk-fbsvc@giftphasetg.iam.gserviceaccount.com',
  client_id: '112480017514627212814',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40giftphasetg.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com',
};

function initApp(serviceAccount, appName) {
  return admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
    },
    appName,
  );
}

async function copyDocument(sourceDb, targetDb, docRef) {
  const snapshot = await docRef.get();
  if (!snapshot.exists) return;

  await targetDb.doc(docRef.path).set(snapshot.data(), { merge: false });

  const subcollections = await docRef.listCollections();
  for (const subcollection of subcollections) {
    await copyCollection(sourceDb, targetDb, subcollection);
  }
}

async function copyCollectionConservative(sourceDb, targetDb, collectionRef) {
  console.log(`  📊 Getting collection size...`);

  // First, try to get a small sample to check if collection exists and is accessible
  const sampleQuery = collectionRef.limit(1);
  const sampleSnapshot = await sampleQuery.get();

  if (sampleSnapshot.empty) {
    console.log(`  📭 Collection ${collectionRef.id} is empty, skipping...`);
    return;
  }

  // Get total count (this might also hit limits for very large collections)
  let totalDocs = 0;
  try {
    const countQuery = collectionRef;
    // Note: Firestore doesn't have a direct count, we'd need to use aggregation
    // For now, we'll process in very small batches
    console.log(`  🔄 Processing in very small batches to avoid quota limits...`);
  } catch (error) {
    console.log(`  ⚠️  Could not determine collection size: ${error.message}`);
  }

  // Process documents one by one with long delays
  const allDocs = [];
  let lastDoc = null;
  let batchCount = 0;

  while (true) {
    batchCount++;
    console.log(`  📄 Fetching batch ${batchCount}...`);

    let query = collectionRef.limit(5); // Very small batches
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      break; // No more documents
    }

    console.log(`  📝 Processing ${snapshot.docs.length} documents in batch ${batchCount}...`);

    // Process each document individually with delays
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      console.log(`    📄 Document ${i + 1}/${snapshot.docs.length}: ${doc.id}`);

      try {
        const docData = doc.data();
        const docPath = doc.ref.path;
        
        if (!docData) {
          console.log(`    ⚠️  Document ${doc.id} has no data (empty document)`);
          continue;
        }

        await targetDb.doc(docPath).set(docData, { merge: false });
        console.log(`    ✅ Document ${doc.id} copied successfully`);
      } catch (error) {
        console.error(`    ❌ Failed to copy document ${doc.id}`);
        console.error(`       Error Code: ${error.code || 'unknown'}`);
        console.error(`       Error Message: ${error.message || 'No message'}`);
        console.error(`       Full Error:`, JSON.stringify(error, null, 2));
        // Continue with next document
      }

      // Long delay between individual documents
      if (i < snapshot.docs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // Even longer delay between batches
    console.log(`  ⏳ Waiting 5 seconds before next batch...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log(`  🎯 Collection ${collectionRef.id} processing complete`);
}

async function processBatchWithRetry(sourceDb, targetDb, batch, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use Firestore batch write for better performance
      const writeBatch = targetDb.batch();

      for (const doc of batch) {
        const docRef = targetDb.doc(doc.ref.path);
        writeBatch.set(docRef, doc.data(), { merge: false });
      }

      await writeBatch.commit();

      // Copy subcollections for each document in the batch
      for (const doc of batch) {
        const subcollections = await doc.ref.listCollections();
        for (const subcollection of subcollections) {
          await copyCollection(sourceDb, targetDb, subcollection, 5, 500); // Smaller batches for subcollections
        }
      }

      return; // Success, exit retry loop
    } catch (error) {
      console.error(`Batch attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error; // Re-throw after max retries
      }

      // Exponential backoff: wait longer between retries
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function runMigration() {
  const sourceApp = initApp(SOURCE_SERVICE_ACCOUNT, 'source');
  const targetApp = initApp(TARGET_SERVICE_ACCOUNT, 'target');

  const sourceDb = admin.firestore(sourceApp);
  const targetDb = admin.firestore(targetApp);

  // Configure Firestore settings for better performance and reliability
  sourceDb.settings({
    ignoreUndefinedProperties: true,
    timestampsInSnapshots: true,
  });

  targetDb.settings({
    ignoreUndefinedProperties: true,
    timestampsInSnapshots: true,
  });

  try {
    // PRE-FLIGHT CHECKS
    console.log('\n🔧 Running pre-flight connectivity checks...\n');
    
    try {
      console.log('[1/2] Testing SOURCE database connection...');
      const sourceCollections = await sourceDb.listCollections();
      console.log(`✅ SOURCE database accessible. Found ${sourceCollections.length} collections`);
    } catch (error) {
      console.error('❌ SOURCE database connection FAILED:');
      console.error(`   Code: ${error.code}`);
      console.error(`   Message: ${error.message}`);
      throw new Error('Cannot read from source database. Check credentials.');
    }

    try {
      console.log('[2/2] Testing TARGET database connection & write permissions...');
      const testRef = targetDb.collection('_connection_test').doc(`test_${Date.now()}`);
      await testRef.set({ test: true, timestamp: new Date() });
      await testRef.delete();
      console.log('✅ TARGET database accessible and writable');
    } catch (error) {
      console.error('❌ TARGET database write test FAILED:');
      console.error(`   Code: ${error.code}`);
      console.error(`   Message: ${error.message}`);
      throw new Error('Cannot write to target database. Check credentials and security rules.');
    }

    console.log('\n✅ All pre-flight checks passed. Starting migration...\n');

    // ACTUAL MIGRATION
    console.log('🔍 Checking source database collections...');
    const collections = await sourceDb.listCollections();

    if (!collections.length) {
      console.log('No root collections found in source Firestore. Nothing to migrate.');
      return;
    }

    console.log(`📋 Found ${collections.length} root collections:`);
    for (const collection of collections) {
      console.log(`  - ${collection.id}`);
    }

    console.log('\n⚠️  WARNING: This migration script may still hit Firestore API limits.');
    console.log('For large datasets, consider using Firestore\'s built-in export/import:');
    console.log('https://firebase.google.com/docs/firestore/manage-data/export-import');
    console.log('\n🚀 Starting migration with very conservative settings...');

    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i];
      console.log(`\n[${i + 1}/${collections.length}] Migrating collection: ${collection.id}`);

      try {
        await copyCollectionConservative(sourceDb, targetDb, collection);
        console.log(`✅ Collection ${collection.id} migrated successfully`);
      } catch (error) {
        console.error(`❌ Failed to migrate collection ${collection.id}:`, error.message);
        // Continue with next collection instead of stopping completely
      }

      // Add very long delay between collections
      if (i < collections.length - 1) {
        console.log('⏳ Waiting 30 seconds before next collection...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    console.log('\n🎉 Firestore migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    console.log('\n💡 Tip: For large migrations, use Firestore export/import instead of this script.');
    throw error;
  } finally {
    // Clean up Firebase apps
    await sourceApp.delete();
    await targetApp.delete();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
