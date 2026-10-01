import { db } from "./firebase-client";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auditService } from "@/services/audit.service";
import { nexusSequenceEngine } from "./sequence-engine";

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
 */
export async function processExpiringWarrantyMAProposals(companyId: string): Promise<MADraftResult[]> {
  if (!companyId) return [];

  const results: MADraftResult[] = [];
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    const snRef = collection(db, `companies/${companyId}/serial_numbers`);
    const q = query(
      snRef,
      where("warrantyStatus", "==", "active"),
      where("isDeleted", "==", false)
    );

    const snap = await getDocs(q);

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
      const proposalCode = await nexusSequenceEngine("QT", companyId);
      const salesOwnerId = data.salesOwnerId || data.createdBy || "SALES-OFFICER-01";
      const customerId = data.customerId || "CUST-UNKNOWN";

      // 1. Create Draft MA Proposal Quotation
      const quotationRef = await addDoc(collection(db, "quotations"), {
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

      // 2. Mark Serial Number document as drafted
      const snDocRef = doc(db, `companies/${companyId}/serial_numbers`, docSnap.id);
      await updateDoc(snDocRef, {
        maDrafted: true,
        maDraftedAt: serverTimestamp(),
        maProposalId: quotationRef.id
      });

      // 3. Log Audit Trail
      await auditService.logCreate(
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
