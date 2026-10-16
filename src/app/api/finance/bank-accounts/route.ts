import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";

/**
 * [API-SERVER] ทะเบียนบัญชีธนาคารของบริษัท (companies/{id}/bank_accounts)
 * Endpoint: POST /api/finance/bank-accounts
 *  - { companyId, action: "create", name, bankName, accountNo, branch?, accountType?, openingBalance?, openingDate? }
 *  - { companyId, action: "update", id, ...ฟิลด์เดียวกัน, legacyLabels?: string[] }
 *  - { companyId, action: "setActive", id, active }
 * - เฉพาะผู้มีสิทธิ์ finance:edit; ยอดยกมาใช้เป็นจุดเริ่มสมุดเงินฝาก
 */

const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const r2 = (n: number) => Math.round(n * 100) / 100;

function fields(body: any) {
  const name = str(body.name, 80);
  const accountNo = str(body.accountNo, 30).replace(/[^\d-]/g, "");
  if (!name) throw new ApiAuthError(400, "กรุณาระบุชื่อบัญชี (เช่น กสิกร ออมทรัพย์)");
  if (!accountNo) throw new ApiAuthError(400, "กรุณาระบุเลขที่บัญชี");
  const openingBalance = r2(Number(body.openingBalance) || 0);
  return {
    name, accountNo,
    bankName: str(body.bankName, 80), branch: str(body.branch, 80),
    accountType: ["SAVINGS", "CURRENT", "FIXED"].includes(String(body.accountType)) ? String(body.accountType) : "SAVINGS",
    openingBalance,
    openingDate: isDate(body.openingDate) ? String(body.openingDate) : "",
    legacyLabels: (Array.isArray(body.legacyLabels) ? body.legacyLabels : []).map((x: any) => str(x, 80)).filter(Boolean).slice(0, 10),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "จัดการบัญชีธนาคารได้เฉพาะฝ่ายบัญชี");
    const col = adminDb.collection(`companies/${companyId}/bank_accounts`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const action = str(body.action, 20);

    if (action === "create") {
      const f = fields(body);
      const dup = await col.where("accountNo", "==", f.accountNo).limit(1).get();
      if (!dup.empty) throw new ApiAuthError(409, `มีบัญชีเลขที่ ${f.accountNo} อยู่แล้ว`);
      const ref = col.doc();
      await ref.create({ id: ref.id, companyId, ...f, glCode: "1112-00", active: true, createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false });
      await auditServer.logCreate(apiUser.uid, companyId, "BANK_ACCOUNT", ref.id, f);
      return NextResponse.json({ success: true, id: ref.id });
    }

    const id = str(body.id);
    if (!id || id.includes("/")) throw new ApiAuthError(400, "ไม่พบบัญชีธนาคาร");
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiAuthError(404, "ไม่พบบัญชีธนาคาร");

    if (action === "update") {
      const f = fields(body);
      await ref.update({ ...f, updatedBy: apiUser.uid, updatedAt: now });
      await auditServer.logUpdate(apiUser.uid, companyId, "BANK_ACCOUNT", id, snap.data(), f);
      return NextResponse.json({ success: true, id });
    }
    if (action === "setActive") {
      const active = body.active === true;
      await ref.update({ active, updatedBy: apiUser.uid, updatedAt: now });
      await auditServer.logUpdate(apiUser.uid, companyId, "BANK_ACCOUNT", id, { active: snap.data()!.active }, { active });
      return NextResponse.json({ success: true, id, active });
    }
    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[BANK_ACCOUNT_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกบัญชีธนาคารไม่สำเร็จ" }, { status: 500 });
  }
}
