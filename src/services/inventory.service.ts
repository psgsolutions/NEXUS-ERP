import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDoc
} from "firebase/firestore";
import { Product } from "@/types/database";
import { auditService } from "./audit.service";

/**
 * [NEXUS-SERVICE] Inventory Intelligence Service
 * จัดการข้อมูลคลังสินค้าแบบ Multi-tenant พร้อมระบบ Audit Trail
 */

export const inventoryService = {
  // ดึงรายการพัสดุทั้งหมดของบริษัท (Tenant Isolation)
  async getCompanyInventory(companyId: string): Promise<Product[]> {
    const q = query(
      collection(db, "products"), 
      where("companyId", "==", companyId),
      where("isDeleted", "==", false)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ 
      ...doc.data(), 
      id: doc.id 
    })) as unknown as Product[];
  },

  // เพิ่มพัสดุใหม่ (Atomic Data Entry with Audit Log)
  async createItem(userId: string, companyId: string, itemData: Partial<Product>) {
    const docData = {
      ...itemData,
      companyId,
      createdBy: userId,
      updatedBy: userId,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, "products"), docData);
    
    // บันทึกประวัติ
    await auditService.logCreate(userId, companyId, "INVENTORY", docRef.id, docData);
    
    return docRef;
  },

  // อัปเดตข้อมูลพัสดุ (พร้อมบันทึกประวัติการเปลี่ยนแปลง)
  async updateItem(userId: string, companyId: string, itemId: string, updates: Partial<Product>) {
    const itemRef = doc(db, "products", itemId);
    
    // ดึงข้อมูลเดิมเพื่อทำ Audit Log
    const oldDoc = await getDoc(itemRef);
    const beforeData = oldDoc.exists() ? oldDoc.data() : null;
    
    const finalUpdates = {
      ...updates,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(itemRef, finalUpdates);
    
    // บันทึกประวัติ
    await auditService.logUpdate(userId, companyId, "INVENTORY", itemId, beforeData, finalUpdates);
    
    return true;
  }
};
