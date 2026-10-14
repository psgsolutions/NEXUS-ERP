import { db } from "./firebase-client";
import { apiFetch } from "./api-client";

/**
 * [PROC-STRATEGY-V3]
 * จัดซื้อ: การเขียนข้อมูลทำที่ server ทั้งหมด (ตรวจสิทธิ์ สถานะ วงเงินอนุมัติ และออกเลขในทรานแซกชัน)
 *  - อนุมัติ/ยกเลิกใบสั่งซื้อ   -> /api/procurement/purchase-orders
 *  - ตั้งเบิกจากใบสั่งซื้อ       -> /api/finance/expenses (fromPO)
 *  - หนังสือรับรองหัก ณ ที่จ่าย -> /api/finance/wht-certificates
 */

async function post(url: string, body: any) {
  const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
  return data;
}

export async function approvePurchaseOrder(poId: string, companyId: string) {
  return post("/api/procurement/purchase-orders", { companyId, action: "approve", poId });
}

export async function cancelPurchaseOrder(poId: string, companyId: string) {
  return post("/api/procurement/purchase-orders", { companyId, action: "cancel", poId });
}

/** ตั้งเบิกค่าใช้จ่ายจากใบสั่งซื้อที่อนุมัติแล้ว (ครั้งเดียวต่อใบ) คืนเลข EXP */
export async function createExpenseFromPO(poId: string, companyId: string): Promise<string> {
  return (await post("/api/finance/expenses", { companyId, action: "fromPO", poId })).expenseId;
}

/** ออกหนังสือรับรองหัก ณ ที่จ่ายล่วงหน้าให้รายการค่าใช้จ่าย คืนเลข WHT */
export async function createWHTFromExpense(expId: string, companyId: string, whtRate: number = 3): Promise<string> {
  return (await post("/api/finance/wht-certificates", { companyId, expenseId: expId, whtRate })).whtId;
}

export interface SupplierPriceRecord {
  supplierId: string;
  supplierName: string;
  price: number;
  poCode?: string;
  date?: string;
  isPrimary?: boolean;
}

/**
 * Fetches recent 2-3 supplier prices for a given product from historical purchase orders
 * and product supplier configuration. Scopes every query with companyId and isDeleted: false.
 */
export async function fetchSupplierPriceHistory(productId: string, companyId: string): Promise<SupplierPriceRecord[]> {
  if (!productId || !companyId) return [];

  const results: SupplierPriceRecord[] = [];
  const seenSuppliers = new Set<string>();

  try {
    const { getDocs, query, collection, where, doc, getDoc } = await import("firebase/firestore");
    
    // 1. Query past purchase_orders with companyId + isDeleted: false
    const posRef = collection(db, "purchase_orders");
    const q = query(
      posRef,
      where("companyId", "==", companyId),
      where("isDeleted", "==", false)
    );
    
    const snap = await getDocs(q);

    snap.forEach((docSnap) => {
      const poData = docSnap.data();
      const items = poData.items || [];
      const supplierName = poData.supplierName || poData.supplier || poData.vendor || "ผู้จำหน่ายไม่ระบุชื่อ";
      const supplierId = poData.supplierId || supplierName;

      for (const item of items) {
        if (
          item.productId === productId || 
          item.sku === productId || 
          (item.name && productId && item.name.toLowerCase() === productId.toLowerCase())
        ) {
          const unitPrice = Number(item.price || item.unitPrice || item.cost || 0);
          const sKey = supplierId + ":" + supplierName;
          
          if (!seenSuppliers.has(sKey)) {
            seenSuppliers.add(sKey);
            results.push({
              supplierId,
              supplierName,
              price: unitPrice,
              poCode: poData.poCode || poData.id || docSnap.id,
              date: poData.expectedDate || poData.date || (poData.createdAt?.toDate ? poData.createdAt.toDate().toISOString().split('T')[0] : "")
            });
          }
        }
      }
    });

    // Subcollection query with companyId + isDeleted: false fallback
    if (results.length === 0) {
      const subPosRef = collection(db, `companies/${companyId}/purchase_orders`);
      const subQ = query(
        subPosRef, 
        where("companyId", "==", companyId),
        where("isDeleted", "==", false)
      );
      const subSnap = await getDocs(subQ);
      
      subSnap.forEach((docSnap) => {
        const poData = docSnap.data();
        const items = poData.items || [];
        const supplierName = poData.supplierName || poData.supplier || poData.vendor || "ผู้จำหน่ายไม่ระบุชื่อ";
        const supplierId = poData.supplierId || supplierName;

        for (const item of items) {
          if (
            item.productId === productId || 
            item.sku === productId || 
            (item.name && productId && item.name.toLowerCase() === productId.toLowerCase())
          ) {
            const unitPrice = Number(item.price || item.unitPrice || item.cost || 0);
            const sKey = supplierId + ":" + supplierName;

            if (!seenSuppliers.has(sKey)) {
              seenSuppliers.add(sKey);
              results.push({
                supplierId,
                supplierName,
                price: unitPrice,
                poCode: poData.poCode || poData.id || docSnap.id,
                date: poData.expectedDate || poData.date || (poData.createdAt?.toDate ? poData.createdAt.toDate().toISOString().split('T')[0] : "")
              });
            }
          }
        }
      });
    }

    // Fallback to Product.supplierConfig if purchase order history < 3
    if (results.length < 3) {
      try {
        const prodRef = doc(db, "products", productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data();
          if (prodData.companyId === companyId && prodData.isDeleted !== true && Array.isArray(prodData.supplierConfig)) {
            for (const cfg of prodData.supplierConfig) {
              const sKey = cfg.supplierId + ":" + (cfg.supplierName || cfg.supplierId);
              if (!seenSuppliers.has(sKey)) {
                seenSuppliers.add(sKey);
                results.push({
                  supplierId: cfg.supplierId,
                  supplierName: cfg.supplierName || cfg.supplierId,
                  price: cfg.latestCost || 0,
                  isPrimary: cfg.isPrimary
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("Product supplierConfig lookup warning:", err);
      }
    }
  } catch (err) {
    console.error("Error fetching supplier price history:", err);
  }

  return results.slice(0, 3);
}

