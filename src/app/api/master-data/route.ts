import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError, type ApiUser } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { canEditMaster, companiesInGroup, groupIdOfCompany } from "@/lib/company-group.server";
import { processStockMovements } from "@/lib/stock-service";
import { LEGACY_ROOT } from "@/lib/master-store.server";
import { normalizeDocProfile } from "@/lib/customer-doc-profile";
import { MASTER_SCHEMAS, isMasterEntity, mergeRecord, splitChanges, uniqueKeyDocId, uniqueKeyValue, type EditScope, type MasterEntity } from "@/lib/master-data";

/**
 * [API-SERVER] ข้อมูลหลักแบบเครือบริษัท — POST /api/master-data
 *  - { action: "get", entity, id }                         ข้อมูลรวม (กลาง + ของบริษัท)
 *  - { action: "context" }                                 เครือของบริษัท จำนวนบริษัท และสิทธิ์แก้ข้อมูลกลาง
 *  - { action: "checkDuplicate", entity, data }            มีรายการที่ SKU/บาร์โค้ด/เลขผู้เสียภาษี ซ้ำในเครือหรือไม่
 *  - { action: "create", entity, id?, data, openingStock? } สร้างใหม่ (ข้อมูลกลาง + ของบริษัท)
 *      openingStock (สินค้า): { qty, unitCost, postJournal? } รับเข้าเป็นยอดยกมา ผ่าน stock engine + บันทึกบัญชีร่าง Dr สินค้าคงเหลือ / Cr กำไรสะสม
 *      (postJournal: false = ไม่บันทึกบัญชี — ใช้เมื่อยอดสินค้าคงเหลือรวมอยู่ในงบทดลองยกมาแล้ว)
 * สินค้าที่ยังอยู่ root products (ก่อนย้ายข้อมูล): get/update ทำงานกับเอกสารเดิม
 *  - { action: "adopt", entity, id, data? }                ใช้รายการกลางที่มีอยู่แล้วในบริษัทนี้ (ตั้งค่าของบริษัทได้)
 *  - { action: "update", entity, id, changes, scope }      scope "group" = แก้ค่ากลาง / "company" = ตั้งค่าของบริษัท
 *      ลูกค้า: changes.docProfile = โปรไฟล์เอกสาร (ของบริษัทเสมอ; แก้เฉพาะ docProfile ได้ด้วยสิทธิ์ finance:edit)
 *  - { action: "resetLocal", entity, id, fields }          ล้างค่าของบริษัท กลับไปใช้ค่ากลาง
 *  - { action: "remove", entity, id }                      ซ่อนรายการของบริษัท (isDeleted) — ข้อมูลกลางของเครือยังอยู่ ใช้ "adopt" นำกลับได้
 * entity: products | customers | suppliers | contractors
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const ID = /^[A-Za-z0-9_.-]{1,120}$/;
/** ฟิลด์ของบริษัทที่ระบบคำนวณเอง (สต็อก ต้นทุน ยอดหนี้) ห้ามแก้ผ่าน API นี้ */
const PROTECTED: Record<MasterEntity, string[]> = {
  products: ["stock", "currentStock", "stockStatus", "cost", "wac", "averageCost", "lastCost", "stockValue"],
  customers: ["arBalance", "outstanding", "balance"],
  suppliers: ["apBalance", "outstanding", "balance"],
  contractors: ["apBalance", "outstanding", "balance"],
};

/** ตัดค่าที่ Firestore เก็บไม่ได้ และจำกัดขนาด */
function clean(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(k) || v === undefined) continue;
    out[k] = typeof v === "string" ? v.slice(0, 5000) : v;
  }
  if (JSON.stringify(out).length > 200_000) throw new ApiAuthError(400, "ข้อมูลใหญ่เกินไป");
  return out;
}

/** ตัดฟิลด์ที่ระบบคำนวณเอง (สต็อก ต้นทุนเฉลี่ย ยอดหนี้) ออก — แก้ได้ผ่านเอกสารคลัง/บัญชีเท่านั้น */
/** คู่ค้า: ใช้ taxId / branchCode เป็นหลัก (ฟอร์มเก่าใช้ tax_id / branch_code) เพื่อให้ตรวจซ้ำได้ */
function normalizeParty(entity: MasterEntity, data: Record<string, any>) {
  if (entity === "products") return data;
  const out = { ...data };
  const tax = String(out.taxId ?? out.tax_id ?? "").replace(/\D/g, "");
  if (tax) out.taxId = tax;
  if (!out.branchCode && out.branch_code) out.branchCode = String(out.branch_code);
  return out;
}

function protectLocal(entity: MasterEntity, local: Record<string, any>): string[] {
  const dropped = Object.keys(local).filter((k) => PROTECTED[entity].includes(k));
  dropped.forEach((k) => delete local[k]);
  if (entity === "products" && local.pricing && typeof local.pricing === "object" && "costWAC" in local.pricing) {
    const { costWAC: _ignored, ...rest } = local.pricing; void _ignored;
    local.pricing = rest;
    dropped.push("pricing.costWAC");
  }
  return dropped;
}

async function findDuplicates(tx: admin.firestore.Transaction | null, groupId: string, entity: MasterEntity, data: Record<string, any>, exceptId = "") {
  const hits: { fields: string[]; value: string; id: string }[] = [];
  for (const fields of MASTER_SCHEMAS[entity].unique) {
    const value = uniqueKeyValue(fields, data);
    if (!value) continue;
    const ref = adminDb.doc(`groups/${groupId}/unique_keys/${uniqueKeyDocId(entity, fields, value)}`);
    const snap = tx ? await tx.get(ref) : await ref.get();
    if (snap.exists && snap.data()!.id !== exceptId) hits.push({ fields, value, id: snap.data()!.id });
  }
  return hits;
}

const dupMessage = (entity: MasterEntity, hits: { fields: string[]; value: string; id: string }[]) =>
  `${MASTER_SCHEMAS[entity].label}ที่มี ${hits.map((h) => `${h.fields.join("+")} ${h.value}`).join(", ")} มีอยู่แล้วในเครือ (รหัส ${hits.map((h) => h.id).join(", ")}) — ใช้รายการเดิมแล้วตั้งชื่อเฉพาะบริษัทแทน`;

function writeUniqueKeys(tx: admin.firestore.Transaction, groupId: string, entity: MasterEntity, id: string, before: Record<string, any> | null, after: Record<string, any>) {
  for (const fields of MASTER_SCHEMAS[entity].unique) {
    const oldV = before ? uniqueKeyValue(fields, before) : "";
    const newV = uniqueKeyValue(fields, after);
    if (oldV === newV) continue;
    if (oldV) tx.delete(adminDb.doc(`groups/${groupId}/unique_keys/${uniqueKeyDocId(entity, fields, oldV)}`));
    if (newV) tx.set(adminDb.doc(`groups/${groupId}/unique_keys/${uniqueKeyDocId(entity, fields, newV)}`), { entity, fields, value: newV, id });
  }
}

/** รายการรุ่นเก่า (ยังไม่มีดัชนีห้ามซ้ำ) ที่ SKU/บาร์โค้ด หรือเลขผู้เสียภาษี+สาขา ชนกัน */
async function legacyDuplicates(entity: MasterEntity, companyId: string, data: Record<string, any>, exceptId = "") {
  const hits: { fields: string[]; value: string; id: string }[] = [];
  const live = (d: admin.firestore.QueryDocumentSnapshot) => d.id !== exceptId && d.data().isDeleted !== true;
  if (entity === "products") {
    for (const f of ["sku", "barcode"]) {
      const v = String(data?.[f] ?? "").trim();
      if (!v) continue;
      const q = await adminDb.collection("products").where("companyId", "==", companyId).where(f, "==", v).limit(3).get();
      q.docs.filter(live).forEach((d) => hits.push({ fields: [f], value: v.toUpperCase(), id: d.id }));
    }
    return hits;
  }
  const taxId = String(data?.taxId ?? data?.tax_id ?? "").replace(/\D/g, "");
  if (!taxId) return hits;
  const branchOf = (x: any) => String(x?.branchCode ?? x?.branch_code ?? "").trim() || "00000";
  const branch = branchOf(data);
  const col = LEGACY_ROOT[entity] ? adminDb.collection(LEGACY_ROOT[entity]!).where("companyId", "==", companyId) : adminDb.collection(`companies/${companyId}/${entity}`);
  const [a, b] = await Promise.all([col.where("taxId", "==", taxId).limit(5).get(), col.where("tax_id", "==", taxId).limit(5).get()]);
  const seen = new Set<string>();
  [...a.docs, ...b.docs].filter(live).filter((d) => branchOf(d.data()) === branch).forEach((d) => {
    if (!seen.has(d.id)) { seen.add(d.id); hits.push({ fields: ["taxId", "branchCode"], value: `${taxId}|${branch}`, id: d.id }); }
  });
  return hits;
}

/** เอกสารรุ่นเก่าของบริษัทนี้ที่ยังไม่ย้ายเข้าข้อมูลกลาง: root (สินค้า ผู้ขาย ผู้รับเหมา) หรือเอกสารลูกค้าใต้บริษัท */
async function legacyDoc(entity: MasterEntity, id: string, companyId: string) {
  const root = LEGACY_ROOT[entity];
  const snap = await adminDb.doc(root ? `${root}/${id}` : `companies/${companyId}/${entity}/${id}`).get();
  if (!snap.exists || (root && snap.data()!.companyId !== companyId)) return null;
  return snap;
}

const historyEntry = (u: ApiUser, companyId: string, action: string, changes: Record<string, any>) => ({
  at: admin.firestore.FieldValue.serverTimestamp(), by: u.uid, byName: u.email || u.uid, companyId, action, changes,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 30);
    const groupId = await groupIdOfCompany(companyId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "context") {
      const companies = await companiesInGroup(groupId);
      const rights = Object.fromEntries(await Promise.all((["products", "customers", "suppliers", "contractors"] as MasterEntity[]).map(async (e) => [e, await canEditMaster(apiUser, companyId, e, groupId)])));
      return NextResponse.json({ success: true, groupId, companyCount: companies.length, canEditMaster: rights });
    }

    const entity = body.entity;
    if (!isMasterEntity(entity)) throw new ApiAuthError(400, "ประเภทข้อมูลไม่ถูกต้อง");
    const schema = MASTER_SCHEMAS[entity];
    const viewPerm = schema.editPermission.replace(":edit", ":view") as any;
    if (!can(apiUser.roles, viewPerm) && !can(apiUser.roles, schema.editPermission)) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const masterCol = adminDb.collection(`groups/${groupId}/${entity}`);
    const localCol = adminDb.collection(`companies/${companyId}/${entity}`);

    if (action === "get") {
      const id = str(body.id, 120);
      if (!ID.test(id)) throw new ApiAuthError(400, "รหัสไม่ถูกต้อง");
      const [m, l, legacy] = await Promise.all([masterCol.doc(id).get(), localCol.doc(id).get(), legacyDoc(entity, id, companyId)]);
      if (!m.exists && !l.exists && !legacy) throw new ApiAuthError(404, `ไม่พบ${schema.label}`);
      const record = m.exists || !legacy ? mergeRecord(entity, m.data(), l.data()) : { ...legacy.data(), ...mergeRecord(entity, null, l.data()), _legacy: true };
      return NextResponse.json({ success: true, groupId, record: { id, ...record } });
    }

    if (action === "checkDuplicate") {
      const exceptId = str(body.exceptId, 120);
      const hits = [...(await findDuplicates(null, groupId, entity, body.data || {}, exceptId)), ...(await legacyDuplicates(entity, companyId, body.data || {}, exceptId))];
      return NextResponse.json({ success: true, duplicates: hits });
    }

    // โปรไฟล์เอกสารลูกค้า (เฉพาะฟิลด์ docProfile ของบริษัท): แอดมินการเงินตั้งรูปแบบวางบิล/รับเงินได้ แม้ไม่มีสิทธิ์งานขาย
    const changeKeys = body.changes && typeof body.changes === "object" ? Object.keys(body.changes) : [];
    const profileOnly = action === "update" && entity === "customers" && changeKeys.length === 1 && changeKeys[0] === "docProfile";
    if (!can(apiUser.roles, schema.editPermission) && !(profileOnly && can(apiUser.roles, "finance:edit"))) throw new ApiAuthError(403, `ไม่มีสิทธิ์แก้ไขข้อมูล${schema.label}`);
    if (entity === "customers" && body.changes?.docProfile !== undefined) {
      // ตรวจค่าที่ server และบันทึกผู้แก้ล่าสุด (โปรไฟล์อยู่ที่ข้อมูลของบริษัทเสมอ)
      body.changes.docProfile = { ...normalizeDocProfile(body.changes.docProfile), updatedBy: apiUser.email || apiUser.uid, updatedAt: new Date().toISOString() };
      body.scope = "company";
    }

    if (action === "create") {
      const data = normalizeParty(entity, clean(body.data || {}));
      if (!str(data.name)) throw new ApiAuthError(400, `กรุณาระบุชื่อ${schema.label}`);
      const id = str(body.id, 120) || masterCol.doc().id;
      if (!ID.test(id)) throw new ApiAuthError(400, "รหัสไม่ถูกต้อง");
      // สร้างรายการใหม่ = ค่าที่กรอกเป็นค่ากลาง (identity + shared) ส่วนที่เหลือเป็นของบริษัท
      const { master, local } = splitChanges(entity, data, "group");
      protectLocal(entity, local);
      const opening = entity === "products" ? { qty: Math.floor(Number(body.openingStock?.qty) || 0), unitCost: Math.max(0, Number(body.openingStock?.unitCost) || 0) } : { qty: 0, unitCost: 0 };
      const postOpeningJournal = body.openingStock?.postJournal !== false;
      if (opening.qty < 0 || opening.qty > 10_000_000) throw new ApiAuthError(400, "จำนวนยกมาไม่ถูกต้อง");
      if (entity === "products") local.stockStatus = { onHand: 0, reserved: 0, available: 0 };
      const legacyHits = await legacyDuplicates(entity, companyId, master);
      if (legacyHits.length) throw new ApiAuthError(409, dupMessage(entity, legacyHits));
      await adminDb.runTransaction(async (tx) => {
        const [m, l] = await Promise.all([tx.get(masterCol.doc(id)), tx.get(localCol.doc(id))]);
        const legacy = LEGACY_ROOT[entity] ? await tx.get(adminDb.doc(`${LEGACY_ROOT[entity]}/${id}`)) : null;
        if (m.exists || l.exists || legacy?.exists) throw new ApiAuthError(409, `รหัส ${id} มีอยู่แล้ว`);
        const hits = await findDuplicates(tx, groupId, entity, master);
        if (hits.length) throw new ApiAuthError(409, dupMessage(entity, hits));
        writeUniqueKeys(tx, groupId, entity, id, null, master);
        tx.create(masterCol.doc(id), { ...master, groupId, createdBy: apiUser.uid, createdByCompany: companyId, createdAt: now, updatedAt: now, isDeleted: false });
        tx.create(localCol.doc(id), { ...local, companyId, groupId, createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false });
        tx.create(masterCol.doc(id).collection("history").doc(), historyEntry(apiUser, companyId, "create", master));
      });
      if (opening.qty > 0) {
        const amount = Math.round(opening.qty * opening.unitCost * 100) / 100;
        await processStockMovements([{ companyId, productId: id, type: "IN", quantity: opening.qty, unitCost: opening.unitCost, referenceId: `OPEN-${id}`, userId: apiUser.email || apiUser.uid }], (tx) => {
          if (amount <= 0 || !postOpeningJournal) return;
          tx.set(adminDb.collection(`companies/${companyId}/journal_entries`).doc(), {
            companyId, date: now, bookType: "JV", status: "draft",
            description: `[AUTO] ยอดยกมาสินค้า ${master.sku || id} ${opening.qty} หน่วย`,
            reference: `OPEN-${id}`, totalDebit: amount, totalCredit: amount, isOfficialTax: false,
            items: [
              { accountCode: "1141-00", accountName: "สินค้าคงเหลือ", debit: amount, credit: 0 },
              { accountCode: "3211-00", accountName: "กำไร (ขาดทุน) สะสม", debit: 0, credit: amount },
            ],
            createdBy: apiUser.uid, createdAt: now, updatedAt: now,
          });
        });
      }
      return NextResponse.json({ success: true, id, groupId, openingStock: opening.qty });
    }

    const id = str(body.id, 120);
    if (!ID.test(id)) throw new ApiAuthError(400, "รหัสไม่ถูกต้อง");

    if (action === "adopt") {
      const local = splitChanges(entity, clean(body.data || {}), "company").local;
      protectLocal(entity, local);
      await adminDb.runTransaction(async (tx) => {
        const [m, l] = await Promise.all([tx.get(masterCol.doc(id)), tx.get(localCol.doc(id))]);
        if (!m.exists || m.data()!.isDeleted === true) throw new ApiAuthError(404, `ไม่พบ${schema.label}กลางรหัส ${id}`);
        if (l.exists && l.data()!.isDeleted !== true) throw new ApiAuthError(409, `บริษัทนี้ใช้${schema.label}รหัส ${id} อยู่แล้ว`);
        tx.set(localCol.doc(id), { ...local, companyId, groupId, isDeleted: false, createdBy: apiUser.uid, createdAt: now, updatedAt: now });
      });
      return NextResponse.json({ success: true, id });
    }

    if (action === "update") {
      const scope: EditScope = body.scope === "group" ? "group" : "company";
      const { master, local } = splitChanges(entity, normalizeParty(entity, clean(body.changes || {})), scope);
      const ignored = protectLocal(entity, local);
      // ส่งมาเฉพาะฟิลด์ที่ระบบคำนวณเอง (สต็อก ต้นทุน) = ไม่มีอะไรให้บันทึก แจ้งชัดเจนแทนการตอบสำเร็จเงียบ ๆ
      if (ignored.length && !Object.keys(master).length && !Object.keys(local).length) {
        throw new ApiAuthError(400, `แก้ ${ignored.join(", ")} ผ่านหน้านี้ไม่ได้ (สต็อกและต้นทุนเปลี่ยนผ่านการรับ/เบิก/ปรับปรุงสต็อกเท่านั้น)`);
      }
      const legacy = await legacyDoc(entity, id, companyId);
      if (legacy && !(await masterCol.doc(id).get()).exists) {
        // ยังไม่ย้ายเข้าข้อมูลกลาง: เครือมีบริษัทเดียวเท่านั้นที่มีรายการแบบนี้ -> แก้ที่เอกสารเดิมทั้งหมด
        const all = { ...master, ...local };
        const hits = [...(await findDuplicates(null, groupId, entity, { ...legacy.data(), ...all }, id)), ...(await legacyDuplicates(entity, companyId, all, id))];
        if (hits.length) throw new ApiAuthError(409, dupMessage(entity, hits));
        await legacy.ref.set({ ...all, updatedAt: now, updatedBy: apiUser.uid }, { merge: true });
        return NextResponse.json({ success: true, id, legacy: true, updated: Object.keys(all), ignored });
      }
      if (Object.keys(master).length && !(await canEditMaster(apiUser, companyId, entity, groupId))) {
        throw new ApiAuthError(403, `ข้อมูลกลางของ${schema.label} (${Object.keys(master).join(", ")}) แก้ได้เฉพาะผู้ดูแลเครือ — ตั้งชื่อ/รายละเอียดเฉพาะบริษัทแทนได้`);
      }
      await adminDb.runTransaction(async (tx) => {
        const [m, l] = await Promise.all([tx.get(masterCol.doc(id)), tx.get(localCol.doc(id))]);
        if (!m.exists && !l.exists) throw new ApiAuthError(404, `ไม่พบ${schema.label}`);
        if (Object.keys(master).length) {
          if (!m.exists) throw new ApiAuthError(409, `${schema.label}นี้ยังไม่ได้ย้ายเข้าข้อมูลกลาง`);
          const after = { ...m.data(), ...master };
          const hits = await findDuplicates(tx, groupId, entity, after, id);
          if (hits.length) throw new ApiAuthError(409, dupMessage(entity, hits));
          writeUniqueKeys(tx, groupId, entity, id, m.data()!, after);
          tx.update(masterCol.doc(id), { ...master, updatedAt: now, updatedBy: apiUser.uid });
          tx.create(masterCol.doc(id).collection("history").doc(), historyEntry(apiUser, companyId, "update", master));
        }
        if (Object.keys(local).length) {
          const localData = { ...local, companyId, groupId, updatedAt: now, updatedBy: apiUser.uid };
          // docProfile แทนที่ทั้งก้อน (merge ปกติจะเก็บค่าย่อยที่ผู้ใช้ลบออกไว้)
          tx.set(localCol.doc(id), localData, "docProfile" in local ? { mergeFields: Object.keys(localData) } : { merge: true });
        }
      });
      return NextResponse.json({ success: true, id, updatedMaster: Object.keys(master), updatedLocal: Object.keys(local), ignored });
    }

    if (action === "resetLocal") {
      const fields = (Array.isArray(body.fields) ? body.fields : []).map((f: any) => str(f, 60)).filter((f: string) => schema.shared.includes(f));
      if (!fields.length) throw new ApiAuthError(400, "ไม่มีฟิลด์ที่ล้างได้");
      const ref = localCol.doc(id);
      if (!(await ref.get()).exists) throw new ApiAuthError(404, `ไม่พบ${schema.label}ของบริษัท`);
      await ref.update({ ...Object.fromEntries(fields.map((f: string) => [f, admin.firestore.FieldValue.delete()])), updatedAt: now, updatedBy: apiUser.uid });
      return NextResponse.json({ success: true, id, reset: fields });
    }

    if (action === "remove") {
      const perm = entity === "products" ? "inventory:delete" : entity === "customers" ? "sales:delete" : "procurement:edit";
      if (!can(apiUser.roles, perm as any)) throw new ApiAuthError(403, `ไม่มีสิทธิ์ลบ${schema.label}`);
      const [m, l, legacy] = await Promise.all([masterCol.doc(id).get(), localCol.doc(id).get(), legacyDoc(entity, id, companyId)]);
      const target = m.exists ? (l.exists ? l.ref : null) : legacy?.ref || null;
      if (!target) throw new ApiAuthError(404, `ไม่พบ${schema.label}`);
      if (entity === "products") {
        const st = (m.exists ? l.data() : legacy?.data())?.stockStatus || {};
        if ((Number(st.onHand) || 0) > 0 || (Number(st.reserved) || 0) > 0) throw new ApiAuthError(409, "ยังมีสต็อกหรือยอดจองอยู่ ลบไม่ได้ — ตัดจำหน่าย/เบิกออกก่อน");
      }
      await target.set({ isDeleted: true, deletedAt: now, deletedBy: apiUser.uid, updatedAt: now }, { merge: true });
      return NextResponse.json({ success: true, id });
    }

    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[MASTER_DATA_API]", err);
    return NextResponse.json({ success: false, error: err.message || "ดำเนินการไม่สำเร็จ" }, { status: 500 });
  }
}
