import admin from 'firebase-admin';

const SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "earn-fest",
  "private_key_id": "7dc0085ede25da94bd97dbcbf85965ce50b35ce6",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC5LT7dc+rHck5n\nvxez6R0+24cKC8QwQHUUA4MZVFOI0qJmxhXNKXxr57Zpkgrb8cKYpdqZfpNPmsgz\nYu4xKv/rKG5tm+bOwH5eVCGLoMWOxxJgqoX+iU33LZ+inaQLpjpxx5mFCTbqmfr2\nf/kR859dNUTtlxQJF/7OZW4uWutUb9RRmi4uJtROQHWa51rpkedvI8643ys6zu0z\n7mtWYEun5OthLNJfzMRjPtDAhWp86czwKFk2WPB84s0GktORPBMNpkwb61eIG03o\noSyaYctMx3zD7g2Wh+G0UP0oCBClo2gTK34ME7ExbnXlDY9OfqHLk7JLKlF3+in4\nNXfmDGG5AgMBAAECggEABzuO7cfiBu2+RbuXQansgEDDTr9kZ40Q9ZnohDQAukKd\n4L1CazvAVhecDpYLcglIlD1AI0goGU8enDE0Q/vduJHg9EuHUZJ/rRAEqmc6aCf6\n3gczChzTTID97/RPzLuuozSMWL+iIzol7PxVHmAhXJrgyRXiTLOg+m9IRSu8btUJ\nT0Q6RqpQpmozHihKstTlOJM60Y4aQwYx5h0suA69+vx6rBiwJd0CCxiwW9Ed5Ksy\nCNfWYmXaTauM5D8kcV6jUoUVpgT4Xqwc7hm+m9uhFrPiTzAB02N3dqCorJw1n8zi\n+Ed9K/OHDSdgQZzF7eRkeH3FHIcwPyiAhFnIEUUWQQKBgQDoBSHs/PullsUFzHRP\niYkn7T4dzJ+HA8JimngBZMFSICQu9fd/VxaX/LuxaJ+/Xdx9+YwRuZAYbHAJ3ljx\n2cfbvKHEgitVEHFMINwhfFthArsl8mCglW6i+xyDp/XVXwSnpwk5loxB2oeNLO/n\ngWcb3YRhQkJwcRf3PNLqHplloQKBgQDMULdoFOG+aGO0xwhfmJSOdKA4Tr242rgk\ Dv3eaC+8LSxOQB45AFhfpR69+7cxYX/mOWegWPt6k+z+O7MZfvC76eRVr3C2hVEw\nI3YQlSNMYM2bV9V7RCA8Se6QBovFHQPVogSrYAgyfYm75BeZyIJfUBIBrBd7Lqmg\nCEmic3NVGQKBgQCw/HlMlg4/2iqgqb1vjrKZSle/0389NpjpLnusVHdDdlEjoW0S\nLhSGC7wBMJXrHGY9kkZOnwZUGyO742hl1IKoE9QyWjlDwi8qq0ZAJORvs+2enK0o\n0dR7bqHprA3SnZCncruOulBzS4drIYQ/TG6iyu9YYXrc2ug1KKia/ox1AQKBgG25\nu4XOER4s+b8QVNLiIoYO5CzZPNKVw+a5lmVnFpu8ttqfXJvIL63OA6CMGmoOrp15\nnsligEvoPZKbhSfgIHEKv3G08pdTKbLsmG93aKmQI1uV5DR69cTq/4+htFZ7qp+E\nj3Vp8X0MJngdmv8fy8RcQA9d2I5zFO25BbKUxg+hAoGBAN2I5gWFuQRyhDhNzJot\nOHPsPtk91sSanGYm+CNxuxeMXJx7W/JGqlm14hXT88CMJgn3vzzcczKdP9+Jb4IM\n6DoG2CFkm9gIq18annYR3F03uQOSWjo7aIt0pkSf/gcHSAPI1DuNTBfCGMn1t3+t\nF5+vZ4MwBx/v5Wko51POOkVS\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@earn-fest.iam.gserviceaccount.com",
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(SERVICE_ACCOUNT),
  });
}

const db = admin.firestore();


const multiplyBalances = async () => {
  console.log('Starting balance multiplication script...');
  const multiplier = 20000;
  
  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users.`);

    const batchSize = 500;
    let count = 0;
    let batch = db.batch();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const currentBalance = Number(userData.balance) || 0;
      const newBalance = currentBalance * multiplier;
      
      batch.update(doc.ref, { balance: newBalance });
      count++;

      if (count % batchSize === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Committed ${count} updates...`);
      }
    }

    if (count % batchSize !== 0) {
      await batch.commit();
      console.log(`Committed final batch. Total updated: ${count}`);
    }

    console.log(`Successfully multiplied balances for ${count} users by ${multiplier}.`);
  } catch (error) {
    console.error('Error during balance multiplication:', error);
  } finally {
    process.exit(0);
  }
};

multiplyBalances();

