import * as admin from 'firebase-admin';

// กฎเหล็กหลังบ้าน: ตรวจสอบว่าระบบเคย Initialize ไปแล้วหรือยัง
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // จัดการฟอร์แมตช่องว่างของ Private Key ป้องกันปัญหาระบบอ่านบรรทัดขาด
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('🚀 [NEXUS-SERVER] Firebase Admin Connected Successfully!');
  } catch (error) {
    console.error('❌ [NEXUS-SERVER] Firebase Admin Connection Error:', error);
  }
}

export const adminDb = admin.firestore();
