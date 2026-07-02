import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Load .env.local manually to avoid dotenv dependency
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();
      // Remove surrounding quotes if they exist
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      // Replace literal \n with actual newline for the private key
      value = value.replace(/\\n/g, '\n');
      process.env[key] = value;
    }
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const companyId = 'COMP-001';

const mockCustomers = [
  { name: 'บริษัท เอ บี ซี จำกัด', contactName: 'สมใจ รักดี', phone: '081-111-1111', email: 'contact@abc.co.th', address: '123 ถ.สุขุมวิท กรุงเทพฯ 10110', industry: 'เทคโนโลยี', taxId: '0105555555551', branch: 'สำนักงานใหญ่', rating: 5, companyId },
  { name: 'บริษัท ไทยเทค ซิสเต็มส์ จำกัด', contactName: 'วิชัย สมหวัง', phone: '082-222-2222', email: 'info@thaitech.co.th', address: '456 ถ.สีลม กรุงเทพฯ 10500', industry: 'การเงิน/ธนาคาร', taxId: '0105555555552', branch: 'สำนักงานใหญ่', rating: 4.5, companyId },
  { name: 'โรงพยาบาลภูมิพล', contactName: 'นพ.สมชาย ใจดี', phone: '083-333-3333', email: 'admin@bhumibol.go.th', address: '789 ถ.พหลโยธิน กรุงเทพฯ 10220', industry: 'การแพทย์/สาธารณสุข', taxId: '0105555555553', branch: 'สำนักงานใหญ่', rating: 5, companyId },
  { name: 'มหาวิทยาลัยเทคโนโลยีมหานคร', contactName: 'ดร.สมศรี มีสุข', phone: '084-444-4444', email: 'contact@mut.ac.th', address: '140 ถ.เชื่อมสัมพันธ์ กรุงเทพฯ 10530', industry: 'การศึกษา', taxId: '0105555555554', branch: 'สำนักงานใหญ่', rating: 4.5, companyId },
  { name: 'ห้างสรรพสินค้าเซ็นทรัล', contactName: 'สมหญิง ยิ่งใหญ่', phone: '085-555-5555', email: 'info@central.co.th', address: '1027 ถ.เพลินจิต กรุงเทพฯ 10330', industry: 'ค้าปลีก/ค้าส่ง', taxId: '0105555555555', branch: 'สำนักงานใหญ่', rating: 5, companyId },
  { name: 'บริษัท แอดวานซ์ ไอที จำกัด', contactName: 'สมชาย ไอที', phone: '086-666-6666', email: 'contact@advance.co.th', address: '99 ถ.พระราม 9 กรุงเทพฯ 10310', industry: 'เทคโนโลยี', taxId: '0105555555556', branch: 'สำนักงานใหญ่', rating: 4, companyId },
  { name: 'เทศบาลนครปฐม', contactName: 'สมปอง นครปฐม', phone: '087-777-7777', email: 'admin@nakhonpathom.go.th', address: '1 ถ.ราชดำเนิน นครปฐม 73000', industry: 'ราชการ/รัฐวิสาหกิจ', taxId: '0105555555557', branch: 'สำนักงานใหญ่', rating: 4.5, companyId },
  { name: 'บริษัท สยามเน็ตเวิร์ค จำกัด', contactName: 'สมศักดิ์ เน็ตเวิร์ค', phone: '088-888-8888', email: 'info@siamnetwork.co.th', address: '88 ถ.วิภาวดี กรุงเทพฯ 10900', industry: 'เทคโนโลยี', taxId: '0105555555558', branch: 'สำนักงานใหญ่', rating: 5, companyId },
  { name: 'ธนาคารกรุงศรีอยุธยา', contactName: 'สมบูรณ์ แบงก์', phone: '089-999-9999', email: 'contact@krungsri.com', address: '1222 ถ.พระราม 3 กรุงเทพฯ 10120', industry: 'การเงิน/ธนาคาร', taxId: '0105555555559', branch: 'สำนักงานใหญ่', rating: 5, companyId },
  { name: 'สถาบันวิจัยวิทยาศาสตร์', contactName: 'ดร.สมหมาย วิจัย', phone: '090-000-0000', email: 'info@tistr.or.th', address: '35 ถ.คลองหลวง ปทุมธานี 12120', industry: 'วิจัย/พัฒนา', taxId: '0105555555560', branch: 'สำนักงานใหญ่', rating: 4.5, companyId }
];

const mockProducts = [
  // Network
  { name: 'Cisco Switch 24-port (C9200L-24P-4G)', category: 'Network', brand: 'Cisco', model: 'C9200L', unit: 'เครื่อง', price: 45000, cost: 35000, stock: 15, minStock: 5, companyId, sku: 'NET-001' },
  { name: 'MikroTik RouterBoard (RB4011)', category: 'Network', brand: 'MikroTik', model: 'RB4011', unit: 'เครื่อง', price: 8500, cost: 6500, stock: 20, minStock: 5, companyId, sku: 'NET-002' },
  { name: 'Cat6 UTP Cable Box 305m', category: 'Network', brand: 'Link', model: 'US-9106', unit: 'กล่อง', price: 3500, cost: 2500, stock: 50, minStock: 10, companyId, sku: 'NET-003' },
  // Hardware
  { name: 'Dell PowerEdge R740 Server', category: 'Hardware', brand: 'Dell', model: 'R740', unit: 'เครื่อง', price: 120000, cost: 95000, stock: 5, minStock: 2, companyId, sku: 'HW-001' },
  { name: 'HP ProLiant DL380 Gen10', category: 'Hardware', brand: 'HP', model: 'DL380', unit: 'เครื่อง', price: 135000, cost: 105000, stock: 4, minStock: 2, companyId, sku: 'HW-002' },
  { name: 'Synology NAS DS920+', category: 'Hardware', brand: 'Synology', model: 'DS920+', unit: 'เครื่อง', price: 22000, cost: 18000, stock: 10, minStock: 3, companyId, sku: 'HW-003' },
  // CCTV
  { name: 'Hikvision 2MP IP Camera', category: 'CCTV', brand: 'Hikvision', model: 'DS-2CD2021G1', unit: 'ตัว', price: 2500, cost: 1500, stock: 100, minStock: 20, companyId, sku: 'CCTV-001' },
  { name: 'Dahua 16-channel NVR', category: 'CCTV', brand: 'Dahua', model: 'NVR4216', unit: 'เครื่อง', price: 8900, cost: 6500, stock: 12, minStock: 3, companyId, sku: 'CCTV-002' },
  { name: 'Seagate SkyHawk 4TB HDD', category: 'CCTV', brand: 'Seagate', model: 'ST4000VX007', unit: 'ลูก', price: 3800, cost: 2900, stock: 40, minStock: 10, companyId, sku: 'CCTV-003' },
  // Software
  { name: 'Windows Server 2022 Standard', category: 'Software', brand: 'Microsoft', model: 'WS2022', unit: 'License', price: 35000, cost: 28000, stock: 999, minStock: 0, companyId, sku: 'SW-001' },
  { name: 'Microsoft 365 Business Standard', category: 'Software', brand: 'Microsoft', model: 'M365', unit: 'License', price: 4200, cost: 3500, stock: 999, minStock: 0, companyId, sku: 'SW-002' },
  { name: 'Bitdefender GravityZone', category: 'Software', brand: 'Bitdefender', model: 'GravityZone', unit: 'License', price: 1500, cost: 900, stock: 999, minStock: 0, companyId, sku: 'SW-003' },
  // Accessories
  { name: 'APC UPS 1000VA / 600W', category: 'Accessories', brand: 'APC', model: 'BV1000I-MS', unit: 'เครื่อง', price: 3200, cost: 2400, stock: 25, minStock: 5, companyId, sku: 'ACC-001' },
  { name: 'HDMI Cable 4K 5m', category: 'Accessories', brand: 'UGREEN', model: 'HD104', unit: 'เส้น', price: 450, cost: 250, stock: 80, minStock: 20, companyId, sku: 'ACC-002' },
  { name: 'Server Rack 42U', category: 'Accessories', brand: '19" Germany', model: 'G3', unit: 'ตู้', price: 18500, cost: 14000, stock: 8, minStock: 2, companyId, sku: 'ACC-003' }
];

const mockContractors = [
  { name: 'ทีมช่างสมชาย (เดินสาย LAN)', contactName: 'สมชาย ขยันดี', phone: '081-234-5678', rating: 4.8, address: '11 ถ.รามคำแหง กทม.', bankName: 'กสิกรไทย (KBANK)', bankAccount: '123-4-56789-0', paymentTerms: 15, companyId, isActive: true },
  { name: 'บริษัท สมาร์ทซิสเท็ม จำกัด', contactName: 'สมฤดี สมาร์ท', phone: '082-345-6789', rating: 4.5, address: '22 ถ.ลาดพร้าว กทม.', bankName: 'ไทยพาณิชย์ (SCB)', bankAccount: '234-5-67890-1', paymentTerms: 30, companyId, isActive: true },
  { name: 'ช่างวิชาญ การไฟฟ้า', contactName: 'วิชาญ สว่างไสว', phone: '083-456-7890', rating: 4.9, address: '33 ถ.สุขุมวิท กทม.', bankName: 'กรุงเทพ (BBL)', bankAccount: '345-6-78901-2', paymentTerms: 7, companyId, isActive: true },
  { name: 'ทีมนครินทร์ (Server Setup)', contactName: 'นครินทร์ เทพบุตร', phone: '084-567-8901', rating: 5.0, address: '44 ถ.พหลโยธิน กทม.', bankName: 'กรุงไทย (KTB)', bankAccount: '456-7-89012-3', paymentTerms: 15, companyId, isActive: true },
  { name: 'บริษัท เพอร์เฟกต์ โซลูชั่น จำกัด', contactName: 'เพอร์เฟกต์ โซลูชั่น', phone: '085-678-9012', rating: 4.2, address: '55 ถ.พระราม 9 กทม.', bankName: 'กรุงศรีอยุธยา (BAY)', bankAccount: '567-8-90123-4', paymentTerms: 30, companyId, isActive: true }
];

const mockEmployees = [
  { employeeId: 'EMP-001', name: 'สมพงษ์ ยอดเยี่ยม', position: 'Project Manager', department: 'Project Management', phone: '089-111-2222', email: 'sompong@nexus.local', type: 'permanent', status: 'active', companyId },
  { employeeId: 'EMP-002', name: 'วลัยภรณ์ รักดี', position: 'Senior Sales', department: 'Sales', phone: '089-222-3333', email: 'walaiporn@nexus.local', type: 'permanent', status: 'active', companyId },
  { employeeId: 'EMP-003', name: 'กิตติศักดิ์ แก้วใส', position: 'System Engineer', department: 'Engineering', phone: '089-333-4444', email: 'kittisak@nexus.local', type: 'permanent', status: 'active', companyId },
  { employeeId: 'EMP-004', name: 'พรพรรณ แจ่มฟ้า', position: 'Accountant', department: 'Finance', phone: '089-444-5555', email: 'pornpan@nexus.local', type: 'permanent', status: 'active', companyId },
  { employeeId: 'EMP-005', name: 'นพดล ใจกว้าง', position: 'IT Technician', department: 'Support', phone: '089-555-6666', email: 'noppadon@nexus.local', type: 'contract', status: 'active', companyId }
];

async function seedData() {
  console.log('🌱 Starting database seed...');
  
  try {
    // Seed Customers
    console.log('Seeding Customers...');
    const custRef = db.collection('companies').doc(companyId).collection('customers');
    const rootCustRef = db.collection('customers');
    for (const item of mockCustomers) {
      await custRef.add({ ...item, createdAt: new Date() });
      await rootCustRef.add({ ...item, createdAt: new Date() });
    }
    
    // Seed Products
    console.log('Seeding Products...');
    const prodRef = db.collection('products');
    for (const item of mockProducts) {
      await prodRef.add({ ...item, createdAt: new Date() });
    }

    // Seed Contractors
    console.log('Seeding Contractors...');
    const contRef = db.collection('contractors');
    for (const item of mockContractors) {
      await contRef.add({ ...item, createdAt: new Date() });
    }

    // Seed Employees
    console.log('Seeding Employees...');
    const empRef = db.collection('employees');
    for (const item of mockEmployees) {
      await empRef.add({ ...item, createdAt: new Date() });
    }

    console.log('✅ Seed complete!');
  } catch (err) {
    console.error('❌ Error seeding data:', err);
  }
}

seedData();
