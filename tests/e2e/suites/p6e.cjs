// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// Phase 6E: cron แจ้งเตือนประจำวัน (ใบแจ้งหนี้ใกล้ครบ/เลยกำหนด + งวดงานยังไม่เรียกเก็บ) ในบริษัททดสอบแยก
// MOCK_SMTP=1 + dev server ที่ตั้ง SMTP_HOST=127.0.0.1 SMTP_PORT=2525 -> ตรวจอีเมลสรุปด้วย
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const net = require("net");
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const S = process.env.CRON_SECRET;
const cron = async (qs, auth = true) => { const r = await fetch(`${E2E_BASE}/api/cron/daily${qs}`, { headers: auth ? { Authorization: `Bearer ${S}` } : {} }); return { status: r.status, body: await r.json().catch(() => ({})) }; };

const mails = [];
function mockSmtp(port) {
  return new Promise((resolve) => {
    const srv = net.createServer((sock) => {
      let buf = "", inData = false, cur = { rcpt: [], data: "" };
      sock.write("220 mock ESMTP\r\n");
      sock.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        while (true) {
          if (inData) { const end = buf.indexOf("\r\n.\r\n"); if (end < 0) return; cur.data = buf.slice(0, end); buf = buf.slice(end + 5); inData = false; mails.push(cur); cur = { rcpt: [], data: "" }; sock.write("250 OK\r\n"); continue; }
          const i = buf.indexOf("\r\n"); if (i < 0) return;
          const line = buf.slice(0, i); buf = buf.slice(i + 2); const cmd = line.slice(0, 4).toUpperCase();
          if (cmd === "EHLO" || cmd === "HELO") sock.write("250-mock\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
          else if (cmd === "AUTH") sock.write("235 OK\r\n");
          else if (cmd === "RCPT") { cur.rcpt.push(line.match(/<([^>]+)>/)?.[1]); sock.write("250 OK\r\n"); }
          else if (cmd === "DATA") { inData = true; sock.write("354 go\r\n"); }
          else if (cmd === "QUIT") { sock.write("221 Bye\r\n"); sock.end(); }
          else sock.write("250 OK\r\n");
        }
      });
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}

(async () => {
  const s = Date.now();
  const CO = `TEST-CO-P6E-${s}`;
  const base = `companies/${CO}`;
  const smtp = process.env.MOCK_SMTP ? await mockSmtp(2525) : null;
  const users = [[`test-p6e-acct-${s}`, "ACCOUNTANT", "acct@example.com"], [`test-p6e-sales-${s}`, "SALES", "sales@example.com"], [`test-p6e-pm-${s}`, "ENGINEER", "pm@example.com"]];
  try {
    await db.doc(base).set({ name: "TEST บริษัทแจ้งเตือน", isDeleted: false });
    for (const [uid, role, email] of users) await db.doc(`users/${uid}`).set({ companyId: CO, role, roles: [role], email, status: "ACTIVE" });
    const inv = (id, dueDate, extra = {}) => db.doc(`${base}/invoices/${id}`).set({ companyId: CO, invoiceNo: id, customerName: "TEST ลูกค้า", dueDate, grandTotal: 1070, balance: 1070, paymentStatus: "unpaid", status: "issued", isDeleted: false, ...extra });
    await inv("INV-SOON", "2026-10-20");
    await inv("INV-OD7", "2026-10-10");
    await inv("INV-PAID", "2026-10-01", { balance: 0, paymentStatus: "paid" });
    await db.doc(`${base}/projects/P1`).set({ companyId: CO, projectId: "PRJ-T1", projectName: "TEST งาน", status: "In Progress", projectManagerUid: users[2][0], isDeleted: false,
      milestones: [{ id: "m1", name: "งวด 1", amount: 5000, endDate: "2026-10-01", progress: 80 }, { id: "m2", name: "งวด 2", amount: 5000, endDate: "2026-12-01", progress: 10 }, { id: "m3", name: "งวด 3", amount: 5000, endDate: "2026-10-05", progress: 100 }] });
    await db.doc(`${base}/invoices/PB-M3`).set({ companyId: CO, invoiceNo: "PB-M3", docKind: "progress", projectDocId: "P1", milestoneId: "m3", grandTotal: 5000, balance: 0, paymentStatus: "paid", status: "issued", isDeleted: false });

    ok("cron without secret -> 401", (await cron(`?company=${CO}`, false)).status === 401);
    const r1 = await cron(`?company=${CO}&today=2026-10-18`);
    const rep = r1.body.billing?.[0] || {};
    ok("run 1: 2 invoice reminders + 1 unbilled milestone", r1.status === 200 && rep.invoices === 2 && rep.milestones === 1 && rep.created === 3, JSON.stringify(r1.body));
    const notes = (await db.collection(`${base}/notifications`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const byType = (t) => notes.filter((n) => n.type === t);
    ok("due-soon notifies accountants", byType("INVOICE_DUE_SOON").length === 1 && byType("INVOICE_DUE_SOON")[0].targetRoles.includes("ACCOUNTANT"));
    ok("overdue (7 days) notifies accountants + executives", byType("INVOICE_OVERDUE").length === 1 && /เลยกำหนด 8 วัน/.test(byType("INVOICE_OVERDUE")[0].title) && byType("INVOICE_OVERDUE")[0].targetRoles.includes("EXECUTIVE"), JSON.stringify(byType("INVOICE_OVERDUE")));
    const ms = byType("MILESTONE_UNBILLED");
    ok("unbilled milestone -> roles + project manager", ms.length === 2 && ms.some((n) => n.targetUserId === users[2][0]) && ms.some((n) => n.targetRoles.includes("SALES")) && ms.every((n) => n.link === "/projects/P1?tab=billing"), JSON.stringify(ms.map((n) => [n.id, n.targetUserId, n.targetRoles])));
    const r2 = await cron(`?company=${CO}&today=2026-10-18`);
    ok("run 2 same day: nothing new (deduped)", r2.body.billing?.[0]?.created === 0 && (await db.collection(`${base}/notifications`).get()).size === notes.length, JSON.stringify(r2.body));
    const r3 = await cron(`?company=${CO}&today=2026-11-12`);
    ok("later: overdue reaches the 30-day bucket -> new reminder", r3.body.billing?.[0]?.created >= 1 && (await db.collection(`${base}/notifications`).get()).docs.some((d) => /od30/.test(d.id)), JSON.stringify(r3.body));
    if (smtp) {
      const m = mails[0];
      ok("digest email to finance viewers only", m && m.rcpt.includes("acct@example.com") && !m.rcpt.includes("sales@example.com") && !m.rcpt.includes("pm@example.com") && r1.body.billing[0].emailed === 1, JSON.stringify(mails.map((x) => x.rcpt)));
      ok("no email when nothing new", mails.length === 2, String(mails.length)); // run1 + run3
    } else {
      ok("email skipped when SMTP not configured", rep.emailed === 0 && !rep.emailError);
    }
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const c of ["invoices", "projects", "notifications"]) for (const d of (await db.collection(`${base}/${c}`).get()).docs) await d.ref.delete();
    await db.doc(base).delete();
    for (const [uid] of users) await db.doc(`users/${uid}`).delete();
    smtp?.close();
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
