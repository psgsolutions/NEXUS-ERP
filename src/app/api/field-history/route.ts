import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { cleanValue, KEY_RE, pushValue, type HistoryValue } from "@/lib/field-history";

/**
 * ข้อมูลเก่าที่เคยบันทึกต่อช่องกรอก — POST /api/field-history { companyId, action, ... }
 *  get    { keys: string[] }                         → { values: { key: string[] } }
 *  record { entries: { key, value }[] }              บันทึกค่าที่เพิ่งบันทึกฟอร์มสำเร็จ (หน้าจอส่งมาหลังบันทึก)
 * ผู้ใช้ในบริษัทอ่าน/เพิ่มได้ (ข้อความที่ตัวเองกรอกในฟอร์ม) · เขียนผ่าน server เท่านั้น
 */
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    await requireApiUser(request, companyId);
    const col = adminDb.collection(`companies/${companyId}/field_history`);
    const action = str(body.action, 20);

    if (action === "get") {
      const keys = (Array.isArray(body.keys) ? body.keys : []).map((k: any) => str(k, 64)).filter((k: string) => KEY_RE.test(k)).slice(0, 20);
      const snaps = keys.length ? await adminDb.getAll(...keys.map((k: string) => col.doc(k))) : [];
      const values: Record<string, string[]> = {};
      snaps.forEach((s, i) => { values[keys[i]] = ((s.data()?.values || []) as HistoryValue[]).map((x) => x.v); });
      return NextResponse.json({ success: true, values });
    }

    if (action === "record") {
      const byKey = new Map<string, string[]>();
      for (const e of (Array.isArray(body.entries) ? body.entries : []).slice(0, 30)) {
        const key = str(e?.key, 64), value = cleanValue(e?.value);
        if (!KEY_RE.test(key) || value.length < 2) continue;
        byKey.set(key, [...(byKey.get(key) || []), value]);
      }
      await Promise.all([...byKey].map(([key, vals]) => adminDb.runTransaction(async (tx) => {
        const ref = col.doc(key);
        let list = ((await tx.get(ref)).data()?.values || []) as HistoryValue[];
        for (const v of vals) list = pushValue(list, v);
        tx.set(ref, { values: list, updatedAt: Date.now() });
      })));
      return NextResponse.json({ success: true, recorded: byKey.size });
    }
    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[FIELD_HISTORY_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "โหลดข้อมูลเก่าไม่สำเร็จ" }, { status: 500 });
  }
}
