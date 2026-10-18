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
  const adminEmail = String((await admin.auth().getUser(user.id)).email || "").toLowerCase();
  const existingMine = (await db.collection("employees").where("companyId", "==", C).where("email", "==", adminEmail).get()).size;
  const made = [];
  const E = (b) => call("/api/hr/employees", b);
  const A = (b) => call("/api/hr/attendance", b);
  try {
    const e1 = await E({ prefix: "Ms.", firstName: "ทดสอบ", lastName: "ระบบบุคคล", position: "ช่างเทคนิค", department: "ติดตั้ง/ช่าง", citizenId: "1100000000001", salary: 18000, email: existingMine ? "" : adminEmail, joinDate: "2026-01-15" });
    made.push(e1.body.docId);
    const d1 = e1.body.docId && (await db.doc(`employees/${e1.body.docId}`).get()).data();
    ok("create employee with EMP code", e1.status === 200 && /^EMP/.test(e1.body.employeeId) && d1.name === "นางสาวทดสอบ ระบบบุคคล" && d1.salary === 18000, JSON.stringify(e1.body));
    const dup = await E({ firstName: "ซ้ำ", lastName: "ซ้ำ", position: "x", citizenId: "1100000000001" });
    ok("duplicate citizen id rejected", dup.status === 409, dup.body.error);
    const miss = await E({ firstName: "", lastName: "x", position: "x" });
    ok("missing name rejected", miss.status === 400, miss.body.error);
    const ed = await E({ employeeDocId: e1.body.docId, prefix: "Ms.", firstName: "ทดสอบ", lastName: "แก้ไขแล้ว", position: "หัวหน้าช่าง", citizenId: "1100000000001", email: existingMine ? "" : adminEmail, status: "active" });
    ok("edit keeps code", ed.status === 200 && ed.body.employeeId === e1.body.employeeId && (await db.doc(`employees/${e1.body.docId}`).get()).data().position === "หัวหน้าช่าง");

    const e2 = await E({ firstName: "พนักงาน", lastName: "ลงแทน", position: "ธุรการ", citizenId: "1100000000002" }); made.push(e2.body.docId);
    const m1 = await A({ type: "IN", employeeDocId: e2.body.docId, date: "2026-10-01", time: "08:45", location: "สำนักงาน" });
    ok("HR manual IN (late)", m1.status === 200 && m1.body.status === "late" && m1.body.date === "2026-10-01", JSON.stringify(m1.body));
    const m2 = await A({ type: "OUT", employeeDocId: e2.body.docId, date: "2026-10-01", time: "08:00" });
    ok("OUT before IN time rejected", m2.status === 400, m2.body.error);
    const m3 = await A({ type: "OUT", employeeDocId: e2.body.docId, date: "2026-10-01", time: "17:30" });
    ok("HR manual OUT", m3.status === 200, m3.body.error);
    const m4 = await A({ type: "IN", employeeDocId: e2.body.docId, date: "2026-10-01", time: "09:00" });
    ok("second IN same day rejected", m4.status === 409, m4.body.error);
    const m5 = await A({ type: "IN", employeeDocId: e2.body.docId, date: "2030-01-01", time: "08:00" });
    ok("future date rejected", m5.status === 400, m5.body.error);
    const o1 = await A({ type: "OUT", employeeDocId: e2.body.docId, date: "2026-10-02", time: "17:00" });
    ok("OUT without IN rejected", o1.status === 409, o1.body.error);
    if (!existingMine) {
      const s1 = await A({ type: "IN", gps: { lat: 13.7, lng: 100.5, accuracy: 12 } });
      ok("self check-in by email", s1.status === 200 && s1.body.name.includes("ทดสอบ"), JSON.stringify(s1.body));
    } else console.log("SKIP self check-in (admin email already linked to a real employee)");
  } catch (e) { console.error("ERR", e); } finally {
    for (const id of made.filter(Boolean)) {
      const a = await db.collection("attendance").where("employeeDocId", "==", id).get(); await Promise.all(a.docs.map((x) => x.ref.delete()));
      const emp = (await db.doc(`employees/${id}`).get()).data();
      const l = await db.collection("logs").where("targetId", "==", emp?.employeeId || id).get(); await Promise.all(l.docs.map((x) => x.ref.delete()));
      await db.doc(`employees/${id}`).delete();
    }
    await (cBefore ? counter.set(cBefore) : counter.delete());
    console.log("cleaned up; counter restored"); process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
