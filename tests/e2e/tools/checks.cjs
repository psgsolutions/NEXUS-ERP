/**
 * ตรวจหลังรันชุดทดสอบ (ใช้โดย run.cjs หรือรันเอง: node tests/e2e/tools/checks.cjs [--clean-logs])
 *  - leftovers: เอกสารที่มีคำว่า TEST ค้างในบริษัท (ชุดทดสอบลบไม่หมด)
 *  - counters: ตัวนับเลขเอกสารต่ำกว่าเลขที่ที่มีอยู่จริง (ถูกคืนค่าทับเลขจริง)
 *  - test logs: audit log ที่เกิดจากผู้ใช้ทดสอบ (uid ขึ้นต้น test-) หรือเอกสาร TEST — ลบได้ด้วย --clean-logs (สำรอง JSON ก่อน)
 */
const fs = require("fs");
const path = require("path");
const { db, COMPANY: C } = require("./db.cjs");

const COLS = ["journal_entries", "cndn", "invoices", "billing_notes", "receipts", "payments", "expenses", "withholding_taxes", "goods_receipts", "purchase_orders", "purchase_requests", "sales_orders", "stock_movements", "payrolls", "delivery_notes", "projects", "customers", "quotations", "work_orders"];

async function leftovers() {
  const hits = [];
  for (const c of COLS) {
    const s = await db.collection(`companies/${C}/${c}`).get();
    for (const d of s.docs) {
      const x = d.data();
      if (x.isSample) continue;
      if (/TEST/.test(d.id) || /TEST[-_ ]|TEST\b/.test(JSON.stringify(x).replace(/"remarks":"[^"]*"/, ""))) hits.push(`${c}/${d.id}`);
    }
  }
  return hits;
}

// prefix -> [collection, ฟิลด์เลขที่]
const SRC = {
  QT: ["quotations", ["documentNo", "quotationNumber"]], SO: ["sales_orders", ["documentNo", "soId"]], DN: ["delivery_notes", ["dnNo"]],
  IV: ["invoices", ["invoiceNo"]], PB: ["invoices", ["invoiceNo"]], BL: ["billing_notes", ["billingNoteNo"]], RE: ["receipts", ["receiptNo"]],
  CN: ["cndn", ["documentNo"]], DBN: ["cndn", ["documentNo"]], RF: ["customer_refunds", ["refundNo", "documentNo"]], POS: ["sales_transactions", ["transactionNo"]],
  PR: ["purchase_requests", ["prCode"]], PO: ["purchase_orders", ["poCode"]], GR: ["goods_receipts", ["grNo"]], EXP: ["expenses", ["expenseId"]],
  PV: ["payments", ["paymentNo"]], ADV: ["cash_advances", ["advanceNo"]], WHT: ["withholding_taxes", ["whtId"]], PRJ: ["projects", ["projectCode", "projectNo", "documentNo"]],
  WO: ["work_orders", ["woCode"]], JOB: ["jobs", ["jobNo"]], TK: ["service_tickets", ["ticketNo"]], FIN: ["journal_entries", ["jvId"]],
};

async function counters() {
  // โหลดไฟล์ .ts ของระบบออกเลขโดยตรง (Node 22.6+ ตัด type ให้เอง) — ปิดคำเตือนเรื่องชนิดโมดูล
  process.removeAllListeners("warning");
  const { resolveSequenceFormat } = await import(require("url").pathToFileURL(path.join(__dirname, "../../../src/lib/sequence-engine.ts")).href);
  const fmt = (await db.doc(`companies/${C}/settings/sequence_formats`).get()).data() || {};
  const behind = [];
  for (const [prefix, [col, fields]] of Object.entries(SRC)) {
    const ctr = (await db.doc(`companies/${C}/counters/${prefix}`).get()).data() || null;
    const r = resolveSequenceFormat(prefix, fmt[prefix]);
    const nums = new Set();
    (await db.collection(`companies/${C}/${col}`).get()).docs.forEach((d) => { nums.add(d.id); fields.forEach((f) => d.data()[f] && nums.add(String(d.data()[f]))); });
    let max = 0;
    nums.forEach((n) => { if (n.startsWith(r.prefixPart)) { const rest = n.slice(r.prefixPart.length).replace(r.suffixPart, ""); if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest)); } });
    const cur = ctr && ctr.lastDate === r.prefixPart ? ctr.lastSeq : 0;
    if (max > cur) behind.push({ prefix, counter: cur, maxExisting: max });
  }
  return behind;
}

async function testLogs(clean) {
  const s = await db.collection("logs").where("companyId", "==", C).get();
  const hits = s.docs.filter((d) => {
    const x = d.data();
    const actor = String(x.createdBy || x.userId || x.uid || "");
    return actor.startsWith("test-") || /TEST[-_ ]/.test(JSON.stringify([x.targetId, x.entityId, x.documentNo]).toUpperCase());
  });
  if (clean && hits.length) {
    const out = path.join(__dirname, "..", ".out"); fs.mkdirSync(out, { recursive: true });
    const file = path.join(out, `logs-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify(hits.map((d) => ({ id: d.id, data: d.data() }))));
    for (const d of hits) await d.ref.delete();
    return { count: hits.length, backup: file };
  }
  return { count: hits.length };
}

module.exports = { leftovers, counters, testLogs };

if (require.main === module) {
  (async () => {
    const clean = process.argv.includes("--clean-logs");
    const [l, c, t] = [await leftovers(), await counters(), await testLogs(clean)];
    console.log(`leftover TEST docs: ${l.length}${l.length ? `\n  ${l.slice(0, 20).join("\n  ")}` : ""}`);
    console.log(`counters behind real numbers: ${c.length}${c.length ? `\n  ${c.map((x) => `${x.prefix} counter=${x.counter} max=${x.maxExisting}`).join("\n  ")}` : ""}`);
    console.log(`test audit logs: ${t.count}${t.backup ? ` (deleted, backup ${t.backup})` : clean ? "" : " (use --clean-logs to delete)"}`);
    process.exit(l.length || c.length ? 1 : 0);
  })().catch((e) => { console.error(e); process.exit(2); });
}
