// @ts-nocheck
import { db } from "./firebase-client";
import { 
  collection, 
  doc, 
  addDoc, 
  Timestamp 
} from "firebase/firestore";
import { JournalEntry, LedgerItem } from "@/types";
import { assertPeriodOpen } from "./period-close-service";
import { apiFetch } from "@/lib/api-client";

/**
 * [LOG-02] Double-Entry GL Engine
 * Automatically posts journal entries to the General Ledger.
 */
export const postToGL = async (
  companyId: string,
  data: {
    description: string;
    reference: string;
    items: LedgerItem[];
    date?: string;
  }
) => {
  await assertPeriodOpen(companyId, data.date);

  // 1. Validation: Debit must equal Credit
  const totalDebit = data.items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = data.items.reduce((sum, item) => sum + item.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error("Accounting Violation: Debit and Credit are not balanced.");
  }

  if (typeof window !== "undefined") {
    const res = await apiFetch("/api/accounting/post-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        description: data.description,
        reference: data.reference,
        items: data.items,
        date: data.date
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Failed to post GL entry via server API");
    }
    return json.journalId;
  }

  // 2. Create Journal Entry Document (Server Fallback)
  const entry: Omit<JournalEntry, "entryId"> = {
    companyId: companyId,
    date: data.date || Timestamp.now().toDate().toISOString(),
    description: data.description,
    referenceId: data.reference,
    items: data.items,
    totalAmount: totalDebit,
    isAdjustment: false
  } as Omit<JournalEntry, "entryId">;

  const entriesRef = collection(db, "journal_entries");
  const docRef = await addDoc(entriesRef, entry);
  return docRef.id; // คืนค่าเป็น journal ID เหมือนเส้นทาง API ฝั่ง client

};

/**
 * Pre-defined Account Mappings for Automation
 */
export const ACCOUNTS = {
  INVENTORY: { code: "113100", name: "สินค้าคงเหลือ" },
  CASH: { code: "111100", name: "เงินสด" },
  ACCOUNTS_PAYABLE: { code: "211100", name: "เจ้าหนี้การค้า" },
  ACCOUNTS_RECEIVABLE: { code: "112100", name: "ลูกหนี้การค้า" },
  SALES_INCOME: { code: "411100", name: "รายได้จากการขาย" },
  COST_OF_GOODS_SOLD: { code: "511100", name: "ต้นทุนขาย" },
};

