import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { listRecords } from "@/lib/master-store.server";
import { MASTER_SCHEMAS } from "@/lib/master-data";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] ส่งออกข้อมูลหลักเป็นแถวสำหรับ Excel — POST /api/data-export { companyId, entity }
 *  entity: customers | suppliers | products | employees
 *  ใช้คู่กับหน้านำเข้าข้อมูล: ส่งออก → แก้ใน Excel → นำเข้ากลับ (คอลัมน์ "รหัสในระบบ" = แก้รายการเดิม)
 *  พนักงาน (มีเงินเดือน/เลขบัตร) ส่งออกได้เฉพาะผู้มีสิทธิ์แก้ไขงานบุคคล
 */
const str = (v: any, max = 80) => String(v ?? "").trim().slice(0, max);
const MAX = 5000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId);
    const apiUser = await requireApiUser(request, companyId);
    const entity = str(body.entity, 20);

    if (entity === "employees") {
      if (!can(apiUser.roles, "hr:edit")) throw new ApiAuthError(403, "ส่งออกข้อมูลพนักงานได้เฉพาะผู้ดูแลงานบุคคล");
      const snap = await adminDb.collection("employees").where("companyId", "==", companyId).limit(MAX).get();
      const records = snap.docs.filter((d) => d.get("isDeleted") !== true).map((d) => ({ ...d.data(), id: d.id }));
      // ข้อมูลส่วนบุคคล (เงินเดือน เลขบัตร บัญชีธนาคาร): บันทึกว่าใครส่งออกเมื่อไร (PDPA)
      await auditServer.logExport(apiUser.uid, companyId, "EMPLOYEES", "employees", { count: records.length });
      return NextResponse.json({ success: true, records });
    }
    if (entity !== "customers" && entity !== "suppliers" && entity !== "products") throw new ApiAuthError(400, "ประเภทข้อมูลไม่ถูกต้อง");
    const perm = MASTER_SCHEMAS[entity].editPermission;
    if (!can(apiUser.roles, perm) && !can(apiUser.roles, perm.replace(":edit", ":view") as any)) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    // ตัดข้อมูลใหญ่ที่ไม่ได้ใช้ในไฟล์ (รูป · ประวัติ)
    const records = (await listRecords(entity, companyId)).slice(0, MAX).map(({ images: _i, imageUrl: _u, history: _h, ...r }) => r);
    // รายชื่อลูกค้า/ผู้ขาย (ชื่อ เบอร์ อีเมล ที่อยู่) เป็นข้อมูลส่วนบุคคล: บันทึกการส่งออก
    if (entity !== "products") await auditServer.logExport(apiUser.uid, companyId, entity === "customers" ? "CUSTOMERS" : "SUPPLIERS", entity, { count: records.length });
    return NextResponse.json({ success: true, records });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DATA_EXPORT]", err);
    return NextResponse.json({ success: false, error: err.message || "ส่งออกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
