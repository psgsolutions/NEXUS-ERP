// ============================================================
// dataBinding.ts — NEXUS ERP Full Database Schema Binding
// แมปทุก Table/Collection ในระบบเพื่อให้ document-builder
// สามารถเลือกผูกข้อมูลได้จากทุกโมดูล
// ============================================================

export interface BindingVariable {
  key: string;           // รหัสตัวแปร เช่น "customer.name"
  label: string;         // ชื่อแสดงผล ภาษาไทย
  table: string;         // ชื่อ Collection/ตาราง
  group: string;         // กลุ่มโมดูล
  fieldType: 'text' | 'number' | 'date' | 'currency';
  neutralValue: string;  // ค่าตัวอย่าง
}

// ============================================================
// NEXUS DB SCHEMA — จัดกลุ่มตาม Collection
// ============================================================
export const DB_TABLES: Record<string, { label: string; icon: string; fields: BindingVariable[] }> = {

  // ── ข้อมูลบริษัท ──────────────────────────────────────────
  companyConfig: {
    label: 'ข้อมูลบริษัท', icon: '🏢',
    fields: [
      { key: 'company.name',    label: 'ชื่อบริษัท',           table: 'companyConfig', group: 'companyConfig', fieldType: 'text',     neutralValue: 'บริษัท NEXUS ERP จำกัด' },
      { key: 'company.taxId',   label: 'เลขผู้เสียภาษีบริษัท', table: 'companyConfig', group: 'companyConfig', fieldType: 'text',     neutralValue: '0105560001234' },
      { key: 'company.phone',   label: 'เบอร์โทรบริษัท',       table: 'companyConfig', group: 'companyConfig', fieldType: 'text',     neutralValue: '02-999-0000' },
      { key: 'company.address', label: 'ที่อยู่บริษัท',         table: 'companyConfig', group: 'companyConfig', fieldType: 'text',     neutralValue: '999/1 ถ.รัชดาภิเษก กรุงเทพฯ 10900' },
      { key: 'company.website', label: 'เว็บไซต์',             table: 'companyConfig', group: 'companyConfig', fieldType: 'text',     neutralValue: 'www.nexus-erp.co.th' },
    ],
  },

  // ── ลูกค้า ──────────────────────────────────────────
  customers: {
    label: 'ลูกค้า', icon: '👤',
    fields: [
      { key: 'customer.customerId',   label: 'รหัสลูกค้า',           table: 'customers', group: 'customers', fieldType: 'text',     neutralValue: 'CUST-001' },
      { key: 'customer.name',         label: 'ชื่อลูกค้า/บริษัท',    table: 'customers', group: 'customers', fieldType: 'text',     neutralValue: 'บริษัท เอบีซี จำกัด' },
      { key: 'customer.taxId',        label: 'เลขผู้เสียภาษีลูกค้า', table: 'customers', group: 'customers', fieldType: 'text',     neutralValue: '0105512345678' },
      { key: 'customer.contactPerson',label: 'ผู้ติดต่อ',             table: 'customers', group: 'customers', fieldType: 'text',     neutralValue: 'คุณสมศักดิ์ รักงาน' },
      { key: 'customer.email',        label: 'อีเมลลูกค้า',          table: 'customers', group: 'customers', fieldType: 'text',     neutralValue: 'contact@abc.co.th' },
      { key: 'customer.phone',        label: 'เบอร์โทรลูกค้า',       table: 'customers', group: 'customers', fieldType: 'text',     neutralValue: '02-123-4567' },
      { key: 'customer.address',      label: 'ที่อยู่จัดส่ง',         table: 'customers', group: 'customers', fieldType: 'text',     neutralValue: '123 ถ.สุขุมวิท แขวงคลองเตย กรุงเทพฯ 10110' },
    ],
  },

  // ── ใบเสนอราคา / ใบสั่งขาย ────────────────────────────────
  quotations: {
    label: 'ใบเสนอราคา', icon: '📋',
    fields: [
      { key: 'quotation.documentNo',     label: 'เลขที่เอกสาร',        table: 'quotations', group: 'quotations', fieldType: 'text',     neutralValue: 'QT-2569-0001' },
      { key: 'quotation.issueDate',      label: 'วันที่ออกเอกสาร',     table: 'quotations', group: 'quotations', fieldType: 'date',     neutralValue: '29/05/2569' },
      { key: 'quotation.dueDate',        label: 'วันที่ครบกำหนด',      table: 'quotations', group: 'quotations', fieldType: 'date',     neutralValue: '28/06/2569' },
      { key: 'quotation.subTotal',       label: 'ยอดก่อนภาษี',         table: 'quotations', group: 'quotations', fieldType: 'currency', neutralValue: '93,457.94' },
      { key: 'quotation.vatAmount',      label: 'ภาษีมูลค่าเพิ่ม 7%',  table: 'quotations', group: 'quotations', fieldType: 'currency', neutralValue: '6,542.06' },
      { key: 'quotation.grandTotal',     label: 'ยอดรวมทั้งสิ้น',      table: 'quotations', group: 'quotations', fieldType: 'currency', neutralValue: '100,000.00' },
      { key: 'quotation.remarks',        label: 'หมายเหตุ',             table: 'quotations', group: 'quotations', fieldType: 'text',     neutralValue: 'ยินดีให้บริการ' },
      { key: 'quotation.status',         label: 'สถานะเอกสาร',         table: 'quotations', group: 'quotations', fieldType: 'text',     neutralValue: 'pending' },
    ],
  },

  // ── ใบแจ้งหนี้ / ใบกำกับภาษี ─────────────────────────────
  invoices: {
    label: 'ใบแจ้งหนี้', icon: '🧾',
    fields: [
      { key: 'invoice.documentNo',    label: 'เลขที่ใบแจ้งหนี้',    table: 'invoices', group: 'invoices', fieldType: 'text',     neutralValue: 'INV-2569-0001' },
      { key: 'invoice.issueDate',     label: 'วันที่ออกใบแจ้งหนี้', table: 'invoices', group: 'invoices', fieldType: 'date',     neutralValue: '29/05/2569' },
      { key: 'invoice.dueDate',       label: 'วันที่ครบกำหนดชำระ',  table: 'invoices', group: 'invoices', fieldType: 'date',     neutralValue: '28/06/2569' },
      { key: 'invoice.subTotal',      label: 'ยอดก่อนภาษี',         table: 'invoices', group: 'invoices', fieldType: 'currency', neutralValue: '93,457.94' },
      { key: 'invoice.vatAmount',     label: 'ภาษีมูลค่าเพิ่ม',    table: 'invoices', group: 'invoices', fieldType: 'currency', neutralValue: '6,542.06' },
      { key: 'invoice.grandTotal',    label: 'ยอดรวมทั้งสิ้น',      table: 'invoices', group: 'invoices', fieldType: 'currency', neutralValue: '100,000.00' },
      { key: 'invoice.reference',     label: 'เอกสารอ้างอิง',       table: 'invoices', group: 'invoices', fieldType: 'text',     neutralValue: 'QT-2569-0001' },
    ],
  },

  // ── ใบสั่งซื้อ ─────────────────────────────────────────────
  purchaseOrders: {
    label: 'ใบสั่งซื้อ', icon: '🛒',
    fields: [
      { key: 'po.documentNo',    label: 'เลขที่ใบสั่งซื้อ',  table: 'purchaseOrders', group: 'purchaseOrders', fieldType: 'text',     neutralValue: 'PO-2569-0001' },
      { key: 'po.orderDate',     label: 'วันที่สั่งซื้อ',    table: 'purchaseOrders', group: 'purchaseOrders', fieldType: 'date',     neutralValue: '29/05/2569' },
      { key: 'po.deliveryDate',  label: 'วันที่ต้องการรับ',  table: 'purchaseOrders', group: 'purchaseOrders', fieldType: 'date',     neutralValue: '05/06/2569' },
      { key: 'po.totalAmount',   label: 'ยอดรวม',            table: 'purchaseOrders', group: 'purchaseOrders', fieldType: 'currency', neutralValue: '55,000.00' },
      { key: 'po.paymentTerms',  label: 'เงื่อนไขการชำระ',   table: 'purchaseOrders', group: 'purchaseOrders', fieldType: 'text',     neutralValue: 'Net 30' },
      { key: 'po.status',        label: 'สถานะ',             table: 'purchaseOrders', group: 'purchaseOrders', fieldType: 'text',     neutralValue: 'issued' },
    ],
  },

  // ── Supplier ──────────────────────────────────────────────
  suppliers: {
    label: 'ผู้จำหน่าย', icon: '🏭',
    fields: [
      { key: 'supplier.name',        label: 'ชื่อผู้จำหน่าย',         table: 'suppliers', group: 'suppliers', fieldType: 'text', neutralValue: 'บริษัท ซัพพลายเออร์ จำกัด' },
      { key: 'supplier.taxId',       label: 'เลขผู้เสียภาษีผู้ขาย',  table: 'suppliers', group: 'suppliers', fieldType: 'text', neutralValue: '0105599999999' },
      { key: 'supplier.address',     label: 'ที่อยู่ผู้จำหน่าย',      table: 'suppliers', group: 'suppliers', fieldType: 'text', neutralValue: '456 ถ.พระราม 4 กรุงเทพฯ' },
      { key: 'supplier.phone',       label: 'เบอร์โทรผู้จำหน่าย',     table: 'suppliers', group: 'suppliers', fieldType: 'text', neutralValue: '02-456-7890' },
      { key: 'supplier.paymentTerms',label: 'เงื่อนไขการชำระ',        table: 'suppliers', group: 'suppliers', fieldType: 'text', neutralValue: 'Net 45' },
    ],
  },

  // ── โครงการ ────────────────────────────────────────────────
  projects: {
    label: 'โครงการ', icon: '📁',
    fields: [
      { key: 'project.projectId',  label: 'รหัสโครงการ',      table: 'projects', group: 'projects', fieldType: 'text',     neutralValue: 'PRJ-26-0001' },
      { key: 'project.title',      label: 'ชื่อโครงการ',      table: 'projects', group: 'projects', fieldType: 'text',     neutralValue: 'โครงการติดตั้งระบบ ERP' },
      { key: 'project.startDate',  label: 'วันเริ่มต้น',      table: 'projects', group: 'projects', fieldType: 'date',     neutralValue: '01/01/2569' },
      { key: 'project.endDate',    label: 'วันสิ้นสุด',       table: 'projects', group: 'projects', fieldType: 'date',     neutralValue: '31/12/2569' },
      { key: 'project.budget',     label: 'งบประมาณโครงการ',  table: 'projects', group: 'projects', fieldType: 'currency', neutralValue: '500,000.00' },
      { key: 'project.status',     label: 'สถานะโครงการ',     table: 'projects', group: 'projects', fieldType: 'text',     neutralValue: 'in-progress' },
    ],
  },

  // ── พนักงาน ────────────────────────────────────────────────
  employees: {
    label: 'พนักงาน', icon: '👨‍💼',
    fields: [
      { key: 'employee.employeeId', label: 'รหัสพนักงาน',  table: 'employees', group: 'employees', fieldType: 'text',     neutralValue: 'EMP-001' },
      { key: 'employee.firstName',  label: 'ชื่อ',          table: 'employees', group: 'employees', fieldType: 'text',     neutralValue: 'สมชาย' },
      { key: 'employee.lastName',   label: 'นามสกุล',       table: 'employees', group: 'employees', fieldType: 'text',     neutralValue: 'ใจดี' },
      { key: 'employee.position',   label: 'ตำแหน่ง',       table: 'employees', group: 'employees', fieldType: 'text',     neutralValue: 'วิศวกร' },
      { key: 'employee.department', label: 'แผนก',          table: 'employees', group: 'employees', fieldType: 'text',     neutralValue: 'IT' },
      { key: 'employee.salary',     label: 'เงินเดือน',     table: 'employees', group: 'employees', fieldType: 'currency', neutralValue: '35,000.00' },
    ],
  },

  // ── สินค้า/พัสดุ ────────────────────────────────────────────
  products: {
    label: 'สินค้า/พัสดุ', icon: '📦',
    fields: [
      { key: 'product.sku',         label: 'รหัสสินค้า',     table: 'products', group: 'products', fieldType: 'text',     neutralValue: 'SKU-001' },
      { key: 'product.name',        label: 'ชื่อสินค้า',           table: 'products', group: 'products', fieldType: 'text',     neutralValue: 'Network Switch 48 Port' },
      { key: 'product.brand',       label: 'ยี่ห้อ',               table: 'products', group: 'products', fieldType: 'text',     neutralValue: 'Cisco' },
      { key: 'product.unit',        label: 'หน่วย',                table: 'products', group: 'products', fieldType: 'text',     neutralValue: 'ชุด' },
      { key: 'product.onHand',      label: 'คงคลัง',               table: 'products', group: 'products', fieldType: 'number',   neutralValue: '15' },
      { key: 'product.priceProject',label: 'ราคาขาย (โครงการ)',    table: 'products', group: 'products', fieldType: 'currency', neutralValue: '45,000.00' },
    ],
  },

  // ── เอกสารการบัญชี ─────────────────────────────────────────
  accountingDocuments: {
    label: 'เอกสารบัญชี', icon: '📊',
    fields: [
      { key: 'acc.documentNo',      label: 'เลขที่เอกสารบัญชี', table: 'accountingDocuments', group: 'accountingDocuments', fieldType: 'text',     neutralValue: 'RV-2569-0001' },
      { key: 'acc.transactionDate', label: 'วันที่ธุรกรรม',     table: 'accountingDocuments', group: 'accountingDocuments', fieldType: 'date',     neutralValue: '29/05/2569' },
      { key: 'acc.netAmount',       label: 'ยอดสุทธิ',          table: 'accountingDocuments', group: 'accountingDocuments', fieldType: 'currency', neutralValue: '100,000.00' },
      { key: 'acc.paymentMethod',   label: 'วิธีชำระ',          table: 'accountingDocuments', group: 'accountingDocuments', fieldType: 'text',     neutralValue: 'transfer' },
      { key: 'acc.referenceDocNo',  label: 'เอกสารอ้างอิง',    table: 'accountingDocuments', group: 'accountingDocuments', fieldType: 'text',     neutralValue: 'INV-2569-0001' },
    ],
  },

  // ── Service Report ─────────────────────────────────────────
  serviceReports: {
    label: 'รายงานการบริการ', icon: '🔧',
    fields: [
      { key: 'sr.reportId',    label: 'รหัส Service Report', table: 'serviceReports', group: 'serviceReports', fieldType: 'text', neutralValue: 'SR-2569-0001' },
      { key: 'sr.workDate',    label: 'วันที่ปฏิบัติงาน',   table: 'serviceReports', group: 'serviceReports', fieldType: 'date', neutralValue: '29/05/2569' },
      { key: 'sr.workType',    label: 'ประเภทงาน',           table: 'serviceReports', group: 'serviceReports', fieldType: 'text', neutralValue: 'installation' },
      { key: 'sr.title',       label: 'หัวข้องาน',           table: 'serviceReports', group: 'serviceReports', fieldType: 'text', neutralValue: 'ติดตั้งระบบ Network' },
      { key: 'sr.description', label: 'รายละเอียดงาน',       table: 'serviceReports', group: 'serviceReports', fieldType: 'text', neutralValue: 'ติดตั้งและ Config Switch ชั้น 3' },
      { key: 'sr.signedByName',label: 'ผู้รับมอบงาน',        table: 'serviceReports', group: 'serviceReports', fieldType: 'text', neutralValue: 'คุณวิเชียร ผู้จัดการ' },
    ],
  },
};

// รวม fields ทั้งหมดเป็น flat array (Backward compatible)
export const availableVariables: BindingVariable[] = Object.values(DB_TABLES).flatMap(t => t.fields);

// ดึง fields ตาม table
export const getFieldsByTable = (tableKey: string): BindingVariable[] =>
  DB_TABLES[tableKey]?.fields ?? [];

// สร้าง neutral preview data object
export const getNeutralData = (): Record<string, string> =>
  Object.fromEntries(availableVariables.map(v => [v.key, v.neutralValue]));

// แทนค่า variable ใน HTML string
export const bindData = (text: string, data?: Record<string, any>): string => {
  if (!text) return '';
  return text.replace(/\{([\w.]+)\}/g, (match, key) => {
    if (data && data[key] !== undefined) return data[key];
    const variable = availableVariables.find(v => v.key === key);
    return variable ? variable.neutralValue : match;
  });
};
