import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";

/**
 * [API-AUTH] Server-side authentication for Next.js API routes.
 * ฝั่ง client ส่ง Firebase ID token มาใน header `Authorization: Bearer <token>` (ใช้ apiFetch จาก api-client.ts)
 */

export interface ApiUser {
  uid: string;
  email: string | null;
  role: string;
  companyId: string | null;
}

export class ApiAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ให้ตรงกับ AuthContext ที่กำหนดบัญชี SUPERADMIN ไว้
const SUPERADMIN_UIDS = ["fgIglIug2dh4aNMMeachaugIyFM2"];
const SUPERADMIN_EMAILS = ["sadmin@admin.com"];

/**
 * Verifies the caller's ID token and (when `companyId` is given) tenant access.
 * Tenant rule mirrors firestore.rules `isTenantOwner`: enforced whenever the user's
 * company is known (custom claim or users/{uid}.companyId); SUPERADMIN may access any company.
 */
export async function requireApiUser(request: Request, companyId?: string | null): Promise<ApiUser> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    throw new ApiAuthError(401, "Unauthorized: กรุณาเข้าสู่ระบบ");
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    throw new ApiAuthError(401, "Unauthorized: session หมดอายุหรือไม่ถูกต้อง");
  }

  const profile = (await adminDb.collection("users").doc(decoded.uid).get()).data() || {};
  const userCompanyId: string | null = (decoded.companyId as string) || profile.companyId || null;
  let role = String(decoded.role || profile.role || "").toUpperCase();
  if (SUPERADMIN_UIDS.includes(decoded.uid) || (decoded.email && SUPERADMIN_EMAILS.includes(decoded.email))) {
    role = "SUPERADMIN";
  }

  if (companyId && role !== "SUPERADMIN" && userCompanyId && userCompanyId !== companyId) {
    throw new ApiAuthError(403, "[Tenant Isolation Violation] ไม่มีสิทธิ์เข้าถึงข้อมูลของบริษัทนี้");
  }

  return { uid: decoded.uid, email: decoded.email || null, role, companyId: userCompanyId };
}

/** Converts an ApiAuthError into a JSON response; returns null for any other error. */
export function authErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof ApiAuthError) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status });
  }
  return null;
}

/**
 * For cron endpoints: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
 * Returns true when the request carries the configured secret.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}
