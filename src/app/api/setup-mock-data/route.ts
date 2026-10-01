import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireApiUser, authErrorResponse } from '@/lib/api-auth';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 404 });
  }

  try {
    const apiUser = await requireApiUser(request);
    if (apiUser.role !== 'SUPERADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const mockProducts = [
      // ข้อมูลของบริษัท A (Tenant A)
      { name: 'MacBook Pro M3', price: 79900, stock: 15, companyId: 'company_A', isDeleted: false },
      { name: 'Magic Mouse', price: 3200, stock: 30, companyId: 'company_A', isDeleted: false },
      
      // ข้อมูลของบริษัท B (Tenant B)
      { name: 'ThinkPad X1 Carbon', price: 65000, stock: 10, companyId: 'company_B', isDeleted: false },
      { name: 'Logitech MX Master 3S', price: 3990, stock: 45, companyId: 'company_B', isDeleted: false },
      
      // ข้อมูลที่ถูกจำลองว่าโดนลบไปแล้ว
      { name: 'Old Keyboard', price: 500, stock: 0, companyId: 'company_A', isDeleted: true },
    ];

    const batch = adminDb.batch();
    const productsRef = adminDb.collection('products');

    mockProducts.forEach(product => {
      const newDocRef = productsRef.doc();
      batch.set(newDocRef, {
        ...product,
        // ใช้ FieldValue ของ Firebase Admin 
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();

    return NextResponse.json({
      status: 'success',
      message: '🚀 [NEXUS-SERVER] Mock Tenant Data inserted successfully!',
      insertedCount: mockProducts.length,
      note: 'ใช้ทดสอบระบบ Tenant Isolation (company_A vs company_B) และ Soft Delete ได้เลยครับ'
    }, { status: 200 });
    
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}
