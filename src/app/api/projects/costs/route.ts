import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { projectCostLines } from "@/lib/project-costs";

/**
 * [API-SERVER] ต้นทุนจริงของโครงการ (จากเอกสารต้นทาง) สำหรับเทียบงบประมาณ
 * POST /api/projects/costs { companyId, projectDocId }
 * -> { lines: รายการต้นทุนจริง, committed: ใบสั่งซื้อโครงการที่ยังไม่ตั้งหนี้ }
 * งบประมาณคำนวณที่หน้าจอจากรายการโครงการ (computeProjectBudget) แล้วเทียบด้วย costVsBudget
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const WIP_ACCOUNT = "1161-00";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!["projects:view", "finance:view"].some((p) => can(apiUser.roles, p as any))) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const projectDocId = str(body.projectDocId, 120);
    if (!projectDocId || projectDocId.includes("/")) throw new ApiAuthError(400, "ไม่พบโครงการ");
    const base = `companies/${companyId}`;
    const p = await adminDb.doc(`${base}/projects/${projectDocId}`).get();
    if (!p.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");

    const byProject = (col: string) => adminDb.collection(`${base}/${col}`).where("projectId", "==", projectDocId).get();
    const [expenses, pos, journals, sos] = await Promise.all([byProject("expenses"), byProject("purchase_orders"), byProject("journal_entries"), byProject("sales_orders")]);

    // ต้นทุนสินค้าที่เบิกจากคลังตามใบสั่งขายของโครงการ (รายการบัญชีอ้างอิงเลขใบสั่งขาย)
    const stockIssueJournals = (await Promise.all(sos.docs.map(async (so) => {
      const q = await adminDb.collection(`${base}/journal_entries`).where("reference", "==", so.id).get();
      return q.docs.map((j) => ({ soNo: String(so.data().documentNo || so.id), journal: { ...j.data(), id: j.id } }));
    }))).flat();

    const siteJournals = journals.docs.map((j) => ({ ...j.data(), id: j.id }))
      .filter((j: any) => (j.items || []).some((l: any) => String(l.accountCode) === WIP_ACCOUNT && (Number(l.debit) || 0) > 0));

    const result = projectCostLines({
      expenses: expenses.docs.map((d) => ({ ...d.data(), id: d.id })),
      purchaseOrders: pos.docs.map((d) => ({ ...d.data(), id: d.id })),
      siteJournals,
      stockIssueJournals,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[PROJECT_COSTS]", err);
    return NextResponse.json({ success: false, error: "โหลดต้นทุนโครงการไม่สำเร็จ" }, { status: 500 });
  }
}
