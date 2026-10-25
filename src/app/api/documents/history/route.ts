import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { canAny } from "@/lib/permissions";
import { DOCUMENT_TYPES } from "@/lib/documents/adapters.server";
import { DOC_SOURCES, dateOf, pick } from "@/lib/documents/sources.server";

/**
 * [API-SERVER] ประวัติเอกสารที่บริษัทออก — POST /api/documents/history
 *  - { companyId, type?: ชนิดเอกสาร | "", limit? } → รายการล่าสุด (ไม่ระบุชนิด = ทุกชนิดที่ผู้ใช้มีสิทธิ์เปิด ชนิดละ 8 ฉบับ)
 *  - { companyId, type, after } → หน้าถัดไปของชนิดนั้น (ต่อจาก createdAt ของฉบับสุดท้าย)
 *  - { companyId, types: [...], from, to } → เอกสารตามวันที่เอกสารในช่วง (ส่งเอกสารให้สำนักบัญชีรายเดือน) สูงสุดชนิดละ 300
 * แสดงเฉพาะชนิดที่ผู้ใช้มีสิทธิ์เปิดอยู่แล้ว · ดูภาพเอกสารผ่าน /api/documents/pdf (ตรวจสิทธิ์ซ้ำที่นั่น)
 */
const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    const type = str(body.type, 30);
    if (type && !DOC_SOURCES[type]) throw new ApiAuthError(400, "ไม่รู้จักชนิดเอกสาร");
    const allowed = Object.keys(DOC_SOURCES).filter((t) => DOCUMENT_TYPES[t] && canAny(apiUser.roles, ([] as any[]).concat(DOCUMENT_TYPES[t].permission)));
    // ช่วงวันที่เอกสาร (YYYY-MM-DD): อ่านตามวันที่สร้างคลุมช่วง แล้วกรองด้วยวันที่บนเอกสาร
    const ISO = /^\d{4}-\d{2}-\d{2}$/;
    const from = ISO.test(str(body.from, 10)) ? str(body.from, 10) : "", to = ISO.test(str(body.to, 10)) ? str(body.to, 10) : "";
    const ranged = !!(from && to);
    const wanted = Array.isArray(body.types) ? body.types.map((x: any) => str(x, 30)) : null;
    const types = type ? allowed.filter((t) => t === type) : wanted ? allowed.filter((t) => wanted.includes(t)) : allowed;
    const limit = ranged ? 300 : Math.max(1, Math.min(60, Number(body.limit) || (type ? 30 : 8)));
    const after = str(body.after, 40);

    const lists = await Promise.all(types.map(async (t) => {
      const src = DOC_SOURCES[t];
      let q = adminDb.collection(`companies/${companyId}/${src.col}`).orderBy("createdAt", "desc");
      if (ranged) q = q.where("createdAt", ">=", new Date(Date.parse(from) - 45 * 86400e3)).where("createdAt", "<", new Date(Date.parse(to) + 60 * 86400e3));
      else if (after && type) q = q.startAfter(new Date(after));
      const snap = await q.limit(limit + 4).get();
      return snap.docs
        // ยอดยกมาและเอกสารที่ลบแล้วไม่ใช่เอกสารที่ออก
        .filter((d) => d.get("docKind") !== "opening" && d.get("isDeleted") !== true)
        .slice(0, limit)
        .map((d) => {
          const x = d.data();
          const status = str(x.status, 30).toUpperCase();
          const amount = pick(x, src.amount);
          return {
            type: t, id: d.id,
            number: str(pick(x, src.no) || d.id, 60),
            party: str(pick(x, src.party), 120),
            date: dateOf(pick(x, src.date)),
            amount: amount === undefined ? null : Number(amount) || 0,
            status,
            cancelled: status === "CANCELLED" || status === "VOIDED" || x.cancelled === true,
            createdAt: dateOf(x.createdAt) ? (x.createdAt?.toDate?.() || new Date(x.createdAt)).toISOString() : "",
          };
        })
        .filter((r) => !ranged || (r.date >= from && r.date <= to));
    }));
    const docs = lists.flat().sort((a, b) => (ranged ? a.date.localeCompare(b.date) || a.number.localeCompare(b.number) : b.createdAt.localeCompare(a.createdAt)));
    return NextResponse.json({ success: true, types: allowed, docs, more: !ranged && !!type && docs.length >= limit });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DOCUMENT_HISTORY]", err);
    return NextResponse.json({ success: false, error: err.message || "โหลดประวัติเอกสารไม่สำเร็จ" }, { status: 500 });
  }
}
