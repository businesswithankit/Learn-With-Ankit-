import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize default app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

// Secondary app to create users without logging out the admin
const secondaryAppName = "AdminUserCreator";
export function getSecondaryAuth() {
  const existingApp = getApps().find(a => a.name === secondaryAppName);
  const secApp = existingApp || initializeApp(firebaseConfig, secondaryAppName);
  return getAuth(secApp);
}

// Validation helper for Firestore document IDs
export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

// Error Handling with FirestoreErrorInfo conformity
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed Info:', JSON.stringify(errInfo, null, 2));
  
  // Only throw a fatal error for writes/updates so UI try-catch forms can react,
  // do NOT throw for background real-time read/list subscription errors (GET/LIST) as it crashes React rendering.
  if (
    operationType === OperationType.CREATE ||
    operationType === OperationType.UPDATE ||
    operationType === OperationType.DELETE ||
    operationType === OperationType.WRITE
  ) {
    throw new Error(JSON.stringify(errInfo));
  }
}

// Verify Firestore connection on load
export async function testFirestoreConnection() {
  try {
    // Attempt to read a test document path
    await getDocFromServer(doc(db, 'system_meta', 'connection_test'));
    console.log("Firestore connection test successfully contacted servers.");
  } catch (error) {
    console.warn("Firestore connection check info:", error);
  }
}

testFirestoreConnection();
