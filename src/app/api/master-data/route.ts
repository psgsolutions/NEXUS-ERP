import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError, type ApiUser } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { canEditMaster, companiesInGroup, groupIdOfCompany } from "@/lib/company-group.server";
import { MASTER_SCHEMAS, isMasterEntity, mergeRecord, splitChanges, uniqueKeyDocId, uniqueKeyValue, type EditScope, type MasterEntity } from "@/lib/master-data";

/**
 * [API-SERVER] ข้อมูลหลักแบบเครือบริษัท — POST /api/master-data
 *  - { action: "get", entity, id }                         ข้อมูลรวม (กลาง + ของบริษัท)
 *  - { action: "context" }                                 เครือของบริษัท จำนวนบริษัท และสิทธิ์แก้ข้อมูลกลาง
 *  - { action: "checkDuplicate", entity, data }            มีรายการที่ SKU/บาร์โค้ด/เลขผู้เสียภาษี ซ้ำในเครือหรือไม่
 *  - { action: "create", entity, id?, data }               สร้างใหม่ (ข้อมูลกลาง + ของบริษัท)
 *  - { action: "adopt", entity, id, data? }                ใช้รายการกลางที่มีอยู่แล้วในบริษัทนี้ (ตั้งค่าของบริษัทได้)
 *  - { action: "update", entity, id, changes, scope }      scope "group" = แก้ค่ากลาง / "company" = ตั้งค่าของบริษัท
 *  - { action: "resetLocal", entity, id, fields }          ล้างค่าของบริษัท กลับไปใช้ค่ากลาง
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

function protectLocal(entity: MasterEntity, local: Record<string, any>) {
  const bad = Object.keys(local).filter((k) => PROTECTED[entity].includes(k));
  if (bad.length) throw new ApiAuthError(400, `แก้ฟิลด์ ${bad.join(", ")} ผ่านเอกสารคลัง/บัญชีเท่านั้น`);
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
      const [m, l] = await Promise.all([masterCol.doc(id).get(), localCol.doc(id).get()]);
      if (!m.exists && !l.exists) throw new ApiAuthError(404, `ไม่พบ${schema.label}`);
      return NextResponse.json({ success: true, groupId, record: { id, ...mergeRecord(entity, m.data(), l.data()) } });
    }

    if (action === "checkDuplicate") {
      const hits = await findDuplicates(null, groupId, entity, body.data || {}, str(body.exceptId, 120));
      return NextResponse.json({ success: true, duplicates: hits });
    }

    if (!can(apiUser.roles, schema.editPermission)) throw new ApiAuthError(403, `ไม่มีสิทธิ์แก้ไขข้อมูล${schema.label}`);

    if (action === "create") {
      const data = clean(body.data || {});
      if (!str(data.name)) throw new ApiAuthError(400, `กรุณาระบุชื่อ${schema.label}`);
      const id = str(body.id, 120) || masterCol.doc().id;
      if (!ID.test(id)) throw new ApiAuthError(400, "รหัสไม่ถูกต้อง");
      // สร้างรายการใหม่ = ค่าที่กรอกเป็นค่ากลาง (identity + shared) ส่วนที่เหลือเป็นของบริษัท
      const { master, local } = splitChanges(entity, data, "group");
      protectLocal(entity, local);
      await adminDb.runTransaction(async (tx) => {
        const [m, l] = await Promise.all([tx.get(masterCol.doc(id)), tx.get(localCol.doc(id))]);
        if (m.exists || l.exists) throw new ApiAuthError(409, `รหัส ${id} มีอยู่แล้ว`);
        const hits = await findDuplicates(tx, groupId, entity, master);
        if (hits.length) throw new ApiAuthError(409, dupMessage(entity, hits));
        writeUniqueKeys(tx, groupId, entity, id, null, master);
        tx.create(masterCol.doc(id), { ...master, groupId, createdBy: apiUser.uid, createdByCompany: companyId, createdAt: now, updatedAt: now, isDeleted: false });
        tx.create(localCol.doc(id), { ...local, companyId, groupId, createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false });
        tx.create(masterCol.doc(id).collection("history").doc(), historyEntry(apiUser, companyId, "create", master));
      });
      return NextResponse.json({ success: true, id, groupId });
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
      const { master, local } = splitChanges(entity, clean(body.changes || {}), scope);
      protectLocal(entity, local);
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
          tx.set(localCol.doc(id), { ...local, companyId, groupId, updatedAt: now, updatedBy: apiUser.uid }, { merge: true });
        }
      });
      return NextResponse.json({ success: true, id, updatedMaster: Object.keys(master), updatedLocal: Object.keys(local) });
    }

    if (action === "resetLocal") {
      const fields = (Array.isArray(body.fields) ? body.fields : []).map((f: any) => str(f, 60)).filter((f: string) => schema.shared.includes(f));
      if (!fields.length) throw new ApiAuthError(400, "ไม่มีฟิลด์ที่ล้างได้");
      const ref = localCol.doc(id);
      if (!(await ref.get()).exists) throw new ApiAuthError(404, `ไม่พบ${schema.label}ของบริษัท`);
      await ref.update({ ...Object.fromEntries(fields.map((f: string) => [f, admin.firestore.FieldValue.delete()])), updatedAt: now, updatedBy: apiUser.uid });
      return NextResponse.json({ success: true, id, reset: fields });
    }

    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[MASTER_DATA_API]", err);
    return NextResponse.json({ success: false, error: err.message || "ดำเนินการไม่สำเร็จ" }, { status: 500 });
  }
}
