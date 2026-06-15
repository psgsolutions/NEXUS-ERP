// =============================================
// document-builder — Mock Database (จำลอง MS Access)
// =============================================

// ตาราง: ลูกค้า (Customers)
export const customers = [
  {
    id: 'CUST-001',
    name: 'บริษัท เอบีซี จำกัด',
    address: '123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    phone: '02-123-4567',
    taxId: '0105512345678',
    email: 'contact@abc.co.th',
    contact: 'คุณสมศักดิ์ รักงาน',
  },
  {
    id: 'CUST-002',
    name: 'ห้างหุ้นส่วน สมปอง ขายส่ง',
    address: '45/6 หมู่ 3 ต.บางปลา อ.บางพลี จ.สมุทรปราการ 10540',
    phone: '081-999-8888',
    taxId: '1100555999888',
    email: 'sompong@wholesale.co.th',
    contact: 'คุณสมปอง มีทรัพย์',
  },
  {
    id: 'CUST-003',
    name: 'โรงพยาบาลรักษ์ดี',
    address: '789 ถ.พหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400',
    phone: '02-777-6666',
    taxId: '0105577766666',
    email: 'procurement@rakdee.or.th',
    contact: 'คุณสุมาลี ใจดี',
  },
  {
    id: 'CUST-004',
    name: 'บริษัท สมาร์ทเทคโนโลยี จำกัด (มหาชน)',
    address: '999 อาคารสินทรัพย์ ถ.พระราม 9 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310',
    phone: '02-555-0001',
    taxId: '0107556789012',
    email: 'finance@smarttech.co.th',
    contact: 'คุณวิชัย นวัตกรรม',
  },
];

// ตาราง: สินค้า/บริการ (Products)
export const products = [
  { id: 'PRD-001', name: 'ซอฟต์แวร์ระบบ ERP', unit: 'License', price: 50000 },
  { id: 'PRD-002', name: 'บริการติดตั้งและอบรม', unit: 'ครั้ง', price: 15000 },
  { id: 'PRD-003', name: 'บริการบำรุงรักษารายปี', unit: 'ปี', price: 25000 },
  { id: 'PRD-004', name: 'อุปกรณ์เซิร์ฟเวอร์', unit: 'ชุด', price: 120000 },
  { id: 'PRD-005', name: 'บริการสนับสนุนทางเทคนิค', unit: 'ชั่วโมง', price: 2500 },
];

// ตาราง: เอกสารที่บันทึกแล้ว (Documents)
let savedDocuments = [];

// =============================================
// Database Query Functions (จำลอง Query)
// =============================================

// SELECT * FROM customers
export const getAllCustomers = async () => {
  return new Promise((resolve) => setTimeout(() => resolve([...customers]), 300));
};

// SELECT * FROM customers WHERE id = ?
export const getCustomerById = async (id) => {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve(customers.find((c) => c.id === id) || null);
    }, 500)
  );
};

// SELECT * FROM products
export const getAllProducts = async () => {
  return new Promise((resolve) => setTimeout(() => resolve([...products]), 200));
};

// INSERT INTO documents (จำลองการบันทึก)
export const saveDocument = async (docData) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newDoc = {
        ...docData,
        savedAt: new Date().toISOString(),
        docId: 'DOC-' + String(savedDocuments.length + 1).padStart(4, '0'),
      };
      savedDocuments.push(newDoc);
      resolve({ success: true, docId: newDoc.docId });
    }, 800);
  });
};

// Generate next document number
export const getNextDocNumber = (type) => {
  const prefix = {
    quotation: 'QT',
    invoice: 'INV',
    purchase_order: 'PO',
    receipt: 'RCT',
  }[type] || 'DOC';
  const year = new Date().getFullYear() + 543;
  const seq = String(savedDocuments.filter((d) => d.docType === type).length + 1).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
};
