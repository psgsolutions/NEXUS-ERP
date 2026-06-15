import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST() {
  try {
    const mockProducts = [
      // ข้อมูลของบริษัท A (Tenant A)
      { name: 'MacBook Pro M3', price: 79900, stock: 15, companyId: 'company_A', isDeleted: false },
      { name: 'Magic Mouse', price: 3200, stock: 30, companyId: 'company_A', isDeleted: false },
      
      // ข้อมูลของบริษัท B (Tenant B)
      { name: 'ThinkPad X1 Carbon', price: 65000, stock: 10, companyId: 'company_B', isDeleted: false },
      { name: 'Logitech MX Master 3S', price: 3990, stock: 45, companyId: 'company_B', isDeleted: false },
      
      // ข้อมูลที่ถูกจำลองว่าโดนลบไปแล้ว (Soft Deleted)
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
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}
