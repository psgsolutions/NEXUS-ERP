import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // ดึงเครื่องมือที่เราเชื่อมต่อฐานข้อมูลไว้คราวที่แล้ว

// ฟังก์ชันสำหรับ "ส่งรายงานสรุปข้อมูล" ออกไปให้หน้าแอปฯ
export async function GET() {
    try {
        // 💡 กฎเหล็กระดับ Enterprise: จำลองบริษัทปัจจุบัน (ในระบบจริงจะดึงจาก Session)
        const currentCompanyId = "COM-NEXUS-01";

        // วิ่งไปเคาะประตูคลังข้อมูล Firebase ที่ชั้นวางของชื่อ 'documents'
        const snapshot = await adminDb.collection('documents')
            .where('companyId', '==', currentCompanyId) // บังคับคุมความปลอดภัยห้ามข้อมูลข้ามบริษัท
            .where('isDeleted', '==', false) // ดึงเฉพาะข้อมูลที่ยังไม่ได้ถูกลบ
            .get();

        // มัดรวมกล่องข้อมูลเพื่อส่งไปหน้าบ้าน
        const documents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ success: true, data: documents });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}