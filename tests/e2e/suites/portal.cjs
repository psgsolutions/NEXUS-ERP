// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// ทดสอบพอร์ทัลแจ้งซ่อม (5B) กับฐานข้อมูลจริง — ข้อมูลติดป้าย TEST และลบทิ้ง/คืนตัวนับเมื่อจบ
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
const { createHash } = require("node:crypto");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY; const BASE = E2E_BASE + "";
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const hashKey = (v) => createHash("sha256").update(`${process.env.RATE_LIMIT_SALT || "nexus-rl"}:${v}`).digest("hex").slice(0, 32);
const PHOTO = "data:image/jpeg;base64," + Buffer.from("TESTJPEG").toString("base64");

(async () => {
  const s = Date.now(); const IP = `203.0.113.${s % 250}`; const IP2 = `198.51.100.${s % 250}`;
  const U = { sales: "test-pr-sales-" + s };
  await db.doc("users/" + U.sales).set({ companyId: C, roles: ["SALES"], role: "SALES", name: "TEST ขาย", status: "ACTIVE" });
  const t = await tok(U.sales);
  const staff = (b) => fetch(BASE + "/api/service/tickets", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ companyId: C, ...b }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const portal = (b, ip = IP) => fetch(BASE + "/api/portal/repair", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ company: C, ...b }) }).then(async (r) => ({ status: r.status, body: await r.json(), retry: r.headers.get("retry-after") }));
  const tkCounter = (await db.doc(`companies/${C}/counters/TK`).get()).data() || null;
  const created = []; let ticketNo;
  try {
    const g = await (await fetch(`${BASE}/api/portal/repair?company=${C}`)).json();
    ok("GET valid company link", g.success === true && typeof g.company.name === "string", JSON.stringify(g));
    const g2 = await fetch(`${BASE}/api/portal/repair?company=NO-SUCH-CO`);
    ok("GET unknown company 404", g2.status === 404);
    const g3 = await fetch(`${BASE}/api/portal/repair?company=${encodeURIComponent("../users")}`);
    ok("GET rejects path-like company id", g3.status === 404);

    const bad1 = await portal({ phoneNumber: "12", symptom: "TEST เปิดไม่ติด" });
    ok("bad phone 400", bad1.status === 400);
    const bad2 = await portal({ phoneNumber: "0812345678", symptom: "" });
    ok("symptom required 400", bad2.status === 400);
    const bad3 = await portal({ phoneNumber: "0812345678", symptom: "TEST x", photo: "data:text/html;base64,PHNjcmlwdD4=" });
    ok("non-image photo rejected", bad3.status === 400);
    const bad4 = await portal({ phoneNumber: "0812345678", symptom: "TEST x", photo: "data:image/jpeg;base64," + "A".repeat(800000) });
    ok("oversized photo rejected", bad4.status === 400);
    const bad5 = await portal({ company: "NO-SUCH-CO", phoneNumber: "0812345678", symptom: "TEST x" });
    ok("unknown company POST 404", bad5.status === 404);

    const hp = await portal({ phoneNumber: "0812345678", symptom: "TEST bot", website: "http://spam" });
    const hpDocs = await db.collection(`companies/${C}/portal_requests`).where("symptom", "==", "TEST bot").get();
    ok("honeypot pretends success but stores nothing", hp.status === 200 && hpDocs.empty);

    const p1 = await portal({ phoneNumber: "081-234-5678", customerName: "TEST คุณลูกค้า", serialNumber: "sn-test-1", symptom: "TEST กล้องไม่มีภาพ", photo: PHOTO });
    if (p1.body.requestId) created.push(p1.body.requestId);
    const d1 = p1.body.requestId ? (await db.doc(`companies/${C}/portal_requests/${p1.body.requestId}`).get()).data() : null;
    ok("valid request stored in company inbox", p1.status === 200 && d1 && d1.status === "NEW" && d1.phoneNumber === "0812345678" && d1.serialNumber === "SN-TEST-1" && d1.hasPhoto === true && d1.ipHash === hashKey(IP) && !JSON.stringify(d1).includes(IP), JSON.stringify(p1.body));

    const p2 = await portal({ phoneNumber: "0899999999", symptom: "TEST แจ้งซ้ำ" });
    if (p2.body.requestId) created.push(p2.body.requestId);

    const ls = await staff({ action: "list" });
    const item = ls.body.portal?.find((p) => p.id === p1.body.requestId);
    ok("staff list shows inbox request without photo/IP", ls.status === 200 && item && item.hasPhoto === true && !("photo" in item) && !("ipHash" in item) && item.customerName === "TEST คุณลูกค้า", JSON.stringify(item));

    const ph = await staff({ action: "portalPhoto", portalId: p1.body.requestId });
    ok("staff can view attached photo", ph.status === 200 && ph.body.photo === PHOTO);
    const ph2 = await staff({ action: "portalPhoto", portalId: "../../users/x" });
    ok("photo lookup rejects bad id", ph2.status === 400 || ph2.status === 404);

    const c = await staff({ action: "create", ticket: { customerName: "TEST คุณลูกค้า", phone: "0812345678", symptom: "TEST กล้องไม่มีภาพ", serialNumber: "SN-TEST-1" }, portalId: p1.body.requestId });
    ticketNo = c.body.ticketNo;
    const after = (await db.doc(`companies/${C}/portal_requests/${p1.body.requestId}`).get()).data();
    const tdoc = ticketNo ? (await db.doc(`companies/${C}/service_tickets/${ticketNo}`).get()).data() : null;
    ok("take over -> ticket TK + inbox ACCEPTED", c.status === 200 && after.ticketNo === ticketNo && after.status === "ACCEPTED" && tdoc.channel === "PORTAL" && tdoc.portalId === p1.body.requestId, JSON.stringify(c.body));
    const again = await staff({ action: "create", ticket: { phone: "0812345678", symptom: "x" }, portalId: p1.body.requestId });
    ok("cannot take over twice", again.status === 409);

    const dm = await staff({ action: "dismissPortal", portalId: p2.body.requestId });
    const dd = (await db.doc(`companies/${C}/portal_requests/${p2.body.requestId}`).get()).data();
    const ls2 = await staff({ action: "list" });
    ok("dismiss removes from inbox", dm.status === 200 && dd.status === "DISMISSED" && !ls2.body.portal.some((p) => p.id === p2.body.requestId));
    const dm2 = await staff({ action: "dismissPortal", portalId: p1.body.requestId });
    ok("cannot dismiss accepted request", dm2.status === 409);

    // จำกัด 5 ครั้ง/ชม. ต่อ IP: ใช้ไปแล้ว 2 (p1, p2) + คำขอที่ไม่ผ่านการตรวจไม่นับ
    const more = [];
    for (let i = 0; i < 4; i++) more.push(await portal({ phoneNumber: "0811111111", symptom: "TEST rate " + i }));
    more.forEach((r) => r.body.requestId && created.push(r.body.requestId));
    ok("6th request in an hour is blocked (429 + Retry-After)", more.slice(0, 3).every((r) => r.status === 200) && more[3].status === 429 && Number(more[3].retry) > 0, JSON.stringify(more.map((r) => r.status)));
    const other = await portal({ phoneNumber: "0811111111", symptom: "TEST other ip" }, IP2);
    if (other.body.requestId) created.push(other.body.requestId);
    ok("other IP not affected", other.status === 200);
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const id of created) await db.doc(`companies/${C}/portal_requests/${id}`).delete();
    const leftovers = await db.collection(`companies/${C}/portal_requests`).where("companyId", "==", C).get();
    for (const d of leftovers.docs) if (String(d.data().symptom || "").startsWith("TEST")) await d.ref.delete();
    if (ticketNo) await db.doc(`companies/${C}/service_tickets/${ticketNo}`).delete();
    const al = await db.collection(`companies/${C}/auditLogs`).where("entityId", "==", ticketNo || "none").get().catch(() => ({ docs: [] }));
    for (const d of al.docs) await d.ref.delete();
    tkCounter ? await db.doc(`companies/${C}/counters/TK`).set(tkCounter) : await db.doc(`companies/${C}/counters/TK`).delete();
    const rl = await db.collection("rate_limits").get();
    for (const d of rl.docs) if ([hashKey(IP), hashKey(IP2), hashKey(C)].some((h) => d.id.includes(h))) await d.ref.delete();
    await db.doc("users/" + U.sales).delete(); await admin.auth().deleteUser(U.sales).catch(() => {});
    console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
