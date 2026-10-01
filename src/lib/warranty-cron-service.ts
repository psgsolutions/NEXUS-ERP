import * as admin from "firebase-admin";
import { adminDb } from "./firebase-admin";
import { auditServer } from "@/services/audit.server";
import { nexusSequenceServer } from "./sequence-server";

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

export interface MADraftResult {
  serialNo: string;
  proposalId: string;
  customerId: string;
  salesOwnerId: string;
  warrantyEndDate: string;
  status: "CREATED" | "SKIPPED_ALREADY_DRAFTED";
}

/**
 * [WARRANTY-MA-CRON-ENGINE]
 * Daily Cron job processing SerialNumbers whose warrantyEndDate is expiring within 30 days.
 * Scoped by companyId + isDeleted: false.
 * Prevents duplicate draft MA proposal generation for the same serial number.
 * [SERVER-ONLY: Admin SDK] ใช้ผ่าน /api/cron/warranty-ma-check
 */
export async function processExpiringWarrantyMAProposals(companyId: string): Promise<MADraftResult[]> {
  if (!companyId) return [];

  const results: MADraftResult[] = [];
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    const snap = await adminDb.collection(`companies/${companyId}/serial_numbers`)
      .where("warrantyStatus", "==", "active")
      .where("isDeleted", "==", false)
      .get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const sn = data.sn || data.serialNo || docSnap.id;

      // Deduplication check 1: SerialNumber document flag
      if (data.maDrafted === true) {
        results.push({
          serialNo: sn,
          proposalId: data.maProposalId || "EXISTING_DRAFT",
          customerId: data.customerId || "CUST-UNKNOWN",
          salesOwnerId: data.salesOwnerId || "SALES-01",
          warrantyEndDate: data.warrantyEndDate || "",
          status: "SKIPPED_ALREADY_DRAFTED"
        });
        continue;
      }

      // Check date bounds (within 30 days)
      let expiryDate: Date | null = null;
      if (data.warrantyEndDate) {
        if (typeof data.warrantyEndDate === "string") {
          expiryDate = new Date(data.warrantyEndDate);
        } else if (data.warrantyEndDate.seconds) {
          expiryDate = new Date(data.warrantyEndDate.seconds * 1000);
        }
      }

      if (!expiryDate || expiryDate < now || expiryDate > thirtyDaysLater) {
        continue;
      }

      // Generate next quotation / MA proposal number
      const proposalCode = await nexusSequenceServer("QT", companyId);
      const salesOwnerId = data.salesOwnerId || data.createdBy || "SALES-OFFICER-01";
      const customerId = data.customerId || "CUST-UNKNOWN";

      // 1. Create Draft MA Proposal Quotation + 2. mark serial as drafted (atomic)
      const quotationRef = adminDb.collection("quotations").doc();
      const batch = adminDb.batch();
      batch.set(quotationRef, {
        qtCode: proposalCode,
        docNo: proposalCode,
        title: `ข้อเสนอสัญญาบริการบำรุงรักษาอุปกรณ์ (MA) - Serial ${sn}`,
        type: "MA_PROPOSAL",
        serialNo: sn,
        customerId,
        salesOwnerId,
        items: [
          {
            name: `สัญญาบริการบำรุงรักษาอุปกรณ์รายปี (MA) สำหรับ Serial: ${sn}`,
            qty: 1,
            unit: "ปี",
            price: 15000,
            totalAmount: 15000
          }
        ],
        subTotal: 15000,
        vatAmount: 1050,
        netTotal: 16050,
        status: "DRAFT",
        companyId,
        isDeleted: false,
        createdAt: serverTimestamp(),
        createdBy: salesOwnerId
      });

      batch.update(docSnap.ref, {
        maDrafted: true,
        maDraftedAt: serverTimestamp(),
        maProposalId: quotationRef.id
      });
      await batch.commit();

      // 3. Log Audit Trail
      await auditServer.logCreate(
        salesOwnerId,
        companyId,
        "quotations",
        quotationRef.id,
        {
          event: "MA_PROPOSAL_CRON_DRAFTED",
          serialNo: sn,
          proposalCode
        }
      );

      results.push({
        serialNo: sn,
        proposalId: quotationRef.id,
        customerId,
        salesOwnerId,
        warrantyEndDate: expiryDate.toISOString().split("T")[0],
        status: "CREATED"
      });
    }
  } catch (err) {
    console.error("[WARRANTY_MA_CRON_ERROR]: Error processing expiring warranties:", err);
    throw err;
  }

  return results;
}
