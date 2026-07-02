// ==========================================
// 🌌 PSG UI Protocol & Validation Constraints
// ==========================================
export type TaxId = string;       // Bounded constraint: 13 characters
export type CitizenId = string;   // Bounded constraint: 13 characters
export type PhoneNumber = string; // Bounded constraint: 10 characters

export type DocumentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'VOIDED';

// ==========================================
// 🏗️ Base Enterprise Entity Interace
// ==========================================
export interface IBaseEntity {
  id: string;
  companyId: string;              // Tenant Isolation Key (.where logic)
  createdAt: Date | any;
  createdBy: string;
  updatedAt: Date | any;
  updatedBy: string;
  isDeleted: boolean;             // Soft Delete Protocol (For Non-Financial Entities)
}

// ==========================================
// 💰 Expense & Petty Cash Schema (Phase 1 Gate)
// ==========================================
export interface IPettyCashExpense extends IBaseEntity {
  projectCode?: string;           // Optional: สามารถแยกออกจากตัวโครงการได้ตามโจทย์
  amount: number;                 // ยอดเงินดิบ (Format UI บังคับ font-mono เท่านั้น)
  description: string;
  receiptUrl?: string;            // แนบหลักฐานรูปภาพหรือ PDF
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;            // ใครเป็นคนกดอนุมัติก่อนวิ่งเข้า AP
  approvedAt?: Date | any;
}

// ==========================================
// 🧾 Financial Ledger / General Journal (Phase 4)
// ==========================================
export interface IJournalEntry extends IBaseEntity {
  documentNo: string;             // รหัสเอกสาร (Format UI บังคับ font-mono เช่น JV-2606-XXXX)
  entryDate: Date | any;
  status: 'DRAFT' | 'POSTED' | 'VOIDED'; // หากเป็น POSTED จะถูก Rules บล็อกการแก้ไข
  totalDebit: number;
  totalCredit: number;            // Validation Logic: Debit ต้องเท่ากับ Credit เสมอ
  isTaxRelated: boolean;
  taxType?: 'VAT' | 'NON-VAT';
  lines: IJournalLine[];
  
  // Audit Trail สำหรับการจัดการระบุความเสี่ยงตามรายงาน
  isReverseEntry: boolean;        // บอกว่าเป็นรายการที่สร้างขึ้นมาเพื่อล้างสถานะหรือไม่
  reversedReferenceId?: string;   // อ้างอิง ID เอกสารเดิมที่ถูกล้าง
}

export interface IJournalLine {
  accountId: string;              // ผังบัญชี
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

// ==========================================
// 🛡️ Audit Log Contract
// ==========================================
export interface IAuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'SOFT_DELETE' | 'VOID' | 'POST_LEDGER';
  collectionName: string;
  documentId: string;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  timestamp: Date | any;
}
