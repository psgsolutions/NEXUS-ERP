import { NextResponse } from "next/server";
import { authErrorResponse, requireApiUser } from "@/lib/api-auth";
import { changeOwnPassword } from "@/lib/user-admin.server";

/**
 * [API-SERVER] ตั้งรหัสผ่านใหม่ของตัวเอง — POST /api/account/password { newPassword }
 * ใช้ตอนเข้าระบบครั้งแรกด้วยรหัสชั่วคราวที่ผู้ดูแลระบบ/HR ออกให้ (users/{uid}.mustChangePassword)
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const { newPassword } = await request.json();
    return NextResponse.json({ success: true, ...(await changeOwnPassword(user, newPassword)) });
  } catch (error: any) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("[ACCOUNT_PASSWORD_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ตั้งรหัสผ่านไม่สำเร็จ" }, { status: 500 });
  }
}
