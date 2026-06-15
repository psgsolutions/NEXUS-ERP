/**
 * NEXUS ERP: UNIFIED DATABASE SCHEMA (V3.0)
 * [STRATEGY] The Unified Business Intelligence | Strict Multi-tenant
 */

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'ENGINEER' | 'SALES' | 'ACCOUNTANT' | 'HR' | 'PURCHASING';

export interface BaseDocument {
  id: string;
  companyId: string; // Tenant ID for Multi-tenancy
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string; // User UID
  updatedBy: string; // User UID
  isDeleted: boolean; // Soft delete flag
}

// ---------------------------------------------------------
// 1. ศูนย์ควบคุมหลัก & ความปลอดภัย (Security & Dashboard)
// ---------------------------------------------------------

export interface UserProfile extends BaseDocument {
  email: string;
  displayName: string;
  role: UserRole;
  permissions: string[];
  status: 'active' | 'inactive';
  lastLogin?: any;
}

export interface CompanyConfig extends BaseDocument {
  name: string;
  taxId?: string;
  address: any;
  phone: string;
  website?: string;
  logoUrl?: string;
  settings: {
    currency: string;
    timezone: string;
    idFormats: {
      quotation: string; // e.g., QT-YYMM-XXXX
      salesOrder: string;
      purchaseOrder: string;
      project: string;
      invoice: string;
    };
    focAccounts?: {
      marketing: string;
      compensation: string;
      crm: string;
      other: string;
    };
  };
}

// ---------------------------------------------------------
// 2. งานขายและ POS (Sales & POS)
// ---------------------------------------------------------

export interface Customer extends BaseDocument {
  customerId: string;
  name: string;
  taxId?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    billing: string;
    shipping: string;
  };
}

// 1. โครงสร้าง Snapshot ข้อมูลลูกค้าสำหรับเอกสาร
export interface DocumentCustomerInfo {
  customerId: string;
  name: string;
  taxId?: string;
  branch?: string; // สาขา
  address: string;
}

// 2. ข้อมูลรายการสินค้า (Line Items)
export interface UniversalLineItem {
  id: string; // สำหรับทำ Key ตอนลากวาง
  itemCode: string; // รหัสสินค้า (บังคับดึงจากระบบ)
  description: string; // รายละเอียด/ชื่อสินค้า
  quantity: number; // จำนวน
  unitPrice: number; // ราคาต่อหน่วย
  discount: number; // ส่วนลดต่อรายการ
  totalAmount: number; // ยอดรวมของบรรทัดนั้น
  isFOC?: boolean; // เป็นของแถมหรือไม่
  focReason?: 'marketing' | 'compensation' | 'crm' | 'other'; // เหตุผลการแถม
}

// 3. ข้อมูลสรุปยอดและเอกสารใบเสนอราคา (Document Header & Summary)
export interface Quotation extends BaseDocument {
  // Document Header
  documentNo: string; // รหัสเอกสาร (เช่น QU-2605-0001)
  issueDate: any; // วันที่ออกเอกสาร (Firestore Timestamp)
  dueDate: any; // วันที่ครบกำหนดชำระ
  customerInfo: DocumentCustomerInfo;
  
  isVatRegistered: boolean;
  vatType: 'Include VAT' | 'Exclude VAT' | 'Non-VAT';

  // Line Items
  items: UniversalLineItem[];
  
  // Document Summary
  subTotal: number; // ยอดรวมทั้งหมดก่อนหักส่วนลด
  totalDiscount: number; // ส่วนลดท้ายบิล
  vatAmount: number; // ยอดภาษีมูลค่าเพิ่ม (VAT 7%)
  grandTotal: number; // ยอดเงินสุทธิรวมทั้งสิ้น
  remarks: string; // หมายเหตุท้ายเอกสาร

  // Status & Logic Specific
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'expired';
  paymentTermDays: number; // For Cash Flow Forecasting
  probability: number; // 0.0 to 1.0 (AI Prediction)
  expectedRevenue: number; // grandTotal * probability
}

// ---------------------------------------------------------
// 3. บริหารโครงการ IT (Projects)
// ---------------------------------------------------------

export interface Project extends BaseDocument {
  projectId: string;
  title: string;
  customerId: string;
  clientReference?: string; // Client's PO or Project ID
  projectType: 'infrastructure' | 'software' | 'consulting' | 'maintenance';
  status: 'planning' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate: any;
  endDate: any;
  location: {
    address: any;
    coordinates?: { lat: number; lng: number };
  };
  siteContact: {
    name: string;
    phone: string;
  };
  projectManager: string; // User UID
  budget: number;
  actualCost: number;
  wipValue: number; // Work-in-Process inventory value
  burnRate: number; // AI calculated spending rate
  estimatedCompletionDate: any; // AI predicted date
  assignedEngineers: string[]; // User UIDs
  tags: string[];
}

export interface ProjectMilestone extends BaseDocument {
  milestoneId: string;
  projectId: string;
  title: string;
  description: string;
  dueDate: any;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  weight: number; // Percentage of total project (0-100)
  isCriticalPath: boolean;
  responsiblePerson: string; // User UID
  billingPercentage?: number; // เปอร์เซ็นต์งวดงานสำหรับวางบิล (e.g. 30, 50, 20)
  invoiceRefId?: string; // เลขที่เอกสารอ้างอิงใบวางบิล/ใบแจ้งหนี้
}

export interface ProjectBOQItem {
  id: string;
  category: 'hardware' | 'software' | 'services';
  description: string;
  qty: number;
  unit: string;
  estimatedCost: number; // ราคาทุนประมาณการต่อหน่วย (Baseline Cost)
  estimatedPrice: number; // ราคาเสนอขายต่อหน่วย (Baseline Price)
  totalCost: number; // estimatedCost * qty
  totalPrice: number; // estimatedPrice * qty
}

export interface ProjectBOQ extends BaseDocument {
  projectId: string;
  version: number; // เลขที่เวอร์ชันของ BOQ (Rev 1, Rev 2, Rev 3)
  status: 'draft' | 'approved';
  items: ProjectBOQItem[];
}

export interface ServiceReport extends BaseDocument {
  reportId: string;
  projectId: string;
  technicianId: string; // User UID
  workDate: any;
  workType: 'installation' | 'maintenance' | 'repair' | 'survey' | 'emergency';
  title: string;
  description: string;
  partsUsed: {
    productId: string;
    qty: number;
    sn?: string;
  }[];
  status: 'draft' | 'pending-signature' | 'completed';
  customerSignature?: string; // Base64 or URL
  signedByName?: string;
  signedAt?: any;
  photos: string[]; // URLs
}

// ---------------------------------------------------------
// 3.5 บริการและสนับสนุน (Support)
// ---------------------------------------------------------

export interface SupportTicket extends BaseDocument {
  ticketId: string;
  subject: string;
  description: string;
  customerId: string;
  projectId?: string;
  category: 'bug' | 'question' | 'incident' | 'request';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignedTo?: string; // User UID
  dueDate?: any; // SLA Deadline
  tags: string[];
  attachments: string[]; // URLs
}

export interface PMPlan extends BaseDocument {
  planId: string;
  title: string;
  customerId: string;
  projectId?: string;
  frequency: 'monthly' | 'quarterly' | 'semi-annually' | 'annually';
  startDate: any;
  nextServiceDate: any;
  assignedTechnician: string; // User UID
  checklist: {
    task: string;
    description?: string;
  }[];
  autoCreateTicket: boolean;
  status: 'active' | 'paused' | 'completed';
}

// ---------------------------------------------------------
// 4. พาณิชย์และลูกค้าสัมพันธ์ (Commerce & CRM)
// ---------------------------------------------------------

export interface CRMCustomer extends BaseDocument {
  customerId: string;
  name: string;
  taxId?: string;
  type: 'GOVERNMENT' | 'PRIVATE' | 'INTERNAL';
  address: any;
  contacts: {
    name: string;
    position?: string;
    phone: string;
    email: string;
  }[];
  paymentTerms: string;
  creditLimit: number;
  status: 'active' | 'inactive';
}

export interface PurchaseRequest extends BaseDocument {
  requestId: string;
  requesterId: string; // User UID
  department: string;
  projectId?: string;
  requestDate: any;
  requiredDate: any;
  items: {
    name: string;
    description?: string;
    qty: number;
    unit: string;
    estimatedPrice?: number;
  }[];
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ordered' | 'cancelled';
}

export interface Supplier extends BaseDocument {
  supplierId: string;
  name: string;
  taxId?: string;
  category: string; // e.g., Hardware, Software, Service
  address: any;
  contacts: {
    name: string;
    position?: string;
    phone: string;
    email: string;
  }[];
  paymentTerms: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  status: 'active' | 'inactive';
}

export interface PurchaseOrder extends BaseDocument {
  poId: string;
  supplierId: string;
  prRef?: string;
  orderDate: any;
  deliveryDate: any;
  items: {
    name: string;
    qty: number;
    unit: string;
    price: number;
    discount?: number;
  }[];
  shippingMethod: string;
  paymentTerms: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  vat_type?: 'Inclusive' | 'Exclusive' | 'Non-VAT';
  isOfficialTax?: boolean;
  status: 'draft' | 'issued' | 'received' | 'cancelled';
}

export interface GoodsReceipt extends BaseDocument {
  receiptId: string;
  poRef: string;
  supplierId: string;
  receiptDate: any;
  receivedBy: string;
  items: {
    name: string;
    qtyOrdered: number;
    qtyReceived: number;
    unit: string;
    warehouseId: string;
    serials?: string[];
  }[];
  deliveryNoteRef?: string;
  status: 'completed' | 'partial' | 'cancelled';
}

export interface JournalEntry extends BaseDocument {
  journalId: string;
  date: any;
  bookType: 'JV' | 'RV' | 'PV' | 'SV' | 'PV_INTERNAL';
  description: string;
  reference?: string;
  lines: {
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
    description?: string;
  }[];
  totalDebit: number;
  totalCredit: number;
  isOfficialTax?: boolean;
  status: 'draft' | 'posted' | 'cancelled';
}

export interface FinancialPeriod extends BaseDocument {
  year: number;
  month: number;
  status: 'open' | 'closed';
  closedAt?: any;
  closedBy?: string;
}

export interface POSSession extends BaseDocument {
  sessionId: string;
  terminalId: string;
  userId: string;
  startTime: any;
  endTime?: any;
  openingCash: number;
  closingCash?: number;
  totalSales: number;
  status: 'open' | 'closed';
}

export interface DailySalesSummary extends BaseDocument {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  paymentBreakdown: {
    cash: number;
    creditCard: number;
    transfer: number;
  };
  topProducts: {
    productId: string;
    name: string;
    qty: number;
    revenue: number;
  }[];
}

export interface Employee extends BaseDocument {
  employeeId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  position: string;
  department: string;
  employmentType: 'permanent' | 'contract' | 'probation';
  joinDate: any;
  salary: number;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
  };
  status: 'active' | 'resigned' | 'suspended';
}

export interface AttendanceRecord extends BaseDocument {
  employeeId: string;
  type: 'IN' | 'OUT';
  timestamp: any;
  location: {
    lat?: number;
    lng?: number;
    siteName?: string;
  };
  note?: string;
  photoUrl?: string;
}

export interface PayrollSession extends BaseDocument {
  period: string; // e.g. "2026-04"
  employeeCount: number;
  totalBaseSalary: number;
  totalOT: number;
  totalSocialSecurity: number;
  totalTax: number;
  totalNetPayout: number;
  status: 'draft' | 'calculated' | 'paid';
  items: {
    employeeId: string;
    baseSalary: number;
    ot: number;
    deductions: number;
    netAmount: number;
  }[];
}

export interface TaxFiling extends BaseDocument {
  filingId: string;
  type: 'VAT30' | 'PND3' | 'PND53' | 'PND1';
  month: number;
  year: number;
  revenue: number;
  taxAmount: number;
  status: 'draft' | 'filed' | 'cancelled';
  filedAt?: any;
}

export interface ReceiptVoucher extends BaseDocument {
  receiptId: string;
  date: any;
  customerId: string;
  bankAccountId: string;
  totalReceived: number;
  invoices: {
    invoiceId: string;
    amountToPay: number;
    whtAmount?: number;
    whtRate?: number;
  }[];
  paymentMethod: 'transfer' | 'cash' | 'cheque' | 'credit_card';
  status: 'draft' | 'posted' | 'cancelled';
}

export interface PaymentVoucher extends BaseDocument {
  paymentId: string;
  date: any;
  supplierId: string;
  bankAccountId: string;
  totalPayment: number;
  orders: {
    orderId: string;
    amountToPay: number;
    whtAmount?: number;
    whtRate?: number;
  }[];
  paymentMethod: 'transfer' | 'cash' | 'cheque';
  status: 'draft' | 'posted' | 'cancelled';
}

export interface CRMQuotation extends BaseDocument {
  documentNo: string;
  customerId: string;
  projectName: string;
  date: any;
  expireDate: any;
  items: {
    name: string;
    qty: number;
    unit: string;
    price: number;
    discount?: number;
  }[];
  taxSystem: 'VAT7' | 'VAT_EXT' | 'NON_VAT';
  terms: string;
  salesPerson: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
}

export interface SalesOrder extends BaseDocument {
  orderId: string;
  quotationRefNo?: string; // Linked Quotation documentNo
  customerId: string;
  projectId?: string;
  orderDate: any;
  deliveryDate: any;
  items: {
    productId: string;
    name: string;
    qty: number;
    unit: string;
    price: number;
    discount?: number;
  }[];
  shippingAddress: string;
  billingAddress: string;
  shippingMethod: string;
  paymentStatus: 'pending' | 'partial' | 'paid';
  depositAmount: number;
  totalAmount: number;
  status: 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
}

export interface Invoice extends BaseDocument {
  invoiceId: string;
  orderRefNo?: string; // Linked SalesOrder orderId
  customerId: string;
  projectId?: string;
  issueDate: any;
  dueDate: any;
  items: {
    productId: string;
    name: string;
    qty: number;
    unit: string;
    price: number;
    discount?: number;
  }[];
  isVatRegistered: boolean;
  vatType: 'Include VAT' | 'Exclude VAT' | 'Non-VAT';
  subTotal: number;
  vatAmount: number;
  grandTotal: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  status: 'draft' | 'issued' | 'cancelled';
}

// ---------------------------------------------------------
// 5. คลังพัสดุและ SN (Inventory)
// ---------------------------------------------------------

export interface Product extends BaseDocument {
  productId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  unit: string;
  allowFOC?: boolean; // อนุญาตให้ใช้เป็นของแถมได้หรือไม่
  stockStatus: {
    onHand: number;
    reserved: number;
    available: number; // onHand - reserved
  };
  pricing: {
    costWAC: number; // Weighted Average Cost
    pricePOS: number;
    priceProject: number;
  };
}

export interface ConfigurableKit extends BaseDocument {
  kitId: string; // SKU หรือรหัสชุดอุปกรณ์หลัก (e.g. KIT-CCTV-01)
  name: string;
  description: string;
  components: {
    productId: string;
    qty: number;
    type: 'hardware' | 'material' | 'service';
  }[];
  aggregateCost: number; // ต้นทุนเฉลี่ย WAC รวมของชุดย่อย
  aggregatePrice: number; // ราคาเสนอขายรวมของชุด
}

export interface SerialNumber extends BaseDocument {
  sn: string;
  productId: string;
  status: 'available' | 'reserved' | 'deployed' | 'rma' | 'lost';
  location: string;
  warrantyExpiry?: any;
  currentProjectId?: string;
  pmFrequency: number; // Periodic Maintenance frequency in days (e.g., 90, 180)
  lastMaintenanceDate?: any;
}

export interface InventoryLineItem {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  lotNumber?: string;
  serialNumber?: string;
  isFOC?: boolean;
  focReason?: string;
}

export interface InventoryDocument extends BaseDocument {
  // Document Header
  documentNo: string;
  movementDate: any;
  sourceLocation: string;
  destinationLocation?: string; // Optional (สำหรับรับ/เบิก ที่ไม่ใช่โอนย้าย)
  referenceNo?: string;
  
  // Line Items
  items: InventoryLineItem[];
  
  // Document Summary
  totalQuantity: number;
  approvedBy?: string;
  remarks: string;

  // Domain Specific
  type: 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT';
}

// ---------------------------------------------------------
// 5. ระบบจัดซื้อ (Procurement)
// ---------------------------------------------------------

export interface DocumentSupplierInfo {
  supplierId: string;
  name: string;
  taxId?: string;
  branch?: string;
  address: string;
}

export interface PurchaseDocument extends BaseDocument {
  // Document Header
  documentNo: string;
  issueDate: any;
  expectedDate: any;
  supplierInfo: DocumentSupplierInfo;
  
  // Line Items (Expense Account Mapping support)
  items: (UniversalLineItem & { accountCode?: string })[];
  
  // Document Summary
  subTotal: number;
  vatAmount: number;
  whtAmount?: number;
  whtRate?: number;
  grandTotal: number;
  remarks: string;

  // Domain Specific
  status: 'draft' | 'pending' | 'ordered' | 'received' | 'cancelled';
}

// ---------------------------------------------------------
// 6. บัญชีและการเงิน (Finance)
// ---------------------------------------------------------

export interface AccountingEntityInfo {
  entityId: string;
  name: string;
  taxId?: string;
  address?: string;
}

export interface AccountingLineItem {
  id: string;
  accountCode: string;
  accountName: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  whtRate?: number;
}

export interface AccountingDocument extends BaseDocument {
  // Document Header
  documentNo: string;
  transactionDate: any;
  entityInfo: AccountingEntityInfo;
  referenceDocNo?: string;
  paymentMethod: 'cash' | 'transfer' | 'cheque';
  
  // Line Items
  entries: AccountingLineItem[];
  
  // Document Summary
  totalDebit: number;
  totalCredit: number;
  netAmount: number;
  totalWhtAmount: number;
  remarks?: string;

  // Domain Specific
  status: 'draft' | 'posted' | 'voided';
}

// ---------------------------------------------------------
// 7. NEXUS AI HUB (AI Context)
// ---------------------------------------------------------

export interface AIProcessingLog extends BaseDocument {
  type: 'ocr' | 'prediction' | 'optimization';
  sourceUrl?: string;
  rawOutput: any;
  structuredData: any;
  confidenceScore: number;
}

// ---------------------------------------------------------
// 8. จัดการบุคลากร (HR)
// ---------------------------------------------------------

export interface EmployeeProfile extends BaseDocument {
  employeeId: string;
  userId: string; // Link to UserProfile
  department: string;
  position: string;
  joinDate: any;
  skills: string[];
}

// ---------------------------------------------------------
// 9. ประวัติบันทึกระบบ (Audit Logs)
// ---------------------------------------------------------

export interface AuditLog extends BaseDocument {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT';
  module: string; // e.g., 'SALES', 'INVENTORY'
  targetId: string; // ID of the document being acted upon
  reason?: string; // Mandatory reason for sensitive updates/deletes
  changes?: {
    before: any;
    after: any;
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
  };
}

// ---------------------------------------------------------
// 10. ระบบแบบฟอร์มไดนามิก & รายงาน (Dynamic Forms & Reports)
// ---------------------------------------------------------

export interface FormField {
  id: string; // e.g., 'customer_name', 'warranty_date'
  type: 'text' | 'number' | 'date' | 'dropdown' | 'table';
  label: string;
  required: boolean;
  options?: string[]; // สำหรับ dropdown
  gridSpan: 1 | 2 | 3 | 4; // สำหรับการจัดวาง grid
}

export interface FormTemplate extends BaseDocument {
  templateId: string;
  module: string; // เช่น 'QUOTATION', 'MAINTENANCE_TICKET', 'SERVICE_REPORT'
  title: string;
  fields: FormField[];
}

export interface FormSubmission extends BaseDocument {
  submissionId: string;
  templateId: string;
  module: string; // e.g., 'QUOTATION', 'MAINTENANCE_TICKET'
  refId: string; // Reference to main document
  values: Record<string, any>; // Dynamic key-values matching FormField ids
}

// ---------------------------------------------------------
// 11. Internal Expense Claims (Petty Cash)
// ---------------------------------------------------------

export interface ExpenseClaim extends BaseDocument {
  claimId: string; // EX-YYMM-XXXX
  employeeId: string;
  expenseAccountCode: string; // Mapping to GL Expense Code
  description: string;
  hasVat: boolean;
  vatAmount: number;
  subtotal: number;
  grandTotal: number;
  receiptUrls: string[]; // For receipt images
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected';
}

