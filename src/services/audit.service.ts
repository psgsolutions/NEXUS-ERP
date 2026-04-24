import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { AuditLog } from "@/types/database";

/**
 * [NEXUS-SERVICE] Audit Trail Intelligence
 * บันทึกทุกกิจกรรมสำคัญในระบบเพื่อความปลอดภัยและความโปร่งใส
 */
export const auditService = {
  /**
   * บันทึก Log กิจกรรม
   */
  async log(entry: Omit<AuditLog, "id" | "createdAt" | "updatedAt" | "isDeleted">) {
    try {
      const logRef = collection(db, "logs");
      await addDoc(logRef, {
        ...entry,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });
    } catch (error) {
      console.error("[AUDIT_LOG_FAILED]:", error);
    }
  },

  /**
   * บันทึกการสร้างข้อมูล
   */
  async logCreate(userId: string, companyId: string, module: string, targetId: string, data: any) {
    return this.log({
      action: "CREATE",
      module,
      targetId,
      companyId,
      createdBy: userId,
      updatedBy: userId,
      changes: {
        before: null,
        after: data
      },
      metadata: {
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "SYSTEM"
      }
    });
  },

  /**
   * บันทึกการแก้ไขข้อมูล
   */
  async logUpdate(userId: string, companyId: string, module: string, targetId: string, before: any, after: any) {
    return this.log({
      action: "UPDATE",
      module,
      targetId,
      companyId,
      createdBy: userId,
      updatedBy: userId,
      changes: {
        before,
        after
      },
      metadata: {
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "SYSTEM"
      }
    });
  }
};
