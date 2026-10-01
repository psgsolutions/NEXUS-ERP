import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * [SERVER-ONLY] Audit Trail ผ่าน Admin SDK สำหรับ API routes
 * โครงสร้างเอกสารเหมือน auditService (audit.service.ts) ฝั่ง client
 */
const cleanData = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(cleanData);
  if (obj instanceof admin.firestore.FieldValue || obj instanceof admin.firestore.Timestamp) return obj;

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanData(value);
    }
  }
  return cleaned;
};

async function log(action: "CREATE" | "UPDATE" | "DELETE", userId: string, companyId: string, module: string, targetId: string, before: any, after: any) {
  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await adminDb.collection("logs").add(cleanData({
      action,
      module,
      targetId,
      companyId,
      createdBy: userId,
      updatedBy: userId,
      changes: { before, after },
      metadata: { userAgent: "SYSTEM" },
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    }));
  } catch (error) {
    console.error("[AUDIT_LOG_FAILED]:", error);
  }
}

export const auditServer = {
  logCreate: (userId: string, companyId: string, module: string, targetId: string, data: any) =>
    log("CREATE", userId, companyId, module, targetId, null, data),
  logUpdate: (userId: string, companyId: string, module: string, targetId: string, before: any, after: any) =>
    log("UPDATE", userId, companyId, module, targetId, before, after),
  logDelete: (userId: string, companyId: string, module: string, targetId: string) =>
    log("DELETE", userId, companyId, module, targetId, null, null),
};
