// @ts-nocheck
import { db } from "@/lib/firebase-client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { JournalEntry } from "@/types/database";
import { WriteBatch, doc } from "firebase/firestore";

/**
 * Nexus Accounting Engine V3.0
 * Handles automated double-entry bookkeeping for operational events.
 */
export const AccountingEngine = {
  /**
   * Generates a Journal Entry for Sales Invoice (AR)
   * Debit: Accounts Receivable (Current Assets)
   * Credit: Sales Revenue, Output VAT (Current Liabilities)
   */
  async postSalesJournal(data: {
    companyId: string;
    invoiceId: string;
    customerName: string;
    subTotal: number;
    vatAmount: number;
    grandTotal: number;
    isVatRegistered: boolean;
  }, batch?: WriteBatch) {
    const items = [
      {
        accountCode: '1131-00', // Accounts Receivable
        accountName: 'ลูกหนี้การค้า',
        debit: data.grandTotal,
        credit: 0
      },
      {
        accountCode: '4111-00', // Sales Revenue
        accountName: 'รายได้จากการขาย',
        debit: 0,
        credit: data.subTotal
      }
    ];

    if (data.isVatRegistered && data.vatAmount > 0) {
      items.push({
        accountCode: '2121-00', // Output VAT
        accountName: 'ภาษีขาย',
        debit: 0,
        credit: data.vatAmount
      });
    }

    const journalEntry: Partial<JournalEntry> = {
      companyId: data.companyId,
      date: serverTimestamp(),
      bookType: 'JV',
      description: `[AUTO] Sales Invoice ${data.invoiceId} to ${data.customerName}`,
      totalDebit: data.grandTotal,
      totalCredit: data.grandTotal,
      isOfficialTax: data.isVatRegistered,
      status: 'draft',
      items: items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates a Journal Entry for Goods Receipt (GRN)
   * Debit: Inventory (Current Assets) / Expense, Input VAT
   * Credit: Accounts Payable (Current Liabilities)
   */
  async postGoodsReceipt(data: {
    companyId: string;
    grnId: string;
    supplierName: string;
    subTotal: number;
    vatAmount: number;
    totalAmount: number;
    warehouseName: string;
    vatType?: 'Inclusive' | 'Exclusive' | 'Non-VAT';
  }, batch?: WriteBatch) {
    const isNonVat = data.vatType === 'Non-VAT';
    const items = [
      {
        accountCode: '1141-00', // Inventory Asset Account
        accountName: 'สินค้าคงเหลือ',
        debit: data.subTotal,
        credit: 0
      },
      {
        accountCode: '2111-00', // Accounts Payable
        accountName: 'เจ้าหนี้การค้า',
        debit: 0,
        credit: data.totalAmount
      }
    ];

    if (!isNonVat && data.vatAmount > 0) {
      items.push({
        accountCode: '1151-00', // Input VAT (Asset)
        accountName: 'ภาษีซื้อ',
        debit: data.vatAmount,
        credit: 0
      });
    }

    const journalEntry: Partial<JournalEntry> = {
      companyId: data.companyId,
      date: serverTimestamp(),
      bookType: isNonVat ? 'PV_INTERNAL' : 'PV', // Purchase Journal
      description: `[AUTO] Goods Receipt ${data.grnId} ${isNonVat ? '(Non-VAT Purchase) ' : ''}from ${data.supplierName} to ${data.warehouseName}`,
      totalDebit: data.totalAmount,
      totalCredit: data.totalAmount,
      isOfficialTax: !isNonVat,
      status: 'draft', // Requires accountant review
      items: items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates a Journal Entry for Sales Payment (Receipt Voucher)
   * Debit: Bank/Cash, WHT (if any)
   * Credit: Accounts Receivable
   */
  async postCashReceiptJournal(data: {
    companyId: string;
    rvId: string;
    customerName: string;
    receivedAmount: number;
    whtAmount: number;
    bankName: string;
  }, batch?: WriteBatch) {
    const arAmount = data.receivedAmount + data.whtAmount;
    const items = [
      {
        accountCode: '1112-00', // Bank Account
        accountName: `เงินฝากธนาคาร (${data.bankName})`,
        debit: data.receivedAmount,
        credit: 0
      },
      {
        accountCode: '1131-00', // Accounts Receivable
        accountName: 'ลูกหนี้การค้า',
        debit: 0,
        credit: arAmount
      }
    ];

    if (data.whtAmount > 0) {
      items.push({
        accountCode: '1152-00', // Withholding Tax Receivable
        accountName: 'ภาษีหัก ณ ที่จ่ายรอล่วงหน้า',
        debit: data.whtAmount,
        credit: 0
      });
    }

    const journalEntry: Partial<JournalEntry> = {
      companyId: data.companyId,
      date: serverTimestamp(),
      bookType: 'RV',
      description: `[AUTO] Payment Received ${data.rvId} from ${data.customerName}`,
      totalDebit: arAmount,
      totalCredit: arAmount,
      status: 'draft',
      items: items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates a Journal Entry for Payment Voucher (PV)
   * Debit: Accounts Payable
   * Credit: Bank/Cash, WHT Payable
   */
  async postCashPaymentJournal(data: {
    companyId: string;
    pvId: string;
    supplierName: string;
    paidAmount: number;
    whtAmount: number;
    bankName: string;
  }, batch?: WriteBatch) {
    const apAmount = data.paidAmount + data.whtAmount;
    const items = [
      {
        accountCode: '2111-00', // Accounts Payable
        accountName: 'เจ้าหนี้การค้า',
        debit: apAmount,
        credit: 0
      },
      {
        accountCode: '1112-00', // Bank Account
        accountName: `เงินฝากธนาคาร (${data.bankName})`,
        debit: 0,
        credit: data.paidAmount
      }
    ];

    if (data.whtAmount > 0) {
      items.push({
        accountCode: '2122-00', // Withholding Tax Payable
        accountName: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย',
        debit: 0,
        credit: data.whtAmount
      });
    }

    const journalEntry: Partial<JournalEntry> = {
      companyId: data.companyId,
      date: serverTimestamp(),
      bookType: 'PV',
      description: `[AUTO] Payment Voucher ${data.pvId} to ${data.supplierName}`,
      totalDebit: apAmount,
      totalCredit: apAmount,
      status: 'draft',
      items: items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates a Journal Entry for Cost of Goods Sold
   * Debit: COGS
   * Credit: Inventory
   */
  async postCostOfGoodsSold(data: {
    companyId: string;
    documentId: string;
    cogsAmount: number;
  }, batch?: WriteBatch) {
    const items = [
      {
        accountCode: '5111-00', // COGS
        accountName: 'ต้นทุนขาย',
        debit: data.cogsAmount,
        credit: 0
      },
      {
        accountCode: '1141-00', // Inventory Asset Account
        accountName: 'สินค้าคงเหลือ',
        debit: 0,
        credit: data.cogsAmount
      }
    ];

    const journalEntry: Partial<JournalEntry> = {
      companyId: data.companyId,
      date: serverTimestamp(),
      bookType: 'JV',
      description: `[AUTO] Cost of Goods Sold for ${data.documentId}`,
      totalDebit: data.cogsAmount,
      totalCredit: data.cogsAmount,
      status: 'posted', // Typically posted immediately for perpetual
      items: items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates a Journal Entry for Subcontractor Work Order
   * Debit: Cost of Services / Subcontractor Expense
   * Credit: Accrued Expenses / Accounts Payable
   */
  async postSubcontractorWorkOrder(data: {
    companyId: string;
    woId: string;
    subcontractorName: string;
    totalLaborCost: number;
  }, batch?: WriteBatch) {
    const items = [
      {
        accountCode: '5121-00', // Cost of Services
        accountName: 'ต้นทุนบริการ',
        debit: data.totalLaborCost,
        credit: 0
      },
      {
        accountCode: '2111-00', // Accounts Payable
        accountName: 'เจ้าหนี้การค้า',
        debit: 0,
        credit: data.totalLaborCost
      }
    ];

    const journalEntry: Partial<JournalEntry> = {
      companyId: data.companyId,
      date: serverTimestamp(),
      bookType: 'PV_INTERNAL',
      description: `[AUTO] Subcontractor Work Order ${data.woId} - ${data.subcontractorName}`,
      totalDebit: data.totalLaborCost,
      totalCredit: data.totalLaborCost,
      status: 'draft',
      items: items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates Withholding Tax Certificate (50 Tawi)
   */
  async generate50Tawi(data: {
    companyId: string;
    pvId: string;
    supplierName: string;
    supplierTaxId: string;
    whtAmount: number;
    whtRate: number;
    baseAmount: number;
  }, batch?: WriteBatch) {
    const certificate = {
      companyId: data.companyId,
      pvId: data.pvId,
      supplierName: data.supplierName,
      supplierTaxId: data.supplierTaxId,
      whtAmount: data.whtAmount,
      whtRate: data.whtRate,
      baseAmount: data.baseAmount,
      createdAt: serverTimestamp(),
      status: 'active'
    };
    if (batch) {
      const docRef = doc(collection(db, "wht_certificates"));
      batch.set(docRef, certificate);
      return docRef;
    }
    return await addDoc(collection(db, "wht_certificates"), certificate);
  },

  /**
   * Posts a generic Journal Entry.
   */
  async postJournalEntry(data: {
    companyId: string;
    description: string;
    totalAmount: number;
    items: any[];
  }, batch?: WriteBatch) {
    const journalEntry: Partial<JournalEntry> = {
      companyId: data.companyId,
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

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates a Journal Entry for Free of Charge (FOC) items
   */
  async postFOCExpense(data: {
    companyId: string;
    documentId: string;
    customerName: string;
    totalCost: number;
    expenseAccountCode: string;
    expenseAccountName: string;
    focReason: string;
  }, batch?: WriteBatch) {
    const journalEntry: Partial<JournalEntry> = {
      companyId: data.companyId,
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
          accountName: 'สินค้าคงเหลือ',
          debit: 0,
          credit: data.totalCost
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  },

  /**
   * Generates General Journal Entry for Internal Expense Claim (PV)
   */
  async postExpenseClaimJournal(companyId: string, claimData: any, batch?: WriteBatch) {
    const lines = [];
    
    // Dr. Expense Account
    lines.push({
      accountCode: claimData.expenseAccountCode || '53000-00',
      accountName: 'ค่าใช้จ่ายเบ็ดเตล็ด',
      debit: claimData.subtotal,
      credit: 0
    });

    // Dr. Input VAT (if hasVat)
    if (claimData.hasVat && claimData.vatAmount > 0) {
      lines.push({
        accountCode: '1151-00',
        accountName: 'ภาษีซื้อ',
        debit: claimData.vatAmount,
        credit: 0
      });
    }

    // Cr. Petty Cash / Bank
    lines.push({
      accountCode: '11000-00',
      accountName: 'เงินสดย่อย / เงินฝากธนาคาร',
      debit: 0,
      credit: claimData.grandTotal
    });

    const journalEntry = {
      companyId,
      bookType: 'PV', // Payment Voucher / สมุดรายวันจ่าย
      date: serverTimestamp(),
      description: `เบิกเงินภายใน/สดย่อย: ${claimData.description}`,
      referenceId: claimData.claimId,
      status: 'posted',
      isOfficialTax: claimData.hasVat, // Map to Tax Engine
      items: lines, // Compatible with existing items/lines schema
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (batch) {
      const docRef = doc(collection(db, "journal_entries"));
      batch.set(docRef, journalEntry);
      return docRef;
    }
    return await addDoc(collection(db, "journal_entries"), journalEntry);
  }
};

