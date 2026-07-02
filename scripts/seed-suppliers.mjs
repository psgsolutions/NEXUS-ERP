import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

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

function getPrefix(prefix, index) {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const runningNum = String(index).padStart(4, "0"); // 4 digits
  return `${prefix}-${yy}${mm}-${runningNum}`;
}

async function seedSuppliers() {
  const compId = 'COM-NEXUS-01';
  console.log('Seeding 5 Suppliers...');

  const now = new Date();
  const dateTag = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const mockSuppliers = [
    {
      name: "บริษัท แอดวานซ์ เน็ตเวิร์ค โซลูชั่น จำกัด",
      business_type: "IT & NETWORKING",
      tax_id: "0105558123456",
      phone: "021234567",
      email: "contact@advancenet.co.th",
      address_detail: "123 อาคารสาทรธานี ชั้น 15 ถนนสาทรใต้",
      province: "กรุงเทพมหานคร",
      zipCode: "10120",
      contact_person: "สมศักดิ์ วงศ์สว่าง",
      payment_term: "30 Days",
      payment_method: "TRANSFER",
      bank_name: "ธนาคารกสิกรไทย (KBANK)",
      account_number: "0123456789",
      account_name: "บจก. แอดวานซ์ เน็ตเวิร์ค",
      rating: 5,
    },
    {
      name: "หจก. ออฟฟิศ ซัพพลาย แอนด์ เซอร์วิส",
      business_type: "OFFICE SUPPLIES",
      tax_id: "0103554987654",
      phone: "029876543",
      email: "sales@officesupply.co.th",
      address_detail: "45/2 ถนนรามคำแหง แขวงหัวหมาก",
      province: "กรุงเทพมหานคร",
      zipCode: "10240",
      contact_person: "วิภาดา รักดี",
      payment_term: "15 Days",
      payment_method: "TRANSFER",
      bank_name: "ธนาคารไทยพาณิชย์ (SCB)",
      account_number: "9876543210",
      account_name: "หจก. ออฟฟิศ ซัพพลาย",
      rating: 4,
    },
    {
      name: "บริษัท ฮาร์ดแวร์ เทค ซิสเต็มส์ จำกัด",
      business_type: "HARDWARE",
      tax_id: "0105561112233",
      phone: "025556677",
      email: "info@hardwaretech.co.th",
      address_detail: "88/9 นิคมอุตสาหกรรมลาดกระบัง",
      province: "กรุงเทพมหานคร",
      zipCode: "10520",
      contact_person: "ชัยณรงค์ มั่นคง",
      payment_term: "60 Days",
      payment_method: "CHEQUE",
      cheque_documents: "ใบเสร็จรับเงิน, หนังสือรับรอง",
      cheque_pickup_day: "ทุกวันศุกร์",
      cheque_pickup_time: "13:00 - 16:00",
      rating: 5,
    },
    {
      name: "บริษัท สมาร์ท คลาวด์ คอร์ปอเรชั่น จำกัด",
      business_type: "SOFTWARE",
      tax_id: "0105562445566",
      phone: "021112233",
      email: "billing@smartcloud.com",
      address_detail: "9 อาคารจีทาวเวอร์ ชั้น 20 ถนนพระราม 9",
      province: "กรุงเทพมหานคร",
      zipCode: "10310",
      contact_person: "อนันต์ ทองสุข",
      payment_term: "30 Days",
      payment_method: "TRANSFER",
      bank_name: "ธนาคารกรุงเทพ (BBL)",
      account_number: "1112223334",
      account_name: "บจก. สมาร์ท คลาวด์",
      rating: 5,
    },
    {
      name: "บริษัท ดาต้า คอมมิวนิเคชั่น จำกัด",
      business_type: "TELECOM",
      tax_id: "0105553778899",
      phone: "024445566",
      email: "finance@datacom.co.th",
      address_detail: "77 ถนนเพชรบุรีตัดใหม่ แขวงบางกะปิ",
      province: "กรุงเทพมหานคร",
      zipCode: "10310",
      contact_person: "สุดาพร ใจดี",
      payment_term: "Cash",
      payment_method: "CASH",
      rating: 3,
    }
  ];

  let seqStart = 1;
  const prefix = 'SUP';
  
  // Try to read existing counter
  const counterRef = db.collection('companies').doc(compId).collection('counters').doc(prefix);
  const counterDoc = await counterRef.get();
  
  if (counterDoc.exists) {
    const data = counterDoc.data();
    if (data.lastDate === dateTag) {
      seqStart = data.lastSeq + 1;
    }
  }

  const batch = db.batch();
  let currentSeq = seqStart;

  for (const supplier of mockSuppliers) {
    const supId = getPrefix(prefix, currentSeq);
    const docRef = db.collection('suppliers').doc(supId);
    batch.set(docRef, {
      ...supplier,
      id: supId,
      supplierId: supId,
      companyId: compId,
      isDeleted: false,
      createdBy: 'SYSTEM_SEED',
      createdAt: new Date().toISOString()
    });
    console.log(`Prepared Supplier: ${supId} - ${supplier.name}`);
    currentSeq++;
  }

  // Update counter
  const maxSeq = currentSeq - 1;
  batch.set(counterRef, {
    lastSeq: maxSeq,
    lastDate: dateTag,
    updatedAt: new Date()
  }, { merge: true });
  console.log(`Updating ${prefix} counter to ${maxSeq}`);

  await batch.commit();
  console.log('Successfully seeded 5 suppliers!');
  process.exit(0);
}

seedSuppliers().catch(console.error);
