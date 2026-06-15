// @ts-nocheck
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { JournalEntry } from "@/types/database";

/**
 * Nexus Accounting Engine V3.0
 * Handles automated double-entry bookkeeping for operational events.
 */
export const AccountingEngine = {
  /**
   * Generates a Journal Entry for Goods Receipt (GRN)
   * Debit: Inventory (Current Assets)
   * Credit: Accounts Payable (Current Liabilities)
   */
  async postGoodsReceipt(data: {
    grnId: string;
    supplierName: string;
    totalAmount: number;
    warehouseName: string;
    vatType?: 'Inclusive' | 'Exclusive' | 'Non-VAT';
  }) {
    const isNonVat = data.vatType === 'Non-VAT';
    const journalEntry: Partial<JournalEntry> = {
      date: serverTimestamp(),
      bookType: isNonVat ? 'PV_INTERNAL' : 'JV',
      description: `[AUTO] Goods Receipt ${data.grnId} ${isNonVat ? '(Non-VAT Purchase) ' : ''}from ${data.supplierName} to ${data.warehouseName}`,
      totalDebit: data.totalAmount,
      totalCredit: data.totalAmount,
      isOfficialTax: !isNonVat,
      status: 'draft', // Requires accountant review
      items: [
        {
          accountCode: '1141-00', // Inventory Asset Account
          accountName: 'สินค้าคงเหลือ (Inventory)',
          debit: data.totalAmount,
          credit: 0
        },
        {
          accountCode: '2111-00', // Accounts Payable
          accountName: 'เจ้าหนี้การค้า (Accounts Payable)',
          debit: 0,
          credit: data.totalAmount
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates a Journal Entry for Sales Payment (Receipt Voucher)
   * Debit: Bank/Cash
   * Credit: Accounts Receivable
   */
  async postReceiptVoucher(data: {
    rvId: string;
    customerName: string;
    totalAmount: number;
    bankName: string;
  }) {
    const journalEntry: Partial<JournalEntry> = {
      date: serverTimestamp(),
      bookType: 'RV',
      description: `[AUTO] Payment Received ${data.rvId} from ${data.customerName}`,
      totalDebit: data.totalAmount,
      totalCredit: data.totalAmount,
      status: 'draft',
      items: [
        {
          accountCode: '1112-00', // Bank Account
          accountName: `เงินฝากธนาคาร (${data.bankName})`,
          debit: data.totalAmount,
          credit: 0
        },
        {
          accountCode: '1131-00', // Accounts Receivable
          accountName: 'ลูกหนี้การค้า (Accounts Receivable)',
          debit: 0,
          credit: data.totalAmount
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Posts a generic Journal Entry.
   */
  async postJournalEntry(data: {
    description: string;
    totalAmount: number;
    items: any[];
  }) {
    const journalEntry: Partial<JournalEntry> = {
      date: serverTimestamp(),
      bookType: 'JV',
      description: data.description,
      totalDebit: data.totalAmount,
      totalCredit: data.totalAmount,
      status: 'draft',
      items: data.items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates a Journal Entry for Free of Charge (FOC) items
   * Debit: FOC Expense Account (Marketing/CRM/Compensation)
   * Credit: Inventory Asset Account
   */
  async postFOCExpense(data: {
    documentId: string;
    customerName: string;
    totalCost: number;
    expenseAccountCode: string;
    expenseAccountName: string;
    focReason: string;
  }) {
    const journalEntry: Partial<JournalEntry> = {
      date: serverTimestamp(),
      bookType: 'JV',
      description: `[AUTO] FOC Issued ${data.documentId} to ${data.customerName} (Reason: ${data.focReason})`,
      totalDebit: data.totalCost,
      totalCredit: data.totalCost,
      isOfficialTax: false,
      status: 'draft',
      items: [
        {
          accountCode: data.expenseAccountCode,
          accountName: data.expenseAccountName,
          debit: data.totalCost,
          credit: 0
        },
        {
          accountCode: '1141-00', // Inventory Asset Account
          accountName: 'สินค้าคงเหลือ (Inventory)',
          debit: 0,
          credit: data.totalCost
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return await addDoc(collection(db, "journal_entries"), journalEntry);
  }
};

