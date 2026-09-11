// src/firebase/server.ts
import 'server-only';
import { cert, initializeApp, getApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

const runtimeProjectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  firebaseConfig.projectId;

function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let val = key.trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.substring(1, val.length - 1);
  }
  return val.replace(/\\n/g, '\n').trim();
}

function getOrInitAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : {
        projectId: runtimeProjectId,
        privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      };

  const hasPlaceholderCredentials =
    String(serviceAccount.clientEmail || '').includes('your-client-email') ||
    String(serviceAccount.privateKey || '').includes('YOUR_PRIVATE_KEY_HERE') ||
    String(serviceAccount.projectId || '').includes('your-project');

  const hasExplicitCredentials =
    !!serviceAccount.projectId &&
    !!serviceAccount.clientEmail &&
    !!serviceAccount.privateKey &&
    !hasPlaceholderCredentials;

  if (!hasExplicitCredentials && process.env.NODE_ENV !== 'production') {
    throw new Error(
      'Firebase Admin credentials are missing for server routes. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_KEY JSON).'
    );
  }

  return initializeApp(
    hasExplicitCredentials
      ? {
          credential: cert({
            projectId: serviceAccount.projectId,
            clientEmail: serviceAccount.clientEmail,
            privateKey: serviceAccount.privateKey,
          }),
        }
      : {
          projectId: runtimeProjectId,
          // Fall back to the hosting/runtime identity when explicit credentials are not set.
        }
  );
}

export async function getFirebaseAdmin() {
  const adminApp = getOrInitAdminApp();
  const auth = getAuth(adminApp);
  const firestore = getFirestore(adminApp);
  return { auth, firestore, app: adminApp };
}
