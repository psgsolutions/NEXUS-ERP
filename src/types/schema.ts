/**
 * NEXUS ERP: Core Shared Schema & Data Models
 * [STRATEGY-V3.5] Unified Schema Protocol
 */

export interface BaseDocument {
  companyId: string; // Tenant ID for Multi-tenancy
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string; // User UID
}

// 1. User & Security
export interface User extends BaseDocument {
  uid: string;
  email: string;
  displayName: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'ENGINEER' | 'SALES' | 'ACCOUNTANT';
  permissions: string[];
  status: 'active' | 'inactive';
}

export interface Company {
  companyId: string;
  taxId: string;
  name: string;
  settings: {
    currency: string;
    timezone: string;
    idFormats: Record<string, string>;
  };
}

// 2. Inventory & Assets
export interface Product extends BaseDocument {
  productId: string; // PROD-XXXX
  sku: string;
  name: string;
  brand: string;
  category: string;
  minStock: number;
  currentStock: number;
}

export interface SerialNumber extends BaseDocument {
  sn: string;
  productId: string;
  status: 'available' | 'reserved' | 'deployed' | 'rma';
  warrantyExpiry: Date;
}

// 3. Project & Service Management
export interface Project extends BaseDocument {
  projectId: string; // PRJ-26-XXXX
  title: string;
  customerId: string;
  budget: number;
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  projectCosts: number; // Derived
}

export interface ServiceReport extends BaseDocument {
  reportId: string; // SR-YYMM-XXXX
  projectId: string;
  details: string;
  signatureUrl: string;
}

// 4. Sales & CRM
export interface Customer extends BaseDocument {
  customerId: string;
  companyName: string;
  contactPerson: string;
  address: {
    shipping: string;
    tax: string;
  };
}

export interface Quotation extends BaseDocument {
  documentNo: string; // QT-YYMM-XXXX
  items: {
    itemCode: string; // บังคับดึงรหัสสินค้าจากระบบ
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    totalAmount: number;
  }[];
  subTotal: number;
  vatAmount: number;
  grandTotal: number;
}

// 5. Procurement & Supply Chain
export interface PurchaseDocument extends BaseDocument {
  documentNo: string; // PO-YYMM-XXXX
  supplierInfo: {
    supplierId: string;
    name: string;
  };
  items: any[];
  status: 'draft' | 'pending' | 'ordered' | 'received' | 'cancelled';
}

// 6. Financial & Accounting
export interface AccountingDocument extends BaseDocument {
  documentNo: string;
  transactionDate: any;
  entityInfo: {
    entityId: string;
    name: string;
  };
  referenceDocNo?: string;
  paymentMethod: 'cash' | 'transfer' | 'cheque';
  entries: {
    accountCode: string;
    accountName: string;
    debitAmount: number;
    creditAmount: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  netAmount: number;
  status: 'draft' | 'posted' | 'voided';
}

// 7. AI Intelligence Center
export interface AIInsight extends BaseDocument {
  insightId: string;
  category: 'inventory_prediction' | 'financial_health';
  content: string;
  confidenceScore: number;
  dataSnapshot: any;
}

// 8. Smart POS & Retail
export interface POSSale extends BaseDocument {
  receiptId: string; // POS-YYMM-XXXX
  sessionId: string; // Shift ID
  paymentMethod: 'cash' | 'qr' | 'credit_card';
  totalAmount: number;
  changeAmount: number;
}

// 9. Maintenance & SLA
export interface MaintenanceContract extends BaseDocument {
  contractId: string; // MA-YY-XXXX
  projectId: string;
  slaLevel: '8x5xNBD' | '24x7x4H';
  pmFrequency: number; // months
  nextServiceDate: Date;
}

// 10. Helpdesk & Ticketing
export interface Ticket extends BaseDocument {
  ticketId: string; // TK-YYMM-XXXX
  sn: string;
  issue: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  resolutionTime?: number; // minutes
  status: 'open' | 'pending' | 'closed';
}
