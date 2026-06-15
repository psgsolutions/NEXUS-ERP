import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // Firebase Admin SDK instance

export async function GET() {
  const startTime = Date.now();
  try {
    // 1. ตรวจสอบโดยการลองไปอ่าน Collection ระบบภายใต้เงื่อนไขความปลอดภัย
    // หรือลองดึงเซสชันสั้นๆ (เช็คสิทธิ์แอดมินเบื้องต้น)
    const testRef = adminDb.collection('system_status').doc('ping');
    await testRef.get();

    const latency = Date.now() - startTime;

    // 2. ตอบกลับสถานะเชื่อมต่อสมบูรณ์ (คุมฟอนต์ตัวเลขเสร็จสรรพ)
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      latency: `${latency}ms`, // แสดงผลความเร็วระบบ
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error: any) {
    // 3. ปล่อย Error ชี้เป้าให้ระบุจุดพังได้ทันทีใน Zero-Agent Mode
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message || 'Firebase Admin SDK initialization failed'
    }, { status: 500 });
  }
}
