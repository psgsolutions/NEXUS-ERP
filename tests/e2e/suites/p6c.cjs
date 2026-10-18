// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// Phase 6C: ต้นทุนจริงของโครงการจากเอกสารต้นทาง + ใบเบิกค่าใช้จ่ายระบุโครงการ
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const toks = {};
const call = (uid) => async (url, b) => {
  toks[uid] = toks[uid] || await tok(uid);
  const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + toks[uid] }, body: JSON.stringify({ companyId: C, ...b }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

(async () => {
  const s = Date.now();
  const U = { acct: `test-p6c-a-${s}`, tech: `test-p6c-t-${s}` };
  await db.doc(`users/${U.acct}`).set({ companyId: C, roles: ["ACCOUNTANT", "ENGINEER"], role: "ACCOUNTANT", status: "ACTIVE" });
  await db.doc(`users/${U.tech}`).set({ companyId: C, roles: ["TECHNICIAN"], role: "TECHNICIAN", status: "ACTIVE" });
  const acct = call(U.acct), tech = call(U.tech);
  const PRJ = `TEST-PRJ-P6C-${s}`, EMP = `TEST-EMP-P6C-${s}`, SO = `TEST-SO-P6C-${s}`;
  const docs = [
    [`companies/${C}/projects/${PRJ}`, { companyId: C, projectId: PRJ, projectName: "TEST ต้นทุนโครงการ", status: "In Progress", isDeleted: false }],
    [`employees/${EMP}`, { companyId: C, name: "TEST พนักงาน P6C", isDeleted: false }],
    [`companies/${C}/purchase_orders/TEST-PO-P6C-A-${s}`, { companyId: C, poCode: `TEST-PO-P6C-A-${s}`, orderType: "PROJECT", projectId: PRJ, status: "APPROVED", subTotal: 12000, supplierName: "TEST ผู้ขาย A", isDeleted: false }],
    [`companies/${C}/purchase_orders/TEST-PO-P6C-B-${s}`, { companyId: C, poCode: `TEST-PO-P6C-B-${s}`, orderType: "PROJECT", projectId: PRJ, status: "RECEIVED", subTotal: 30000, expenseId: `TEST-EXP-P6C-B-${s}`, isDeleted: false }],
    [`companies/${C}/purchase_orders/TEST-PO-P6C-C-${s}`, { companyId: C, poCode: `TEST-PO-P6C-C-${s}`, orderType: "STOCK", projectId: PRJ, status: "RECEIVED", subTotal: 9999, isDeleted: false }],
    [`companies/${C}/expenses/TEST-EXP-P6C-B-${s}`, { companyId: C, expenseId: `TEST-EXP-P6C-B-${s}`, documentType: "Expense", poRef: `TEST-PO-P6C-B-${s}`, projectId: PRJ, subTotal: 30000, vatAmount: 2100, isDeleted: false }],
    [`companies/${C}/expenses/TEST-EXP-P6C-C-${s}`, { companyId: C, expenseId: `TEST-EXP-P6C-C-${s}`, documentType: "Expense", poRef: `TEST-PO-P6C-C-${s}`, projectId: PRJ, subTotal: 9999, isDeleted: false }],
    [`companies/${C}/expenses/TEST-EXP-P6C-S-${s}`, { companyId: C, expenseId: `TEST-EXP-P6C-S-${s}`, documentType: "Subcontract", projectId: PRJ, subTotal: 20000, isDeleted: false }],
    [`companies/${C}/journal_entries/TEST-JV-P6C-W-${s}`, { companyId: C, projectId: PRJ, reference: `WIP-${s}`, description: "[WIP ASSET] TEST ค่าเดินทาง", items: [{ accountCode: "1161-00", debit: 700, credit: 0 }, { accountCode: "1111-00", debit: 0, credit: 700 }], totalDebit: 700, totalCredit: 700, status: "draft", isDeleted: false }],
    [`companies/${C}/sales_orders/${SO}`, { companyId: C, documentNo: SO, projectId: PRJ, status: "DELIVERED", isDeleted: false }],
    [`companies/${C}/journal_entries/TEST-JV-P6C-COGS-${s}`, { companyId: C, reference: SO, description: "[AUTO] เบิกสินค้า TEST x1", items: [{ accountCode: "5111-00", debit: 4500, credit: 0 }, { accountCode: "1141-00", debit: 0, credit: 4500 }], totalDebit: 4500, totalCredit: 4500, status: "draft", isDeleted: false }],
  ];
  let claimId = "";
  try {
    for (const [p, d] of docs) await db.doc(p).set(d);

    const bad = await acct("/api/finance/expenses", { action: "claim", employeeId: EMP, description: "TEST", subtotal: 100, projectId: "NO-SUCH-PROJECT" });
    ok("claim with unknown project rejected", bad.status === 400, JSON.stringify(bad.body));
    const cl = await acct("/api/finance/expenses", { action: "claim", employeeId: EMP, description: "TEST ค่าน้ำมันไซต์งาน", subtotal: 1500, projectId: PRJ });
    claimId = cl.body.expenseId || "";
    const cd = claimId ? (await db.doc(`companies/${C}/expenses/${claimId}`).get()).data() : {};
    ok("claim stores project", cl.status === 200 && cd.projectId === PRJ && cd.projectName === "TEST ต้นทุนโครงการ", JSON.stringify(cl.body));

    ok("technician (no project/finance view) cannot read costs", (await tech("/api/projects/costs", { projectDocId: PRJ })).status === 403);
    const c = await acct("/api/projects/costs", { projectDocId: PRJ });
    const by = (no) => c.body.lines?.find((l) => l.docNo === no);
    ok("project PO expense counted as materials", by(`TEST-EXP-P6C-B-${s}`)?.amount === 30000 && by(`TEST-EXP-P6C-B-${s}`)?.category === "materials", JSON.stringify(c.body).slice(0, 300));
    ok("stock PO expense NOT counted (cost comes at stock issue)", !by(`TEST-EXP-P6C-C-${s}`));
    ok("subcontract counted as labor", by(`TEST-EXP-P6C-S-${s}`)?.category === "labor");
    ok("claim counted as operating", by(claimId)?.amount === 1500 && by(claimId)?.category === "operating");
    ok("site expense counted", by(`WIP-${s}`)?.amount === 700);
    ok("stock issued for project SO counted at cost", by(SO)?.amount === 4500 && by(SO)?.category === "materials");
    ok("approved project PO not yet expensed is committed", c.body.committed?.length === 1 && c.body.committed[0].amount === 12000, JSON.stringify(c.body.committed));
    const total = (c.body.lines || []).reduce((a, l) => a + l.amount, 0);
    ok("total actual = 30,000 + 20,000 + 1,500 + 700 + 4,500 = 56,700", total === 56700, String(total));
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const [p] of docs) await db.doc(p).delete();
    if (claimId) await db.doc(`companies/${C}/expenses/${claimId}`).delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
