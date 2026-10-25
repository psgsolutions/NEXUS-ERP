import * as admin from "firebase-admin";
import { ApiAuthError, type ApiUser } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { prepareSequence } from "@/lib/sequence-server";
import { auditServer } from "@/services/audit.server";
import { EXPENSE_ACCOUNTS } from "@/lib/payables";

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const r2 = (n: number) => Math.round(n * 100) / 100;
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export interface ClaimInput {
  employeeId: string; expenseAccountCode: string; description: string; hasVat: boolean; subtotal: number; projectId?: string;
  /** ที่มาของใบเบิก (เช่น จากรูปบิลในกล่องรอยืนยัน) — เก็บไว้ตรวจย้อนได้ */
  source?: { kind: string; id: string; docType?: string };
}

/**
 * สร้างใบเบิกค่าใช้จ่ายพนักงาน (companies/{id}/expenses) — ใช้ทั้งฟอร์มเบิกและการยืนยันรูปบิล
 * เลข EXP ออกในทรานแซกชันเดียวกับการบันทึก (ไม่ข้าม) · ยอดคำนวณที่ server · เข้าโครงการได้ (ต้นทุนจริง)
 */
export async function createExpenseClaim(apiUser: ApiUser, companyId: string, input: ClaimInput): Promise<string> {
  const subtotal = r2(Math.max(0, Number(input.subtotal) || 0));
  if (!(subtotal > 0)) throw new ApiAuthError(400, "กรุณาระบุยอดเงินเบิก");
  if (!str(input.description)) throw new ApiAuthError(400, "กรุณาระบุรายละเอียดการเบิก");
  const account = EXPENSE_ACCOUNTS.find((a) => a.code === str(input.expenseAccountCode)) || EXPENSE_ACCOUNTS[0];
  const empRef = adminDb.doc(`employees/${str(input.employeeId, 120)}`);
  const vat = input.hasVat ? r2(subtotal * 0.07) : 0;
  const projectId = str(input.projectId, 120);
  const projectRef = projectId && !projectId.includes("/") ? adminDb.doc(`companies/${companyId}/projects/${projectId}`) : null;
  const take = await prepareSequence("EXP", companyId);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const id = await adminDb.runTransaction(async (tx) => {
    const emp = await tx.get(empRef);
    const proj = projectRef ? await tx.get(projectRef) : null;
    if (projectId && !proj?.exists) throw new ApiAuthError(400, "ไม่พบโครงการที่เลือก");
    if (!emp.exists || emp.data()!.companyId !== companyId) throw new ApiAuthError(400, "กรุณาเลือกพนักงานผู้เบิก");
    const e = emp.data()!;
    const name = str(e.name || [e.firstName, e.lastName].filter(Boolean).join(" ") || e.fullName || emp.id, 200);
    const seq = await take(tx); const code = seq.number; seq.commit();
    tx.create(adminDb.doc(`companies/${companyId}/expenses/${code}`), {
      companyId, createdBy: apiUser.uid, createdByEmail: apiUser.email || "", createdAt: now, updatedAt: now, isDeleted: false, status: "Awaiting Payment",
      id: code, expenseId: code, documentType: "ExpenseClaim",
      employeeId: emp.id, employeeName: name, supplierName: name, vendor: name,
      expenseAccountCode: account.code, description: str(input.description, 1000), hasVat: !!input.hasVat,
      ...(proj?.exists ? { projectId, projectName: str(proj.data()!.projectName || proj.data()!.title, 200) } : {}),
      ...(input.source ? { source: { kind: str(input.source.kind, 30), id: str(input.source.id, 120), ...(input.source.docType ? { docType: str(input.source.docType, 30) } : {}) } } : {}),
      subTotal: subtotal, vatAmount: vat, totalAmount: r2(subtotal + vat), dueDate: todayBkk(),
    });
    return code;
  });
  await auditServer.logCreate(apiUser.uid, companyId, "EXPENSE_CLAIM", id, { total: r2(subtotal + vat), ...(input.source ? { source: input.source } : {}) });
  return id;
}
