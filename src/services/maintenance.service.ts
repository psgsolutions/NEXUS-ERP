import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { SerialNumber } from "@/types/database";

/**
 * [NEXUS-SERVICE] Maintenance & Warranty Intelligence
 * จัดการข้อมูลการรับประกันและการแจ้งเตือนเชิงรุก
 */
export const maintenanceService = {
  /**
   * ตรวจสอบอุปกรณ์ที่ใกล้หมดประกัน (ภายใน 30 วัน)
   * เพื่อสร้างโอกาสในการขายงาน MA (Maintenance Agreement)
   */
  async getExpiringWarranties(companyId: string) {
    try {
      const now = Timestamp.now();
      const thirtyDaysFromNow = new Timestamp(
        now.seconds + 30 * 24 * 60 * 60,
        now.nanoseconds
      );

      const snRef = collection(db, `companies/${companyId}/serial_numbers`);
      const q = query(
        snRef,
        where("warrantyExpiry", ">=", now),
        where("warrantyExpiry", "<=", thirtyDaysFromNow)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SerialNumber[];
    } catch (error) {
      console.error("[WARRANTY_CHECK_FAILED]:", error);
      return [];
    }
  }
};
