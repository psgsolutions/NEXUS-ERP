/**
 * สถานะบัญชีผู้ใช้ (users/{uid}.status)
 * - ไม่มี status = บัญชีเดิมก่อนมีระบบอนุมัติ ถือว่าใช้งานได้
 * - PENDING: สมัครแล้วรออนุมัติ (ยังไม่มี companyId จึงเข้าข้อมูลบริษัทไม่ได้)
 * - คำขอ PENDING ที่ค้างเกิน 24 ชม. ถือว่าหมดอายุ ต้องสมัครใหม่หรือให้ผู้ดูแลอนุมัติ
 */

export type UserStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED";

export const PENDING_TTL_MS = 24 * 3600 * 1000;

/**
 * SUPERADMIN: custom claim `superadmin: true` บน Firebase Auth (ตั้งด้วย scripts/set-superadmin-claim.mjs)
 * uid/อีเมลเดิมด้านล่างใช้ชั่วคราวระหว่างย้ายไปใช้ claim — ลบออกหลังตั้ง claim ให้บัญชีจริงแล้ว (แผนงาน C-17)
 */
export const SUPERADMIN_UIDS = ["fgIglIug2dh4aNMMeachaugIyFM2"];
export const SUPERADMIN_EMAILS = ["sadmin@admin.com"];

export function isSuperAdminAccount(uid?: string | null, email?: string | null, claims?: Record<string, unknown> | null): boolean {
  return claims?.superadmin === true || (!!uid && SUPERADMIN_UIDS.includes(uid)) || (!!email && SUPERADMIN_EMAILS.includes(email));
}

export function normalizeUserStatus(status: unknown): UserStatus {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING" || s === "SUSPENDED" || s === "REJECTED") return s;
  return "ACTIVE";
}

function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v._seconds === "number") return v._seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function isPendingExpired(profile: { status?: unknown; createdAt?: any }, now = Date.now()): boolean {
  if (normalizeUserStatus(profile.status) !== "PENDING") return false;
  const created = toMillis(profile.createdAt);
  return created > 0 && now - created > PENDING_TTL_MS;
}

/** ข้อความแจ้งเมื่อบัญชียังใช้งานไม่ได้ (null = ใช้งานได้) */
export function inactiveReason(profile: { status?: unknown; createdAt?: any }): string | null {
  const status = normalizeUserStatus(profile.status);
  if (status === "PENDING") {
    return isPendingExpired(profile)
      ? "คำขอสมัครใช้งานหมดอายุ (ไม่ได้รับการอนุมัติภายใน 24 ชั่วโมง) กรุณาติดต่อผู้ดูแลระบบ"
      : "บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ";
  }
  if (status === "SUSPENDED") return "บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
  if (status === "REJECTED") return "คำขอสมัครใช้งานไม่ได้รับการอนุมัติ";
  return null;
}
