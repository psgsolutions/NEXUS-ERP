// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// D5: ลิงก์เอกสารสำหรับลูกค้า + ประวัติการส่ง + อีเมล (ผ่าน SMTP จำลองในเครื่องเมื่อ MOCK_SMTP=1)
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const net = require("net");
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const toks = {};
const call = (uid) => async (b) => {
  toks[uid] = toks[uid] || await tok(uid);
  const r = await fetch(E2E_BASE + "/api/documents/share", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + toks[uid] }, body: JSON.stringify({ companyId: C, ...b }) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const pub = async (token, qs = "") => { const r = await fetch(`${E2E_BASE}/api/public/documents/${token}${qs}`); return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "", cd: r.headers.get("content-disposition") || "" }; };

// ถอดส่วนข้อความ (base64 / quoted-printable) ของอีเมลเพื่อตรวจเนื้อหา
const decoded = (raw) => raw.split(/\r?\n\r?\n/).map((part) => { const t = part.replace(/\r?\n/g, ""); return /^[A-Za-z0-9+/=]{40,}$/.test(t) ? Buffer.from(t, "base64").toString("utf8") : part.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))); }).join("\n");
// SMTP จำลอง (รับทุกอย่าง เก็บข้อความไว้ตรวจ)
const mails = [];
function mockSmtp(port) {
  return new Promise((resolve) => {
    const srv = net.createServer((sock) => {
      let buf = "", inData = false, cur = { rcpt: [], data: "" };
      sock.write("220 mock ESMTP\r\n");
      sock.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        while (true) {
          if (inData) {
            const end = buf.indexOf("\r\n.\r\n");
            if (end < 0) return;
            cur.data = buf.slice(0, end); buf = buf.slice(end + 5); inData = false; mails.push(cur); cur = { rcpt: [], data: "" };
            sock.write("250 OK queued\r\n"); continue;
          }
          const i = buf.indexOf("\r\n"); if (i < 0) return;
          const line = buf.slice(0, i); buf = buf.slice(i + 2);
          const cmd = line.slice(0, 4).toUpperCase();
          if (cmd === "EHLO" || cmd === "HELO") sock.write("250-mock\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
          else if (cmd === "AUTH") sock.write("235 Authentication successful\r\n");
          else if (cmd === "MAIL") { cur.from = line; sock.write("250 OK\r\n"); }
          else if (cmd === "RCPT") { cur.rcpt.push(line.match(/<([^>]+)>/)?.[1]); sock.write("250 OK\r\n"); }
          else if (cmd === "DATA") { inData = true; sock.write("354 End data with <CR><LF>.<CR><LF>\r\n"); }
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
  const U = { sales: `test-d5s-${s}`, hr: `test-d5h-${s}`, acct: `test-d5a-${s}` };
  const ROLE = { sales: "SALES", hr: "HR", acct: "ACCOUNTANT" };
  for (const k of Object.keys(U)) await db.doc(`users/${U[k]}`).set({ companyId: C, roles: [ROLE[k]], role: ROLE[k], status: "ACTIVE" });
  const sales = call(U.sales), hr = call(U.hr), acct = call(U.acct);
  const SO = `TEST-SO-D5-${s}`;
  const JV = `TEST-JV-D5-${s}`;
  const smtp = process.env.MOCK_SMTP ? await mockSmtp(2525) : null;
  try {
    await db.doc(`companies/${C}/sales_orders/${SO}`).set({ companyId: C, documentNo: SO, soId: SO, status: "Confirmed", customerName: "TEST ลูกค้า D5", customerSnapshot: { name: "TEST ลูกค้า D5", taxId: "0105555555555", address: "TEST" }, vatType: "Exclude VAT", items: [{ name: "TEST บริการ", qty: 1, unit: "งาน", price: 1000, itemType: "SERVICE" }], subTotal: 1000, vatAmount: 70, grandTotal: 1070, isDeleted: false });
    await db.doc(`companies/${C}/journal_entries/${JV}`).set({ companyId: C, date: "2026-10-18", description: "TEST", items: [{ accountCode: "1111-00", accountName: "เงินสด", debit: 1, credit: 0 }, { accountCode: "4111-00", accountName: "รายได้", debit: 0, credit: 1 }], status: "draft", isDeleted: false });

    const st0 = await sales({ action: "status", type: "sales_order", id: SO });
    ok("status: not internal, email readiness reported", st0.status === 200 && st0.body.internal === false && typeof st0.body.emailReady === "boolean", JSON.stringify(st0.body));
    const l1 = await sales({ action: "link", type: "sales_order", id: SO });
    const l2 = await sales({ action: "link", type: "sales_order", id: SO, channel: "line" });
    ok("link created as /d/{token}; second request reuses the same live link", l1.status === 200 && /\/d\/[A-Za-z0-9_-]{32}$/.test(l1.body.url) && l2.body.token === l1.body.token, JSON.stringify([l1.body, l2.body]));
    const T = l1.body.token;
    const share = (await db.doc(`document_shares/${T}`).get()).data();
    ok("share stored with 30-day expiry", share && Math.abs(share.expiresAt.toMillis() - (Date.now() + 30 * 86400e3)) < 120e3 && share.docKey === `sales_order/${SO}`);

    const info = await pub(T);
    const j = JSON.parse(info.buf.toString());
    ok("public info without login", info.status === 200 && j.document.title === "ใบสั่งขาย" && j.document.number === SO && j.document.total === 1070, info.buf.toString().slice(0, 200));
    const p = await pub(T, "?pdf=1");
    ok("public PDF inline", p.status === 200 && p.buf.slice(0, 4).toString() === "%PDF" && p.cd.startsWith("inline"));
    const pd = await pub(T, "?pdf=1&download=1");
    ok("public PDF download", pd.status === 200 && pd.cd.startsWith("attachment"));
    const share2 = (await db.doc(`document_shares/${T}`).get()).data();
    ok("view counted (inline only)", share2.views === 1, String(share2.views));

    const page = await fetch(`${E2E_BASE}/d/${T}`);
    ok("customer page /d/{token} renders without login", page.status === 200);
    ok("bad token format -> 404", (await pub("short")).status === 404);
    ok("unknown token -> 404", (await pub("A".repeat(32))).status === 404);

    ok("internal document (journal) cannot be shared", (await acct({ action: "link", type: "journal", id: JV })).status === 400);
    ok("HR (no sales/finance view) cannot share SO", (await hr({ action: "link", type: "sales_order", id: SO })).status === 403);

    if (!process.env.MOCK_SMTP) {
      const e = await sales({ action: "email", type: "sales_order", id: SO, to: "test@example.com" });
      ok("email without SMTP config -> 503 with Thai message", e.status === 503 && /ยังไม่ได้ตั้งค่าอีเมล/.test(e.body.error), JSON.stringify(e.body));
    } else {
      const bad = await sales({ action: "email", type: "sales_order", id: SO, to: "not-an-email" });
      ok("invalid recipient rejected", bad.status === 400);
      const inj = await sales({ action: "email", type: "sales_order", id: SO, to: "a@example.com\r\nBcc: evil@example.com" });
      ok("header injection attempt rejected", inj.status === 400, JSON.stringify(inj.body));
      const e = await sales({ action: "email", type: "sales_order", id: SO, to: "customer@example.com, boss@example.com", cc: "me@example.com", message: "TEST เรียนลูกค้า\nบรรทัดสอง <b>ไม่เป็นตัวหนา</b>" });
      const m = mails.at(-1);
      ok("email sent via SMTP with link + PDF attachment", e.status === 200 && m && m.rcpt.length === 3 && /application\/pdf/.test(m.data) && decoded(m.data).includes(`${E2E_BASE}/d/${T}`) && !decoded(m.data).includes("<b>ไม่"), JSON.stringify(e.body) + " " + (m ? m.data.slice(0, 300) : "no mail"));
      ok("email subject defaults to document title (encoded)", m && /Subject: /i.test(m.data));
    }

    const st1 = await sales({ action: "status", type: "sales_order", id: SO });
    ok("send log records link/line" + (process.env.MOCK_SMTP ? "/email" : ""), st1.body.sends.some((x) => x.channel === "line") && st1.body.sends.some((x) => x.channel === "link") && (!process.env.MOCK_SMTP || st1.body.sends.some((x) => x.channel === "email" && x.status === "sent")), JSON.stringify(st1.body.sends));

    const rv = await sales({ action: "revoke", type: "sales_order", id: SO, token: T });
    const after = await pub(T);
    ok("revoked link stops working with Thai reason", rv.status === 200 && after.status === 404 && /ยกเลิก/.test(JSON.parse(after.buf.toString()).error));
    const l3 = await sales({ action: "link", type: "sales_order", id: SO });
    ok("after revoke a new token is issued", l3.status === 200 && l3.body.token !== T);
    await db.doc(`document_shares/${l3.body.token}`).update({ expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000) });
    const ex = await pub(l3.body.token);
    ok("expired link -> 404 หมดอายุ", ex.status === 404 && /หมดอายุ/.test(JSON.parse(ex.buf.toString()).error));
    await db.doc(`companies/${C}/sales_orders/${SO}`).update({ status: "CANCELLED", cancelReason: "TEST" });
    const l4 = await sales({ action: "link", type: "sales_order", id: SO });
    const i4 = JSON.parse((await pub(l4.body.token)).buf.toString());
    ok("cancelled document shows as cancelled on the public page", i4.document?.cancelled === true);
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const d of (await db.collection("document_shares").where("companyId", "==", C).where("docKey", "in", [`sales_order/${SO}`, `journal/${JV}`]).get()).docs) await d.ref.delete();
    for (const d of (await db.collection(`companies/${C}/document_sends`).where("docKey", "==", `sales_order/${SO}`).get()).docs) await d.ref.delete();
    await db.doc(`companies/${C}/sales_orders/${SO}`).delete();
    await db.doc(`companies/${C}/journal_entries/${JV}`).delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    smtp?.close();
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
