#!/usr/bin/env node

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
-----END PRIVATE KEY-----`,
  client_email: 'firebase-adminsdk-fbsvc@eidfest.iam.gserviceaccount.com',
  client_id: '110445541961180205413',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40eidfest.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com',
};

async function testConnection() {
  console.log('🔍 Testing Firestore connection...');

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert(SOURCE_SERVICE_ACCOUNT),
    }, 'test-source');

    const db = admin.firestore(app);

    console.log('✅ Firebase app initialized successfully');

    // Try a simple operation
    console.log('📋 Attempting to list collections...');
    const collections = await db.listCollections();

    console.log(`✅ Successfully connected! Found ${collections.length} collections:`);
    collections.forEach(collection => {
      console.log(`  - ${collection.id}`);
    });

    await app.delete();
    console.log('✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.log('\nPossible issues:');
    console.log('1. Service account credentials are invalid');
    console.log('2. Firestore API quota exceeded');
    console.log('3. Project does not exist or Firestore is not enabled');
    console.log('4. Network connectivity issues');
    console.log('5. Service account lacks required permissions');

    if (error.code === 4) {
      console.log('\n🔴 RESOURCE_EXHAUSTED error indicates quota limits have been reached.');
      console.log('You may need to wait for quota reset or upgrade your Firebase plan.');
    }
  }
}

testConnection();