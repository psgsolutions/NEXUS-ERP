import { NextResponse } from "next/server";
import { ApiAuthError, authErrorResponse, requireApiUser } from "@/lib/api-auth";
import { applyUserAction, listManagedUsers, type UserAction } from "@/lib/user-admin.server";
import { can } from "@/lib/permissions";

/**
 * [API-SERVER] จัดการผู้ใช้ (ADMIN: บริษัทตัวเอง, SUPERADMIN: ทั้งหมด)
 * GET  /api/admin/users                 -> { users, registrations }
 * POST /api/admin/users { uid, action, roles? }  action: approve | reject | suspend | reactivate | setRoles
 * - กำหนดตำแหน่ง (approve พร้อม roles / setRoles) ได้เฉพาะ SUPERADMIN
 */

async function requireManager(request: Request) {
  const user = await requireApiUser(request);
  if (!can(user.roles, "users:manage")) {
    throw new ApiAuthError(403, "ต้องเป็นผู้ดูแลระบบเท่านั้น");
  }
  return user;
}

export async function GET(request: Request) {
  try {
    const user = await requireManager(request);
    return NextResponse.json({ success: true, ...(await listManagedUsers(user)) });
  } catch (error: any) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("[ADMIN_USERS_GET_ERROR]:", error);
    return NextResponse.json({ success: false, error: "โหลดรายชื่อผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireManager(request);
    const { uid, action, roles } = await request.json();
    if (!uid || !action) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const result = await applyUserAction(user, String(uid), action as UserAction, roles);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("[ADMIN_USERS_POST_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ดำเนินการไม่สำเร็จ" }, { status: 500 });
  }
}
