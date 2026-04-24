import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

/**
 * PSG-Firebase Bootloader V10.5 (Internal Assertion Guard Active)
 * ⚙️ SOLID SINGLETON: ป้องกันการเกิด Assertion Failed (ID: ca9) 
 * ⚙️ โดยการล็อคการ Initialize ไว้ในตัวแปร Global ที่ไม่สามารถเปลี่ยนแปลงได้
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

export function initializeFirebase() {
  if (typeof window === 'undefined') return { app: null as any, auth: null as any, db: null as any };

  // 🔥 CRITICAL: Prevent re-initialization which causes ca9 error
  if (firebaseAppInstance && firestoreInstance && authInstance) {
    return {
      app: firebaseAppInstance,
      auth: authInstance,
      db: firestoreInstance
    };
  }

  const apps = getApps();
  firebaseAppInstance = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);

  if (!firestoreInstance) {
    firestoreInstance = getFirestore(firebaseAppInstance);
  }

  if (!authInstance) {
    authInstance = getAuth(firebaseAppInstance);
  }

  return {
    app: firebaseAppInstance,
    auth: authInstance,
    db: firestoreInstance
  };
}

// Legacy exports for backward compatibility
const { app, auth, db } = initializeFirebase();
export { app, auth, db };
export default app;
