import { db } from "@/lib/firebase-client";
import { collection, limit, query, getDocs } from "firebase/firestore";

/**
 * [NEXUS-SERVICE] System Health Monitor
 * ตรวจสอบสถานะการเชื่อมต่อระหว่าง NEXUS กับ Firebase แบบ Real-time
 */

export const healthService = {
  // ตรวจสอบสถานะการเชื่อมต่อ Database
  async checkDatabaseConnectivity(): Promise<{ status: "online" | "offline"; latency: number }> {
    const startTime = Date.now();
    try {
      // ลองดึงข้อมูลขนาดเล็กเพื่อทดสอบความหน่วง
      const q = query(collection(db, "companies"), limit(1));
      await getDocs(q);
      const endTime = Date.now();
      return { 
        status: "online", 
        latency: endTime - startTime 
      };
    } catch (error) {
      console.error("[HEALTH_CHECK_ERROR]:", error);
      return { 
        status: "offline", 
        latency: 0 
      };
    }
  }
};
