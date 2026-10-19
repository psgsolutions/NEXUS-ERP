// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// 7C: ยอดยกมา — งบทดลองยกมาผ่านหน้าจอ (/data-import) + ลูกหนี้/เจ้าหนี้คงค้างผ่าน API แล้วรับ/จ่ายชำระต่อในระบบ
// ตรวจ: ไม่บันทึกบัญชีตอนยกมา, รับชำระ Cr 1131 / จ่ายชำระ Dr 2111 (ไม่มีภาษีซื้อ), ไม่เข้ารายงานภาษีขาย, กระทบยอด, พิมพ์เอกสารไม่ได้
require("@next/env").loadEnvConfig(E2E_ROOT);
const path = require("path");
const admin = require("firebase-admin");
const XLSX = require("xlsx");
const { chromium } = require("playwright");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const G = C; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const signIn = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json());

(async () => {
  const s = Date.now(); const T = String(s).slice(-9); const M = `TEST-OB-${s}`;
  const UID = `test-ob-${s}`, VIEW = `test-ob-v-${s}`;
  await admin.auth().createUser({ uid: UID, email: `${UID}@example.com` });
  await db.doc(`users/${UID}`).set({ companyId: C, roles: ["ACCOUNTANT", "SALES", "PURCHASING"], role: "ACCOUNTANT", status: "ACTIVE", email: `${UID}@example.com`, name: "TEST ยอดยกมา", onboarding: { welcomed: true } });
  await db.doc(`users/${VIEW}`).set({ companyId: C, roles: ["SALES"], role: "SALES", status: "ACTIVE" });
  const auth = await signIn(UID);
  const api = async (url, body, uid) => {
    const token = uid ? (await signIn(uid)).idToken : auth.idToken;
    const r = await fetch(E2E_BASE + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ companyId: C, ...body }) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const created = { customers: [], suppliers: [], contractors: [] };
  const refs = { receipts: [], payments: [], journals: [] };
  let browser;
  try {
    // ลูกค้า/ผู้ขายของการทดสอบ (สร้างผ่าน API เหมือนการนำเข้า)
    const cust = await api("/api/master-data", { action: "create", entity: "customers", data: { name: `${M} ลูกค้า`, taxId: `0107${T}`, branchCode: "00000" } });
    const sup = await api("/api/master-data", { action: "create", entity: "suppliers", data: { name: `${M} ผู้ขาย`, taxId: `0207${T}` } });
    created.customers.push(cust.body.id); created.suppliers.push(sup.body.id);
    ok("test customer/supplier created", cust.status === 200 && sup.status === 200, JSON.stringify([cust.body, sup.body]));

    const before = (await api("/api/finance/opening-balances", { action: "status" })).body;
    const denied = await api("/api/finance/opening-balances", { action: "status" }, VIEW);
    ok("sales-only user cannot use opening balances", denied.status === 403);

    // ลูกหนี้คงค้าง: จับคู่ด้วยเลขภาษี / ชื่อ, ไม่พบลูกค้า, เลขที่ซ้ำ
    const ar = await api("/api/finance/opening-balances", { action: "ar", items: [
      { docNo: `${M}-IV1`, date: "2026-09-15", dueDate: "2026-10-15", partyName: "ชื่ออื่น", taxId: `0107${T}`, branchCode: "00000", amount: 53500, subTotal: 50000 },
      { docNo: `${M}-IV2`, date: "2026-09-20", partyName: `${M} ลูกค้า`, amount: 1000 },
      { docNo: `${M}-IV3`, date: "2026-09-20", partyName: `${M} ไม่มีในระบบ`, amount: 10 },
    ] });
    ok("AR: 2 created (tax ID and name match), unknown customer rejected", ar.status === 200 && ar.body.created === 2 && /ไม่พบลูกค้า/.test(ar.body.results[2].error), JSON.stringify(ar.body));
    const again = await api("/api/finance/opening-balances", { action: "ar", items: [{ docNo: `${M}-IV1`, date: "2026-09-15", partyName: `${M} ลูกค้า`, amount: 5 }] });
    ok("AR: same document number cannot be imported twice", again.body.created === 0 && /มีรายการยกมาเลขที่นี้แล้ว/.test(again.body.results[0].error), JSON.stringify(again.body));
    const iv1Id = ar.body.results[0].id;
    const iv1 = (await db.doc(`companies/${C}/invoices/${iv1Id}`).get()).data();
    const noJournal = (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", `${M}-IV1`).get()).empty;
    ok("AR invoice: opening kind, outstanding, no VAT, customer snapshot, no journal", iv1.docKind === "opening" && iv1.balance === 53500 && iv1.vatAmount === 0 && iv1.customerId === cust.body.id && iv1.customerSnapshot.taxId === `0107${T}` && !iv1.journalId && noJournal, JSON.stringify(iv1));

    // เจ้าหนี้คงค้าง
    const ap = await api("/api/finance/opening-balances", { action: "ap", items: [{ docNo: `${M}-SUP1`, date: "2026-09-10", partyName: `${M} ผู้ขาย`, amount: 21400, subTotal: 20000 }] });
    const apId = ap.body.results?.[0]?.id;
    const apDoc = apId && (await db.doc(`companies/${C}/expenses/${apId}`).get()).data();
    ok("AP item: apPosted, opening type, linked to supplier", ap.body.created === 1 && apDoc.apPosted === true && apDoc.documentType === "Opening" && apDoc.supplierId === sup.body.id && apDoc.balance === 21400, JSON.stringify(ap.body));

    // รับชำระลูกหนี้ยกมาบางส่วน หัก ณ ที่จ่าย 3% จากยอดก่อน VAT
    const rc = await api("/api/finance/receipts", { customerId: cust.body.id, paymentDate: "2026-10-05", paymentMethod: "CASH", lines: [{ invoiceDocId: iv1Id, amount: 21400, whtRate: 3 }] });
    if (rc.body.receiptNo) refs.receipts.push(rc.body.receiptNo);
    const rcJ = rc.body.receiptNo ? (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", rc.body.receiptNo).get()).docs.map((d) => d.data())[0] : null;
    const iv1b = (await db.doc(`companies/${C}/invoices/${iv1Id}`).get()).data();
    const cr1131 = rcJ?.items.find((l) => l.accountCode === "1131-00")?.credit;
    const wht = rcJ?.items.find((l) => l.accountCode === "1154-00")?.debit;
    ok("receipt on opening invoice: Cr 1131 21,400, WHT 3% of pre-VAT 20,000 = 600, no VAT lines", rc.status === 200 && cr1131 === 21400 && wht === 600 && !rcJ.items.some((l) => l.accountCode.startsWith("212")) && iv1b.balance === 32100 && iv1b.paymentStatus === "partial", JSON.stringify({ rc: rc.body, items: rcJ?.items }));

    // จ่ายชำระเจ้าหนี้ยกมาทั้งจำนวน
    const pv = await api("/api/finance/payments", { payeeKey: `SUP:${sup.body.id}`, paymentDate: "2026-10-06", paymentMethod: "CASH", lines: [{ expenseDocId: apId, amount: 21400, whtRate: 0 }] });
    const pvNo = pv.body.paymentNo;
    if (pvNo) refs.payments.push(pvNo);
    const pvJ = pvNo ? (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", pvNo).get()).docs.map((d) => d.data())[0] : null;
    ok("payment on opening AP: Dr 2111 full amount, no input VAT", pv.status === 200 && pvJ?.items.find((l) => l.accountCode === "2111-00")?.debit === 21400 && !pvJ.items.some((l) => l.accountCode === "1151-00"), JSON.stringify({ pv: pv.body, items: pvJ?.items }));

    // VAT / เอกสาร
    const vat = await api("/api/reports/financial", { report: "vat-out", to: "2026-09" });
    ok("opening invoices not in output VAT report", vat.status === 200 && !JSON.stringify(vat.body).includes(M), JSON.stringify(vat.body).slice(0, 300));
    const pdf = await api("/api/documents/pdf", { type: "invoice", id: iv1Id, format: "json" });
    ok("opening invoice cannot be printed as a document of this system", pdf.status === 400 && /ยอดยกมา/.test(pdf.body.error || ""), JSON.stringify(pdf));

    // งบทดลองยกมาผ่านหน้าจอ: ไฟล์ไม่สมดุลกดไม่ได้ / สมดุลสร้างใบสำคัญร่าง
    browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const record = { uid: UID, email: `${UID}@example.com`, emailVerified: false, isAnonymous: false, providerData: [], stsTokenManager: { refreshToken: auth.refreshToken, accessToken: auth.idToken, expirationTime: Date.now() + 3500e3 }, createdAt: String(s), lastLoginAt: String(s), apiKey: KEY, appName: "[DEFAULT]" };
    await page.goto(E2E_BASE + "/login", { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.evaluate(async ({ record, key }) => {
      localStorage.setItem("selectedCompanyId", "COM-NEXUS-01");
      await new Promise((res, rej) => { const req = indexedDB.open("firebaseLocalStorageDb", 1); req.onupgradeneeded = () => req.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" }); req.onsuccess = () => { const tx = req.result.transaction("firebaseLocalStorage", "readwrite"); tx.objectStore("firebaseLocalStorage").put({ fbase_key: key, value: record }); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }; req.onerror = () => rej(req.error); });
    }, { record, key: `firebase:authUser:${KEY}:[DEFAULT]` });
    await page.goto(E2E_BASE + "/data-import", { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.getByRole("button", { name: "งบทดลองยกมา", exact: true }).click({ timeout: 120000 });
    await page.getByText("กระทบยอดบัญชีคุมกับยอดรายตัว").waitFor({ timeout: 60000 });
    const xlsx = (name, aoa) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "ข้อมูล"); const f = path.join(E2E_OUT, name); XLSX.writeFile(wb, f); return f; };
    const head = ["รหัสบัญชี", "ชื่อบัญชี", "เดบิต", "เครดิต"];
    await page.locator('input[type="file"]').setInputFiles(xlsx(`ob-tb-bad-${s}.xlsx`, [head, ["1131", "ลูกหนี้", 54500, ""], ["2111-00", "เจ้าหนี้", "", 21400], ["3211-00", "กำไรสะสม", "", 1]]));
    await page.getByText(/ไม่สมดุล ต่างกัน/).waitFor({ timeout: 30000 });
    ok("unbalanced TB: import button disabled", await page.getByRole("button", { name: /สร้างใบสำคัญยกมา/ }).isDisabled());
    await page.locator('input[type="file"]').setInputFiles(xlsx(`ob-tb-${s}.xlsx`, [head, ["1131", "ลูกหนี้", 54500, ""], ["2111-00", "เจ้าหนี้", "", 21400], ["3211-00", "กำไรสะสม", "", 33100]]));
    await page.getByRole("button", { name: "สร้างใบสำคัญยกมา (3 บัญชี)" }).click({ timeout: 30000 });
    await page.getByText(/สร้างใบสำคัญ .* \(ร่าง\) แล้ว/).waitFor({ timeout: 60000 });
    const tbJ = (await db.collection(`companies/${C}/journal_entries`).where("reference", "==", "OPENING-TB").get()).docs.filter((d) => d.data().createdBy === UID);
    tbJ.forEach((d) => refs.journals.push(d.ref));
    const tbd = tbJ[0]?.data();
    ok("TB journal: draft JV, reference OPENING-TB, balanced 54,500", tbJ.length === 1 && tbd.status === "draft" && tbd.bookType === "JV" && tbd.totalDebit === 54500 && tbd.items.find((l) => l.accountCode === "1131-00")?.debit === 54500, JSON.stringify(tbd));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(E2E_OUT, `opening-tb-${s}.png`), fullPage: true });

    // กระทบยอด: ลูกหนี้ยกมา 54,500 − รับชำระ 21,400 = 33,100 (ร่างรวมรับชำระ) / เจ้าหนี้จ่ายครบ
    const after = (await api("/api/finance/opening-balances", { action: "status" })).body;
    const d = (k, f) => Math.round((after.reconcile[k][f] - before.reconcile[k][f]) * 100) / 100;
    ok("reconcile deltas: AR sub +33,100 / GL(draft) +33,100; AP sub 0 / GL(draft) 0", d(0, "sub") === 33100 && d(0, "glWithDraft") === 33100 && d(1, "sub") === 0 && d(1, "glWithDraft") === 0 && after.ar.count - before.ar.count === 2, JSON.stringify({ before: before.reconcile, after: after.reconcile }));

    // ลบยอดยกมาที่ยังไม่มีการชำระ: IV2 ถูกลบ, IV1 (รับชำระแล้ว) คงอยู่
    const clr = await api("/api/finance/opening-balances", { action: "clear", kind: "ar" });
    const iv2 = await db.doc(`companies/${C}/invoices/${ar.body.results[1].id}`).get();
    ok("clear removes only unpaid opening items", clr.body.removed >= 1 && clr.body.kept >= 1 && !iv2.exists && (await db.doc(`companies/${C}/invoices/${iv1Id}`).get()).exists, JSON.stringify(clr.body));
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    if (browser) await browser.close();
    const del = async (q) => { for (const d of (await q.get()).docs) await d.ref.delete(); };
    for (const no of [...refs.receipts, ...refs.payments]) {
      await del(db.collection(`companies/${C}/journal_entries`).where("reference", "==", no));
      await db.doc(`companies/${C}/receipts/${no}`).delete(); await db.doc(`companies/${C}/payments/${no}`).delete();
    }
    for (const r of refs.journals) await r.delete();
    for (const col of ["invoices", "expenses"]) for (const d of (await db.collection(`companies/${C}/${col}`).get()).docs) if (d.id.includes(M)) await d.ref.delete();
    for (const [ent, ids] of Object.entries(created)) for (const id of ids.filter(Boolean)) {
      await del(db.collection(`groups/${G}/${ent}/${id}/history`));
      await db.doc(`groups/${G}/${ent}/${id}`).delete(); await db.doc(`companies/${C}/${ent}/${id}`).delete();
    }
    const all = new Set(Object.values(created).flat());
    for (const d of (await db.collection(`groups/${G}/unique_keys`).get()).docs) if (all.has(d.data().id)) await d.ref.delete();
    for (const u of [UID, VIEW]) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
