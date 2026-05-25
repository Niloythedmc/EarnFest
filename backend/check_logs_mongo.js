import { db } from './src/config/db.js';

async function checkLogs() {
  console.log('Fetching logs from walletFatherLogs...');
  const snapshot = await db.collection('walletFatherLogs').get();
  console.log(`Total logs: ${snapshot.size}`);
  
  // Sort logs by timestamp (newest first)
  const logs = [];
  snapshot.forEach(doc => {
    logs.push({ id: doc.id, ...doc.data() });
  });
  
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  console.log('--- Last 5 entries ---');
  logs.slice(0, 5).forEach(log => {
    console.log(JSON.stringify(log, null, 2));
  });

  console.log('Fetching last 5 withdrawals...');
  const wSnapshot = await db.collection('withdrawals').get();
  const wLogs = [];
  wSnapshot.forEach(doc => {
    wLogs.push({ id: doc.id, ...doc.data() });
  });
  wLogs.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
  
  wLogs.slice(0, 5).forEach(w => {
    console.log('--- Withdrawal ---');
    console.log(JSON.stringify(w, null, 2));
  });

  process.exit(0);
}

checkLogs().catch(console.error);
