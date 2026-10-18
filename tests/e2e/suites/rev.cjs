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
  const Q = (id) => db.doc(`companies/${C}/quotations/${id}`);
  const made = ["TEST-REV-D", "TEST-REV-S", "TEST-REV-W"];
  const rev = (id, changeSummary) => call(`/api/quotations/${id}/create-revision`, { changeSummary });
  const base = { companyId: C, customerName: "ลูกค้าทดสอบ", grandTotal: 10700, isDeleted: false, createdAt: admin.firestore.FieldValue.serverTimestamp() };
  try {
    await Q("TEST-REV-D").set({ ...base, documentNo: "QT-TEST-0001", status: "DRAFT" });
    await Q("TEST-REV-S").set({ ...base, documentNo: "QT-TEST-0002", status: "SENT", sentAt: "x", approvedBy: "y" });
    await Q("TEST-REV-S").collection("lines").doc("L1").set({ name: "สินค้า A", qty: 2, price: 5000 });
    await Q("TEST-REV-W").set({ ...base, documentNo: "QT-TEST-0003", status: "Approved", linkedSo: "SO-TEST" });
    const r0 = await rev("TEST-REV-D", "x"); ok("draft cannot be revised", r0.status === 409, r0.body.error);
    const r1 = await rev("TEST-REV-S", ""); ok("summary required", r1.status === 400, r1.body.error);
    const r2 = await rev("TEST-REV-S", "ปรับราคาสินค้า A"); made.push(r2.body.newQuotationId);
    const o = (await Q("TEST-REV-S").get()).data(), n = (await Q(r2.body.newQuotationId).get()).data();
    const lines = await Q(r2.body.newQuotationId).collection("lines").get();
    ok("R2 created, original superseded", r2.status === 200 && r2.body.newDocumentNo === "QT-TEST-0002-R2" && o.status === "SUPERSEDED" && o.supersededBy === r2.body.newQuotationId && n.status === "DRAFT" && n.revisionNumber === 2, JSON.stringify(r2.body));
    ok("lines copied, send/approval fields reset", lines.size === 1 && !n.sentAt && !n.approvedBy && !n.supersededBy, `lines=${lines.size}`);
    ok("history has ids", n.revisionHistory.length === 2 && n.revisionHistory[0].quotationId === "TEST-REV-S" && n.revisionHistory[1].quotationId === r2.body.newQuotationId && n.revisionHistory[1].changeSummary === "ปรับราคาสินค้า A");
    const r3 = await rev("TEST-REV-S", "อีกครั้ง"); ok("superseded cannot be revised again", r3.status === 409, r3.body.error);
    const r4 = await rev(r2.body.newQuotationId, "x"); ok("R2 still draft cannot be revised", r4.status === 409, r4.body.error);
    await Q(r2.body.newQuotationId).update({ status: "SENT" });
    const r5 = await rev(r2.body.newQuotationId, "เพิ่มรายการ"); made.push(r5.body.newQuotationId);
    const n3 = r5.body.newQuotationId && (await Q(r5.body.newQuotationId).get()).data();
    ok("R3 from latest", r5.status === 200 && r5.body.newDocumentNo === "QT-TEST-0002-R3" && n3.revisionHistory.length === 3 && n3.parentQuotationId === "TEST-REV-S", r5.body.newDocumentNo);
    const r6 = await rev("TEST-REV-W", "x"); ok("won (linked SO) cannot be revised", r6.status === 409, r6.body.error);
  } catch (e) { console.error("ERR", e); } finally {
    for (const id of made.filter(Boolean)) { const ls = await Q(id).collection("lines").get(); await Promise.all(ls.docs.map((d) => d.ref.delete())); await Q(id).delete(); }
    for (const t of ["QT-TEST-0002-R2", "QT-TEST-0002-R3"]) { const l = await db.collection("logs").where("targetId", "==", t).get(); await Promise.all(l.docs.map((x) => x.ref.delete())); }
    console.log("cleaned up"); process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
