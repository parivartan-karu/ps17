import dotenv from 'dotenv';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let val = key.trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.substring(1, val.length - 1);
  }
  return val.replace(/\\n/g, '\n').trim();
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing required Firebase Admin credentials in .env');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function deleteCollection(collectionName: string) {
  console.log(`Fetching documents from collection: ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`No documents found in ${collectionName}.`);
    return 0;
  }

  console.log(`Found ${snapshot.size} documents in ${collectionName}. Deleting...`);
  
  const batchSize = 400;
  let count = 0;
  let batch = db.batch();

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      console.log(`Deleted ${count}/${snapshot.size} from ${collectionName}`);
      batch = db.batch();
    }
  }

  if (count % batchSize !== 0) {
    await batch.commit();
  }

  console.log(`Finished deleting ${snapshot.size} documents from ${collectionName}.\n`);
  return snapshot.size;
}

async function main() {
  console.log(`Starting cleanup on Firebase Project: ${projectId}`);
  const deletedServices = await deleteCollection('civic_services');
  const deletedReports = await deleteCollection('reports');

  console.log(`Cleanup complete!`);
  console.log(`- Civic Services deleted: ${deletedServices}`);
  console.log(`- Reports deleted: ${deletedReports}`);
}

main().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
