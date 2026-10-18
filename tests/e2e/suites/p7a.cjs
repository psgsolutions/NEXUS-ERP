// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// 7A: ตั้งค่าบริษัทผ่าน API (รูปแบบเลขที่ / พร้อมเพย์) — สิทธิ์และการตรวจรูปแบบ (คืนค่าเดิมเมื่อจบ)
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const toks = {};
const call = (uid) => async (b) => { toks[uid] = toks[uid] || await tok(uid); const r = await fetch(E2E_BASE + "/api/settings/company", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + toks[uid] }, body: JSON.stringify({ companyId: C, ...b }) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
(async () => {
  const s = Date.now(); const A = `test-p7a-adm-${s}`, S = `test-p7a-sal-${s}`;
  await db.doc(`users/${A}`).set({ companyId: C, roles: ["ADMIN"], role: "ADMIN", status: "ACTIVE" });
  await db.doc(`users/${S}`).set({ companyId: C, roles: ["SALES"], role: "SALES", status: "ACTIVE" });
  const fmtRef = db.doc(`companies/${C}/settings/sequence_formats`); const coRef = db.doc(`companies/${C}`);
  const fmtBefore = (await fmtRef.get()).data(); const ppBefore = (await coRef.get()).data()?.promptPayId;
  const adm = call(A), sal = call(S);
  try {
    ok("sales cannot change number formats", (await sal({ action: "sequenceFormats", formats: { QT: "QT-[0000]" } })).status === 403);
    ok("format without sequence token rejected", (await adm({ action: "sequenceFormats", formats: { QT: "QT-[YYMM]" } })).status === 400);
    ok("format with slash rejected", (await adm({ action: "sequenceFormats", formats: { QT: "QT/[YYMM]/[0000]" } })).status === 400);
    const cur = fmtBefore?.PR || "";
    const r = await adm({ action: "sequenceFormats", formats: { PR: "PR-[BB][MM]-[0000]" } });
    ok("admin saves a valid format", r.status === 200 && (await fmtRef.get()).data().PR === "PR-[BB][MM]-[0000]", JSON.stringify(r.body));
    ok("sales cannot change PromptPay", (await sal({ action: "promptPay", promptPayId: "0812345678" })).status === 403);
    ok("invalid PromptPay rejected", (await adm({ action: "promptPay", promptPayId: "12345" })).status === 400);
    const p = await adm({ action: "promptPay", promptPayId: "081-234-5678" });
    ok("admin saves PromptPay (digits only)", p.status === 200 && (await coRef.get()).data().promptPayId === "0812345678");
    void cur;
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    if (fmtBefore) await fmtRef.set(fmtBefore); else await fmtRef.delete();
    await coRef.update({ promptPayId: ppBefore ?? admin.firestore.FieldValue.delete() });
    for (const u of [A, S]) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    for (const d of (await db.collection("logs").where("createdBy", "in", [A, S]).get()).docs) await d.ref.delete();
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
