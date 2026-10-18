// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// Phase 6D: คำขอเปลี่ยนแปลง (อนุมัติแล้ว) -> ปรับใบเสนอราคา (ฉบับแก้ไข / แทนรายการในฉบับร่าง)
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
  const U = { all: `test-p6d-a-${s}`, eng: `test-p6d-e-${s}` };
  await db.doc(`users/${U.all}`).set({ companyId: C, roles: ["ENGINEER", "EXECUTIVE", "SALES"], role: "ENGINEER", status: "ACTIVE" });
  await db.doc(`users/${U.eng}`).set({ companyId: C, roles: ["ENGINEER"], role: "ENGINEER", status: "ACTIVE" });
  const all = call(U.all), eng = call(U.eng);
  const PRJ = `TEST-PRJ-P6D-${s}`, Q1 = `TEST-QT-P6D-${s}`;
  const quotes = new Set([Q1]);
  const co = (b) => all("/api/projects/change-orders", { projectDocId: PRJ, ...b });
  const qd = async (id) => (await db.doc(`companies/${C}/quotations/${id}`).get()).data();
  const qlines = async (id) => (await db.collection(`companies/${C}/quotations/${id}/lines`).get()).docs.map((d) => d.data()).sort((a, b) => a.sequence - b.sequence);
  try {
    await db.doc(`companies/${C}/projects/${PRJ}`).set({
      companyId: C, projectId: PRJ, projectName: "TEST CO โครงการ", status: "Approved", quotationDocId: Q1, clientReference: Q1, isDeleted: false, startDate: "2026-10-01", endDate: "2026-12-31",
      items: [
        { lineId: "a", kind: "PRODUCT", name: "กล้อง A", qty: 2, unit: "ตัว", unitPrice: 1000, unitCost: 600, discountType: "PERCENT", discountValue: 0, whtRate: 0, isOptional: false, amount: 2000, costAmount: 1200, productId: null, sku: "", details: "" },
        { lineId: "b", kind: "LABOR", name: "ค่าติดตั้ง", qty: 1, unit: "งาน", unitPrice: 500, unitCost: 300, discountType: "PERCENT", discountValue: 0, whtRate: 3, isOptional: false, amount: 500, costAmount: 300, productId: null, sku: "", details: "" },
      ],
      milestones: [{ id: "m1", name: "งวดเดียว", weight: 100, amount: 2675 }],
    });
    await db.doc(`companies/${C}/quotations/${Q1}`).set({ companyId: C, documentNo: Q1, quotationNumber: Q1, status: "SENT", taxType: "EXCLUSIVE", subTotal: 2500, netTotal: 2500, vatAmount: 175, grandTotal: 2675, customerName: "TEST", revisionNumber: 1, isDeleted: false });
    for (const [i, l] of [{ itemType: "PRODUCT", productName: "กล้อง A", qty: 2, unitPrice: 1000, lineTotal: 2000 }, { itemType: "LABOR", productName: "ค่าติดตั้ง", qty: 1, unitPrice: 500, lineTotal: 500, whtRate: 3 }].entries()) {
      await db.doc(`companies/${C}/quotations/${Q1}/lines/l${i}`).set({ ...l, sequence: i + 1 });
    }

    // ---- CO1: เปลี่ยนจำนวนกล้อง 2 -> 3 ----
    const c1 = await co({ action: "create", type: "EQUIPMENT", reason: "ลูกค้าขอเพิ่มจุดติดตั้ง", payload: { lineId: "a", qty: 3 } });
    ok("CO1 created", c1.status === 200, JSON.stringify(c1.body));
    ok("cannot revise quotation before approval", (await co({ action: "reviseQuotation", coId: c1.body.id })).status === 409);
    ok("CO1 approved", (await co({ action: "approve", coId: c1.body.id })).status === 200);
    ok("engineer without sales:edit cannot revise quotation", (await eng("/api/projects/change-orders", { projectDocId: PRJ, action: "reviseQuotation", coId: c1.body.id })).status === 403);
    const r1 = await co({ action: "reviseQuotation", coId: c1.body.id });
    if (r1.body.quotationId) quotes.add(r1.body.quotationId);
    const nq = r1.body.quotationId ? await qd(r1.body.quotationId) : {};
    const nl = r1.body.quotationId ? await qlines(r1.body.quotationId) : [];
    const oq = await qd(Q1);
    ok("sent quotation -> revision -R2 (draft) with new lines and totals", r1.status === 200 && r1.body.mode === "revision" && r1.body.docNo === `${Q1}-R2` && nq.status === "DRAFT" && nq.grandTotal === 3745 && nq.whtAmount === 15 && nl.find((l) => l.productName === "กล้อง A")?.qty === 3, JSON.stringify([r1.body, nq.grandTotal, nl.map((l) => [l.productName, l.qty])]));
    ok("original superseded; history records CO summary", oq.status === "SUPERSEDED" && oq.supersededBy === r1.body.quotationId && nq.revisionHistory.at(-1).changeSummary.startsWith("CO-01"), JSON.stringify(nq.revisionHistory?.at(-1)));
    const p1 = (await db.doc(`companies/${C}/projects/${PRJ}`).get()).data();
    const co1 = (await db.doc(`companies/${C}/projects/${PRJ}/change_orders/${c1.body.id}`).get()).data();
    ok("project points to the new quotation; CO remembers it", p1.quotationDocId === r1.body.quotationId && p1.clientReference === `${Q1}-R2` && co1.quotationUpdate?.docNo === `${Q1}-R2`, JSON.stringify([p1.quotationDocId, p1.clientReference, co1.quotationUpdate]));
    ok("same CO cannot revise twice", (await co({ action: "reviseQuotation", coId: c1.body.id })).status === 409);

    // ---- CO2 บนฉบับร่าง: แทนรายการในใบเดิม ----
    const c2 = await co({ action: "create", type: "EQUIPMENT", reason: "ปรับราคาค่าติดตั้ง", payload: { lineId: "b", unitPrice: 800 } });
    await co({ action: "approve", coId: c2.body.id });
    const r2 = await co({ action: "reviseQuotation", coId: c2.body.id });
    const q2 = await qd(r1.body.quotationId);
    ok("draft quotation updated in place", r2.status === 200 && r2.body.mode === "updated" && r2.body.quotationId === r1.body.quotationId && q2.subTotal === 3800 && (await qlines(r1.body.quotationId)).length === 2, JSON.stringify([r2.body, q2.subTotal]));

    // ---- ใบที่ส่งแล้วออกฉบับแก้ไขจากหน้าใบเสนอราคาได้ตามเดิม (โค้ดที่ย้ายมาใช้ร่วม) ----
    await db.doc(`companies/${C}/quotations/${r1.body.quotationId}`).update({ status: "SENT" });
    const manual = await all(`/api/quotations/${r1.body.quotationId}/create-revision`, { changeSummary: "TEST ปรับเงื่อนไข" });
    if (manual.body.newQuotationId) quotes.add(manual.body.newQuotationId);
    ok("manual create-revision still works and copies lines", manual.status === 200 && manual.body.newDocumentNo === `${Q1}-R3` && (await qlines(manual.body.newQuotationId)).length === 2, JSON.stringify(manual.body));

    // ---- แปลงเป็นใบสั่งขายแล้ว ----
    await db.doc(`companies/${C}/quotations/${manual.body.newQuotationId}`).update({ status: "SENT", linkedSo: "TEST-SO" });
    const c3 = await co({ action: "create", type: "EQUIPMENT", reason: "เปลี่ยนรุ่นกล้อง", payload: { lineId: "a", name: "กล้อง B" } });
    await co({ action: "approve", coId: c3.body.id });
    const r3 = await co({ action: "reviseQuotation", coId: c3.body.id });
    ok("converted quotation (latest of chain) cannot be revised", r3.status === 409 && /ใบสั่งขาย/.test(r3.body.error), JSON.stringify(r3.body));
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const id of quotes) {
      for (const sub of ["lines", "audit_logs"]) for (const d of (await db.collection(`companies/${C}/quotations/${id}/${sub}`).get()).docs) await d.ref.delete();
      await db.doc(`companies/${C}/quotations/${id}`).delete();
    }
    for (const d of (await db.collection(`companies/${C}/projects/${PRJ}/change_orders`).get()).docs) await d.ref.delete();
    await db.doc(`companies/${C}/projects/${PRJ}`).delete();
    for (const d of (await db.collection(`companies/${C}/notifications`).where("documentNo", "==", PRJ).get()).docs) await d.ref.delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
