import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { WORK_START, bkkParts, employeeName } from "@/lib/hr";

/**
 * [API-SERVER] ลงเวลาเข้า / ออกงาน
 * Endpoint: POST /api/hr/attendance
 * body: { companyId, type: "IN" | "OUT", employeeDocId?, date?, time?, location?, note?, gps?: { lat, lng, accuracy } }
 *
 * - ลงเวลาตัวเอง: ไม่ส่ง employeeDocId -> ใช้พนักงานที่อีเมลตรงกับบัญชีผู้ใช้, เวลา = เวลาเซิร์ฟเวอร์
 * - ฝ่ายบุคคล (hr:edit) ลงแทนได้ และระบุวัน/เวลาย้อนหลังได้ (บันทึกว่าเป็นการลงแทน)
 * - ลงเวลาเข้าซ้ำในวันเดียวกันไม่ได้, ลงเวลาออกต้องมีเวลาเข้าก่อน, เข้าหลัง WORK_START = สาย
 */

const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const type = body.type === "OUT" ? "OUT" : body.type === "IN" ? "IN" : "";
    if (!type) throw new ApiAuthError(400, "กรุณาเลือกเข้างานหรือออกงาน");

    const isHr = can(apiUser.role, "hr:edit");
    const requested = str(body.employeeDocId, 120);
    let empSnap: FirebaseFirestore.DocumentSnapshot;
    if (requested) {
      empSnap = await adminDb.doc(`employees/${requested}`).get();
    } else {
      const email = String(apiUser.email || "").toLowerCase();
      const q = email ? await adminDb.collection("employees").where("companyId", "==", companyId).where("email", "==", email).limit(1).get() : null;
      if (!q || q.empty) throw new ApiAuthError(404, "ไม่พบข้อมูลพนักงานที่ผูกกับอีเมลของบัญชีนี้ กรุณาติดต่อฝ่ายบุคคล");
      empSnap = q.docs[0];
    }
    const emp = empSnap.exists ? empSnap.data()! : null;
    if (!emp || emp.companyId !== companyId || emp.isDeleted === true) throw new ApiAuthError(404, "ไม่พบพนักงาน");
    if (String(emp.status || "").toLowerCase() === "resigned") throw new ApiAuthError(400, "พนักงานลาออกแล้ว");
    const self = String(emp.email || "").toLowerCase() === String(apiUser.email || "").toLowerCase();
    if (!self && !isHr) throw new ApiAuthError(403, "ลงเวลาแทนผู้อื่นได้เฉพาะฝ่ายบุคคล");

    // เวลา: ลงเองใช้เวลาเซิร์ฟเวอร์เสมอ, ฝ่ายบุคคลระบุย้อนหลังได้
    const now = bkkParts(Date.now());
    const manual = isHr && !self && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) && /^\d{2}:\d{2}$/.test(String(body.time || ""));
    const date = manual ? body.date : now.date;
    const time = manual ? body.time : now.time;
    if (date > now.date || (date === now.date && time > now.time && manual)) throw new ApiAuthError(400, "ลงเวลาล่วงหน้าไม่ได้");

    const gps = body.gps && Number.isFinite(Number(body.gps.lat)) && Number.isFinite(Number(body.gps.lng))
      ? { lat: Number(body.gps.lat), lng: Number(body.gps.lng), accuracy: Math.round(Number(body.gps.accuracy) || 0) }
      : null;

    const dayRef = adminDb.collection("attendance");
    const result = await adminDb.runTransaction(async (tx) => {
      const same = await tx.get(dayRef.where("companyId", "==", companyId).where("employeeDocId", "==", empSnap.id).where("date", "==", date));
      const recs = same.docs.map((d) => d.data()).filter((r) => r.isDeleted !== true);
      const hasIn = recs.some((r) => r.type === "IN");
      const hasOut = recs.some((r) => r.type === "OUT");
      if (type === "IN" && hasIn) throw new ApiAuthError(409, `ลงเวลาเข้างานวันที่ ${date} ไปแล้ว`);
      if (type === "OUT" && !hasIn) throw new ApiAuthError(409, `ยังไม่ได้ลงเวลาเข้างานของวันที่ ${date}`);
      if (type === "OUT" && hasOut) throw new ApiAuthError(409, `ลงเวลาออกงานวันที่ ${date} ไปแล้ว`);
      const inRec = recs.find((r) => r.type === "IN");
      if (type === "OUT" && inRec && time < inRec.time) throw new ApiAuthError(400, "เวลาออกงานต้องไม่ก่อนเวลาเข้างาน");

      const ref = dayRef.doc();
      const status = type === "IN" ? (time > WORK_START ? "late" : "on_time") : "out";
      tx.create(ref, {
        companyId,
        employeeDocId: empSnap.id,
        employeeId: emp.employeeId || empSnap.id,
        name: employeeName(emp),
        department: emp.department || "",
        type,
        date,
        time,
        status,
        location: str(body.location, 160) || emp.workLocation || "",
        note: str(body.note, 300),
        gps,
        method: self ? "self" : "manual",
        recordedBy: apiUser.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isDeleted: false,
      });
      return { id: ref.id, name: employeeName(emp), date, time, status };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[HR_ATTENDANCE_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ลงเวลาไม่สำเร็จ" }, { status: 500 });
  }
}
