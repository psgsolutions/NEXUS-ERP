import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { canAny } from "@/lib/permissions";
import { DOCUMENT_TYPES } from "@/lib/documents/adapters.server";
import { renderDocumentPdf, pdfFileName } from "@/lib/documents/render.server";

export const runtime = "nodejs";

/**
 * [API-SERVER] พิมพ์เอกสารเป็น PDF (เทมเพลตมาตรฐานเดียวกันทุกประเภท)
 * POST /api/documents/pdf  { companyId, type, id, copy?: "original" | "copy", format?: "pdf" | "json" }
 *  - format "json" คืน DocumentModel (ใช้กับแอปอื่น/แสดงผลเอง)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const apiUser = await requireApiUser(request, companyId);
    const def = DOCUMENT_TYPES[String(body.type || "")];
    if (!def) throw new ApiAuthError(400, "ไม่รู้จักประเภทเอกสาร");
    if (!canAny(apiUser.roles, ([] as any[]).concat(def.permission))) throw new ApiAuthError(403, `ไม่มีสิทธิ์เปิด${def.label}`);
    const id = String(body.id || "").trim();
    if (body.type !== "sample" && (!id || id.includes("/"))) throw new ApiAuthError(400, "ไม่พบเลขที่เอกสาร");
    const doc = await def.load(companyId, id);
    if (body.format === "json") return NextResponse.json({ success: true, document: doc });
    const copy = body.copy === "copy" ? "copy" : "original";
    const pdf = await renderDocumentPdf(doc, copy, new URL(request.url).origin);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(pdfFileName(doc, copy))}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DOCUMENT_PDF]", err);
    return NextResponse.json({ success: false, error: err.message || "สร้าง PDF ไม่สำเร็จ" }, { status: 500 });
  }
}
