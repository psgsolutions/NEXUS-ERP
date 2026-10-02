/**
 * ย้อนการออกใบกำกับภาษีที่ทำเพื่อทดสอบ (จากหน้า /sales/orders/[id])
 * ลบใบกำกับภาษี + ใบวางบิล + รายการบัญชีที่เกิดจากใบนั้น, คืนสถานะใบสั่งขายเป็น "ส่งมอบแล้ว"
 * และคืนตัวนับเลขใบกำกับ/ใบวางบิล "เฉพาะเมื่อเป็นเลขล่าสุด" เพื่อไม่ให้เลขใบกำกับภาษีขาดช่วง
 *
 *   node scripts/revert-test-invoice.js --so SO-6910-0001            ดูรายการที่จะย้อน (ไม่เขียน)
 *   node scripts/revert-test-invoice.js --so SO-6910-0001 --apply    ย้อนจริง
 */
const path = require('path');
const root = path.join(__dirname, '..');
require('@next/env').loadEnvConfig(root);
const admin = require('firebase-admin');

const COMPANY_ID = process.env.SAMPLE_COMPANY_ID || 'COM-NEXUS-01';
const soArg = process.argv.indexOf('--so');
const SO_ID = soArg > 0 ? process.argv[soArg + 1] : '';
const APPLY = process.argv.includes('--apply');
if (!SO_ID) {
  console.error('ระบุใบสั่งขาย: --so <เลขใบสั่งขาย>');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const base = `companies/${COMPANY_ID}`;

// เลขแบบ idService.formatId: INV-26-0001 → counter `${companyId}_INV-26`, seq 1
const parseNo = (no) => {
  const m = String(no || '').match(/^([A-Z]+)-(\d{2})-(\d+)$/);
  return m ? { counterId: `${COMPANY_ID}_${m[1]}-${m[2]}`, seq: Number(m[3]) } : null;
};

(async () => {
  const soRef = db.doc(`${base}/sales_orders/${SO_ID}`);
  const so = await soRef.get();
  if (!so.exists) throw new Error(`ไม่พบใบสั่งขาย ${SO_ID}`);
  const { invoiceNo, billingNoteNo } = so.data();
  if (!invoiceNo) throw new Error(`${SO_ID} ยังไม่ได้ออกใบกำกับภาษี ไม่มีอะไรต้องย้อน`);

  const invDocs = (await db.collection(`${base}/invoices`).where('invoiceNo', '==', invoiceNo).get()).docs;
  const bnDocs = billingNoteNo ? (await db.collection(`${base}/billing_notes`).where('billingNoteNo', '==', billingNoteNo).get()).docs : [];
  const jvDocs = (await db.collection(`${base}/journal_entries`).get()).docs
    .filter((d) => String(d.data().description || '').startsWith(`[AUTO] Sales Invoice ${invoiceNo} `));
  const receipts = (await db.collection(`${base}/receipts`).where('invoiceNo', '==', invoiceNo).get()).docs;
  if (receipts.length) throw new Error(`มีใบเสร็จอ้างอิง ${invoiceNo} แล้ว (${receipts.length} ใบ) ย้อนอัตโนมัติไม่ได้`);

  const counters = [];
  for (const no of [invoiceNo, billingNoteNo].filter(Boolean)) {
    const p = parseNo(no);
    if (!p) { console.log(`  ! อ่านรูปแบบเลข ${no} ไม่ได้ จะไม่แตะตัวนับ`); continue; }
    const ref = db.doc(`counters/${p.counterId}`);
    const cur = (await ref.get()).data() || {};
    const current = cur.currentValue ?? cur.seq ?? 0;
    if (current === p.seq) counters.push({ ref, to: p.seq - 1, label: `${p.counterId}: ${current} → ${p.seq - 1}` });
    else console.log(`  ! ${no} ไม่ใช่เลขล่าสุด (ตัวนับ ${p.counterId} = ${current}) จะไม่คืนตัวนับ เลขจะขาดช่วง`);
  }

  console.log(`ใบสั่งขาย ${SO_ID}: ใบกำกับ ${invoiceNo}, ใบวางบิล ${billingNoteNo || '-'}`);
  invDocs.forEach((d) => console.log(`  ลบ invoices/${d.id}`));
  bnDocs.forEach((d) => console.log(`  ลบ billing_notes/${d.id}`));
  jvDocs.forEach((d) => console.log(`  ลบ journal_entries/${d.id}  (${d.data().description})`));
  counters.forEach((c) => console.log(`  คืนตัวนับ ${c.label}`));
  console.log(`  ใบสั่งขาย → สถานะ DELIVERED, ล้าง invoiceNo/billingNoteNo`);

  if (!APPLY) {
    console.log('\n(ดูอย่างเดียว) ใช้ --apply เพื่อย้อนจริง');
    return;
  }

  const batch = db.batch();
  [...invDocs, ...bnDocs, ...jvDocs].forEach((d) => batch.delete(d.ref));
  counters.forEach((c) => batch.set(c.ref, { currentValue: c.to, seq: c.to }, { merge: true }));
  batch.update(soRef, {
    status: 'DELIVERED',
    invoiceNo: admin.firestore.FieldValue.delete(),
    billingNoteNo: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  console.log('\nย้อนเรียบร้อย');
})().catch((err) => {
  console.error('ล้มเหลว:', err.message);
  process.exit(1);
});
