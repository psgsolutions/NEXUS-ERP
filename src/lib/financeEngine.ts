import { db } from "./firebase";
import { 
  collection, 
  doc, 
  addDoc, 
  Timestamp 
} from "firebase/firestore";
import { JournalEntry, JournalItem } from "@/types";

/**
 * [LOG-02] Double-Entry GL Engine
 * Automatically posts journal entries to the General Ledger.
 */
export const postToGL = async (
  companyId: string,
  data: {
    description: string;
    reference: string;
    items: JournalItem[];
  }
) => {
  // 1. Validation: Debit must equal Credit
  const totalDebit = data.items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = data.items.reduce((sum, item) => sum + item.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error("Accounting Violation: Debit and Credit are not balanced.");
  }

  // 2. Create Journal Entry Document
  const entry: Omit<JournalEntry, "entry_id"> = {
    company_id: companyId,
    date: Timestamp.now().toDate().toISOString(),
    description: data.description,
    reference: data.reference,
    items: data.items,
    total_amount: totalDebit
  };

  const entriesRef = collection(db, "journal_entries");
  return await addDoc(entriesRef, entry);
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
