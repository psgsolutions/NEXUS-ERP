// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = process.env.BASE_URL || E2E_BASE + "";
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
(async () => {
  const s = Date.now();
  const U = { boss: `test-j-boss-${s}`, tech: `test-j-tech-${s}`, tech2: `test-j-tech2-${s}`, hr: `test-j-hr-${s}` };
  await db.doc(`users/${U.boss}`).set({ companyId: C, roles: ["WAREHOUSE"], role: "WAREHOUSE", name: "TEST หัวหน้าคลัง", status: "ACTIVE" });
  await db.doc(`users/${U.tech}`).set({ companyId: C, roles: ["TECHNICIAN"], role: "TECHNICIAN", name: "TEST ช่างเอ", status: "ACTIVE" });
  await db.doc(`users/${U.tech2}`).set({ companyId: C, roles: ["TECHNICIAN"], role: "TECHNICIAN", name: "TEST ช่างบี", status: "ACTIVE" });
  await db.doc(`users/${U.hr}`).set({ companyId: C, roles: ["HR"], role: "HR", name: "TEST HR", status: "ACTIVE" });
  const mk = (t) => (b) => fetch(`${BASE}/api/jobs`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ companyId: C, ...b }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const boss = mk(await tok(U.boss)), tech = mk(await tok(U.tech)), tech2 = mk(await tok(U.tech2)), hr = mk(await tok(U.hr));
  const counters = {}; for (const id of ["JOB", "INV"]) counters[id] = (await db.doc(`companies/${C}/counters/${id}`).get()).data() || null;
  const prod = db.doc(`products/TEST-JOB-PROD-${s}`);
  await prod.set({ companyId: C, name: "TEST สายไฟ", sku: "TEST-W1", unit: "ม้วน", itemType: "PRODUCT", isSample: false, stockStatus: { onHand: 10, reserved: 0, available: 10 }, pricing: { costWAC: 100 }, costPrice: 100 });
  const jobs = [];
  try {
    const hrc = await hr({ action: "create", job: { title: "x" } });
    ok("HR cannot dispatch", hrc.status === 403);
    const as = await boss({ action: "assignees" });
    ok("assignees list includes technicians", as.status === 200 && as.body.assignees.some((a) => a.uid === U.tech), JSON.stringify(as.body).slice(0, 100));
    // งานจัดของ ไม่มีวัสดุ
    const j1 = await boss({ action: "create", job: { type: "PICK_PACK", title: "TEST จัดของส่งลูกค้า", scheduledDate: today, assignees: [U.tech], equipment: [{ kind: "TOOL", name: "รถเข็น", qty: 1 }] } });
    const n1 = j1.body.jobNo; if (n1) jobs.push(n1);
    const d1 = n1 ? (await db.doc(`companies/${C}/jobs/${n1}`).get()).data() : {};
    ok("create + assign -> ASSIGNED with template checklist", j1.status === 200 && d1.status === "ASSIGNED" && d1.checklist.length === 4, JSON.stringify(j1.body));
    const o1 = await tech2({ action: "accept", jobNo: n1 });
    ok("other technician cannot accept", o1.status === 403);
    const st0 = await tech({ action: "start", jobNo: n1 });
    ok("cannot start before accepting", st0.status === 409);
    const a1 = await tech({ action: "accept", jobNo: n1 });
    ok("technician accepts", a1.status === 200 && a1.body.status === "ACCEPTED", JSON.stringify(a1.body));
    const a1b = await tech({ action: "accept", jobNo: n1 });
    ok("accept twice blocked", a1b.status === 409);
    const mine = await tech({ action: "mine" });
    ok("mine lists the job", mine.status === 200 && mine.body.jobs.some((j) => j.jobNo === n1) && Array.isArray(mine.body.workOrders));
    await tech({ action: "start", jobNo: n1 });
    const ck = await tech({ action: "check", jobNo: n1, index: 0, done: true });
    const d1b = (await db.doc(`companies/${C}/jobs/${n1}`).get()).data();
    ok("checklist ticked", ck.status === 200 && d1b.checklist[0].done === true);
    const cp = await tech({ action: "complete", jobNo: n1, note: "เรียบร้อย", returnTools: true });
    const d1c = (await db.doc(`companies/${C}/jobs/${n1}`).get()).data();
    ok("complete returns tools", cp.status === 200 && d1c.status === "DONE" && d1c.equipment[0].returnedQty === 1, JSON.stringify(d1c.equipment));

    // งานซ่อมพร้อมวัสดุตัดสต็อก
    const j2 = await boss({ action: "create", job: { type: "SERVICE", title: "TEST ซ่อมระบบไฟ", assignees: [U.tech], equipment: [{ kind: "MATERIAL", productId: prod.id, name: "TEST สายไฟ", qty: 2, unit: "ม้วน" }, { kind: "TOOL", name: "สว่าน", qty: 1 }] } });
    const n2 = j2.body.jobNo; if (n2) jobs.push(n2);
    const a2 = await tech({ action: "accept", jobNo: n2 });
    const p2 = (await prod.get()).data();
    ok("accept withdraws material from stock (10 -> 8)", a2.status === 200 && a2.body.issuedMaterials === 1 && p2.stockStatus.onHand === 8, JSON.stringify({ b: a2.body, s: p2.stockStatus }));
    const rt = await boss({ action: "returnTools", jobNo: n2 });
    const d2 = (await db.doc(`companies/${C}/jobs/${n2}`).get()).data();
    ok("dispatcher records tool return", rt.status === 200 && d2.equipment.find((e) => e.kind === "TOOL").returnedQty === 1);
    const re2 = await boss({ action: "assign", jobNo: n2, assignees: [U.tech2] });
    ok("cannot reassign after materials issued", re2.status === 409, JSON.stringify(re2.body));

    // สต็อกไม่พอ
    const j3 = await boss({ action: "create", job: { type: "INSTALL", title: "TEST ติดตั้ง", assignees: [U.tech], equipment: [{ kind: "MATERIAL", productId: prod.id, name: "TEST สายไฟ", qty: 50 }] } });
    const n3 = j3.body.jobNo; if (n3) jobs.push(n3);
    const a3 = await tech({ action: "accept", jobNo: n3 });
    const d3 = (await db.doc(`companies/${C}/jobs/${n3}`).get()).data();
    ok("insufficient stock blocks accept, job stays ASSIGNED", a3.status === 409 && /สต็อก/.test(a3.body.error) && d3.status === "ASSIGNED" && (await prod.get()).data().stockStatus.onHand === 8, JSON.stringify(a3.body));
    // ปฏิเสธและจ่ายใหม่
    const rj = await tech({ action: "reject", jobNo: n3, reason: "ติดงานอื่น" });
    const ra = await boss({ action: "assign", jobNo: n3, assignees: [U.tech2] });
    const d3b = (await db.doc(`companies/${C}/jobs/${n3}`).get()).data();
    ok("reject then reassign", rj.status === 200 && ra.status === 200 && d3b.status === "ASSIGNED" && d3b.assignees[0] === U.tech2, JSON.stringify([rj.body, ra.body]));
    const cx = await boss({ action: "cancel", jobNo: n3, reason: "ลูกค้าเลื่อน" });
    ok("cancel job", cx.status === 200 && cx.body.status === "CANCELLED");
    const bd = await boss({ action: "board" });
    ok("board lists jobs", bd.status === 200 && jobs.every((n) => bd.body.jobs.some((j) => j.jobNo === n)));
    const tb = await tech({ action: "board" });
    ok("technician cannot open board", tb.status === 403);
  } catch (e) { fails++; console.log("ERROR", e); }
  finally {
    for (const n of jobs) {
      await db.doc(`companies/${C}/jobs/${n}`).delete();
      for (const c of ["stock_movements", "journal_entries"]) {
        const q = await db.collection(`companies/${C}/${c}`).where(c === "stock_movements" ? "referenceId" : "reference", "==", n).get();
        for (const d of q.docs) await d.ref.delete();
      }
      const nq = await db.collection(`companies/${C}/notifications`).where("documentNo", "==", n).get();
      for (const d of nq.docs) await d.ref.delete();
    }
    await prod.delete();
    for (const id of Object.keys(counters)) counters[id] ? await db.doc(`companies/${C}/counters/${id}`).set(counters[id]) : await db.doc(`companies/${C}/counters/${id}`).delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log(fails ? `${fails} FAILED` : "ALL PASS"); process.exit(0);
  }
})();
