import { db } from "@/lib/firebase-client";
import { collection, doc, addDoc, writeBatch, runTransaction } from "firebase/firestore";

export interface StockMovementData {
  companyId: string;       // ID ของบริษัท
  productId: string;       // ID ของสินค้า
  productCode: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  refDocumentNo: string;   // เลขที่เอกสารอ้างอิง (เช่น PO-XXXX, SO-XXXX)
  note?: string;
  createdBy: string;
}

export const InventoryService = {
  /**
   * บันทึกการเคลื่อนไหวสต็อก (Stock Movement) เข้า Subcollection ของบริษัท
   */
  async recordStockMovement(data: StockMovementData, batch?: any) {
    if (!data.companyId) {
      throw new Error("[Tenant Isolation Violation] companyId is required!");
    }

    const movementPayload = {
      ...data,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    // 🔒 ล็อก Path ไปยัง Subcollection ของบริษัทนั้นๆ
    const companyStockPath = `companies/${data.companyId}/stock_movements`;

    if (batch) {
      const docRef = doc(collection(db, companyStockPath));
      batch.set(docRef, movementPayload);
      return docRef;
    }

    return await addDoc(collection(db, companyStockPath), movementPayload);
  },

  /**
   * ตัดหรือเพิ่มสต็อกแบบ Atomic Transaction ป้องกันแข่งกันบันทึก (Concurrency)
   */
  async updateProductStockTransaction(
    companyId: string,
    productId: string,
    quantityChange: number,
    movementData: Omit<StockMovementData, "companyId" | "productId">
  ) {
    if (!companyId) throw new Error("[Tenant Isolation Violation] companyId is required!");

    const productRef = doc(db, `companies/${companyId}/products`, productId);
    const movementRef = doc(collection(db, `companies/${companyId}/stock_movements`));

    return await runTransaction(db, async (transaction) => {
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) {
        throw new Error("Product not found");
      }

      const currentStock = productDoc.data().currentStock || 0;
      const newStock = currentStock + quantityChange;

      // 1. อัปเดตยอดสต็อกคงเหลือใน Master Product
      transaction.update(productRef, {
        currentStock: newStock,
        updatedAt: new Date().toISOString(),
      });

      // 2. บันทึก Stock Movement Log
      transaction.set(movementRef, {
        ...movementData,
        companyId,
        productId,
        quantity: quantityChange,
        createdAt: new Date().toISOString(),
        isDeleted: false,
      });
    });
  },

  /**
   * ตัดสต็อกอัตโนมัติเมื่ออนุมัติใบสั่งขาย (Auto Stock Deduction for SO Approval)
   */
  async processSalesOrderStock(
    companyId: string, 
    items: Array<{ productId: string; name?: string; quantity: number }>, 
    soNo: string,
    userId: string = "SYSTEM"
  ) {
    if (!companyId) throw new Error("[Tenant Isolation Violation] companyId is required!");

    return await runTransaction(db, async (transaction) => {
      for (const item of items) {
        if (!item.productId) continue; // Skip non-inventory items

        const productRef = doc(db, `companies/${companyId}/products`, item.productId);
        const productDoc = await transaction.get(productRef);

        if (!productDoc.exists()) {
          throw new Error(`Product ID ${item.productId} not found in inventory.`);
        }

        const data = productDoc.data();
        const currentStock = data.currentStock || 0;
        
        // Prevent negative stock (Hard Reserve)
        if (currentStock < item.quantity) {
          throw new Error(`สต็อกไม่เพียงพอสำหรับสินค้า: ${item.name || data.name || item.productId} (ต้องการ: ${item.quantity}, มี: ${currentStock})`);
        }

        // ตัดสต็อกและบันทึกประวัติการเคลื่อนไหว
        transaction.update(productRef, {
          currentStock: currentStock - item.quantity,
          updatedAt: new Date().toISOString(),
        });

        const movementRef = doc(collection(db, `companies/${companyId}/stock_movements`));
        transaction.set(movementRef, {
          companyId,
          productId: item.productId,
          productCode: data.sku || data.productCode || item.productId,
          type: "OUT",
          quantity: item.quantity,
          refDocumentNo: soNo,
          note: `ตัดสต็อกอัตโนมัติจากใบสั่งขาย ${soNo}`,
          createdBy: userId,
          createdAt: new Date().toISOString(),
          isDeleted: false,
        });
      }
    });
  },
};
