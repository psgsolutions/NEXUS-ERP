// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
const path = require("path"); const root = E2E_ROOT;
require("@next/env").loadEnvConfig(root);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10)) }) });
const db = admin.firestore(); const C = "COM-NEXUS-01";
const ok = (label, cond, extra = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${label} ${extra}`);
const jstr = (j) => j.items.map((l) => `${l.accountCode}:${l.debit}/${l.credit}`).join(" ");

(async () => {
  const user = (await db.collection("users").where("companyId", "==", C).where("role", "==", "ADMIN").limit(1).get()).docs[0];
  const tok = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(user.id), returnSecureToken: true }) })).json();
  const call = (url, body) => fetch(`${E2E_BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok.idToken}` }, body: JSON.stringify({ companyId: C, ...body }) }).then(async (x) => ({ status: x.status, body: await x.json() }));
  const counter = db.doc(`companies/${C}/counters/EMP`); const cBefore = (await counter.get()).data() || null;
  const P = (p) => db.doc(`companies/${C}/payrolls/${p}`);
  const J = (id) => db.doc(`companies/${C}/journal_entries/${id}`);
  const made = { emps: [], journals: [] };
  const PR = (b) => call("/api/hr/payroll", b);
  const pre = await Promise.all(["2025-02", "2025-03"].map(async (p) => (await P(p).get()).exists));
  if (pre.some(Boolean)) { console.log("periods already exist, abort"); process.exit(1); }
  try {
    const e1 = await call("/api/hr/employees", { firstName: "เงินเดือน", lastName: "รายเดือน", position: "วิศวกร", salary: 30000, citizenId: "1100000000011", joinDate: "2024-01-01" });
    const e2 = await call("/api/hr/employees", { firstName: "เงินเดือน", lastName: "รายวัน", position: "ช่าง", salary: 500, employmentType: "daily", socialSecurity: false, citizenId: "1100000000012", joinDate: "2024-01-01" });
    made.emps.push(e1.body.docId, e2.body.docId);
    const lines = [{ employeeDocId: e1.body.docId }, { employeeDocId: e2.body.docId, workDays: 20, allowance: 500, otherDeduction: 200 }];
    const s1 = await PR({ period: "2025-02", action: "save", lines });
    const d = (await P("2025-02").get()).data();
    const l1 = d.lines.find((l) => l.employeeDocId === e1.body.docId), l2 = d.lines.find((l) => l.employeeDocId === e2.body.docId);
    ok("monthly 30,000: SSO 875, WHT 164.58, net 28,960.42", l1.sso === 875 && l1.wht === 164.58 && l1.net === 28960.42, JSON.stringify({ sso: l1.sso, wht: l1.wht, net: l1.net }));
    ok("daily 500x20 + 500 allowance - 200: no SSO, no tax, net 10,300", l2.base === 10000 && l2.sso === 0 && l2.wht === 0 && l2.net === 10300, JSON.stringify({ base: l2.base, sso: l2.sso, wht: l2.wht, net: l2.net }));
    ok("totals", s1.status === 200 && d.totalGross === 40500 && d.totalNet === 39260.42 && d.status === "draft", JSON.stringify(s1.body.totals));
    const a1 = await PR({ period: "2025-02", action: "approve" }); made.journals.push(a1.body.journalId);
    const ja = a1.body.journalId && (await J(a1.body.journalId).get()).data();
    ok("approve journal", ja && jstr(ja) === "5211-00:40500/0 5212-00:875/0 2133-00:0/1750 2131-00:0/164.58 1132-00:0/200 2142-00:0/39260.42" && ja.date === "2025-02-28", ja && jstr(ja));
    const s2 = await PR({ period: "2025-02", action: "save", lines });
    ok("save after approve rejected", s2.status === 409, s2.body.error);
    const p0 = await PR({ period: "2025-02", action: "pay", payDate: "2025-03-01" });
    ok("pay needs bank account", p0.status === 400, p0.body.error);
    const p1 = await PR({ period: "2025-02", action: "pay", payDate: "2025-03-01", bankAccount: "กสิกร 999" }); made.journals.push(p1.body.journalId);
    const jp = p1.body.journalId && (await J(p1.body.journalId).get()).data();
    ok("pay journal Dr2142 / Cr1112", jp && jstr(jp) === "2142-00:39260.42/0 1112-00:0/39260.42" && (await P("2025-02").get()).data().status === "paid", jp && jstr(jp));
    const c1 = await PR({ period: "2025-02", action: "cancel", reason: "x" });
    ok("cancel after paid rejected", c1.status === 409, c1.body.error);

    await PR({ period: "2025-03", action: "save", lines });
    const a2 = await PR({ period: "2025-03", action: "approve" }); made.journals.push(a2.body.journalId);
    await J(a2.body.journalId).update({ status: "posted" });
    const c2 = await PR({ period: "2025-03", action: "cancel", reason: "คำนวณใหม่" });
    const rev = (await P("2025-03").get()).data().reversalJournalId; made.journals.push(rev);
    ok("cancel approved (posted) -> reversal", c2.status === 200 && c2.body.journal === "reversed" && !!rev, JSON.stringify(c2.body));
    const s3 = await PR({ period: "2025-03", action: "save", lines });
    ok("re-save cancelled period as draft", s3.status === 200 && (await P("2025-03").get()).data().status === "draft");
  } catch (e) { console.error("ERR", e); } finally {
    for (const p of ["2025-02", "2025-03"]) await P(p).delete();
    for (const j of made.journals.filter(Boolean)) await J(j).delete();
    for (const t of ["2025-02", "2025-03"]) { const l = await db.collection("logs").where("targetId", "==", t).get(); await Promise.all(l.docs.map((x) => x.ref.delete())); }
    for (const id of made.emps.filter(Boolean)) { const l = await db.collection("logs").where("targetId", "==", id).get(); await Promise.all(l.docs.map((x) => x.ref.delete())); await db.doc(`employees/${id}`).delete(); }
    await (cBefore ? counter.set(cBefore) : counter.delete());
    console.log("cleaned up"); process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
