import { db } from "./firebase-client";
import { runTransaction, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { SalesOrder } from "@/types/database";

export interface ConfirmSalesOrderResult {
  success: boolean;
  message: string;
  orderId?: string;
  isPendingApproval?: boolean;
}

export const confirmSalesOrderAtomic = async (
  companyId: string,
  orderData: Partial<SalesOrder>,
  userId: string
): Promise<ConfirmSalesOrderResult> => {
  if (!orderData.orderId) return { success: false, message: "Missing Order ID" };
  
  const orderRef = doc(db, `companies/${companyId}/sales_orders`, orderData.orderId);
  const customerRef = doc(db, `companies/${companyId}/customers`, orderData.customerId || "unknown");

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. ตรวจสอบวงเงินลูกค้า (Credit Limit)
      let isOverCredit = false;
      let isPendingApproval = false;
      
      const customerSnap = await transaction.get(customerRef);
      if (customerSnap.exists()) {
        const custData = customerSnap.data();
        const creditLimit = custData.creditLimit || 0;
        const currentBalance = custData.arBalance || 0;
        const newTotal = orderData.totalAmount || 0;
        
        if (creditLimit > 0 && (currentBalance + newTotal > creditLimit)) {
          isOverCredit = true;
          isPendingApproval = true; // Wait for approval
        }
      }

      // 2. เช็คสต็อกสินค้า (ATP - Available To Promise)
      const inventoryUpdates: { ref: any; newAvailable: number; newReserved: number }[] = [];
      let insufficientStock = false;

      if (orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          if (!item.productId) continue;
          const productRef = doc(db, `companies/${companyId}/products`, item.productId);
          const productSnap = await transaction.get(productRef);
          
          if (productSnap.exists()) {
            const prodData = productSnap.data();
            const available = prodData.availableStock || 0;
            const reserved = prodData.reservedStock || 0;
            
            if (available < item.qty) {
              insufficientStock = true;
              throw new Error(`สต็อกสินค้า ${item.name || item.productId} ไม่เพียงพอ (มี ${available}, ต้องการ ${item.qty})`);
            }
            
            inventoryUpdates.push({
              ref: productRef,
              newAvailable: available - item.qty,
              newReserved: reserved + item.qty
            });
          }
        }
      }

      // 3. บันทึกข้อมูลและตัดสต็อก
      // อัปเดตคลังสินค้า
      for (const update of inventoryUpdates) {
        transaction.update(update.ref, {
          availableStock: update.newAvailable,
          reservedStock: update.newReserved,
          updatedAt: new Date()
        });
      }

      // สร้าง หรือ อัปเดตเอกสาร Sales Order
      const targetStatus = isPendingApproval ? 'pending_approval' : 'confirmed';
      
      const orderPayload: any = {
        ...orderData,
        companyId,
        status: targetStatus,
        isOverCreditLimit: isOverCredit,
        createdAt: orderData.createdAt || new Date(),
        updatedAt: new Date(),
        confirmedBy: userId
      };

      const existingOrderSnap = await transaction.get(orderRef);
      if (existingOrderSnap.exists()) {
        transaction.update(orderRef, orderPayload);
      } else {
        transaction.set(orderRef, orderPayload);
      }

      // 4. สร้าง Audit Log
      const logRef = doc(db, `companies/${companyId}/audit_logs`, `${Date.now()}_${orderData.orderId}`);
      transaction.set(logRef, {
        action: "CONFIRM_SALES_ORDER",
        documentId: orderData.orderId,
        actor: userId,
        timestamp: new Date(),
        details: `Confirmed SO. Over Credit: ${isOverCredit}`,
        companyId
      });

      return { success: true, message: "บันทึกใบสั่งขายเรียบร้อย", isPendingApproval };
    });

    return result as ConfirmSalesOrderResult;

  } catch (error: any) {
    console.error("Sales Order Transaction failed: ", error);
    return { success: false, message: error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล" };
  }
};
