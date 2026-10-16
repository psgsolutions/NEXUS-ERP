import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";

/**
 * [API-SERVER] อ่านบันทึกการใช้งาน (audit log) ของบริษัท
 * GET /api/logs?companyId&limit=200            -> รายการล่าสุด
 * GET /api/logs?companyId&id=<logId>           -> รายการเดียว
 * ถ้ายังไม่มี composite index (companyId + createdAt) จะอ่านทั้งหมดแล้วเรียงในหน่วยความจำ (จำกัด 5,000 รายการ)
 */

const toIso = (v: any) => (v?.toDate ? v.toDate().toISOString() : typeof v === "string" ? v : null);

async function actorNames(uids: string[]) {
  const unique = Array.from(new Set(uids.filter((u) => u && !u.includes("@") && u !== "SYSTEM"))).slice(0, 200);
  const snaps = unique.length ? await adminDb.getAll(...unique.map((u) => adminDb.doc(`users/${u}`))) : [];
  const m = new Map<string, string>();
  snaps.forEach((s) => { if (s.exists) { const u = s.data()!; m.set(s.id, u.displayName || u.name || u.email || s.id); } });
  return m;
}

function shape(id: string, d: any, names: Map<string, string>) {
  const by = d.createdBy || d.userId || "";
  return {
    id,
    action: d.action || "",
    module: d.module || "",
    targetId: d.targetId || "",
    actorId: by,
    // ผู้ใช้ที่ไม่พบในระบบแล้ว (เช่น ถูกลบ) แสดงรหัสย่อ
    actor: names.get(by) || (by.includes("@") ? by : by ? `ผู้ใช้ ${by.slice(0, 6)}…` : "ระบบ"),
    createdAt: toIso(d.createdAt),
    changes: d.changes || null,
    userAgent: d.metadata?.userAgent || "",
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = String(url.searchParams.get("companyId") || "");
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "logs:view")) throw new ApiAuthError(403, "ไม่มีสิทธิ์ดูบันทึกการใช้งาน");

    const id = url.searchParams.get("id");
    if (id) {
      const snap = await adminDb.doc(`logs/${id}`).get();
      if (!snap.exists || snap.data()!.companyId !== companyId) throw new ApiAuthError(404, "ไม่พบบันทึก");
      const names = await actorNames([snap.data()!.createdBy]);
      return NextResponse.json({ success: true, log: shape(snap.id, snap.data(), names) });
    }

    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 200));
    const base = adminDb.collection("logs").where("companyId", "==", companyId);
    let docs: FirebaseFirestore.QueryDocumentSnapshot[];
    let indexed = true;
    try {
      docs = (await base.orderBy("createdAt", "desc").limit(limit).get()).docs;
    } catch (e: any) {
      if (e?.code !== 9) throw e; // FAILED_PRECONDITION = ยังไม่มี index
      indexed = false;
      const all = (await base.limit(5000).get()).docs;
      const ms = (d: any) => d.data().createdAt?.toMillis?.() || 0;
      docs = all.sort((a, b) => ms(b) - ms(a)).slice(0, limit);
    }
    const rows = docs.filter((d) => d.data().isDeleted !== true);
    const names = await actorNames(rows.map((d) => d.data().createdBy));
    return NextResponse.json({ success: true, indexed, logs: rows.map((d) => shape(d.id, d.data(), names)) });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[LOGS_API_ERROR]:", error);
    return NextResponse.json({ success: false, error: "อ่านบันทึกการใช้งานไม่สำเร็จ" }, { status: 500 });
  }
}
