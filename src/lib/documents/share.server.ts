import crypto from "node:crypto";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * ลิงก์เอกสารสำหรับลูกค้า/คู่ค้า (ไม่ต้องล็อกอิน) และประวัติการส่ง
 *  - ไม่เก็บไฟล์ PDF: เปิดลิงก์เมื่อไรระบบสร้าง PDF จากข้อมูลที่บันทึกไว้ (ข้อมูล ณ วันที่ออก) ทุกครั้ง
 *  - document_shares/{token}: token สุ่ม 192 บิต เดาไม่ได้ มีวันหมดอายุ ยกเลิกได้
 *  - companies/{c}/document_sends: ใครส่งอะไร ให้ใคร ช่องทางไหน เมื่อไร
 */

export const SHARE_DAYS_DEFAULT = 30;
export const SHARE_DAYS_MAX = 365;

export interface ShareRecord {
  token: string;
  companyId: string;
  type: string;
  id: string;
  number: string;
  title: string;
  createdBy: string;
  createdAt: any;
  expiresAt: admin.firestore.Timestamp;
  revoked: boolean;
  views: number;
  lastViewedAt?: any;
}

export const newToken = () => crypto.randomBytes(24).toString("base64url");
export const isTokenFormat = (t: string) => /^[A-Za-z0-9_-]{32}$/.test(t);

/** ลิงก์ที่ยังใช้ได้ของเอกสารนี้ (ใช้ซ้ำแทนการสร้างใหม่ทุกครั้ง) */
async function activeShare(companyId: string, type: string, id: string): Promise<ShareRecord | null> {
  const q = await adminDb.collection("document_shares").where("companyId", "==", companyId).where("docKey", "==", `${type}/${id}`).get();
  const now = Date.now();
  const live = q.docs.map((d) => d.data() as ShareRecord)
    .filter((s) => !s.revoked && s.expiresAt.toMillis() > now + 7 * 86400e3)
    .sort((a, b) => b.expiresAt.toMillis() - a.expiresAt.toMillis());
  return live[0] || null;
}

export async function createShare(args: { companyId: string; type: string; id: string; number: string; title: string; uid: string; days?: number; reuse?: boolean }): Promise<ShareRecord> {
  if (args.reuse !== false) {
    const cur = await activeShare(args.companyId, args.type, args.id);
    if (cur) return cur;
  }
  const days = Math.min(SHARE_DAYS_MAX, Math.max(1, Math.round(Number(args.days) || SHARE_DAYS_DEFAULT)));
  const token = newToken();
  const rec = {
    token, companyId: args.companyId, type: args.type, id: args.id, docKey: `${args.type}/${args.id}`,
    number: args.number, title: args.title,
    createdBy: args.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + days * 86400e3),
    revoked: false, views: 0,
  };
  await adminDb.doc(`document_shares/${token}`).create(rec);
  return { ...rec, createdAt: new Date() } as ShareRecord;
}

export async function listShares(companyId: string, type: string, id: string) {
  const q = await adminDb.collection("document_shares").where("companyId", "==", companyId).where("docKey", "==", `${type}/${id}`).get();
  return q.docs.map((d) => d.data() as ShareRecord);
}

export async function revokeShare(companyId: string, token: string, uid: string) {
  const ref = adminDb.doc(`document_shares/${token}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.companyId !== companyId) return null;
  await ref.update({ revoked: true, revokedBy: uid, revokedAt: admin.firestore.FieldValue.serverTimestamp() });
  return snap.data() as ShareRecord;
}

/** ตรวจลิงก์สาธารณะ: มีอยู่ ไม่ถูกยกเลิก ไม่หมดอายุ */
export async function resolveShare(token: string): Promise<{ ok: true; share: ShareRecord } | { ok: false; reason: string }> {
  if (!isTokenFormat(token)) return { ok: false, reason: "ลิงก์ไม่ถูกต้อง" };
  const snap = await adminDb.doc(`document_shares/${token}`).get();
  if (!snap.exists) return { ok: false, reason: "ไม่พบเอกสาร หรือลิงก์ไม่ถูกต้อง" };
  const s = snap.data() as ShareRecord;
  if (s.revoked) return { ok: false, reason: "ลิงก์นี้ถูกยกเลิกแล้ว กรุณาติดต่อผู้ส่งเอกสาร" };
  if (s.expiresAt.toMillis() < Date.now()) return { ok: false, reason: "ลิงก์นี้หมดอายุแล้ว กรุณาติดต่อผู้ส่งเอกสาร" };
  return { ok: true, share: s };
}

export async function markViewed(token: string) {
  await adminDb.doc(`document_shares/${token}`).update({ views: admin.firestore.FieldValue.increment(1), lastViewedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
}

export type SendChannel = "link" | "email" | "line";

export async function logSend(companyId: string, entry: {
  type: string; id: string; number: string; channel: SendChannel; to?: string; token?: string; status: "sent" | "failed" | "created"; error?: string; uid: string; byName?: string;
}) {
  await adminDb.collection(`companies/${companyId}/document_sends`).add({
    companyId, docKey: `${entry.type}/${entry.id}`, ...JSON.parse(JSON.stringify(entry)),
    at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function listSends(companyId: string, type: string, id: string) {
  const q = await adminDb.collection(`companies/${companyId}/document_sends`).where("docKey", "==", `${type}/${id}`).get();
  return q.docs.map((d) => ({ ...d.data(), sendId: d.id }) as any)
    .sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0))
    .slice(0, 50);
}

/** URL หน้าเอกสารสำหรับลูกค้า */
export const shareUrl = (origin: string, token: string) => `${origin.replace(/\/$/, "")}/d/${token}`;

/**
 * โดเมนของเว็บที่ผู้ใช้เรียกมา (สำหรับลิงก์ที่ส่งออกไป)
 * ตั้ง NEXT_PUBLIC_APP_URL เพื่อกำหนดเอง, ไม่งั้นใช้ X-Forwarded-Host / Host (request.url อาจเป็นที่อยู่ภายในเช่น 0.0.0.0)
 */
export function publicOrigin(request: Request): string {
  const fixed = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (/^https?:\/\/[^\s/]+$/.test(fixed)) return fixed;
  const h = request.headers;
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") || "").split(",")[0].trim() || new URL(request.url).protocol.replace(":", "");
  return /^[A-Za-z0-9.-]+(:\d+)?$/.test(host) ? `${proto === "http" ? "http" : "https"}://${host}` : new URL(request.url).origin;
}
