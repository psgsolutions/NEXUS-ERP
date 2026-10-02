/**
 * ข้อมูลตัวอย่างงานจัดซื้อในฐานข้อมูลจริง (ไม่ลงบัญชี, ไม่เปลี่ยนสต็อก, ไม่ใช้เลขรันจริง)
 * ทุกเอกสารมี isSample: true และเลขเอกสาร/ID ขึ้นต้น "SAMPLE-" รันซ้ำได้ไม่ซ้ำ
 * หน้าจอไม่ยอมให้รับสินค้า หรือสร้างใบสั่งซื้อจริง จากเอกสารตัวอย่าง
 *
 *   node scripts/seed-procurement-samples.js            ดูรายการที่จะสร้าง (ไม่เขียน)
 *   node scripts/seed-procurement-samples.js --apply    สร้าง/อัปเดตข้อมูลตัวอย่าง
 *   node scripts/seed-procurement-samples.js --delete   ลบข้อมูลตัวอย่างทั้งหมด (isSample: true)
 */
const path = require('path');
const root = path.join(__dirname, '..');
require('@next/env').loadEnvConfig(root);
const admin = require('firebase-admin');

const COMPANY_ID = process.env.SAMPLE_COMPANY_ID || 'COM-NEXUS-01';
const MODE = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--delete') ? 'delete' : 'dry-run';
const COLLECTIONS = ['purchase_requests', 'purchase_orders', 'goods_receipts', 'expenses', 'withholding_taxes'];

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
const daysFrom = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const round2 = (n) => Math.round(n * 100) / 100;

async function buildSamples() {
  const suppliers = (await db.collection('suppliers').where('companyId', '==', COMPANY_ID).limit(3).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  if (suppliers.length === 0) throw new Error(`ไม่พบผู้จำหน่ายของ ${COMPANY_ID}`);
  const products = (await db.collection('products').where('companyId', '==', COMPANY_ID).limit(4).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  if (products.length === 0) throw new Error(`ไม่พบสินค้าของ ${COMPANY_ID}`);

  const sup = (i) => suppliers[i % suppliers.length];
  const supName = (s) => s.name || s.supplierName || s.id;
  const prod = (i) => products[i % products.length];
  const costOf = (p) => Number(p.pricing?.costWAC ?? p.cost ?? p.costPrice ?? 500) || 500;
  const line = (p, qty, received = 0) => ({
    id: `${p.id}-${qty}`, productId: p.id, sku: p.sku || p.id, name: p.name || p.id,
    unit: p.unit || 'ชิ้น', qty, price: costOf(p), cost: costOf(p), itemType: 'PRODUCT', qtyReceived: received,
  });
  const totals = (items) => {
    const subTotal = round2(items.reduce((s, it) => s + it.qty * it.price, 0));
    const vatAmount = round2(subTotal * 0.07);
    return { subTotal, vatAmount, totalAmount: round2(subTotal + vatAmount) };
  };
  const base = {
    companyId: COMPANY_ID, isSample: true, isDeleted: false, createdBy: 'SAMPLE_SEED', updatedBy: 'SAMPLE_SEED',
    remarks: '[ตัวอย่าง] ข้อมูลทดสอบ ไม่ได้ลงบัญชี/ไม่เปลี่ยนสต็อก ลบได้ด้วย scripts/seed-procurement-samples.js --delete',
  };
  const out = [];

  // ใบขอซื้อ 3 ใบ: รออนุมัติ / อนุมัติแล้ว / ออกใบสั่งซื้อแล้ว
  const prDefs = [
    { n: 1, status: 'PENDING_APPROVAL', items: [line(prod(0), 5)], priority: 'medium', reason: 'สต็อกต่ำกว่าจุดสั่งซื้อ' },
    { n: 2, status: 'APPROVED', items: [line(prod(1), 2), line(prod(2), 10)], priority: 'high', reason: 'ใช้ติดตั้งงานลูกค้าเดือนหน้า' },
    { n: 3, status: 'CONVERTED', items: [line(prod(3), 4)], priority: 'urgent', reason: 'อุปกรณ์สำรองงานซ่อมบำรุง', poCode: 'SAMPLE-PO-001' },
  ];
  for (const d of prDefs) {
    const no = `SAMPLE-PR-${String(d.n).padStart(3, '0')}`;
    const t = totals(d.items);
    out.push({ col: 'purchase_requests', id: no, data: {
      ...base, prCode: no, documentNo: no, requester: '[ตัวอย่าง] ผู้ขอซื้อ', requesterUid: 'SAMPLE_SEED', department: 'ฝ่ายวิศวกรรม',
      requestDate: iso(daysFrom(-7 + d.n)), requiredDate: iso(daysFrom(14)), priority: d.priority, reason: d.reason,
      projectId: '', projectName: '', suggestedSupplierId: sup(d.n - 1).id, suggestedSupplierName: supName(sup(d.n - 1)),
      vatMode: 'exclude', whtRate: 0, items: d.items, subTotal: t.subTotal, vatAmount: t.vatAmount, whtAmount: 0, totalAmount: t.totalAmount,
      status: d.status, ...(d.poCode ? { poCode: d.poCode } : {}),
    } });
  }

  // ใบสั่งซื้อ 3 ใบ: อนุมัติแล้วรอรับ (จาก PR-003) / รออนุมัติ / รับครบแล้ว
  const poDefs = [
    { n: 1, status: 'APPROVED', s: 2, items: [line(prod(3), 4)], prRef: 'SAMPLE-PR-003', date: -3 },
    { n: 2, status: 'PENDING_APPROVAL', s: 0, items: [line(prod(0), 20)], prRef: '', date: -1 },
    { n: 3, status: 'RECEIVED', s: 1, items: [line(prod(1), 3, 3), line(prod(2), 6, 6)], prRef: '', date: -20 },
  ];
  const pos = poDefs.map((d) => {
    const no = `SAMPLE-PO-${String(d.n).padStart(3, '0')}`;
    const t = totals(d.items);
    const s = sup(d.s);
    return { col: 'purchase_orders', id: no, data: {
      ...base, poCode: no, documentNo: no, orderType: 'STOCK', supplierId: s.id, supplierName: supName(s), reference: d.prRef, prRef: d.prRef,
      projectId: '', projectName: '', department: '', warehouseCode: 'WH-01', date: iso(daysFrom(d.date)), expectedDate: iso(daysFrom(d.date + 14)),
      vatType: 'Exclusive', currency: 'THB', exchangeRate: 1, paymentTerm: 'Net 30', terms: '',
      items: d.items, ...t, totalAmountForeign: t.totalAmount, status: d.status,
    } };
  });
  out.push(...pos);

  // ใบรับสินค้า 1 ใบ ของ PO-003 (เอกสารอย่างเดียว ไม่เพิ่มสต็อก)
  const po3 = pos[2].data;
  out.push({ col: 'goods_receipts', id: 'SAMPLE-GR-001', data: {
    ...base, grId: 'SAMPLE-GR-001', grNo: 'SAMPLE-GR-001', poRef: po3.poCode, supplier: po3.supplierName, receiptDate: iso(daysFrom(-12)),
    deliveryNote: 'DN-SAMPLE-01', receivedBy: '[ตัวอย่าง] ผู้รับสินค้า', warehouse: 'WH-01', location: '',
    items: po3.items.map((it) => ({ productId: it.productId, name: it.name, qtyReceived: it.qty, unitPrice: it.price })),
    totalAmount: po3.subTotal, status: 'received',
  } });

  // ใบสำคัญจ่าย 2 ใบ ของ PO-003: ยังไม่หัก ณ ที่จ่าย / หักแล้ว
  const expenseBase = {
    ...base, poRef: po3.poCode, supplierId: po3.supplierId, supplierName: po3.supplierName, vendor: po3.supplierName, documentType: 'Expense',
    dueDate: iso(daysFrom(18)),
  };
  out.push({ col: 'expenses', id: 'SAMPLE-EXP-001', data: {
    ...expenseBase, id: 'SAMPLE-EXP-001', expenseId: 'SAMPLE-EXP-001', items: po3.items,
    subTotal: po3.subTotal, vatAmount: po3.vatAmount, totalAmount: po3.totalAmount, status: 'Awaiting Payment',
  } });
  const svcBase = 12000;
  const whtAmount = round2(svcBase * 0.03);
  out.push({ col: 'expenses', id: 'SAMPLE-EXP-002', data: {
    ...expenseBase, id: 'SAMPLE-EXP-002', expenseId: 'SAMPLE-EXP-002', poRef: '',
    items: [{ id: 'svc-1', name: '[ตัวอย่าง] ค่าบริการติดตั้ง', qty: 1, price: svcBase, itemType: 'SERVICE', unit: 'งาน' }],
    subTotal: svcBase, vatAmount: round2(svcBase * 0.07), totalAmount: round2(svcBase * 1.07),
    status: 'Paid (WHT Deducted)', whtId: 'SAMPLE-WHT-001', whtRef: 'SAMPLE-WHT-001', whtAmount,
  } });

  // หนังสือรับรองหัก ณ ที่จ่าย 1 ใบ (3% ค่าบริการ ฐานก่อน VAT)
  out.push({ col: 'withholding_taxes', id: 'SAMPLE-WHT-001', data: {
    ...base, id: 'SAMPLE-WHT-001', whtId: 'SAMPLE-WHT-001', expenseId: 'SAMPLE-EXP-002', expRef: 'SAMPLE-EXP-002',
    vendor: po3.supplierName, supplierId: po3.supplierId, documentType: 'Withholding Tax (50 Tawi)',
    baseAmount: svcBase, whtRate: 3, taxAmount: whtAmount, whtAmount, status: 'Issued', filingDate: iso(daysFrom(-5)),
  } });

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
    const party = d.supplierName || d.suggestedSupplierName || d.supplier || d.vendor || '';
    const amount = d.totalAmount ?? d.taxAmount ?? '';
    console.log(`  ${s.col.padEnd(18)} ${s.id.padEnd(15)} ${String(d.status || '').padEnd(18)} ${party}  ${amount !== '' ? Number(amount).toLocaleString('th-TH') + ' บาท' : ''}`);
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
