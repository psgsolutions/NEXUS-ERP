import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { assertPeriodOpen } from "@/lib/period-close-service";
import { auditServer } from "@/services/audit.server";
import { monthlyDepreciation, assetBookValue, periodEndDate } from "@/lib/depreciation";

/**
 * [API-SERVER] ประมวลผลค่าเสื่อมราคาประจำงวด (วิธีเส้นตรง รายเดือน)
 * Endpoint: POST /api/finance/depreciation  { companyId, period: "YYYY-MM" }
 *
 * ทำในทรานแซกชันเดียว:
 *  - คำนวณจากข้อมูลทรัพย์สินที่ server อ่านเอง (ไม่เชื่อตัวเลขจากหน้าจอ)
 *  - ปรับค่าเสื่อมสะสม / มูลค่าตามบัญชีของทรัพย์สินแต่ละรายการ
 *  - กันประมวลผลงวดเดียวกันซ้ำ (assetDepreciations/{companyId}_{period})
 *  - รายการบัญชี (ร่าง รออนุมัติ) ลงวันสิ้นงวด: Dr ค่าเสื่อมราคา 5310-00 / Cr ค่าเสื่อมราคาสะสม 1591-00
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const period = String(body.period || "");
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new ApiAuthError(400, "งวดไม่ถูกต้อง (YYYY-MM)");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const date = periodEndDate(period);
    const todayBkk = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    if (period > todayBkk) throw new ApiAuthError(400, "ประมวลผลงวดในอนาคตไม่ได้");
    await assertPeriodOpen(companyId, date);

    const assetSnap = await adminDb.collection("assets").where("companyId", "==", companyId).get();
    const runRef = adminDb.doc(`assetDepreciations/${companyId}_${period}`);
    const journalRef = adminDb.collection(`companies/${companyId}/journal_entries`).doc();

    const result = await adminDb.runTransaction(async (tx) => {
      if ((await tx.get(runRef)).exists) throw new ApiAuthError(409, `งวด ${period} ประมวลผลค่าเสื่อมไปแล้ว`);
      const snaps = assetSnap.docs.length ? await tx.getAll(...assetSnap.docs.map((d) => d.ref)) : [];
      const now = admin.firestore.FieldValue.serverTimestamp();
      const items = snaps
        .filter((s) => s.exists && s.data()!.isDeleted !== true && s.data()!.lastDepreciationPeriod !== period)
        .map((s) => ({ s, a: s.data()!, amount: r2(monthlyDepreciation(s.data()!)) }))
        .filter((x) => x.amount > 0);
      if (!items.length) throw new ApiAuthError(400, "ไม่มีสินทรัพย์ที่ต้องคิดค่าเสื่อมในงวดนี้");
      const total = r2(items.reduce((sum, x) => sum + x.amount, 0));

      for (const { s, a, amount } of items) {
        tx.update(s.ref, {
          accumulatedDepreciation: r2((Number(a.accumulatedDepreciation) || 0) + amount),
          netBookValue: r2(assetBookValue(a) - amount),
          lastDepreciationPeriod: period,
          updatedAt: now,
        });
      }
      const lines = items.map(({ s, a, amount }) => ({ assetId: s.id, name: a.name || a.assetId || s.id, amount }));
      tx.create(runRef, {
        companyId, period, date, amount: total, assetCount: lines.length, items: lines, journalId: journalRef.id,
        createdBy: apiUser.uid, createdByEmail: apiUser.email || "", createdAt: now, isDeleted: false,
      });
      tx.set(journalRef, {
        companyId, date, bookType: "JV",
        description: `[AUTO] ค่าเสื่อมราคาประจำงวด ${period} (${lines.length} รายการ)`,
        reference: `DEP-${period}`,
        items: [
          { accountCode: "5310-00", accountName: "ค่าเสื่อมราคา", debit: total, credit: 0 },
          { accountCode: "1591-00", accountName: "ค่าเสื่อมราคาสะสม", debit: 0, credit: total },
        ],
        totalDebit: total, totalCredit: total, status: "draft",
        createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
      });
      return { period, amount: total, assetCount: lines.length, journalId: journalRef.id };
    });

    await auditServer.logCreate(apiUser.uid, companyId, "ASSET_DEPRECIATION", `DEP-${period}`, { amount: result.amount, assets: result.assetCount });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("ปิดงบ")) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[DEPRECIATION_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ประมวลผลค่าเสื่อมไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
