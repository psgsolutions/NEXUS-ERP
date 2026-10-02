/**
 * ข้อมูลตัวอย่างงานขายในฐานข้อมูลจริง (ไม่ลงบัญชี, ไม่ใช้เลขรันจริง)
 * ทุกเอกสารมี isSample: true และเลขเอกสารขึ้นต้น "SAMPLE-" ใช้ ID คงที่ รันซ้ำได้ไม่ซ้ำ
 *
 *   node scripts/seed-sales-samples.js            ดูรายการที่จะสร้าง (ไม่เขียน)
 *   node scripts/seed-sales-samples.js --apply    สร้าง/อัปเดตข้อมูลตัวอย่าง
 *   node scripts/seed-sales-samples.js --delete   ลบข้อมูลตัวอย่างทั้งหมด (isSample: true)
 */
const path = require('path');
const root = path.join(__dirname, '..');
require('@next/env').loadEnvConfig(root);
const admin = require('firebase-admin');

const COMPANY_ID = process.env.SAMPLE_COMPANY_ID || 'COM-NEXUS-01';
const MODE = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--delete') ? 'delete' : 'dry-run';
const COLLECTIONS = ['invoices', 'billing_notes', 'receipts', 'cndn', 'opportunities'];

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const companyPath = `companies/${COMPANY_ID}`;

const iso = (d) => d.toISOString().split('T')[0];
const daysFrom = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const round2 = (n) => Math.round(n * 100) / 100;

async function buildSamples() {
  const customers = (await db.collection(`${companyPath}/customers`).limit(3).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  if (customers.length === 0) throw new Error(`ไม่พบลูกค้าใน ${companyPath}/customers`);
  const products = (await db.collection('products').where('companyId', '==', COMPANY_ID).limit(3).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  if (products.length === 0) throw new Error(`ไม่พบสินค้าของ ${COMPANY_ID}`);

  const cust = (i) => customers[i % customers.length];
  const custName = (c) => c.name || c.customerName || c.id;
  const priceOf = (p) => Number(p.pricing?.priceProject ?? p.pricing?.pricePOS ?? p.sellingPrice ?? p.price ?? 1000) || 1000;
  const line = (p, qty) => ({
    id: `${p.id}-${qty}`, productId: p.id, sku: p.sku || p.productCode || p.id, name: p.name || p.productName || p.id,
    unit: p.unit || 'ชิ้น', qty, price: priceOf(p), itemType: 'PRODUCT',
  });
  const totals = (items) => {
    const subTotal = round2(items.reduce((s, it) => s + it.qty * it.price, 0));
    const vatAmount = round2(subTotal * 0.07);
    return { subTotal, vatAmount, grandTotal: round2(subTotal + vatAmount) };
  };
  const base = {
    companyId: COMPANY_ID, isSample: true, isDeleted: false,
    createdBy: 'SAMPLE_SEED', updatedBy: 'SAMPLE_SEED',
    remarks: '[ตัวอย่าง] ข้อมูลทดสอบ ไม่ได้ลงบัญชี ลบได้ด้วย scripts/seed-sales-samples.js --delete',
  };
  const today = new Date();
  const out = [];

  // ใบแจ้งหนี้ / ใบกำกับภาษี 3 ใบ: ชำระแล้ว 1, รอชำระ 1, เกินกำหนด 1
  const invDefs = [
    { n: 1, c: 0, items: [line(products[0], 2)], issued: -40, term: 30, paid: true },
    { n: 2, c: 1, items: [line(products[1 % products.length], 1), line(products[2 % products.length], 3)], issued: -10, term: 30, paid: false },
    { n: 3, c: 2, items: [line(products[0], 5)], issued: -50, term: 30, paid: false },
  ];
  const invoices = invDefs.map((d) => {
    const c = cust(d.c);
    const t = totals(d.items);
    const no = `SAMPLE-INV-${String(d.n).padStart(3, '0')}`;
    const issueDate = daysFrom(today, d.issued);
    return {
      col: 'invoices', id: `sample-inv-${d.n}`,
      data: {
        ...base, invoiceNo: no, invoiceId: no, docNumber: no, orderRefNo: '-',
        customerId: c.id, customerName: custName(c),
        customerSnapshot: { name: custName(c), taxId: c.taxId || '', address: c.address || '' },
        issueDate: iso(issueDate), dueDate: iso(daysFrom(issueDate, d.term)),
        items: d.items, ...t, vatType: 'Exclude VAT', isVatRegistered: true,
        paymentStatus: d.paid ? 'paid' : 'unpaid', status: 'issued',
      },
    };
  });
  out.push(...invoices);

  // ใบวางบิล 2 ใบ (สำหรับใบแจ้งหนี้ที่ยังไม่ชำระ)
  invoices.filter((i) => i.data.paymentStatus === 'unpaid').forEach((inv, idx) => {
    const no = `SAMPLE-BN-${String(idx + 1).padStart(3, '0')}`;
    out.push({
      col: 'billing_notes', id: `sample-bn-${idx + 1}`,
      data: {
        ...base, billingNoteNo: no, docNumber: no, invoiceRefNo: inv.data.invoiceNo,
        customerId: inv.data.customerId, customerName: inv.data.customerName,
        issueDate: inv.data.issueDate, dueDate: inv.data.dueDate, totalAmount: inv.data.grandTotal, status: 'issued',
      },
    });
  });

  // ใบเสร็จ 1 ใบ (สำหรับใบแจ้งหนี้ที่ชำระแล้ว)
  const paidInv = invoices.find((i) => i.data.paymentStatus === 'paid');
  out.push({
    col: 'receipts', id: 'sample-rc-1',
    data: {
      ...base, receiptNo: 'SAMPLE-RC-001', docNumber: 'SAMPLE-RC-001', invoiceNo: paidInv.data.invoiceNo,
      customerId: paidInv.data.customerId, customerName: paidInv.data.customerName,
      paymentDate: iso(daysFrom(today, -12)), amount: paidInv.data.grandTotal, paymentMethod: 'transfer',
    },
  });

  // ใบลดหนี้ 1 ใบ (คืนสินค้าบางส่วนจากใบแจ้งหนี้ที่ 2)
  const cnInv = invoices[1];
  const cnSub = round2(cnInv.data.items[0].price);
  out.push({
    col: 'cndn', id: 'sample-cn-1',
    data: {
      ...base, documentNo: 'SAMPLE-CN-001', type: 'CN', invoiceRefNo: cnInv.data.invoiceNo,
      customerId: cnInv.data.customerId, customerName: cnInv.data.customerName,
      issueDate: iso(daysFrom(today, -5)), reason: 'คืนสินค้าชำรุด 1 หน่วย',
      subTotal: cnSub, vatAmount: round2(cnSub * 0.07), totalAmount: round2(cnSub * 1.07), status: 'active',
    },
  });

  // โอกาสขาย 3 รายการ
  [
    { c: 0, value: 450000, score: 82, sentiment: 'Positive', next: 'นัดสาธิตระบบ' },
    { c: 1, value: 1200000, score: 64, sentiment: 'Neutral', next: 'ส่งใบเสนอราคาฉบับแก้ไข' },
    { c: 2, value: 280000, score: 35, sentiment: 'Negative', next: 'ติดตามงบประมาณไตรมาสหน้า' },
  ].forEach((o, idx) => {
    const c = cust(o.c);
    out.push({
      col: 'opportunities', id: `sample-opp-${idx + 1}`,
      data: {
        ...base, customerId: c.id, customerName: custName(c), projectValue: o.value,
        lastContact: iso(daysFrom(today, -(idx * 4 + 2))), aiScore: o.score, sentiment: o.sentiment, nextStep: o.next,
      },
    });
  });

  return out;
}

(async () => {
  console.log(`โหมด: ${MODE} | บริษัท: ${COMPANY_ID}\n`);

  if (MODE === 'delete') {
    let deleted = 0;
    for (const col of COLLECTIONS) {
      const snap = await db.collection(`${companyPath}/${col}`).where('isSample', '==', true).get();
      for (const d of snap.docs) { await d.ref.delete(); deleted++; console.log(`  ลบ ${col}/${d.id}`); }
    }
    console.log(`\nลบข้อมูลตัวอย่าง ${deleted} รายการ`);
    return;
  }

  const samples = await buildSamples();
  for (const s of samples) {
    const d = s.data;
    const no = d.receiptNo || d.billingNoteNo || d.documentNo || d.invoiceNo || (s.col === 'opportunities' ? '-' : '');
    const amount = d.grandTotal ?? d.totalAmount ?? d.amount ?? d.projectValue ?? '';
    console.log(`  ${s.col.padEnd(14)} ${s.id.padEnd(14)} ${String(no).padEnd(16)} ${d.customerName}  ${amount ? Number(amount).toLocaleString('th-TH') + ' บาท' : ''}`);
  }

  if (MODE === 'dry-run') {
    console.log(`\n(ดูอย่างเดียว) จะสร้าง ${samples.length} รายการ ใช้ --apply เพื่อเขียนจริง`);
    return;
  }

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const s of samples) batch.set(db.doc(`${companyPath}/${s.col}/${s.id}`), { ...s.data, createdAt: now, updatedAt: now });
  await batch.commit();
  console.log(`\nสร้าง/อัปเดตข้อมูลตัวอย่าง ${samples.length} รายการแล้ว`);
})().catch((err) => {
  console.error('ล้มเหลว:', err.message);
  process.exit(1);
});
