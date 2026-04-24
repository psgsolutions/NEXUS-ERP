import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * [DEP-02] Singleton Instance
 * Initialize Firebase app and services for NEXUS ERP.
 */
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// NEXUS Core Database instance
// Note: Using default database instance with named identifier support if needed
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;

/**
 * [DAT-01] Multi-tenancy Isolation Wrapper
 * Utility to ensure every query is scoped with company_id.
 */
export const nexusQuery = (companyId: string) => {
  if (!companyId) throw new Error("CRITICAL: company_id is required for all NEXUS operations.");
  // Add query helper logic here in next phase
  return { companyId };
};
