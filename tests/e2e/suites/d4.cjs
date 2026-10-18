// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
// D4: ใบสั่งขาย / ใบส่งของ (ออกตอนเบิกและส่งมอบ) / ใบสั่งงาน-รายงานบริการพร้อมรูปและลายเซ็น
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = admin.firestore(); const C = "COM-NEXUS-01"; const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const fs = require("fs"); const OUT = E2E_OUT; fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (l, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"}  ${l} ${c ? "" : x}`); };
const tok = async (uid) => (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await admin.auth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const toks = {};
const call = (uid) => async (url, b, raw = false) => {
  toks[uid] = toks[uid] || await tok(uid);
  const r = await fetch(E2E_BASE + "" + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + toks[uid] }, body: JSON.stringify({ companyId: C, ...b }) });
  if (raw) return { status: r.status, buf: Buffer.from(await r.arrayBuffer()) };
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
// รูปทดสอบ PNG 1x1 (สีเข้ม)
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

(async () => {
  const s = Date.now();
  const U = { wh: `test-d4w-${s}`, sales: `test-d4s-${s}`, tech: `test-d4t-${s}`, hr: `test-d4h-${s}` };
  const ROLE = { wh: "WAREHOUSE", sales: "SALES", tech: "TECHNICIAN", hr: "HR" };
  for (const k of Object.keys(U)) await db.doc(`users/${U[k]}`).set({ companyId: C, roles: [ROLE[k]], role: ROLE[k], status: "ACTIVE", name: `TEST ${k}` });
  const wh = call(U.wh), sales = call(U.sales), tech = call(U.tech), hr = call(U.hr);
  const PROD = `TEST-D4-PROD-${s}`, SO1 = `TEST-SO-D4A-${s}`, SO2 = `TEST-SO-D4B-${s}`, WO = `TEST-WO-D4-${s}`;
  const dns = [];
  const cust = { name: "TEST ลูกค้า D4", taxId: "0105555555555", branch: "สำนักงานใหญ่", address: "1 ถนนทดสอบ กรุงเทพฯ 10110" };
  try {
    await db.doc(`products/${PROD}`).set({ companyId: C, name: "TEST สายไฟ D4", sku: "TEST-D4", unit: "ม้วน", itemType: "PRODUCT", pricing: { costWAC: 50 }, costPrice: 50, stockStatus: { onHand: 10, reserved: 0, available: 10 } });
    await db.doc(`companies/${C}/sales_orders/${SO1}`).set({ companyId: C, documentNo: SO1, soId: SO1, status: "Confirmed", stockReserved: false, customerName: cust.name, customerSnapshot: cust, deliveryAddress: "ไซต์งาน TEST อาคาร B", vatType: "Exclude VAT", items: [{ productId: PROD, sku: "TEST-D4", name: "TEST สายไฟ D4", qty: 3, unit: "ม้วน", price: 100, itemType: "PRODUCT" }, { productId: null, name: "TEST ค่าติดตั้ง", qty: 1, unit: "งาน", price: 500, itemType: "SERVICE" }], subTotal: 800, vatAmount: 56, grandTotal: 856, isDeleted: false });
    await db.doc(`companies/${C}/sales_orders/${SO2}`).set({ companyId: C, documentNo: SO2, soId: SO2, status: "Confirmed", customerName: cust.name, customerSnapshot: cust, vatType: "Exclude VAT", items: [{ name: "TEST ค่าบริการตรวจเช็คระบบ", qty: 2, unit: "ครั้ง", price: 1000, itemType: "SERVICE" }], subTotal: 2000, vatAmount: 140, grandTotal: 2140, isDeleted: false });

    // ---- เบิกบางส่วน -> DN ใบแรก ----
    const p1 = await wh("/api/inventory/pick", { soId: SO1, lines: [{ productId: PROD, location: "UNASSIGNED", qty: 2 }] });
    if (p1.body.deliveryNoteNo) dns.push(p1.body.deliveryNoteNo);
    const dn1 = p1.body.deliveryNoteNo ? (await db.doc(`companies/${C}/delivery_notes/${p1.body.deliveryNoteNo}`).get()).data() : null;
    let so = (await db.doc(`companies/${C}/sales_orders/${SO1}`).get()).data();
    ok("partial pick issues DN with picked lines only", p1.status === 200 && /^DN/.test(p1.body.deliveryNoteNo || "") && dn1?.lines?.length === 1 && dn1.lines[0].qty === 2 && dn1.lines[0].name === "TEST สายไฟ D4" && dn1.soNo === SO1 && dn1.sellerSnapshot?.name, JSON.stringify([p1.body, dn1?.lines]));
    ok("SO keeps the DN list, status PROCESSING", so.status === "PROCESSING" && so.deliveryNotes?.[0] === p1.body.deliveryNoteNo);
    const ctrA = (await db.doc(`companies/${C}/counters/DN`).get()).data();
    const bad = await wh("/api/inventory/pick", { soId: SO1, lines: [{ productId: PROD, location: "UNASSIGNED", qty: 5 }] });
    const ctrB = (await db.doc(`companies/${C}/counters/DN`).get()).data();
    ok("over-pick rejected without consuming a DN number", bad.status === 400 && ctrA.lastSeq === ctrB.lastSeq);
    const p2 = await wh("/api/inventory/pick", { soId: SO1, lines: [{ productId: PROD, location: "UNASSIGNED", qty: 1 }] });
    if (p2.body.deliveryNoteNo) dns.push(p2.body.deliveryNoteNo);
    so = (await db.doc(`companies/${C}/sales_orders/${SO1}`).get()).data();
    ok("final pick -> second DN, SO DELIVERED with both DNs", p2.status === 200 && p2.body.allPicked && so.status === "DELIVERED" && so.deliveryNotes.length === 2 && p2.body.deliveryNoteNo !== p1.body.deliveryNoteNo, JSON.stringify(p2.body));

    // ---- ส่งมอบงานบริการ (ไม่ต้องเบิก) ----
    const d = await sales("/api/sales/orders/status", { soId: SO2, action: "deliver" });
    if (d.body.deliveryNoteNo) dns.push(d.body.deliveryNoteNo);
    const dn3 = d.body.deliveryNoteNo ? (await db.doc(`companies/${C}/delivery_notes/${d.body.deliveryNoteNo}`).get()).data() : null;
    ok("service-only deliver issues DN with all items", d.status === 200 && d.body.status === "DELIVERED" && dn3?.lines?.[0]?.qty === 2 && dn3.source === "deliver", JSON.stringify(d.body));

    // ---- PDF ----
    const dj = await wh("/api/documents/pdf", { type: "delivery_note", id: p1.body.deliveryNoteNo, format: "json" });
    ok("DN model: delivery address, no prices", dj.status === 200 && dj.body.document.party.contact === "ไซต์งาน TEST อาคาร B" && !dj.body.document.columns.includes("price") && dj.body.document.signatures.includes("ผู้รับของ"), JSON.stringify(dj.body).slice(0, 300));
    const sj = await sales("/api/documents/pdf", { type: "sales_order", id: SO1, format: "json" });
    ok("SO model totals + DN note", sj.status === 200 && sj.body.document.totals.at(-1).amount === 856 && sj.body.document.notes.some((n) => n.includes(p1.body.deliveryNoteNo)), JSON.stringify(sj.body.document?.totals));
    ok("HR cannot open delivery note", (await hr("/api/documents/pdf", { type: "delivery_note", id: p1.body.deliveryNoteNo, format: "json" })).status === 403);

    // ---- ใบสั่งงาน / รายงานบริการ ----
    const wref = db.doc(`companies/${C}/work_orders/${WO}`);
    await wref.set({ companyId: C, woCode: WO, documentNo: WO, soId: SO1, soCode: SO1, customerName: cust.name, technicianUid: U.tech, technicianName: "TEST ช่างสมชาย", scheduleDate: "2026-10-18T09:30", remarks: "TEST ติดตั้งสายไฟ", items: [{ sku: "TEST-D4", name: "TEST สายไฟ D4", qty: 3, unit: "ม้วน" }], status: "COMPLETED", checkIn: { at: admin.firestore.Timestamp.fromMillis(Date.parse("2026-10-18T02:35:00Z")), gps: { lat: 13.75, lng: 100.5 } }, checkOut: { at: admin.firestore.Timestamp.fromMillis(Date.parse("2026-10-18T05:10:00Z")) }, completedAt: admin.firestore.Timestamp.fromMillis(Date.parse("2026-10-18T05:10:00Z")), isDeleted: false });
    for (const t of ["before", "after", "signature"]) await wref.collection("attachments").doc(t).set({ companyId: C, type: t, dataUrl: PNG });
    const wj = await tech("/api/documents/pdf", { type: "work_order", id: WO, format: "json" });
    const w = wj.body.document;
    ok("technician opens service report with photos + customer signature", wj.status === 200 && w.title === "ใบรายงานการให้บริการ" && w.photos.length === 2 && w.signed["ลูกค้าผู้ตรวจรับงาน"].image && w.signed["ช่างผู้ปฏิบัติงาน"].name === "TEST ช่างสมชาย" && w.notes.some((n) => n.startsWith("เริ่มงาน 18 ตุลาคม 2569 09:35")), JSON.stringify(w).slice(0, 400));
    ok("technician cannot open sales order", (await tech("/api/documents/pdf", { type: "sales_order", id: SO1, format: "json" })).status === 403);

    for (const [type, id, who] of [["sales_order", SO1, sales], ["delivery_note", p1.body.deliveryNoteNo, wh], ["delivery_note", d.body.deliveryNoteNo, sales], ["work_order", WO, tech]]) {
      const p = await who("/api/documents/pdf", { type, id }, true);
      fs.writeFileSync(`${OUT}/${type}-${id}.pdf`, p.buf);
      ok(`PDF ${type} ${id}`, p.status === 200 && p.buf.slice(0, 4).toString() === "%PDF", `${p.status} ${p.buf.slice(0, 200)}`);
    }
  } catch (e) { fails++; console.log("ERROR", e); } finally {
    for (const n of dns) await db.doc(`companies/${C}/delivery_notes/${n}`).delete();
    for (const so of [SO1, SO2]) {
      for (const c of ["stock_movements", "journal_entries"]) for (const x of (await db.collection(`companies/${C}/${c}`).where(c === "stock_movements" ? "referenceId" : "reference", "==", so).get()).docs) await x.ref.delete();
      await db.doc(`companies/${C}/sales_orders/${so}`).delete();
    }
    const wref = db.doc(`companies/${C}/work_orders/${WO}`);
    for (const a of (await wref.collection("attachments").get()).docs) await a.ref.delete();
    await wref.delete();
    await db.doc(`products/${PROD}`).delete();
    for (const u of Object.values(U)) { await db.doc(`users/${u}`).delete(); await admin.auth().deleteUser(u).catch(() => {}); }
    console.log("cleaned"); console.log(fails ? fails + " FAILED" : "ALL PASS"); process.exit(0);
  }
})();
