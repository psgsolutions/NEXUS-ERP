// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// เริ่มต้น Admin SDK ตอนใช้งานครั้งแรก (ไม่ใช่ตอนโหลดไฟล์)
// ตอน build Next.js จะโหลดทุก API route เพื่อเก็บข้อมูลหน้า ถ้าเริ่มต้นตอนโหลดไฟล์แล้วตัวแปร env ไม่ครบ build จะล้มทั้งระบบ
function getAdminApp(): admin.app.App {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return admin.app();
}

const lazy = <T extends object>(get: () => T): T =>
  new Proxy({} as T, {
    get(_target, prop) {
      const target = get() as any;
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

// แนะนำให้ตั้งชื่อตัวแปรให้ต่างกัน จะได้ไม่สับสนเวลาเรียกใช้ครับ
export const adminDb: admin.firestore.Firestore = lazy(() => getAdminApp().firestore());
export const adminAuth: admin.auth.Auth = lazy(() => getAdminApp().auth());
