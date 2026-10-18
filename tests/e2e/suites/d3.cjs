// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// D3: เอกสารจัดซื้อ/การเงิน — เลข GR ในทรานแซกชัน, 50 ทวิ (snapshot + ยกเลิกแทนลบ), PDF ทุกประเภท, สิทธิ์
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const fs = require("fs"); const OUT = E2E_OUT; fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const toks = {};
const call = (uid) => async (url, b, raw = false) => {
  toks[uid] = toks[uid] || await tok(uid);
  const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + toks[uid] }, body: JSON.stringify({ companyId: C, ...b }) });
  if (raw) return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") };
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

(async () => {
  const s = Date.now();
  const U = { acct: `test-d3a-${s}`, wh: `test-d3w-${s}`, hr: `test-d3h-${s}`, sales: `test-d3s-${s}` };
  const ROLE = { acct: "ACCOUNTANT", wh: "WAREHOUSE", hr: "HR", sales: "SALES" };
  for (const k of Object.keys(U)) await db.doc(`users/${U[k]}`).set({ companyId: C, roles: [ROLE[k]], role: ROLE[k], status: "ACTIVE" });
  const acct = call(U.acct), wh = call(U.wh), hr = call(U.hr), sales = call(U.sales);
  const PROD = `TEST-D3-PROD-${s}`, PO = `TEST-PO-D3-${s}`, PR = `TEST-PR-D3-${s}`, EXP = `TEST-EXP-D3-${s}`, PV = `TEST-PV-D3-${s}`, PERIOD = "2099-01", EMP = `TEST-EMP-D3-${s}`;
  const cleanup = { grs: [], whts: [] };
  try {
    await db.doc(`products/${PROD}`).set({ companyId: C, name: "TEST สินค้า D3", sku: "TEST-D3", unit: "ชิ้น", itemType: "PRODUCT", pricing: { costWAC: 0 }, stockStatus: { onHand: 0, reserved: 0, available: 0 } });
    await db.doc(`companies/${C}/purchase_requests/${PR}`).set({ companyId: C, prCode: PR, requester: "TEST ผู้ขอ", department: "TEST", requestDate: "2026-10-18", requiredDate: "2026-10-25", reason: "TEST", suggestedSupplierId: "SUP-2606-0002", suggestedSupplierName: "TEST", vatMode: "exclude", items: [{ productId: PROD, sku: "TEST-D3", name: "TEST สินค้า D3 ชื่อยาวสำหรับดูการตัดคำภาษาไทยในตาราง น้ำ ค่ำ", qty: 3, unit: "ชิ้น", price: 100 }], subTotal: 300, vatAmount: 21, totalAmount: 321, status: "PENDING_APPROVAL", isDeleted: false });
    await db.doc(`companies/${C}/purchase_orders/${PO}`).set({ companyId: C, poCode: PO, documentNo: PO, supplierId: "SUP-2606-0002", supplierName: "TEST ผู้ขาย", prRef: PR, date: "2026-10-18", expectedDate: "2026-10-25", vatType: "Exclusive", paymentTerm: "Net 30", items: [{ productId: PROD, sku: "TEST-D3", name: "TEST สินค้า D3", unit: "ชิ้น", qty: 3, price: 100, qtyReceived: 0 }], subTotal: 300, vatAmount: 21, totalAmount: 321, status: "APPROVED", isDeleted: false });

    // ---- GR: เลขที่ออกในทรานแซกชัน ----
    const ctr0 = (await db.doc(`companies/${C}/counters/GR`).get()).data();
    const g = await wh("/api/inventory/goods-receipt", { poRef: PO, poDocPath: `companies/${C}/purchase_orders/${PO}`, supplier: "TEST ผู้ขาย", receiptDate: "2026-10-18", deliveryNote: "TEST-DN", receivedBy: "TEST", items: [{ productId: PROD, name: "TEST สินค้า D3", qtyReceived: 3, unitPrice: 100, poLineIndex: 0 }] });
    if (g.body.grNo) cleanup.grs.push(g.body.grNo);
    const grDoc = g.body.grNo ? await db.doc(`companies/${C}/goods_receipts/${g.body.grNo}`).get() : null;
    ok("GR gets a sequence number used as doc id", g.status === 200 && /^GR/.test(g.body.grNo || "") && grDoc?.exists && grDoc.data().grNo === g.body.grNo, JSON.stringify(g.body));
    const ctr1 = (await db.doc(`companies/${C}/counters/GR`).get()).data();
    ok("GR counter advanced by one", (ctr1?.lastSeq || 0) === (ctr0 && ctr0.lastDate === ctr1?.lastDate ? ctr0.lastSeq + 1 : 1), JSON.stringify([ctr0, ctr1]));
    const jq = await db.collection(`companies/${C}/journal_entries`).where("reference", "==", g.body.grNo || "-").get();
    ok("GR journal references GR number", jq.size === 1);
    const g2 = await wh("/api/inventory/goods-receipt", { poRef: PO, poDocPath: `companies/${C}/purchase_orders/${PO}`, supplier: "TEST", receiptDate: "2026-10-18", items: [{ productId: PROD, qtyReceived: 1, unitPrice: 100, poLineIndex: 0 }] });
    const ctr2 = (await db.doc(`companies/${C}/counters/GR`).get()).data();
    ok("failed GR (over-receipt) does not consume a number", g2.status >= 400 && ctr2.lastSeq === ctr1.lastSeq, JSON.stringify([g2.status, ctr2]));

    // ---- 50 ทวิ ----
    await db.doc(`companies/${C}/expenses/${EXP}`).set({ companyId: C, expenseId: EXP, supplierId: "SUP-2606-0002", supplierName: "TEST ผู้ขาย", subTotal: 10000, vatAmount: 700, totalAmount: 10700, status: "Pending", isDeleted: false });
    const w = await acct("/api/finance/wht-certificates", { expenseId: EXP, whtRate: 3, filingDate: "2026-10-18" });
    if (w.body.whtId) cleanup.whts.push(w.body.whtId);
    const wd = w.body.whtId ? (await db.doc(`companies/${C}/withholding_taxes/${w.body.whtId}`).get()).data() : {};
    const sup = (await db.doc(`groups/${C}/suppliers/SUP-2606-0002`).get()).data() || (await db.doc(`suppliers/SUP-2606-0002`).get()).data() || {};
    ok("WHT stores payee + payer snapshot", w.status === 200 && wd.payee?.name && wd.payerSnapshot?.name && wd.payee.taxId === String(sup.taxId || sup.tax_id || "").replace(/\D/g, "") && ["CORPORATE", "INDIVIDUAL"].includes(wd.vendorType), JSON.stringify([w.body, wd.payee]));
    const wj = await acct("/api/documents/pdf", { type: "wht", id: w.body.whtId, format: "json" });
    const f = wj.body.document?.wht50;
    ok("WHT model: form, PND by tax id, row 5, totals", f && f.form === (wd.payee.corporate ? "PND53" : "PND3") && f.rows[0].row === 5 && f.rows[0].amount === 10000 && f.rows[0].tax === 300 && f.payer.taxId, JSON.stringify(f));
    for (const copy of ["original", "copy"]) {
      const p = await acct("/api/documents/pdf", { type: "wht", id: w.body.whtId, copy }, true);
      fs.writeFileSync(`${OUT}/wht-${copy}.pdf`, p.buf);
      ok(`WHT PDF ${copy}`, p.status === 200 && p.buf.slice(0, 4).toString() === "%PDF", p.buf.slice(0, 200).toString());
    }
    const sc = await sales("/api/documents/pdf", { type: "wht", id: w.body.whtId, format: "json" });
    ok("sales cannot open WHT", sc.status === 403);
    const cx = await acct("/api/documents/delete", { kind: "wht", id: w.body.whtId, reason: "TEST ออกผิด" });
    const wd2 = (await db.doc(`companies/${C}/withholding_taxes/${w.body.whtId}`).get());
    const exp2 = (await db.doc(`companies/${C}/expenses/${EXP}`).get()).data();
    ok("WHT 'delete' now cancels and keeps the document", cx.status === 200 && wd2.exists && wd2.data().status === "Cancelled" && wd2.data().cancelReason === "TEST ออกผิด" && !exp2.whtId, JSON.stringify(cx.body));
    const cx2 = await acct("/api/documents/delete", { kind: "wht", id: w.body.whtId, reason: "อีกครั้ง" });
    ok("cancel twice -> 409", cx2.status === 409);
    const wj2 = await acct("/api/documents/pdf", { type: "wht", id: w.body.whtId, format: "json" });
    ok("cancelled WHT prints with watermark", wj2.body.document?.watermark === "ยกเลิก");

    // ---- ใบสำคัญจ่าย ----
    await db.doc(`companies/${C}/payments/${PV}`).set({ companyId: C, paymentNo: PV, payeeName: "TEST ผู้ขาย", supplierId: "SUP-2606-0002", paymentDate: "2026-10-18", paymentMethodLabel: "โอนเงิน", bankAccount: "TEST 123", lines: [{ expenseNo: EXP, amount: 10700, preVat: 10000, vat: 700, whtRate: 3, whtAmount: 300, netPaid: 10400 }], totalAmount: 10700, totalWht: 300, netPaid: 10400, whtCertificates: [], status: "posted", isDeleted: false });

    // ---- สลิปเงินเดือน ----
    await db.doc(`companies/${C}/payrolls/${PERIOD}`).set({ companyId: C, period: PERIOD, periodLabel: "TEST มกราคม 2642", status: "approved", lines: [{ employeeDocId: EMP, employeeId: "TEST-001", name: "TEST พนักงาน", position: "ช่าง", employmentType: "monthly", rate: 20000, base: 20000, allowance: 1000, overtime: 500, otherIncome: 0, otherDeduction: 200, workDays: 0, gross: 21500, sso: 750, employerSso: 750, wht: 100, net: 20450, whtOverride: null, bankName: "TEST", bankAccount: "000" }], isDeleted: false });
    const slipId = `${PERIOD}~${EMP}`;
    const hs = await hr("/api/documents/pdf", { type: "payslip", id: slipId, format: "json" });
    ok("HR opens payslip; totals net", hs.status === 200 && hs.body.document.totals.find((t) => t.strong).amount === 20450 && hs.body.document.totals[1].amount === -1050, JSON.stringify(hs.body).slice(0, 300));
    const hpv = await hr("/api/documents/pdf", { type: "payment", id: PV, format: "json" });
    ok("HR cannot open payment voucher", hpv.status === 403);
    const sp = await sales("/api/documents/pdf", { type: "payslip", id: slipId, format: "json" });
    ok("sales cannot open payslip", sp.status === 403);
    const bad = await hr("/api/documents/pdf", { type: "payslip", id: `${PERIOD}~nobody`, format: "json" });
    ok("unknown employee -> 404", bad.status === 404);

    // ---- PDF ทุกประเภท ----
    const docs = [["purchase_request", PR, acct], ["purchase_order", PO, acct], ["goods_receipt", g.body.grNo, wh], ["payment", PV, acct], ["journal", jq.docs[0]?.id, acct], ["payslip", slipId, hr]];
    for (const [type, id, who] of docs) {
      const p = await who("/api/documents/pdf", { type, id }, true);
      fs.writeFileSync(`${OUT}/${type}.pdf`, p.buf);
      ok(`PDF ${type}`, p.status === 200 && p.buf.slice(0, 4).toString() === "%PDF", `${p.status} ${p.buf.slice(0, 200).toString()}`);
    }
    const jj = await acct("/api/documents/pdf", { type: "journal", id: jq.docs[0]?.id, format: "json" });
    ok("journal model has debit/credit columns and balanced totals", jj.body.document?.columns.includes("debit") && jj.body.document.totals[0].amount === 300 && jj.body.document.totals[1].amount === 300, JSON.stringify(jj.body.document?.totals));
    const pj = await acct("/api/documents/pdf", { type: "purchase_order", id: PO, format: "json" });
    ok("PO party from supplier master", pj.body.document?.party?.label === "ผู้ขาย" && pj.body.document.party.name && pj.body.document.totals.at(-1).amount === 321, JSON.stringify(pj.body.document?.party));
    const prj = await wh("/api/documents/pdf", { type: "purchase_request", id: PR, format: "json" });
    ok("PR pending shows watermark; warehouse (procurement:view) can open", prj.status === 200 && prj.body.document.watermark === "รออนุมัติ", JSON.stringify(prj.body).slice(0, 200));
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const n of cleanup.grs) {
      await db.doc(`companies/${C}/goods_receipts/${n}`).delete();
      for (const d of (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", n).get()).docs) await d.ref.delete();
    }
    for (const d of (await db.collection(`companies/${C}/stock_movements`).where("referenceId", "==", PO).get()).docs) await d.ref.delete();
    for (const n of cleanup.whts) await db.doc(`companies/${C}/withholding_taxes/${n}`).delete();
    for (const p of [`products/${PROD}`, `companies/${C}/purchase_requests/${PR}`, `companies/${C}/purchase_orders/${PO}`, `companies/${C}/expenses/${EXP}`, `companies/${C}/payments/${PV}`, `companies/${C}/payrolls/${PERIOD}`]) await db.doc(p).delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
