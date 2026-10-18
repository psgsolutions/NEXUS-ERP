// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
const path = require("path");
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = process.env.BASE_URL || E2E_BASE + "";
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const L = (code, debit, credit) => ({ accountCode: code, debit, credit });
const J = [
  ["TEST-FR-1", "2020-01-05", [L("1112-00", 10000, 0), L("3111-00", 0, 10000)], "posted"],
  ["TEST-FR-2", "2020-01-10", [L("1131-00", 10700, 0), L("4111-00", 0, 10000), L("2121-00", 0, 700)], "posted"],
  ["TEST-FR-3", "2020-01-20", [L("5300-00", 2000, 0), L("1112-00", 0, 2000)], "posted"],
  ["TEST-FR-4", "2020-02-05", [L("1112-00", 10700, 0), L("1131-00", 0, 10700)], "posted"],
  ["TEST-FR-5", "2020-01-25", [L("5300-00", 999, 0), L("1111-00", 0, 999)], "draft"],
  ["TEST-FR-6", "2020-01-26", [L("5300-00", 555, 0), L("1111-00", 0, 555)], "cancelled"],
];
(async () => {
  const acct = `test-fr-acct-${Date.now()}`, sales = `test-fr-sales-${Date.now()}`;
  await db.doc(`users/${acct}`).set({ companyId: C, roles: ["ACCOUNTANT"], role: "ACCOUNTANT", status: "ACTIVE" });
  await db.doc(`users/${sales}`).set({ companyId: C, roles: ["SALES"], role: "SALES", status: "ACTIVE" });
  for (const [id, date, items, status] of J) await db.doc(`companies/${C}/journal_entries/${id}`).set({ companyId: C, date, items, status, reference: id, description: "TEST report", isTest: true });
  const ta = await tok(acct), ts = await tok(sales);
  const call = (t, body) => fetch(`${BASE}/api/reports/financial`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ companyId: C, ...body }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  try {
    const s = await call(ts, { report: "tb", from: "2020-01", to: "2020-01" });
    ok("SALES blocked", s.status === 403, s.status);
    const tb = await call(ta, { report: "tb", from: "2020-01", to: "2020-01" });
    const row = (c) => tb.body.rows?.find((r) => r.code === c) || {};
    ok("TB balanced, totals 22,700", tb.body.balanced && tb.body.totals.periodDebit === 22700 && tb.body.totals.periodCredit === 22700, JSON.stringify(tb.body.totals));
    ok("TB bank closing Dr 8,000", row("1112-00").closingDebit === 8000, JSON.stringify(row("1112-00")));
    ok("TB excludes draft/cancelled (no 1111)", !tb.body.rows.some((r) => r.code === "1111-00"));
    const tb2 = await call(ta, { report: "tb", from: "2020-02", to: "2020-02" });
    const r2 = tb2.body.rows?.find((r) => r.code === "1112-00") || {};
    ok("TB Feb opening 8,000 closing 18,700", r2.openingDebit === 8000 && r2.closingDebit === 18700, JSON.stringify(r2));
    const pl = await call(ta, { report: "pl", from: "2020-01", to: "2020-01" });
    ok("P&L revenue 10,000 expense 2,000 net 8,000", pl.body.totalRevenue === 10000 && pl.body.totalExpense === 2000 && pl.body.netProfit === 8000, JSON.stringify({ r: pl.body.totalRevenue, e: pl.body.totalExpense, n: pl.body.netProfit }));
    const bs = await call(ta, { report: "bs", to: "2020-01" });
    ok("BS assets 18,700 = L 700 + E 18,000", bs.body.balanced && bs.body.totalAssets === 18700 && bs.body.totalLiabilities === 700 && bs.body.totalEquity === 18000, JSON.stringify({ a: bs.body.totalAssets, l: bs.body.totalLiabilities, e: bs.body.totalEquity }));
    const gl = await call(ta, { report: "gl", from: "2020-02", to: "2020-02", account: "1112-00" });
    ok("GL bank Feb opening 8,000 closing 18,700", gl.body.ledger?.opening === 8000 && gl.body.ledger?.closing === 18700 && gl.body.ledger.entries.length === 1, JSON.stringify({ o: gl.body.ledger?.opening, c: gl.body.ledger?.closing, n: gl.body.ledger?.entries?.length }));
    const gl3 = await call(ta, { report: "gl", from: "2020-01", to: "2020-01", account: "3111-00" });
    ok("GL capital (credit-normal) balance 10,000", gl3.body.ledger?.closing === 10000, JSON.stringify(gl3.body.ledger?.closing));
    ok("GL account list returned", Array.isArray(gl.body.accounts) && gl.body.accounts.some((a) => a.code === "1112-00"));
    for (const r of ["vat-out", "vat-in", "pnd3", "pnd53"]) {
      const x = await call(ta, { report: r });
      ok(`${r} current month responds`, x.status === 200 && Array.isArray(x.body.rows), JSON.stringify(x.body).slice(0, 160));
    }
    const bad = await call(ta, { report: "tb", from: "2020-03", to: "2020-01" });
    ok("from > to rejected", bad.status === 400);
  } catch (e) { fails++; console.log("ERROR", e); }
  finally {
    for (const [id] of J) await db.doc(`companies/${C}/journal_entries/${id}`).delete();
    for (const u of [acct, sales]) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log(fails ? `${fails} FAILED` : "ALL PASS"); process.exit(0);
  }
})();
