import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api-auth";
import { registerBusiness, registerUser } from "@/lib/user-admin.server";

/**
 * [API-SERVER] สมัครใช้งาน (ไม่ต้องล็อกอิน)
 * Endpoint: POST /api/auth/register
 *  - { kind: "user", accountType, companyId, firstName, lastName, email, password }
 *  - { kind: "business", ...ข้อมูลกิจการ, ownerName, email, password }
 * บัญชีที่สร้างอยู่ในสถานะ PENDING จนกว่าผู้ดูแลจะอนุมัติ
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = body?.kind === "business" ? await registerBusiness(body) : await registerUser(body);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("[REGISTER_API_ERROR]:", error);
    return NextResponse.json({ success: false, error: "สมัครใช้งานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
