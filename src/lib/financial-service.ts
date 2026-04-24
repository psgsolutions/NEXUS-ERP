import { db } from "./firebase";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp,
  setDoc,
  getDoc
} from "firebase/firestore";
import { nexusSequenceEngine } from "./sequence-engine";

/**
 * [FIN-STRATEGY-V2.0]
 * Double-Entry Bookkeeping & Financial Intelligence
 */

export interface JournalEntry {
  date: Date;
  description: string;
  lines: {
    accountId: string; // From COA
    debit: number;
    credit: number;
  }[];
  referenceId?: string; // INV-XX, BILL-XX, EXP-XX
  companyId: string;
}

export async function postJournalEntry(entry: JournalEntry) {
  const { lines, companyId } = entry;

  // 1. Validation: Dr must equal Cr
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("รายการบัญชีไม่สมดุล (Debit != Credit)");
  }

  // 2. Generate JV ID
  const jvId = await nexusSequenceEngine("FIN", companyId);

  // 3. Save to Firestore
  const jvRef = doc(db, `companies/${companyId}/journal_entries`, jvId);
  await setDoc(jvRef, {
    ...entry,
    jvId,
    totalAmount: totalDebit,
    createdAt: serverTimestamp()
  });

  return jvId;
}

/**
 * Create Invoice (AR) from Sales Order
 */
export async function createInvoice(soId: string, companyId: string) {
  const invId = await nexusSequenceEngine("FIN", companyId); // Or use custom prefix "INV"
  
  // Logic: Fetch SO, Calculate VAT 7%, Create Invoice Doc
  // And auto-generate Journal Entry:
  // Dr. Accounts Receivable
  // Cr. Sales Revenue
  // Cr. Output VAT
}

/**
 * AI Expense Mapping (Paypers-style)
 */
export async function processAiExpense(expenseData: any, companyId: string) {
  const expId = await nexusSequenceEngine("EXP", companyId);
  
  // Logic: 
  // 1. Save Expense Doc
  // 2. If Project ID provided, link to Project Costing
  // 3. Auto-generate Journal Entry:
  // Dr. Expense (e.g. Travel, Materials)
  // Dr. Input VAT (if applicable)
  // Cr. Cash/Bank or Employee Payable
}
