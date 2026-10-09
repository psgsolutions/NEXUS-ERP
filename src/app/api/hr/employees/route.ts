import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, PREFIXES, employeeName } from "@/lib/hr";

/**
 * [API-SERVER] ลงทะเบียน / แก้ไขข้อมูลพนักงาน
 * Endpoint: POST /api/hr/employees
 * body: { companyId, employeeDocId? (แก้ไข), prefix, firstName, lastName, nickname?, citizenId?, phone?, email?,
 *         position, department, employmentType, joinDate, workLocation?, status?, salary?, socialSecurity?, bankName?, bankAccount? }
 * พนักงานใหม่ได้รหัส EMP ในทรานแซกชันเดียวกับการบันทึก (เลขไม่ข้ามเมื่อบันทึกไม่ผ่าน)
 */

const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.role, "hr:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอสำหรับข้อมูลบุคคล");

    const firstName = str(body.firstName, 80);
    const lastName = str(body.lastName, 80);
    const position = str(body.position, 120);
    const citizenId = str(body.citizenId, 20).replace(/\D/g, "");
    const email = str(body.email, 160).toLowerCase();
    const salary = Math.round((Number(body.salary) || 0) * 100) / 100;
    if (!firstName || !lastName) throw new ApiAuthError(400, "กรุณาระบุชื่อและนามสกุล");
    if (!position) throw new ApiAuthError(400, "กรุณาระบุตำแหน่ง");
    if (citizenId && citizenId.length !== 13) throw new ApiAuthError(400, "เลขบัตรประชาชนต้องมี 13 หลัก");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiAuthError(400, "อีเมลไม่ถูกต้อง");
    if (salary < 0 || salary > 10_000_000) throw new ApiAuthError(400, "เงินเดือนไม่ถูกต้อง");
    if (body.joinDate && !isDate(body.joinDate)) throw new ApiAuthError(400, "วันที่เริ่มงานไม่ถูกต้อง");

    const fields = {
      companyId,
      prefix: PREFIXES.some((p) => p.value === body.prefix) ? body.prefix : "Mr.",
      firstName,
      lastName,
      nickname: str(body.nickname, 40),
      citizenId,
      phone: str(body.phone, 40),
      email,
      position,
      department: str(body.department, 80),
      employmentType: EMPLOYMENT_TYPES[body.employmentType] ? body.employmentType : "permanent",
      joinDate: isDate(body.joinDate) ? body.joinDate : "",
      workLocation: str(body.workLocation, 160),
      status: EMPLOYEE_STATUS[body.status] ? body.status : "active",
      salary,
      socialSecurity: body.socialSecurity !== false,
      bankName: str(body.bankName, 60),
      bankAccount: str(body.bankAccount, 30).replace(/[^\d-]/g, ""),
    };
    const name = employeeName(fields);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const editId = str(body.employeeDocId, 120);
    const take = editId ? null : await prepareSequence("EMP", companyId);

    const result = await adminDb.runTransaction(async (tx) => {
      // พนักงานคนเดิมห้ามซ้ำ (เลขบัตรประชาชน)
      if (citizenId) {
        const dup = await tx.get(adminDb.collection("employees").where("companyId", "==", companyId).where("citizenId", "==", citizenId).limit(2));
        if (dup.docs.some((d) => d.id !== editId && d.data().isDeleted !== true)) throw new ApiAuthError(409, "มีพนักงานที่ใช้เลขบัตรประชาชนนี้แล้ว");
      }
      if (editId) {
        const ref = adminDb.doc(`employees/${editId}`);
        const snap = await tx.get(ref);
        if (!snap.exists || snap.data()!.companyId !== companyId) throw new ApiAuthError(404, "ไม่พบพนักงาน");
        tx.update(ref, { ...fields, name, updatedAt: now, updatedBy: apiUser.uid });
        return { employeeId: snap.data()!.employeeId || editId, docId: editId, created: false };
      }
      const seq = await take!(tx);
      seq.commit();
      const ref = adminDb.doc(`employees/${seq.number}`);
      tx.create(ref, { ...fields, name, employeeId: seq.number, isDeleted: false, createdBy: apiUser.uid, createdAt: now, updatedAt: now });
      return { employeeId: seq.number, docId: seq.number, created: true };
    });

    // ไม่เก็บเงินเดือน / เลขบัญชีลงบันทึกตรวจสอบ
    const logFields = { name, position: fields.position, department: fields.department, status: fields.status };
    if (result.created) await auditServer.logCreate(apiUser.uid, companyId, "HR_EMPLOYEE", result.employeeId, logFields);
    else await auditServer.logUpdate(apiUser.uid, companyId, "HR_EMPLOYEE", result.employeeId, {}, logFields);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[HR_EMPLOYEE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกข้อมูลพนักงานไม่สำเร็จ" }, { status: 500 });
  }
}
