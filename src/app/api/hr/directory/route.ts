import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

/**
 * [API-SERVER] รายชื่อพนักงานแบบย่อ (สำหรับเลือกผู้เบิก/ผู้รับผิดชอบ)
 * Endpoint: POST /api/hr/directory  { companyId }
 * - สมาชิกบริษัทเรียกได้ทุกตำแหน่ง แต่ได้เฉพาะชื่อ รหัส แผนก ตำแหน่ง
 * - ข้อมูลเงินเดือน/บัญชีธนาคารอ่านได้เฉพาะบุคคล บัญชี และผู้บริหาร (Firestore rules)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    await requireApiUser(request, companyId);
    const snap = await adminDb.collection("employees").where("companyId", "==", companyId).get();
    const employees = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((e) => e.isDeleted !== true && String(e.status || "active").toLowerCase() !== "resigned")
      .map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode || e.employeeId || "",
        name: e.name || [e.firstName, e.lastName].filter(Boolean).join(" ") || "",
        department: e.department || "",
        position: e.position || "",
      }))
      .sort((a, b) => String(a.employeeCode).localeCompare(String(b.employeeCode)));
    return NextResponse.json({ success: true, employees });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[HR_DIRECTORY_ERROR]:", error);
    return NextResponse.json({ success: false, error: "โหลดรายชื่อพนักงานไม่สำเร็จ" }, { status: 500 });
  }
}
