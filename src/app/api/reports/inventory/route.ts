import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { listProducts } from "@/lib/product-store.server";
import { stockAging } from "@/lib/management-reports";

/**
 * [API-SERVER] รายงานสต็อก — POST /api/reports/inventory { companyId, report: "aging", asOf?: "YYYY-MM-DD", slowDays? }
 * สินค้าเคลื่อนไหวช้าและมูลค่าสต็อกตามอายุ (นับจากวันเบิกออกล่าสุด) · สิทธิ์ inventory:view
 * อ่านการเคลื่อนไหว 2 ปีย้อนหลัง (เก่ากว่านั้นถือว่าเกิน 1 ปีอยู่แล้ว)
 */
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "inventory:view")) throw new ApiAuthError(403, "รายงานสต็อกเปิดได้เฉพาะผู้ดูแลคลังสินค้า");
    if (body.report !== "aging") throw new ApiAuthError(400, "ไม่พบรายงานที่ต้องการ");
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(body.asOf || "")) && body.asOf <= todayBkk() ? String(body.asOf) : todayBkk();
    const slowDays = [30, 60, 90, 180, 365].includes(Number(body.slowDays)) ? Number(body.slowDays) : 90;
    const since = new Date(new Date(`${asOf}T00:00:00Z`).getTime() - 2 * 365 * 86_400_000);
    const [products, moves] = await Promise.all([
      listProducts(companyId),
      adminDb.collection(`companies/${companyId}/stock_movements`).where("timestamp", ">=", since).get(),
    ]);
    const result = stockAging(products, moves.docs.map((d) => d.data()), asOf, slowDays);
    return NextResponse.json({ success: true, asOf, ...result });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[INVENTORY_REPORT]", err);
    return NextResponse.json({ success: false, error: "สร้างรายงานไม่สำเร็จ" }, { status: 500 });
  }
}
