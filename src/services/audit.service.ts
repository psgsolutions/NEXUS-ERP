import { db } from "@/lib/firebase-client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { AuditLog } from "@/types/database";

/**
 * [NEXUS-SERVICE] Audit Trail Intelligence
 * บันทึกทุกกิจกรรมสำคัญในระบบเพื่อความปลอดภัยและความโปร่งใส
 */
const cleanData = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanData);
  // ค่าพิเศษของ Firestore (serverTimestamp, Timestamp ฯลฯ) ต้องส่งตามเดิม ห้ามคัดลอกเป็นออบเจกต์ธรรมดา
  if (Object.getPrototypeOf(obj) !== Object.prototype) return obj;

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanData(value);
    }
  }
  return cleaned;
};

export const auditService = {
  /**
   * บันทึก Log กิจกรรม
   */
  async log(entry: Omit<AuditLog, "id" | "createdAt" | "updatedAt" | "isDeleted">) {
    try {
      const logRef = collection(db, "logs");
      await addDoc(logRef, {
        ...cleanData(entry),
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
  },

  /**
   * บันทึกการลบข้อมูล
   */
  async logDelete(userId: string, companyId: string, module: string, targetId: string) {
    return this.log({
      action: "DELETE",
      module,
      targetId,
      companyId,
      createdBy: userId,
      updatedBy: userId,
      changes: {
        before: null,
        after: null
      },
      metadata: {
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "SYSTEM"
      }
    });
  }
};
