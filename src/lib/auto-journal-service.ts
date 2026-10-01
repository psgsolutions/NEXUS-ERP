import { db } from "@/lib/firebase-client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { assertPeriodOpen } from "@/lib/period-close-service";
import type { 
  Invoice, 
  PurchaseDocument, 
  InventoryDocument,
  AccountingDocument,
  AccountingLineItem
} from "@/types/database";

/**
 * Auto-Journal Engine (NEXUS ERP V3.1)
 * Rules:
 * - Strict Tenant Isolation: Must use companyId
 * - Atomic transactions should be handled in Cloud Functions, but for MVP we construct AccountingDocument payloads here.
 */

export class AutoJournalService {
  
  /**
   * 1. Sales Hub (Invoice)
   * Dr. Accounts Receivable (AR)
   * Cr. Sales Revenue
   * Cr. Output VAT
   */
  static async generateSalesJournal(companyId: string, invoice: Invoice, userId: string) {
    await assertPeriodOpen(companyId);
    const lines: AccountingLineItem[] = [];
    
    // 1. Debit AR (ลูกหนี้การค้า) - Net Payable
    lines.push({
      id: crypto.randomUUID(),
      accountCode: "11-01-001", // AR
      accountName: "Accounts Receivable",
      description: `AR for Invoice ${invoice.invoiceId}`,
      debitAmount: invoice.grandTotal,
      creditAmount: 0
    });

    // 2. Credit Revenue (รายได้จากการขาย) - SubTotal
    lines.push({
      id: crypto.randomUUID(),
      accountCode: "41-01-001", // Revenue
      accountName: "Sales Revenue",
      description: `Revenue for Invoice ${invoice.invoiceId}`,
      debitAmount: 0,
      creditAmount: invoice.subTotal
    });

    // 3. Credit Output VAT (ภาษีขาย) - VAT Amount (ถ้ามี)
    if (invoice.vatAmount > 0) {
      lines.push({
        id: crypto.randomUUID(),
        accountCode: "21-02-001", // Output VAT
        accountName: "Output VAT",
        description: `Output VAT for Invoice ${invoice.invoiceId}`,
        debitAmount: 0,
        creditAmount: invoice.vatAmount
      });
    }

    const journalDoc: Omit<AccountingDocument, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> & { companyId: string } = {
      companyId,
      documentNo: `JV-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`,
      transactionDate: new Date().toISOString(),
      entityInfo: {
        entityId: invoice.customerId,
        name: "Customer Reference"
      },
      referenceDocNo: invoice.invoiceId,
      paymentMethod: 'transfer',
      entries: lines,
      totalDebit: invoice.grandTotal,
      totalCredit: invoice.subTotal + invoice.vatAmount,
      netAmount: invoice.grandTotal,
      totalWhtAmount: 0,
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
      isDeleted: false
    };

    return await addDoc(collection(db, "accounting_documents"), {
      ...journalDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * 2. Procurement Hub (Bill / Purchase)
   * Dr. Inventory / Expenses
   * Dr. Input VAT
   * Cr. Accounts Payable (AP)
   * Cr. WHT Payable (ภาษีหัก ณ ที่จ่าย รอนำส่ง)
   */
  static async generateProcurementJournal(companyId: string, doc: PurchaseDocument, userId: string) {
    await assertPeriodOpen(companyId);
    const lines: AccountingLineItem[] = [];

    // 1. Debit Expense / Inventory
    lines.push({
      id: crypto.randomUUID(),
      accountCode: doc.items[0]?.accountCode || "51-01-001", // Default Expense
      accountName: "Purchases / Expenses",
      description: `Purchase for ${doc.documentNo}`,
      debitAmount: doc.subTotal,
      creditAmount: 0
    });

    // 2. Debit Input VAT
    if (doc.vatAmount > 0) {
      lines.push({
        id: crypto.randomUUID(),
        accountCode: "11-03-001",
        accountName: "Input VAT",
        description: `Input VAT for ${doc.documentNo}`,
        debitAmount: doc.vatAmount,
        creditAmount: 0
      });
    }

    // 3. Credit WHT Payable (if any)
    let totalWht = 0;
    if (doc.whtRate && doc.whtRate > 0) {
      totalWht = doc.subTotal * (doc.whtRate / 100);
      lines.push({
        id: crypto.randomUUID(),
        accountCode: "21-03-001",
        accountName: "WHT Payable",
        description: `WHT ${doc.whtRate}% for ${doc.documentNo}`,
        debitAmount: 0,
        creditAmount: totalWht,
        whtRate: doc.whtRate
      });
    }

    // 4. Credit AP
    const apAmount = (doc.subTotal + doc.vatAmount) - totalWht;
    lines.push({
      id: crypto.randomUUID(),
      accountCode: "21-01-001",
      accountName: "Accounts Payable",
      description: `AP for ${doc.documentNo}`,
      debitAmount: 0,
      creditAmount: apAmount
    });

    const journalDoc: Omit<AccountingDocument, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> & { companyId: string } = {
      companyId,
      documentNo: `JV-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`,
      transactionDate: new Date().toISOString(),
      entityInfo: {
        entityId: doc.supplierInfo.supplierId,
        name: doc.supplierInfo.name
      },
      referenceDocNo: doc.documentNo,
      paymentMethod: 'transfer',
      entries: lines,
      totalDebit: doc.subTotal + doc.vatAmount,
      totalCredit: apAmount + totalWht,
      netAmount: apAmount,
      totalWhtAmount: totalWht,
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
      isDeleted: false
    };

    return await addDoc(collection(db, "accounting_documents"), {
      ...journalDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * 3. Inventory Hub
   * Dr. COGS
   * Cr. Inventory
   */
  static async generateInventoryJournal(companyId: string, doc: InventoryDocument, expenseAccountId: string, userId: string) {
    await assertPeriodOpen(companyId);
    const lines: AccountingLineItem[] = [];
    const totalCost = 1000; // Placeholder until cost logic is implemented

    lines.push({
      id: crypto.randomUUID(),
      accountCode: expenseAccountId || "51-02-001", // COGS
      accountName: "Cost of Goods Sold",
      description: `COGS for ${doc.documentNo}`,
      debitAmount: totalCost,
      creditAmount: 0
    });

    lines.push({
      id: crypto.randomUUID(),
      accountCode: "11-04-001", // Inventory
      accountName: "Inventory Asset",
      description: `Inventory deduction for ${doc.documentNo}`,
      debitAmount: 0,
      creditAmount: totalCost
    });

    const journalDoc: Omit<AccountingDocument, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> & { companyId: string } = {
      companyId,
      documentNo: `JV-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`,
      transactionDate: new Date().toISOString(),
      entityInfo: {
        entityId: "INTERNAL",
        name: "Inventory Movement"
      },
      referenceDocNo: doc.documentNo,
      paymentMethod: 'transfer',
      entries: lines,
      totalDebit: totalCost,
      totalCredit: totalCost,
      netAmount: 0,
      totalWhtAmount: 0,
      status: 'posted',
      createdBy: userId,
      updatedBy: userId,
      isDeleted: false
    };

    return await addDoc(collection(db, "accounting_documents"), {
      ...journalDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * 4. Project Hub (Site Expenses / WIP)
   * Dr. Work in Process (WIP) - Project
   * Cr. Cash / Bank / AP
   */
  static async generateProjectWIPJournal(companyId: string, projectId: string, amount: number, paymentAccountId: string, userId: string) {
    await assertPeriodOpen(companyId);
    const lines: AccountingLineItem[] = [];

    lines.push({
      id: crypto.randomUUID(),
      accountCode: "11-05-001", // WIP Asset
      accountName: "Work in Process",
      description: `WIP for Project ${projectId}`,
      debitAmount: amount,
      creditAmount: 0
    });

    lines.push({
      id: crypto.randomUUID(),
      accountCode: paymentAccountId || "11-01-002", // Bank or AP
      accountName: "Payment Account",
      description: `Payment for WIP ${projectId}`,
      debitAmount: 0,
      creditAmount: amount
    });

    const journalDoc: Omit<AccountingDocument, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> & { companyId: string } = {
      companyId,
      documentNo: `JV-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`,
      transactionDate: new Date().toISOString(),
      entityInfo: {
        entityId: projectId,
        name: "Project Costing"
      },
      referenceDocNo: projectId,
      paymentMethod: 'transfer',
      entries: lines,
      totalDebit: amount,
      totalCredit: amount,
      netAmount: amount,
      totalWhtAmount: 0,
      status: 'posted',
      createdBy: userId,
      updatedBy: userId,
      isDeleted: false
    };

    return await addDoc(collection(db, "accounting_documents"), {
      ...journalDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}
