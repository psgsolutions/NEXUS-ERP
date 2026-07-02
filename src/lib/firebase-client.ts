// src/lib/firebase-client.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 1. ใส่กุญแจสำหรับฝั่งหน้าเว็บ (สังเกตว่าต้องมี NEXT_PUBLIC_ นำหน้า)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 2. ป้องกันการเปิดแอปซ้ำซ้อนตอน Next.js ทำ Fast Refresh
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. ส่งออกเครื่องมือฝั่ง Client
export const auth = getAuth(app);
export const db = getFirestore(app);
