// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
const path = require("path"); const root = E2E_ROOT;
require("@next/env").loadEnvConfig(root);
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10)) }) });
const db = admin.firestore(); const C = "COM-NEXUS-01";
const ok = (l, c, x = "") => console.log(`${c ? "PASS" : "FAIL"}  ${l} ${x}`);
const { chromium } = require("playwright");
const { authUserRecord } = require("../tools/auth-shots.cjs");
(async () => {
  const user = (await db.collection("users").where("companyId", "==", C).where("role", "==", "ADMIN").limit(1).get()).docs[0];
  const tok = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(user.id), returnSecureToken: true }) })).json();
  const call = (url, body) => fetch(`${E2E_BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok.idToken}` }, body: JSON.stringify({ companyId: C, ...body }) }).then(async (x) => ({ status: x.status, body: await x.json() }));
  const counterRef = db.doc(`companies/${C}/counters/PRJ`); const counterBefore = (await counterRef.get()).data();
  let prj = "", custId = "";
  try {
    const r = await call("/api/projects/create", {
      asDraft: true, projectName: "TEST ปรับเปลี่ยนระหว่างโครงการ", newCustomerName: "TEST-หน่วยงาน CO", sectorType: "Government", projectStage: "CONTRACTED",
      projectTypeCode: 4, startDate: "2026-10-01", endDate: "2026-12-31", projectManagerUid: user.id,
      items: [{ id: "A1", name: "กล้อง รุ่น X100", qty: 10, unit: "ตัว", price: 5000, cost: 3500, itemType: "PRODUCT" }],
      expenses: [{ id: "E1", key: "RISK", name: "สำรอง", basis: "PCT_DIRECT", value: 5 }],
      timeline: [{ id: "PH-1", name: "ติดตั้ง", startDate: "2026-10-01", endDate: "2026-11-30", weight: 60 }, { id: "PH-2", name: "ตรวจรับ", startDate: "2026-12-01", endDate: "2026-12-31", weight: 40 }],
      followers: [{ name: "นาย ก", role: "ประธานกรรมการ" }],
      governmentDetails: { budgetAmount: 60000 },
    });
    prj = r.body.projectId;
    const P = db.doc(`companies/${C}/projects/${prj}`);
    custId = (await P.get()).data().customerId;
    const co = (b) => call("/api/projects/change-orders", { projectDocId: prj, ...b });

    const d = await co({ action: "create", type: "OTHER", reason: "ทดสอบฉบับร่าง", payload: { description: "x" } });
    ok("draft project cannot request change", d.status === 409, d.body.error);
    await P.update({ status: "In Progress" });

    const noReason = await co({ action: "create", type: "SCHEDULE", reason: "", payload: { endDate: "2027-01-31" } });
    ok("reason required", noReason.status === 400, noReason.body.error);
    const e1 = await co({ action: "create", type: "EQUIPMENT", reason: "รุ่นเดิมเลิกผลิต", payload: { lineId: "A1", name: "กล้อง รุ่น X200", qty: 10, unitPrice: 5500, unitCost: 3800, details: "4MP" } });
    const e2 = await co({ action: "create", type: "EQUIPMENT", reason: "คำขอซ้อน ทดสอบ", payload: { lineId: "A1", name: "กล้อง รุ่น X300", qty: 10, unitPrice: 6000, unitCost: 4000 } });
    const s1 = await co({ action: "create", type: "SCHEDULE", reason: "หน่วยงานขอเลื่อน", payload: { endDate: "2027-01-31" } });
    ok("create change orders CO-01..03", e1.body.coNo === "CO-01" && e2.body.coNo === "CO-02" && s1.body.coNo === "CO-03", [e1.body.coNo, e2.body.coNo, s1.body.coNo].join(","));
    ok("pending counter = 3", (await P.get()).data().pendingChangeOrders === 3);

    const before = (await P.get()).data();
    const a1 = await co({ action: "approve", coId: e1.body.id });
    const after = (await P.get()).data();
    const line = after.items.find((l) => l.lineId === "A1");
    // 10 × 5,500 = 55,000; VAT = 58,850; งวด 60% = 35,310
    ok("approve equipment updates line + budget + milestones", a1.status === 200 && line.name === "กล้อง รุ่น X200" && line.amount === 55000 && after.budget === 55000 && after.milestones[0].amount === 35310 && after.budgetSummary.expensesTotal === 1900,
      JSON.stringify({ amt: line.amount, budget: after.budget, ms: after.milestones.map((m) => m.amount), exp: after.budgetSummary.expensesTotal, prev: before.budget }));
    const stale = await co({ action: "approve", coId: e2.body.id });
    ok("stale equipment change rejected", stale.status === 409, stale.body.error);
    const rejNo = await co({ action: "reject", coId: s1.body.id });
    ok("reject needs note", rejNo.status === 400, rejNo.body.error);
    const rej = await co({ action: "reject", coId: s1.body.id, note: "ยังไม่มีหนังสือจากหน่วยงาน" });
    ok("reject schedule keeps end date", rej.status === 200 && (await P.get()).data().endDate === "2026-12-31");
    const again = await co({ action: "approve", coId: s1.body.id });
    ok("cannot decide twice", again.status === 409, again.body.error);

    const s2 = await co({ action: "create", type: "SCHEDULE", reason: "ได้รับหนังสือขยายเวลา", payload: { endDate: "2027-01-31" } });
    await co({ action: "approve", coId: s2.body.id });
    const ps = (await P.get()).data();
    ok("approve schedule extends end + last milestone", ps.endDate === "2027-01-31" && ps.milestones[1].endDate === "2027-01-31", JSON.stringify(ps.milestones.map((m) => m.endDate)));
    const c1 = await co({ action: "create", type: "COMMITTEE", reason: "แต่งตั้งกรรมการใหม่", payload: { members: [{ name: "นาย ข", role: "ประธานกรรมการ" }, { name: "นาง ค", role: "กรรมการ" }] } });
    await co({ action: "approve", coId: c1.body.id });
    const b1 = await co({ action: "create", type: "BUDGET", reason: "ได้รับงบประมาณเพิ่ม", payload: { budgetAmount: 65000 } });
    await co({ action: "approve", coId: b1.body.id });
    const pf = (await P.get()).data();
    ok("committee + budget applied", pf.followers.length === 2 && pf.followers[0].name === "นาย ข" && pf.governmentDetails.budgetAmount === 65000);
    ok("pending counter back to 1 (CO-02 stale still pending)", pf.pendingChangeOrders === 1, String(pf.pendingChangeOrders));

    const record = await authUserRecord(); const b = await chromium.launch();
    const pg = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    pg.on("pageerror", (e) => console.log("PAGEERROR", e.message));
    await pg.goto(E2E_BASE + "/login", { waitUntil: "domcontentloaded", timeout: 240000 });
    await pg.evaluate(async ({ record, key }) => { localStorage.setItem("selectedCompanyId", "COM-NEXUS-01");
      await new Promise((res) => { const req = indexedDB.open("firebaseLocalStorageDb", 1); req.onupgradeneeded = () => req.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
        req.onsuccess = () => { const tx = req.result.transaction("firebaseLocalStorage", "readwrite"); tx.objectStore("firebaseLocalStorage").put({ fbase_key: key, value: record }); tx.oncomplete = () => res(); }; }); }, { record, key: `firebase:authUser:${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}:[DEFAULT]` });
    await pg.goto(`${E2E_BASE}/projects/${prj}?tab=changes`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await pg.waitForSelector("aside"); await pg.waitForTimeout(4500);
    await pg.screenshot({ path: require("path").join(E2E_OUT, "co-list.png") });
    await pg.getByRole("button", { name: /ขอเปลี่ยนแปลง/ }).click(); await pg.waitForTimeout(800);
    await pg.screenshot({ path: require("path").join(E2E_OUT, "co-form.png") });
    console.log("overflowX", await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
    await b.close();
  } catch (e) { console.error("ERR", e); } finally {
    if (prj) {
      const P = db.doc(`companies/${C}/projects/${prj}`);
      const cos = await P.collection("change_orders").get(); await Promise.all(cos.docs.map((x) => x.ref.delete()));
      await P.delete();
      const l = await db.collection("logs").get().then((s) => s.docs.filter((d) => String(d.data().targetId || "").startsWith(prj)));
      await Promise.all(l.map((x) => x.ref.delete()));
      const n = await db.collection(`companies/${C}/notifications`).where("documentNo", "==", prj).get(); await Promise.all(n.docs.map((x) => x.ref.delete()));
    }
    if (custId) { await db.doc(`customers/${custId}`).delete(); await db.doc(`companies/${C}/customers/${custId}`).delete(); await db.doc(`groups/${C}/customers/${custId}`).delete(); }
    if (counterBefore) await counterRef.set(counterBefore); else await counterRef.delete();
    console.log("cleaned", prj); process.exit(0);
  }
})();
