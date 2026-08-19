import { db } from "@/lib/firebase-client";
import { doc, runTransaction, collection } from "firebase/firestore";

interface OrderItem {
  productId: string;
  productCode: string;
  quantity: number;
}

/**
 * ฟังก์ชันตัดสต็อกอัตโนมัติเมื่อ Sales Order ได้รับการอนุมัติ
 * รองรับ Atomic Concurrency ผ่าน runTransaction เพื่อป้องกันสต็อกติดลบหรือชนกัน
 */
export async function deductStockOnSalesOrderApproval(
  companyId: string,
  soNo: string,
  items: OrderItem[],
  userId: string
) {
  if (!companyId) {
    throw new Error("[Tenant Isolation Violation] companyId is required!");
  }

  return await runTransaction(db, async (transaction) => {
    for (const item of items) {
      if (!item.productId) continue;

      const productRef = doc(db, `companies/${companyId}/products`, item.productId);
      const productDoc = await transaction.get(productRef);

      if (!productDoc.exists()) {
        throw new Error(`Product ID: ${item.productId} not found in inventory master.`);
      }

      const productData = productDoc.data();
      const currentStock = productData.currentStock || 0;

      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for SKU: ${productData.code || item.productCode}. Available: ${currentStock}, Required: ${item.quantity}`);
      }

      const newStock = currentStock - item.quantity;

      // 1. อัปเดตยอดสต็อกคงเหลือในสินค้าหลัก
      transaction.update(productRef, {
        currentStock: newStock,
        updatedAt: new Date().toISOString(),
      });

      // 2. บันทึกประวัติการเคลื่อนไหวสต็อก (Stock Movement)
      const movementRef = doc(collection(db, `companies/${companyId}/stock_movements`));
      transaction.set(movementRef, {
        companyId,
        productId: item.productId,
        productCode: productData.code || item.productCode,
        type: "OUT",
        quantity: item.quantity,
        refDocumentNo: soNo,
        note: `Auto-deducted from Sales Order: ${soNo}`,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        isDeleted: false,
      });
    }
  });
}
