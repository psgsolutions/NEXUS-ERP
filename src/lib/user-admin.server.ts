import * as admin from "firebase-admin";
import { adminAuth, adminDb } from "./firebase-admin";
import { ApiAuthError, type ApiUser } from "./api-auth";
import { isPendingExpired, normalizeUserStatus } from "./user-status";
import { ASSIGNABLE_ROLES as ROLE_OPTIONS, FULL_ACCESS_ROLES, can, primaryRole, resolveRoles } from "./permissions";
import { auditServer } from "@/services/audit.server";
import { randomBytes } from "crypto";

/**
 * [SERVER-ONLY: Admin SDK] สมัครใช้งาน / อนุมัติผู้ใช้
 * - ผู้สมัครได้ users/{uid} สถานะ PENDING และเก็บบริษัทที่ขอไว้ใน requestedCompanyId
 *   (ยังไม่มี companyId จึงอ่านข้อมูลบริษัทไม่ได้ทั้งใน rules และ API)
 * - อนุมัติแล้วจึงตั้ง companyId + status ACTIVE
 */

export const SELF_REGISTER_ROLES = ["CUSTOMER", "TECHNICIAN"] as const;
// ตำแหน่งที่กำหนดให้ผู้ใช้ได้ (นิยามสิทธิ์อยู่ที่ src/lib/permissions.ts)
export const ASSIGNABLE_ROLES = ROLE_OPTIONS.map((r) => r.value) as string[];
/**
 * ผู้ดูแลระบบของบริษัทมีได้ 1 คน (เจ้าของที่เปิดบริษัท) — ผู้ดูแลระบบ/HR ของบริษัทให้ตำแหน่ง ADMIN ไม่ได้
 * ย้ายผู้ดูแลระบบไปคนอื่นทำโดย SUPERADMIN
 */
const COMPANY_ADMIN_ROLE = "ADMIN";
const isCompanyAdmin = (u: Record<string, any>) => resolveRoles(u).includes(COMPANY_ADMIN_ROLE);
// เจ้าของกิจการที่เปิดบริษัทใหม่: ได้ทุกตำแหน่งงาน (SUPERADMIN ปรับลดภายหลังได้)
const BUSINESS_OWNER_ROLES: string[] = FULL_ACCESS_ROLES;

/** ตรวจรายการตำแหน่งที่ส่งมา: ต้องเป็นตำแหน่งที่กำหนดได้ อย่างน้อย 1 ตำแหน่ง */
function cleanRoles(raw: any, isSuper = false): string[] {
  const list = Array.from(new Set((Array.isArray(raw) ? raw : []).map((r: any) => String(r || "").toUpperCase())));
  if (!list.length) bad("กรุณาเลือกตำแหน่งอย่างน้อย 1 ตำแหน่ง");
  if (list.some((r) => !ASSIGNABLE_ROLES.includes(r))) bad("ตำแหน่งไม่ถูกต้อง");
  if (!isSuper && list.includes(COMPANY_ADMIN_ROLE)) bad("บริษัทมีผู้ดูแลระบบได้ 1 คน — ย้ายผู้ดูแลระบบติดต่อผู้ดูแลระบบกลาง (SUPERADMIN)");
  return list;
}

/** SUPERADMIN ให้ตำแหน่ง ADMIN: ต้องไม่มีผู้ดูแลระบบคนอื่นที่ใช้งานอยู่ในบริษัทเดียวกัน */
async function assertSingleAdmin(companyId: string | null | undefined, uid: string, roles: string[]) {
  if (!companyId || !roles.includes(COMPANY_ADMIN_ROLE)) return;
  const members = await adminDb.collection("users").where("companyId", "==", companyId).get();
  const other = members.docs.find((d) => d.id !== uid && normalizeUserStatus(d.get("status")) === "ACTIVE" && isCompanyAdmin(d.data()));
  if (other) bad(`บริษัทนี้มีผู้ดูแลระบบแล้ว (${other.get("name") || other.get("email")}) — ถอดตำแหน่งผู้ดูแลระบบของคนเดิมก่อน`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const now = () => admin.firestore.FieldValue.serverTimestamp();

function bad(message: string): never {
  throw new ApiAuthError(400, message);
}

function validateAccount(email: string, password: string, name: string) {
  if (!EMAIL_RE.test(email)) bad("รูปแบบอีเมลไม่ถูกต้อง");
  if (password.length < 8) bad("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  if (!name) bad("กรุณาระบุชื่อ");
}

async function createAuthUser(email: string, password: string, displayName: string) {
  try {
    return await adminAuth.createUser({ email, password, displayName });
  } catch (e: any) {
    if (e?.code === "auth/email-already-exists") bad("อีเมลนี้ถูกใช้สมัครแล้ว");
    if (e?.code === "auth/invalid-password") bad("รหัสผ่านไม่ถูกต้องตามเงื่อนไข");
    throw e;
  }
}

export interface RegisterUserInput {
  accountType: string;
  companyId: string;
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
}

/** สมัครเป็นผู้ใช้ของบริษัทที่มีอยู่ (ลูกค้า/ช่างเทคนิค) */
export async function registerUser(input: RegisterUserInput) {
  const role = String(input.accountType || "").toUpperCase();
  if (!(SELF_REGISTER_ROLES as readonly string[]).includes(role)) bad("ประเภทบัญชีไม่ถูกต้อง");
  const companyId = String(input.companyId || "").trim().toUpperCase();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const name = [input.firstName, input.lastName].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
  validateAccount(email, password, name);
  if (!companyId) bad("กรุณาระบุรหัสบริษัท");

  const company = await adminDb.collection("companies").doc(companyId).get();
  if (!company.exists) bad("ไม่พบรหัสบริษัทนี้ในระบบ");

  const user = await createAuthUser(email, password, name);
  await adminDb.collection("users").doc(user.uid).set({
    email,
    name,
    role,
    status: "PENDING",
    requestedCompanyId: companyId,
    requestedCompanyName: company.data()?.name || companyId,
    createdAt: now(),
  });
  return { uid: user.uid, companyId };
}

export interface RegisterBusinessInput {
  personType: string;
  taxId: string;
  branchType: string;
  branchCode?: string;
  juristicType?: string;
  companyName: string;
  vatRegistered: boolean;
  businessType: string;
  customerTypes?: string[];
  employeeCount?: string;
  ownerName: string;
  email: string;
  password: string;
}

/** ลงทะเบียนกิจการใหม่: สร้างคำขอ + บัญชีเจ้าของ (รอ SUPERADMIN อนุมัติจึงสร้างบริษัท) */
export async function registerBusiness(input: RegisterBusinessInput) {
  const taxId = String(input.taxId || "").replace(/\D/g, "");
  const companyName = String(input.companyName || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const ownerName = String(input.ownerName || "").trim();
  if (taxId.length !== 13) bad("เลขทะเบียนต้องมี 13 หลัก");
  if (!companyName) bad("กรุณาระบุชื่อกิจการ");
  if (!input.businessType) bad("กรุณาเลือกประเภทธุรกิจ");
  validateAccount(email, password, ownerName);
  const branchCode = input.branchType === "branch" ? String(input.branchCode || "").replace(/\D/g, "").padStart(5, "0") : "00000";

  const dup = await adminDb.collection("companies").where("taxId", "==", taxId).limit(1).get();
  if (!dup.empty) bad("เลขทะเบียนนี้มีอยู่ในระบบแล้ว กรุณาสมัครเป็นผู้ใช้ของบริษัทเดิม");

  const user = await createAuthUser(email, password, ownerName);
  const regRef = adminDb.collection("company_registrations").doc();
  const batch = adminDb.batch();
  batch.set(regRef, {
    personType: input.personType === "natural" || input.personType === "individual" ? "natural" : "juristic",
    taxId,
    branchCode,
    juristicType: input.juristicType || "",
    companyName,
    vatRegistered: !!input.vatRegistered,
    businessType: String(input.businessType),
    customerTypes: Array.isArray(input.customerTypes) ? input.customerTypes.map(String) : [],
    employeeCount: String(input.employeeCount || ""),
    ownerUid: user.uid,
    ownerName,
    ownerEmail: email,
    status: "PENDING",
    createdAt: now(),
  });
  batch.set(adminDb.collection("users").doc(user.uid), {
    email,
    name: ownerName,
    role: "ADMIN",
    status: "PENDING",
    registrationId: regRef.id,
    requestedCompanyName: companyName,
    createdAt: now(),
  });
  await batch.commit();
  return { registrationId: regRef.id };
}

function serializeTime(v: any): string | null {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  return null;
}

/** รายชื่อผู้ใช้ที่ผู้เรียกจัดการได้: ADMIN เห็นบริษัทตัวเอง (+คำขอเข้าบริษัท), SUPERADMIN เห็นทั้งหมด */
export async function listManagedUsers(caller: ApiUser) {
  const isSuper = caller.roles.includes("SUPERADMIN");
  let docs: FirebaseFirestore.QueryDocumentSnapshot[];
  if (isSuper) {
    docs = (await adminDb.collection("users").get()).docs;
  } else {
    const [members, requests] = await Promise.all([
      adminDb.collection("users").where("companyId", "==", caller.companyId).get(),
      adminDb.collection("users").where("requestedCompanyId", "==", caller.companyId).get(),
    ]);
    const map = new Map(members.docs.concat(requests.docs).map((d) => [d.id, d]));
    docs = Array.from(map.values());
  }
  const users = docs.map((d) => {
    const x = d.data();
    return {
      uid: d.id,
      name: x.name || x.displayName || "",
      email: x.email || "",
      role: String(x.role || "USER").toUpperCase(),
      roles: resolveRoles(x),
      status: normalizeUserStatus(x.status),
      expired: isPendingExpired(x),
      companyId: x.companyId || null,
      requestedCompanyId: x.requestedCompanyId || null,
      requestedCompanyName: x.requestedCompanyName || null,
      registrationId: x.registrationId || null,
      mustChangePassword: x.mustChangePassword === true,
      createdAt: serializeTime(x.createdAt),
    };
  });

  let registrations: any[] = [];
  if (isSuper) {
    const regs = await adminDb.collection("company_registrations").where("status", "==", "PENDING").get();
    registrations = regs.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: serializeTime(d.data().createdAt) }));
  }
  return { users, registrations };
}

async function nextCompanyId(): Promise<string> {
  const snap = await adminDb.collection("companies").get();
  let max = 0;
  snap.forEach((d) => {
    const m = d.id.match(/^COM-NEXUS-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `COM-NEXUS-${String(max + 1).padStart(2, "0")}`;
}

export type UserAction = "approve" | "reject" | "suspend" | "reactivate" | "setRoles";

/**
 * อนุมัติ/ระงับ/กำหนดตำแหน่งผู้ใช้ — ผู้ดูแลระบบและ HR ของบริษัท (users:manage) ทำได้กับคนในบริษัทตัวเอง
 * - กำหนดตำแหน่งงาน (approve พร้อม roles / setRoles): ทุกตำแหน่ง ยกเว้นผู้ดูแลระบบ (บริษัทละ 1 คน)
 * - บัญชีผู้ดูแลระบบของบริษัท: เปลี่ยนตำแหน่ง/ระงับได้เฉพาะ SUPERADMIN · เปลี่ยนตำแหน่งของตัวเองไม่ได้
 */
export async function applyUserAction(caller: ApiUser, uid: string, action: UserAction, roles?: any) {
  const isSuper = caller.roles.includes("SUPERADMIN");
  if (!isSuper && !can(caller.roles, "users:manage")) throw new ApiAuthError(403, "ต้องเป็นผู้ดูแลระบบหรือฝ่ายบุคคลเท่านั้น");
  const assigning = roles !== undefined && roles !== null;
  if (uid === caller.uid) bad("ไม่สามารถเปลี่ยนสถานะหรือตำแหน่งของบัญชีตัวเองได้");

  const ref = adminDb.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiAuthError(404, "ไม่พบผู้ใช้");
  const u = snap.data()!;
  const status = normalizeUserStatus(u.status);

  // ADMIN จัดการได้เฉพาะสมาชิก/ผู้ขอเข้าบริษัทตัวเอง และไม่แตะคำขอเปิดบริษัทใหม่
  if (!isSuper) {
    const mine = u.companyId === caller.companyId || (!u.companyId && u.requestedCompanyId === caller.companyId);
    if (!mine || u.registrationId) throw new ApiAuthError(403, "ไม่มีสิทธิ์จัดการผู้ใช้นี้");
  }

  if (!isSuper && isCompanyAdmin(u) && ["suspend", "setRoles", "reject"].includes(action)) {
    throw new ApiAuthError(403, "บัญชีผู้ดูแลระบบของบริษัท เปลี่ยนแปลงได้โดยผู้ดูแลระบบกลาง (SUPERADMIN) เท่านั้น");
  }

  const stamp = { updatedAt: now(), updatedBy: caller.uid };
  switch (action) {
    case "approve": {
      if (status !== "PENDING") bad("ผู้ใช้นี้ไม่ได้อยู่ในสถานะรออนุมัติ");
      if (u.registrationId) {
        if (!isSuper) throw new ApiAuthError(403, "การเปิดบริษัทใหม่ต้องอนุมัติโดย SUPERADMIN");
        return approveBusiness(caller, uid, u.registrationId);
      }
      const assigned = assigning ? cleanRoles(roles, isSuper) : null;
      if (assigned && isSuper) await assertSingleAdmin(u.requestedCompanyId, uid, assigned);
      await ref.update({
        status: "ACTIVE", companyId: u.requestedCompanyId, approvedAt: now(), approvedBy: caller.uid, ...stamp,
        ...(assigned ? { roles: assigned, role: primaryRole(assigned) } : {}),
      });
      await adminAuth.updateUser(uid, { disabled: false });
      await auditServer.logUpdate(caller.uid, u.requestedCompanyId, "USER_ROLES", uid, { status, roles: resolveRoles(u) }, { status: "ACTIVE", roles: assigned || resolveRoles(u) });
      return { companyId: u.requestedCompanyId, roles: assigned || resolveRoles(u) };
    }
    case "reject": {
      if (status !== "PENDING") bad("ผู้ใช้นี้ไม่ได้อยู่ในสถานะรออนุมัติ");
      await ref.update({ status: "REJECTED", ...stamp });
      if (u.registrationId) {
        await adminDb.collection("company_registrations").doc(u.registrationId).update({ status: "REJECTED", ...stamp });
      }
      await adminAuth.updateUser(uid, { disabled: true });
      return {};
    }
    case "suspend": {
      if (status !== "ACTIVE") bad("ระงับได้เฉพาะบัญชีที่ใช้งานอยู่");
      if (!isSuper && resolveRoles(u).includes("SUPERADMIN")) throw new ApiAuthError(403, "ไม่มีสิทธิ์");
      await ref.update({ status: "SUSPENDED", ...stamp });
      await adminAuth.revokeRefreshTokens(uid);
      return {};
    }
    case "reactivate": {
      if (status !== "SUSPENDED") bad("เปิดใช้งานได้เฉพาะบัญชีที่ถูกระงับ");
      await ref.update({ status: "ACTIVE", ...stamp });
      return {};
    }
    case "setRoles": {
      if (resolveRoles(u).includes("SUPERADMIN")) throw new ApiAuthError(403, "เปลี่ยนตำแหน่งของ SUPERADMIN ไม่ได้");
      if (status !== "ACTIVE") bad("กำหนดตำแหน่งได้เฉพาะบัญชีที่ใช้งานอยู่");
      const next = cleanRoles(roles, isSuper);
      if (isSuper) await assertSingleAdmin(u.companyId, uid, next);
      await ref.update({ roles: next, role: primaryRole(next), ...stamp });
      await auditServer.logUpdate(caller.uid, u.companyId, "USER_ROLES", uid, { roles: resolveRoles(u) }, { roles: next });
      return { roles: next };
    }
    default:
      bad("คำสั่งไม่ถูกต้อง");
  }
}

export interface CreateStaffInput { name: string; email: string; roles: string[]; companyId?: string }

/** รหัสผ่านชั่วคราว 12 ตัว (ตัด 0/O/1/l/I ที่อ่านสับสน) — ผู้ใช้ต้องตั้งใหม่เมื่อเข้าระบบครั้งแรก */
function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const pw = Array.from(randomBytes(12), (b) => chars[b % chars.length]).join("");
  return /\d/.test(pw) && /[A-Za-z]/.test(pw) ? pw : tempPassword();
}

/**
 * ผู้ดูแลระบบ/HR สร้างบัญชีพนักงานในบริษัทตัวเอง พร้อมตำแหน่งงาน — ใช้งานได้ทันที
 * คืนรหัสผ่านชั่วคราวครั้งเดียว (ไม่เก็บ) ผู้ใช้ต้องเปลี่ยนรหัสเมื่อเข้าระบบครั้งแรก
 */
export async function createStaffUser(caller: ApiUser, input: CreateStaffInput) {
  const isSuper = caller.roles.includes("SUPERADMIN");
  if (!isSuper && !can(caller.roles, "users:manage")) throw new ApiAuthError(403, "ต้องเป็นผู้ดูแลระบบหรือฝ่ายบุคคลเท่านั้น");
  const companyId = isSuper ? String(input.companyId || "").trim().toUpperCase() : caller.companyId;
  if (!companyId) bad("กรุณาระบุบริษัท");
  if (isSuper && !(await adminDb.collection("companies").doc(companyId).get()).exists) bad("ไม่พบบริษัทนี้");
  const name = String(input.name || "").trim().slice(0, 120);
  const email = String(input.email || "").trim().toLowerCase();
  const roles = cleanRoles(input.roles, isSuper);
  if (isSuper) await assertSingleAdmin(companyId, "", roles);
  const password = tempPassword();
  validateAccount(email, password, name);
  const user = await createAuthUser(email, password, name);
  await adminDb.collection("users").doc(user.uid).set({
    email, name, roles, role: primaryRole(roles), status: "ACTIVE", companyId,
    mustChangePassword: true, createdBy: caller.uid, createdAt: now(), approvedAt: now(), approvedBy: caller.uid,
  });
  await auditServer.logCreate(caller.uid, companyId, "USER_ROLES", user.uid, { name, email, roles });
  return { uid: user.uid, companyId, tempPassword: password };
}

/** ผู้ใช้ตั้งรหัสผ่านใหม่ (บังคับเมื่อเข้าระบบครั้งแรกด้วยรหัสชั่วคราว) */
export async function changeOwnPassword(caller: ApiUser, newPassword: string) {
  const pw = String(newPassword || "");
  if (pw.length < 8) bad("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) bad("รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข");
  await adminAuth.updateUser(caller.uid, { password: pw });
  await adminDb.collection("users").doc(caller.uid).set({ mustChangePassword: false, passwordChangedAt: now() }, { merge: true });
  return {};
}

/** SUPERADMIN อนุมัติกิจการใหม่: สร้าง companies/{id} แล้วผูกเจ้าของเป็น ADMIN */
async function approveBusiness(caller: ApiUser, uid: string, registrationId: string) {
  const regRef = adminDb.collection("company_registrations").doc(registrationId);
  const reg = (await regRef.get()).data();
  if (!reg || reg.status !== "PENDING") bad("ไม่พบคำขอเปิดบริษัทที่รออนุมัติ");
  const companyId = await nextCompanyId();
  const batch = adminDb.batch();
  batch.create(adminDb.collection("companies").doc(companyId), {
    id: companyId,
    name: reg.companyName,
    taxId: reg.taxId,
    branchCode: reg.branchCode || "00000",
    type: reg.personType === "natural" ? "บุคคลธรรมดา" : (reg.juristicType || "นิติบุคคล"),
    vatRegistered: !!reg.vatRegistered,
    businessType: reg.businessType || "",
    address: "",
    registrationId,
    createdAt: now(),
  });
  batch.update(regRef, { status: "APPROVED", companyId, approvedAt: now(), approvedBy: caller.uid });
  batch.update(adminDb.collection("users").doc(uid), {
    status: "ACTIVE",
    companyId,
    role: "ADMIN",
    roles: BUSINESS_OWNER_ROLES,
    approvedAt: now(),
    approvedBy: caller.uid,
    updatedAt: now(),
  });
  await batch.commit();
  return { companyId };
}
