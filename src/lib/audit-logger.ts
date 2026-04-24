import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * [AUDIT-V1.0] Nexus Activity Logger
 * Records significant actions for compliance and traceability.
 */

export interface AuditLog {
  userId: string;
  userEmail: string;
  companyId: string;
  action: string;
  module: string;
  details: string;
  targetId?: string;
  oldValue?: any;
  newValue?: any;
}

export async function logActivity(log: AuditLog) {
  try {
    const logsRef = collection(db, "activity_logs");
    await addDoc(logsRef, {
      ...log,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Audit Logger Error:", error);
    // Fail silently to not block user operation, 
    // but in production consider a retry mechanism or alert.
  }
}
