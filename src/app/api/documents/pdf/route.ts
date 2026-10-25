import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { canAny } from "@/lib/permissions";
import { DOCUMENT_TYPES } from "@/lib/documents/adapters.server";
import { renderDocumentPdf, pdfFileName } from "@/lib/documents/render.server";
import { withSigning } from "@/lib/documents/esign.server";

export const runtime = "nodejs";

/**
 * [API-SERVER] พิมพ์เอกสารเป็น PDF (เทมเพลตมาตรฐานเดียวกันทุกประเภท)
 * POST /api/documents/pdf  { companyId, type, id, copy?: "original" | "copy", format?: "pdf" | "json" }
 *  - format "json" คืน DocumentModel (ใช้กับแอปอื่น/แสดงผลเอง)
 *  - esign: false = พิมพ์โดยไม่ใส่ลายเซ็น/ตราอิเล็กทรอนิกส์ (ค่าเริ่มต้นใส่ตามที่ตั้งไว้ เฉพาะเอกสารที่ออกจริง)
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
    const raw = await def.load(companyId, id);
    const signedDoc = await withSigning(companyId, raw);
    const esign = signedDoc !== raw;
    const doc = body.esign === false ? raw : signedDoc;
    // ตัวเลือกตอนพิมพ์: ใส่วันที่ / เว้นวันที่ (เฉพาะเอกสารที่อนุญาต — ใบกำกับภาษีพิมพ์วันที่เสมอ)
    if (doc.dateOption && (body.dateMode === "dated" || body.dateMode === "undated")) doc.date = body.dateMode === "dated" ? doc.dateOption.actual : "";
    if (body.format === "json") return NextResponse.json({ success: true, document: doc });
    const copy = body.copy === "copy" ? "copy" : "original";
    const pdf = await renderDocumentPdf(doc, copy, new URL(request.url).origin);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(pdfFileName(doc, copy))}"`,
        "Cache-Control": "no-store",
        ...(esign ? { "X-ESign": body.esign === false ? "off" : "on" } : {}),
        ...(doc.dateOption ? { "X-Date-Option": encodeURIComponent(JSON.stringify({ ...doc.dateOption, undated: !doc.date })) } : {}),
      },
    });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DOCUMENT_PDF]", err);
    return NextResponse.json({ success: false, error: err.message || "สร้าง PDF ไม่สำเร็จ" }, { status: 500 });
  }
}
