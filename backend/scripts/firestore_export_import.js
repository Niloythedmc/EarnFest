#!/usr/bin/env node

/**
 * Firestore Migration using Google Cloud Export/Import
 *
 * This is the RECOMMENDED approach for migrating large Firestore databases.
 * It's more reliable, faster, and handles quota limits automatically.
 *
 * Requirements:
 * 1. Google Cloud SDK installed: https://cloud.google.com/sdk/docs/install
 * 2. Authenticated with gcloud: gcloud auth login
 * 3. Source and target projects have Firestore enabled
 * 4. A Google Cloud Storage bucket for temporary storage
 *
 * Usage:
 * 1. Create a GCS bucket: gs://your-migration-bucket
 * 2. Run: node firestore_export_import.js YOUR_BUCKET_NAME
 */

const { execSync } = require('child_process');

const SOURCE_PROJECT = 'eidfest';
const TARGET_PROJECT = 'giftphasetg';

function runCommand(command, description) {
  console.log(`\n🔄 ${description}`);
  console.log(`Command: ${command}`);

  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'inherit' });
    console.log('✅ Success');
    return output;
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    throw error;
  }
}

async function migrateWithExportImport(bucketName) {
  if (!bucketName) {
    console.error('❌ Error: Please provide a Google Cloud Storage bucket name');
    console.log('Usage: node firestore_export_import.js YOUR_BUCKET_NAME');
    console.log('Example: node firestore_export_import.js my-migration-bucket');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportPath = `gs://${bucketName}/firestore-export-${timestamp}`;

  console.log('🚀 Starting Firestore migration using export/import');
  console.log(`Source project: ${SOURCE_PROJECT}`);
  console.log(`Target project: ${TARGET_PROJECT}`);
  console.log(`Export path: ${exportPath}`);

  try {
    // Step 1: Export from source project
    runCommand(
      `gcloud firestore export ${exportPath} --project=${SOURCE_PROJECT}`,
      'Exporting data from source Firestore database'
    );

    // Step 2: Import to target project
    runCommand(
      `gcloud firestore import ${exportPath} --project=${TARGET_PROJECT}`,
      'Importing data to target Firestore database'
    );

    console.log('\n🎉 Migration completed successfully!');
    console.log('You can now safely delete the export files:');
    console.log(`gsutil rm -r ${exportPath}`);

  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure you are authenticated: gcloud auth login');
    console.log('2. Verify the bucket exists: gs://' + bucketName);
    console.log('3. Check project permissions for both projects');
    console.log('4. Ensure Firestore is enabled in both projects');
    process.exit(1);
  }
}

// Get bucket name from command line arguments
const bucketName = process.argv[2];
migrateWithExportImport(bucketName);