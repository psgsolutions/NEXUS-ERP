import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { normalizeUserStatus } from "@/lib/user-status";
import { auditServer } from "@/services/audit.server";
import { MAX_SIGNERS, SIGN_MAX, normalizeSigning, signerIdOf, type SigningConfig } from "@/lib/documents/esign";
import { loadSigning, signerImageRef, signingRef } from "@/lib/documents/esign.server";

/**
 * [API-SERVER] ลายเซ็นและตราประทับอิเล็กทรอนิกส์ — POST /api/settings/document-signing
 * ลายเซ็นผูกกับรหัสผู้ใช้เสมอ · ตราบริษัทและการเลือกช่องลงนามเป็นของผู้ดูแลบริษัท
 *  - get                                   ทุกคน: ลายเซ็นของตัวเอง · ผู้ดูแล/ฝ่ายบุคคล: ทั้งหมด + รายชื่อผู้ใช้ในบริษัท
 *  - saveCompany { stamp, stampSize, assign }   ผู้ดูแลบริษัท (settings:manage) — ตรา ขนาดตรา ช่องลงนาม
 *  - saveSigner  { userId?, image, position, consent? }
 *        ตั้งลายเซ็นของตัวเอง (ไม่ส่ง userId) — เจ้าของยินยอมเอง
 *        ฝ่ายบุคคล (hr:edit) ตั้งให้ผู้ใช้คนอื่นในบริษัท — ต้องยืนยันว่าได้รับความยินยอมจากเจ้าของ
 *  - removeSigner { signerId }             เจ้าของลบของตัวเอง · ฝ่ายบุคคลลบของใครก็ได้ (ช่องลงนามที่ใช้ลายเซ็นนี้ถูกล้าง)
 *  - bindSigner  { signerId, userId }       ฝ่ายบุคคล: ผูกลายเซ็นรุ่นเก่า (ยังไม่ผูกผู้ใช้) กับบัญชีผู้ใช้
 * รูปลายเซ็นแยกเก็บต่อคนที่ document_assets/signer_{id} (กฎฐานข้อมูล: client อ่าน/เขียนไม่ได้)
 * เขียนเอกสารรวมทั้งก้อนเสมอ (ไม่ใช้ merge — merge รวมค่าซ้อนใน assign ทำให้ลบการกำหนดช่องลงนามไม่ได้)
 */
const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);
const IMG = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const displayName = (u: any) => str(u?.displayName || u?.name || u?.email, 80);

type Meta = { id: string; userId?: string; name: string; position: string; image?: string; consentAt?: string; consentBy?: string };

/** รายชื่อผู้ลงนาม (ไม่มีรูป) จากเอกสารรวม — คงรูปของลายเซ็นรุ่นเก่าไว้จนกว่าจะแก้ */
const metaOf = (raw: any): Meta[] => (Array.isArray(raw?.signers) ? raw.signers : []).filter((s: any) => s?.id).slice(0, MAX_SIGNERS);
/** ช่องลงนามที่อ้างถึงลายเซ็นที่ถูกลบ: เหลือเฉพาะการประทับตรา */
function dropSigner(assign: SigningConfig["assign"], id: string): SigningConfig["assign"] {
  const out: SigningConfig["assign"] = {};
  for (const [t, slots] of Object.entries(assign || {})) {
    const n = Object.fromEntries(Object.entries(slots).map(([l, r]) => [l, r.signer === id ? { ...(r.stamp ? { stamp: true } : {}) } : r]).filter(([, r]: any) => r.signer || r.stamp));
    if (Object.keys(n).length) out[t] = n as any;
  }
  return out;
}

async function companyUser(companyId: string, uid: string) {
  const snap = await adminDb.doc(`users/${uid}`).get();
  const u = snap.data();
  if (!snap.exists || u?.companyId !== companyId) throw new ApiAuthError(400, "ผู้ใช้นี้ไม่ได้อยู่ในบริษัทนี้");
  if (normalizeUserStatus(u?.status) !== "ACTIVE") throw new ApiAuthError(400, "บัญชีผู้ใช้นี้ยังไม่เปิดใช้งาน");
  return u!;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    const isAdmin = can(apiUser.roles, "settings:manage"), isHr = can(apiUser.roles, "hr:edit");
    const ref = signingRef(companyId);
    const action = str(body.action, 20);
    const myId = signerIdOf(apiUser.uid);

    if (action === "get") {
      const signing = await loadSigning(companyId);
      const mine = signing.signers.find((s) => s.id === myId) || null;
      if (!isAdmin && !isHr) return NextResponse.json({ success: true, mine });
      const users = isHr
        ? (await adminDb.collection("users").where("companyId", "==", companyId).limit(500).get()).docs
          .filter((d) => normalizeUserStatus(d.get("status")) === "ACTIVE").map((d) => ({ uid: d.id, name: displayName(d.data()) })).sort((a, b) => a.name.localeCompare(b.name, "th"))
        : [];
      return NextResponse.json({ success: true, signing, mine, users, canManageSigners: isHr, canManageCompany: isAdmin });
    }

    if (action === "saveCompany") {
      if (!isAdmin) throw new ApiAuthError(403, "ตราประทับและช่องลงนามตั้งได้เฉพาะผู้ดูแลบริษัท");
      const raw = body.signing || {};
      const stamp = String(raw.stamp || "");
      const result = await adminDb.runTransaction(async (tx) => {
        const cur = (await tx.get(ref)).data() || {};
        const ids = new Set(metaOf(cur).map((s) => s.id));
        const norm = normalizeSigning({ stamp, stampSize: raw.stampSize, assign: raw.assign, signers: metaOf(cur).map((s) => ({ ...s, image: "data:image/png;base64,AA==" })) });
        if (stamp && !norm.stamp) throw new ApiAuthError(400, "ตราประทับต้องเป็น PNG/JPG ไม่เกิน 300 KB");
        // ช่องลงนามอ้างได้เฉพาะลายเซ็นที่มีอยู่
        const assign = Object.fromEntries(Object.entries(norm.assign).map(([t, slots]) => [t, Object.fromEntries(Object.entries(slots).map(([l, r]) => [l, r.signer && !ids.has(r.signer) ? { ...(r.stamp ? { stamp: true } : {}) } : r]))]));
        tx.set(ref, { ...cur, stamp: norm.stamp, stampSize: norm.stampSize, assign, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
        return { before: { stamp: !!cur.stamp, assign: cur.assign || {} }, after: { stamp: !!norm.stamp, assign } };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "DOCUMENT_SIGNING", "company-stamp", result.before, result.after);
      return NextResponse.json({ success: true, signing: await loadSigning(companyId) });
    }

    if (action === "saveSigner") {
      const target = str(body.userId, 128) || apiUser.uid;
      const self = target === apiUser.uid;
      if (!self && !isHr) throw new ApiAuthError(403, "ตั้งลายเซ็นให้ผู้อื่นได้เฉพาะฝ่ายบุคคล");
      if (!self && body.consent !== true) throw new ApiAuthError(400, "ยืนยันว่าได้รับความยินยอมจากเจ้าของลายเซ็นให้ใช้ลายเซ็นบนเอกสารก่อนบันทึก");
      const image = String(body.image || "");
      if (!IMG.test(image) || image.length > SIGN_MAX) throw new ApiAuthError(400, "รูปลายเซ็นต้องเป็น PNG/JPG ไม่เกิน 150 KB");
      const user = await companyUser(companyId, target);
      const id = signerIdOf(target), who = str((apiUser as any).name || apiUser.email || apiUser.uid, 80), now = new Date().toISOString();
      await adminDb.runTransaction(async (tx) => {
        const cur = (await tx.get(ref)).data() || {};
        const list = metaOf(cur);
        if (!list.some((s) => s.id === id) && list.length >= MAX_SIGNERS) throw new ApiAuthError(400, `ลายเซ็นในบริษัทครบ ${MAX_SIGNERS} คนแล้ว`);
        const meta: Meta = {
          id, userId: target, name: displayName(user), position: str(body.position, 80),
          consentAt: now, consentBy: self ? `${who} (เจ้าของลายเซ็น)` : who,
        };
        tx.set(ref, { ...cur, signers: [...list.filter((s) => s.id !== id), meta], updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
        tx.set(signerImageRef(companyId, id), { id, userId: target, image, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "DOCUMENT_SIGNING", id, null, { signer: displayName(user), by: self ? "เจ้าของ" : "ฝ่ายบุคคล" });
      const signing = await loadSigning(companyId);
      return NextResponse.json({ success: true, mine: signing.signers.find((s) => s.id === myId) || null, ...(isHr || isAdmin ? { signing } : {}) });
    }

    if (action === "removeSigner") {
      const id = str(body.signerId, 80) || myId;
      if (id !== myId && !isHr) throw new ApiAuthError(403, "ลบลายเซ็นของผู้อื่นได้เฉพาะฝ่ายบุคคล");
      await adminDb.runTransaction(async (tx) => {
        const cur = (await tx.get(ref)).data() || {};
        tx.set(ref, { ...cur, signers: metaOf(cur).filter((s) => s.id !== id), assign: dropSigner(cur.assign || {}, id), updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
        tx.delete(signerImageRef(companyId, id));
      });
      await auditServer.logDelete(apiUser.uid, companyId, "DOCUMENT_SIGNING", id);
      const signing = await loadSigning(companyId);
      return NextResponse.json({ success: true, mine: signing.signers.find((s) => s.id === myId) || null, ...(isHr || isAdmin ? { signing } : {}) });
    }

    if (action === "bindSigner") {
      if (!isHr) throw new ApiAuthError(403, "ผูกลายเซ็นกับผู้ใช้ได้เฉพาะฝ่ายบุคคล");
      const id = str(body.signerId, 80), target = str(body.userId, 128);
      const user = await companyUser(companyId, target);
      await adminDb.runTransaction(async (tx) => {
        const cur = (await tx.get(ref)).data() || {};
        const list = metaOf(cur), old = list.find((s) => s.id === id);
        if (!old) throw new ApiAuthError(404, "ไม่พบลายเซ็นนี้");
        if (old.userId) throw new ApiAuthError(409, "ลายเซ็นนี้ผูกกับผู้ใช้แล้ว");
        if (list.some((s) => s.userId === target)) throw new ApiAuthError(409, `${displayName(user)} มีลายเซ็นของตัวเองแล้ว — ลบลายเซ็นใดลายเซ็นหนึ่งก่อน`);
        // รหัสเดิมคงไว้ (ช่องลงนาม/กล่องลายเซ็นในผังอ้างถึงรหัสนี้) · ย้ายรูปออกจากเอกสารรวม
        const { image, ...rest } = old;
        tx.set(ref, { ...cur, signers: list.map((s) => (s.id === id ? { ...rest, userId: target, name: displayName(user) } : s)), updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
        if (image) tx.set(signerImageRef(companyId, id), { id, userId: target, image, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "DOCUMENT_SIGNING", id, null, { boundTo: displayName(user) });
      return NextResponse.json({ success: true, signing: await loadSigning(companyId) });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DOCUMENT_SIGNING]", err);
    return NextResponse.json({ success: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
