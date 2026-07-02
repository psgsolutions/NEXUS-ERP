import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
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

const products = [
  // หมวดไฟฟ้า (Electrical)
  { name: 'สายไฟ THW 1x1.5 sq.mm', category: 'Electrical', brand: 'Yazaki', model: 'THW 1.5', unit: 'ม้วน', price: 650, cost: 500, stock: 100, minStock: 20, companyId, sku: 'ELEC-001' },
  { name: 'สายไฟ VAF 2x2.5 sq.mm', category: 'Electrical', brand: 'BCC', model: 'VAF 2.5', unit: 'ม้วน', price: 1200, cost: 950, stock: 50, minStock: 10, companyId, sku: 'ELEC-002' },
  { name: 'เบรกเกอร์ 2P 20A', category: 'Electrical', brand: 'Panasonic', model: 'BS2020', unit: 'ตัว', price: 150, cost: 110, stock: 200, minStock: 50, companyId, sku: 'ELEC-003' },
  { name: 'ตู้คอนซูมเมอร์ 6 ช่อง', category: 'Electrical', brand: 'Schneider', model: 'Square D', unit: 'ตู้', price: 1800, cost: 1400, stock: 15, minStock: 5, companyId, sku: 'ELEC-004' },
  { name: 'หลอดไฟ LED 18W T8', category: 'Electrical', brand: 'Philips', model: 'EcoFit', unit: 'หลอด', price: 95, cost: 65, stock: 500, minStock: 100, companyId, sku: 'ELEC-005' },
  { name: 'สวิตช์ทางเดียว', category: 'Electrical', brand: 'Panasonic', model: 'Wide Series', unit: 'ตัว', price: 35, cost: 25, stock: 300, minStock: 100, companyId, sku: 'ELEC-006' },
  { name: 'เต้ารับคู่มีกราวด์', category: 'Electrical', brand: 'Panasonic', model: 'Wide Series', unit: 'ตัว', price: 120, cost: 85, stock: 250, minStock: 50, companyId, sku: 'ELEC-007' },
  { name: 'ท่อร้อยสายไฟ PVC ขาว 20mm', category: 'Electrical', brand: 'SCG', model: 'PVC White', unit: 'เส้น', price: 45, cost: 32, stock: 1000, minStock: 200, companyId, sku: 'ELEC-008' },
  { name: 'เทปพันเกลียว', category: 'Electrical', brand: '3M', model: 'Temflex', unit: 'ม้วน', price: 20, cost: 12, stock: 400, minStock: 100, companyId, sku: 'ELEC-009' },
  { name: 'โคมไฟดาวน์ไลท์ 4 นิ้ว', category: 'Electrical', brand: 'Eve', model: 'Downlight 4"', unit: 'โคม', price: 150, cost: 100, stock: 100, minStock: 20, companyId, sku: 'ELEC-010' },

  // หมวด IT (IT)
  { name: 'Dell OptiPlex 7000 Desktop', category: 'IT', brand: 'Dell', model: 'OptiPlex', unit: 'เครื่อง', price: 25000, cost: 20000, stock: 20, minStock: 5, companyId, sku: 'IT-001' },
  { name: 'Lenovo ThinkPad E14', category: 'IT', brand: 'Lenovo', model: 'ThinkPad', unit: 'เครื่อง', price: 28000, cost: 23000, stock: 15, minStock: 3, companyId, sku: 'IT-002' },
  { name: 'Monitor LG 24" IPS', category: 'IT', brand: 'LG', model: '24MP400', unit: 'จอ', price: 3500, cost: 2800, stock: 40, minStock: 10, companyId, sku: 'IT-003' },
  { name: 'Logitech Wireless Mouse', category: 'IT', brand: 'Logitech', model: 'M185', unit: 'ตัว', price: 390, cost: 250, stock: 100, minStock: 20, companyId, sku: 'IT-004' },
  { name: 'Keyboard USB Standard', category: 'IT', brand: 'Dell', model: 'KB216', unit: 'ตัว', price: 450, cost: 300, stock: 80, minStock: 15, companyId, sku: 'IT-005' },
  { name: 'External HDD 1TB', category: 'IT', brand: 'WD', model: 'My Passport', unit: 'ลูก', price: 1500, cost: 1100, stock: 30, minStock: 5, companyId, sku: 'IT-006' },
  { name: 'UPS APC 500VA', category: 'IT', brand: 'APC', model: 'BX500CI', unit: 'เครื่อง', price: 1800, cost: 1400, stock: 25, minStock: 5, companyId, sku: 'IT-007' },
  { name: 'Printer HP LaserJet Pro', category: 'IT', brand: 'HP', model: 'M15w', unit: 'เครื่อง', price: 3200, cost: 2600, stock: 10, minStock: 2, companyId, sku: 'IT-008' },
  { name: 'Flash Drive 64GB', category: 'IT', brand: 'SanDisk', model: 'Cruzer Blade', unit: 'ชิ้น', price: 250, cost: 150, stock: 200, minStock: 50, companyId, sku: 'IT-009' },
  { name: 'Docking Station USB-C', category: 'IT', brand: 'Ugreen', model: 'Revodok', unit: 'ตัว', price: 1200, cost: 800, stock: 15, minStock: 5, companyId, sku: 'IT-010' },

  // หมวด CCTV (CCTV)
  { name: 'กล้องวงจรปิด Bullet 2MP', category: 'CCTV', brand: 'Hikvision', model: 'DS-2CE16D0T', unit: 'ตัว', price: 800, cost: 500, stock: 150, minStock: 30, companyId, sku: 'CCTV-011' },
  { name: 'กล้องวงจรปิด Dome 2MP', category: 'CCTV', brand: 'Dahua', model: 'HAC-HDW1220R', unit: 'ตัว', price: 750, cost: 480, stock: 120, minStock: 30, companyId, sku: 'CCTV-012' },
  { name: 'NVR 8-channel PoE', category: 'CCTV', brand: 'Hikvision', model: 'DS-7608NI-K1/8P', unit: 'เครื่อง', price: 5500, cost: 4200, stock: 20, minStock: 5, companyId, sku: 'CCTV-013' },
  { name: 'สาย RG6 Power + สลิง', category: 'CCTV', brand: 'Link', model: 'RG6-Power-Sling', unit: 'ม้วน', price: 2800, cost: 2100, stock: 15, minStock: 3, companyId, sku: 'CCTV-014' },
  { name: 'Balun 8MP', category: 'CCTV', brand: 'OEM', model: 'BL-8MP', unit: 'คู่', price: 150, cost: 80, stock: 300, minStock: 50, companyId, sku: 'CCTV-015' },
  { name: 'HDD Surveillance 2TB', category: 'CCTV', brand: 'WD', model: 'Purple', unit: 'ลูก', price: 2200, cost: 1700, stock: 40, minStock: 10, companyId, sku: 'CCTV-016' },
  { name: 'Power Supply 12V 10A', category: 'CCTV', brand: 'OEM', model: 'PS-12V10A', unit: 'กล่อง', price: 450, cost: 300, stock: 80, minStock: 20, companyId, sku: 'CCTV-017' },
  { name: 'กล้อง IP PTZ 4MP', category: 'CCTV', brand: 'Dahua', model: 'SD49425XB-HNR', unit: 'ตัว', price: 15000, cost: 11000, stock: 5, minStock: 1, companyId, sku: 'CCTV-018' },
  { name: 'กล่องกันน้ำ 4x4', category: 'CCTV', brand: 'Nano', model: 'Waterproof 4x4', unit: 'กล่อง', price: 35, cost: 20, stock: 500, minStock: 100, companyId, sku: 'CCTV-019' },
  { name: 'ขายึดกล้องอลูมิเนียม', category: 'CCTV', brand: 'OEM', model: 'Bracket-L', unit: 'อัน', price: 120, cost: 70, stock: 100, minStock: 20, companyId, sku: 'CCTV-020' },

  // หมวด Network (Network)
  { name: 'สาย LAN Cat6 UTP (Indoor)', category: 'Network', brand: 'Link', model: 'US-9106', unit: 'กล่อง', price: 3500, cost: 2600, stock: 40, minStock: 10, companyId, sku: 'NET-011' },
  { name: 'Switch PoE 8-port Gigabit', category: 'Network', brand: 'TP-Link', model: 'TL-SG108PE', unit: 'ตัว', price: 2200, cost: 1600, stock: 25, minStock: 5, companyId, sku: 'NET-012' },
  { name: 'Access Point Wi-Fi 6', category: 'Network', brand: 'Ubiquiti', model: 'U6-Pro', unit: 'ตัว', price: 6500, cost: 5200, stock: 15, minStock: 3, companyId, sku: 'NET-013' },
  { name: 'Router Board Dual Core', category: 'Network', brand: 'MikroTik', model: 'RB750Gr3', unit: 'ตัว', price: 2100, cost: 1500, stock: 30, minStock: 5, companyId, sku: 'NET-014' },
  { name: 'Rack 15U หนา 60cm', category: 'Network', brand: '19" Premium', model: 'Rack 15U', unit: 'ตู้', price: 6500, cost: 4800, stock: 8, minStock: 2, companyId, sku: 'NET-015' },
  { name: 'Patch Panel 24-port Cat6', category: 'Network', brand: 'CommScope', model: 'PP-24', unit: 'แผง', price: 1800, cost: 1200, stock: 20, minStock: 5, companyId, sku: 'NET-016' },
  { name: 'RJ45 Plug Cat6', category: 'Network', brand: 'Link', model: 'US-1002', unit: 'ห่อ', price: 350, cost: 220, stock: 100, minStock: 20, companyId, sku: 'NET-017' },
  { name: 'Fiber Optic Cable 4-core Drop Wire', category: 'Network', brand: 'OFC', model: 'Drop 4C', unit: 'ม้วน', price: 2800, cost: 1900, stock: 10, minStock: 2, companyId, sku: 'NET-018' },
  { name: 'Media Converter 10/100/1000', category: 'Network', brand: 'Netlink', model: 'Gigabit Media', unit: 'คู่', price: 800, cost: 500, stock: 50, minStock: 10, companyId, sku: 'NET-019' },
  { name: 'SFP Module 1.25G Single Mode', category: 'Network', brand: 'OEM', model: 'SFP-1G-SM', unit: 'ตัว', price: 450, cost: 300, stock: 60, minStock: 15, companyId, sku: 'NET-020' },

  // หมวด Access Control (Access Control)
  { name: 'เครื่องสแกนใบหน้าและนิ้วมือ', category: 'Access Control', brand: 'ZKTeco', model: 'MB20', unit: 'เครื่อง', price: 4500, cost: 3200, stock: 20, minStock: 5, companyId, sku: 'ACC-101' },
  { name: 'กลอนแม่เหล็ก 600 lbs', category: 'Access Control', brand: 'HIP', model: 'Magnetic 600', unit: 'ชุด', price: 1200, cost: 800, stock: 40, minStock: 10, companyId, sku: 'ACC-102' },
  { name: 'ปุ่มกดออก (Exit Switch) แบบไม่สัมผัส', category: 'Access Control', brand: 'HIP', model: 'No-Touch', unit: 'ตัว', price: 350, cost: 200, stock: 80, minStock: 20, companyId, sku: 'ACC-103' },
  { name: 'บัตร Proximity 125KHz', category: 'Access Control', brand: 'OEM', model: 'Thick Card', unit: 'ใบ', price: 15, cost: 8, stock: 2000, minStock: 500, companyId, sku: 'ACC-104' },
  { name: 'Power Supply พร้อมแบต 12V 7Ah', category: 'Access Control', brand: 'OEM', model: 'UPS Box', unit: 'ชุด', price: 1800, cost: 1300, stock: 25, minStock: 5, companyId, sku: 'ACC-105' },
  { name: 'ขาจับกระจกตัว U (U-Bracket)', category: 'Access Control', brand: 'OEM', model: 'U-Bracket', unit: 'อัน', price: 450, cost: 300, stock: 50, minStock: 10, companyId, sku: 'ACC-106' },
  { name: 'LZ Bracket สำหรับแม่เหล็ก 600lbs', category: 'Access Control', brand: 'OEM', model: 'LZ-600', unit: 'ชุด', price: 500, cost: 350, stock: 40, minStock: 10, companyId, sku: 'ACC-107' },
  { name: 'กริ่งประตูไร้สาย', category: 'Access Control', brand: 'Panasonic', model: 'Wireless Doorbell', unit: 'ชุด', price: 850, cost: 600, stock: 30, minStock: 10, companyId, sku: 'ACC-108' },
  { name: 'บัตร Mifare 13.56MHz', category: 'Access Control', brand: 'OEM', model: 'Mifare Card', unit: 'ใบ', price: 20, cost: 12, stock: 1500, minStock: 300, companyId, sku: 'ACC-109' },
  { name: 'หัวอ่านบัตร Wiegand', category: 'Access Control', brand: 'ZKTeco', model: 'KR500', unit: 'ตัว', price: 800, cost: 550, stock: 20, minStock: 5, companyId, sku: 'ACC-110' },

  // หมวดอิเล็กทรอนิกส์ (Electronics)
  { name: 'Relay Module 5V 4-channel', category: 'Electronics', brand: 'Arduino', model: 'Relay 4CH', unit: 'บอร์ด', price: 120, cost: 70, stock: 50, minStock: 10, companyId, sku: 'ELC-001' },
  { name: 'บอร์ด Microcontroller ESP32', category: 'Electronics', brand: 'Espressif', model: 'ESP32-DevKit', unit: 'บอร์ด', price: 250, cost: 150, stock: 100, minStock: 20, companyId, sku: 'ELC-002' },
  { name: 'Sensor วัดอุณหภูมิและความชื้น', category: 'Electronics', brand: 'DHT', model: 'DHT22', unit: 'ตัว', price: 150, cost: 90, stock: 80, minStock: 20, companyId, sku: 'ELC-003' },
  { name: 'Power Supply Switching 24V 5A', category: 'Electronics', brand: 'Meanwell', model: 'LRS-150-24', unit: 'ตัว', price: 650, cost: 450, stock: 30, minStock: 10, companyId, sku: 'ELC-004' },
  { name: 'สายจัมเปอร์ ผู้-ผู้ 40 เส้น', category: 'Electronics', brand: 'OEM', model: 'Jumper M-M', unit: 'แพ็ค', price: 40, cost: 20, stock: 200, minStock: 50, companyId, sku: 'ELC-005' },
  { name: 'หน้าจอ OLED 0.96 นิ้ว', category: 'Electronics', brand: 'OEM', model: 'OLED 0.96', unit: 'ชิ้น', price: 150, cost: 80, stock: 60, minStock: 15, companyId, sku: 'ELC-006' },
  { name: 'Battery 18650 3.7V 3000mAh', category: 'Electronics', brand: 'Samsung', model: '30Q', unit: 'ก้อน', price: 180, cost: 120, stock: 150, minStock: 30, companyId, sku: 'ELC-007' },
  { name: 'รางถ่าน 18650 2 ก้อน', category: 'Electronics', brand: 'OEM', model: 'Holder 18650x2', unit: 'อัน', price: 30, cost: 15, stock: 200, minStock: 50, companyId, sku: 'ELC-008' },
  { name: 'โมดูลแปลงไฟ Step-down LM2596', category: 'Electronics', brand: 'OEM', model: 'LM2596', unit: 'บอร์ด', price: 45, cost: 25, stock: 100, minStock: 20, companyId, sku: 'ELC-009' },
  { name: 'ตัวต้านทาน 1/4W รวมค่า 600 ตัว', category: 'Electronics', brand: 'OEM', model: 'Resistor Pack', unit: 'แพ็ค', price: 150, cost: 80, stock: 40, minStock: 10, companyId, sku: 'ELC-010' },

  // หมวด Infrastructure (Infrastructure)
  { name: 'ท่อ HDPE ร้อยสายไฟ 50mm', category: 'Infrastructure', brand: 'TGG', model: 'HDPE 50 PN6', unit: 'ม้วน', price: 3500, cost: 2800, stock: 10, minStock: 2, companyId, sku: 'INF-001' },
  { name: 'บ่อพักสายคอนกรีต 40x40', category: 'Infrastructure', brand: 'Local', model: 'Handhole 40', unit: 'บ่อ', price: 800, cost: 550, stock: 20, minStock: 5, companyId, sku: 'INF-002' },
  { name: 'เสาเหล็กชุบกัลวาไนซ์ 4 เมตร', category: 'Infrastructure', brand: 'Local', model: 'Pole 4M HDG', unit: 'ต้น', price: 2500, cost: 1800, stock: 15, minStock: 5, companyId, sku: 'INF-003' },
  { name: 'ท่อเหล็ก EMT 1/2 นิ้ว', category: 'Infrastructure', brand: 'Panasonic', model: 'EMT 1/2"', unit: 'เส้น', price: 120, cost: 85, stock: 300, minStock: 50, companyId, sku: 'INF-004' },
  { name: 'ท่อเหล็ก IMC 3/4 นิ้ว', category: 'Infrastructure', brand: 'Panasonic', model: 'IMC 3/4"', unit: 'เส้น', price: 280, cost: 210, stock: 150, minStock: 30, companyId, sku: 'INF-005' },
  { name: 'Wireway รางวายเวย์ 4x4 นิ้ว', category: 'Infrastructure', brand: 'Local', model: 'Wireway 4x4', unit: 'เส้น', price: 450, cost: 320, stock: 100, minStock: 20, companyId, sku: 'INF-006' },
  { name: 'Cable Tray แลดเดอร์ 300mm', category: 'Infrastructure', brand: 'Local', model: 'Tray 300', unit: 'เส้น', price: 650, cost: 480, stock: 50, minStock: 10, companyId, sku: 'INF-007' },
  { name: 'ปูนซีเมนต์ผสมสำเร็จ 50กก', category: 'Infrastructure', brand: 'SCG', model: 'เสือ', unit: 'ถุง', price: 120, cost: 95, stock: 100, minStock: 20, companyId, sku: 'INF-008' },
  { name: 'อิฐบล็อก', category: 'Infrastructure', brand: 'Local', model: 'Block', unit: 'ก้อน', price: 6, cost: 4, stock: 1000, minStock: 200, companyId, sku: 'INF-009' },
  { name: 'ตู้คอนโทรลกันน้ำ MDB', category: 'Infrastructure', brand: 'Tamlai', model: 'MDB Outdoor', unit: 'ตู้', price: 8500, cost: 6500, stock: 5, minStock: 1, companyId, sku: 'INF-010' },

  // อุปกรณ์งานช่างต่างๆ (Tools)
  { name: 'สว่านไร้สาย 18V', category: 'Tools', brand: 'Makita', model: 'DDF482', unit: 'ชุด', price: 4500, cost: 3200, stock: 10, minStock: 2, companyId, sku: 'TOL-001' },
  { name: 'เครื่องเจียร 4 นิ้ว', category: 'Tools', brand: 'Bosch', model: 'GWS060', unit: 'เครื่อง', price: 1200, cost: 850, stock: 15, minStock: 3, companyId, sku: 'TOL-002' },
  { name: 'มัลติมิเตอร์ดิจิตอล', category: 'Tools', brand: 'Fluke', model: '115', unit: 'เครื่อง', price: 6500, cost: 5200, stock: 5, minStock: 1, companyId, sku: 'TOL-003' },
  { name: 'คีมตัดสายไฟ/ปอกสาย', category: 'Tools', brand: 'Knipex', model: 'Stripper', unit: 'อัน', price: 850, cost: 600, stock: 20, minStock: 5, companyId, sku: 'TOL-004' },
  { name: 'บันไดอลูมิเนียม 7 ฟุต', category: 'Tools', brand: 'Barco', model: 'Step 7', unit: 'อัน', price: 1800, cost: 1300, stock: 12, minStock: 3, companyId, sku: 'TOL-005' },
  { name: 'ชุดไขควงช่างไฟ หุ้มฉนวน 1000V', category: 'Tools', brand: 'Wera', model: 'VDE 7pcs', unit: 'ชุด', price: 1500, cost: 1100, stock: 15, minStock: 3, companyId, sku: 'TOL-006' },
  { name: 'ตลับเมตร 5 เมตร', category: 'Tools', brand: 'Stanley', model: 'Powerlock', unit: 'อัน', price: 250, cost: 150, stock: 40, minStock: 10, companyId, sku: 'TOL-007' },
  { name: 'ปืนกาวแท่งร้อน', category: 'Tools', brand: 'Stanley', model: 'GluePRO', unit: 'กระบอก', price: 350, cost: 220, stock: 25, minStock: 5, companyId, sku: 'TOL-008' },
  { name: 'ระดับน้ำอลูมิเนียม 24 นิ้ว', category: 'Tools', brand: 'Pumpkin', model: 'Level 24', unit: 'อัน', price: 450, cost: 300, stock: 15, minStock: 3, companyId, sku: 'TOL-009' },
  { name: 'กล่องเครื่องมือช่าง', category: 'Tools', brand: 'Dewalt', model: 'T-STAK', unit: 'ใบ', price: 1200, cost: 850, stock: 20, minStock: 5, companyId, sku: 'TOL-010' }
];

async function seedProducts() {
  console.log('🌱 Starting 80 Products seed...');
  try {
    const prodRef = db.collection('products');
    let count = 0;
    for (const item of products) {
      await prodRef.add({ ...item, createdAt: new Date() });
      count++;
    }
    console.log(`✅ Seed complete! Added ${count} products.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
  }
}

seedProducts();
