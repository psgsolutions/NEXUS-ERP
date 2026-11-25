import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { normalizeSynonyms } from "@/lib/product-match";

/**
 * คำพ้องสำหรับตรวจสินค้าซ้ำ (ชื่อที่บริษัทเรียกต่างกัน) — POST /api/inventory/product-match { companyId, action }
 *  get                    อ่านคำพ้องของบริษัท (ทุกคนในบริษัท)
 *  save { synonyms }      บันทึก [[คำกลาง, คำที่ใช้เรียก...], ...] · ต้องมีสิทธิ์ inventory:edit
 * เก็บที่ companies/{id}/settings/product-match
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = String(body.companyId || "").trim().slice(0, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const user = await requireApiUser(request, companyId);
    const ref = adminDb.doc(`companies/${companyId}/settings/product-match`);
    const action = String(body.action || "get");
    if (action === "get") {
      const snap = await ref.get();
      return NextResponse.json({ success: true, synonyms: normalizeSynonyms(snap.get("synonyms")), updatedAt: snap.get("updatedAt") || "" });
    }
    if (action === "save") {
      if (!can(user.roles, "inventory:edit")) throw new ApiAuthError(403, "ต้องมีสิทธิ์แก้ไขคลังสินค้า");
      const synonyms = normalizeSynonyms(body.synonyms);
      // Firestore ไม่รับ array ซ้อน array — เก็บแต่ละกลุ่มเป็นข้อความคั่นด้วย ,
      await ref.set({ synonyms: synonyms.map((g) => g.join(", ")), updatedAt: new Date().toISOString(), updatedBy: user.email || user.uid });
      await auditServer.logUpdate(user.uid, companyId, "PRODUCT_SYNONYMS", "product-match", {}, { groups: synonyms.length });
      return NextResponse.json({ success: true, synonyms });
    }
    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PRODUCT_MATCH_API_ERROR]", err);
    return NextResponse.json({ success: false, error: "ดำเนินการคำพ้องสินค้าไม่สำเร็จ" }, { status: 500 });
  }
}
