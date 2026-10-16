import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { nextCounterSequence, nexusSequenceServer } from "@/lib/sequence-server";
import { can, type Permission } from "@/lib/permissions";
import type { SequencePrefix } from "@/lib/sequence-engine";
import { IdType } from "@/lib/utils";

/**
 * [API-SERVER] ออกเลขเอกสาร/รหัสทั่วไปที่ server (ตัวนับเขียนได้ผ่าน API เท่านั้น)
 * Endpoint: POST /api/sequence/next  Header: Authorization: Bearer <Firebase ID token>
 *  - { companyId, prefix }        -> { number }   ตามรูปแบบเลขที่ของบริษัท (ตั้งค่า › รูปแบบเลขที่)
 *  - { companyId, type, context } -> { sequence } ตัวนับรหัส (idService)
 *
 * เอกสารภาษี/การเงินที่ต้องเรียงต่อเนื่อง (ใบกำกับ ใบเสร็จ ใบลดหนี้ ใบเสนอราคา ฯลฯ) ไม่ออกผ่านช่องนี้
 * — ออกในทรานแซกชันเดียวกับการบันทึกที่ API ของเอกสารนั้น (เลขไม่ข้าม)
 */

/** prefix ที่ออกผ่านช่องนี้ได้ และสิทธิ์ที่ต้องมี (มีข้อใดข้อหนึ่ง) */
const PREFIX_PERMISSIONS: Partial<Record<SequencePrefix, Permission[]>> = {
  CUS: ["sales:edit", "projects:edit", "finance:edit"],
  SUP: ["inventory:edit", "finance:edit"],
  PRD: ["inventory:edit"],
  SO: ["sales:edit"],
  PR: ["inventory:edit", "finance:edit", "projects:edit"],
  PO: ["inventory:edit", "finance:edit"],
  WO: ["projects:edit", "inventory:edit", "sales:edit"],
  EXP: ["finance:edit", "projects:edit", "inventory:edit"],
  PV: ["finance:edit"],
  WHT: ["finance:edit"],
  EMP: ["hr:edit"],
};

/** ตัวนับรหัสที่ห้ามเลื่อนจากหน้าจอ (เอกสารภาษี/บัญชี) */
const SERVER_ONLY_TYPES: IdType[] = ["INV", "CN", "DN", "BN", "TAX", "REC", "GL"];

export async function POST(request: Request) {
  try {
    const { companyId, type, context, prefix } = await request.json();
    if (!companyId) throw new ApiAuthError(400, "companyId is required");
    const apiUser = await requireApiUser(request, companyId);

    if (prefix) {
      const perms = PREFIX_PERMISSIONS[prefix as SequencePrefix];
      if (!perms) throw new ApiAuthError(400, `เลขเอกสาร ${String(prefix).slice(0, 10)} ออกผ่านช่องนี้ไม่ได้`);
      if (!perms.some((p) => can(apiUser.roles, p))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอสำหรับออกเลขเอกสารนี้");
      const number = await nexusSequenceServer(prefix as SequencePrefix, companyId);
      return NextResponse.json({ number });
    }

    if (!type) throw new ApiAuthError(400, "type or prefix is required");
    if (SERVER_ONLY_TYPES.includes(type as IdType)) throw new ApiAuthError(400, `ตัวนับ ${String(type).slice(0, 10)} ออกได้เฉพาะที่ API ของเอกสารนั้น`);
    const sequence = await nextCounterSequence(type as IdType, companyId, context);
    return NextResponse.json({ sequence });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[SEQUENCE_NEXT_API_ERROR]", err);
    return NextResponse.json({ error: "ออกเลขเอกสารไม่สำเร็จ" }, { status: 500 });
  }
}
