import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { AiError, aiErrorResponse, geminiModel, limitAi, parseAiJson } from "@/lib/gemini.server";
import { normalizeSpecItems } from "@/lib/spec-items";

/**
 * [NEXUS-AI] อ่าน datasheet (PDF/รูป) แล้วเขียนคุณลักษณะเฉพาะเป็นข้อ ๆ แบบ TOR ภาษาไทย — ผลเป็นร่างให้ผู้ใช้แก้ก่อนบันทึกเสมอ
 *  - multipart: file (≤ 10 MB) + companyId + productName?
 *  - JSON: { companyId, attachmentId, productName? }  ใช้ไฟล์ที่แนบไว้กับสินค้า
 * ผู้ใช้: ผู้แก้ข้อมูลสินค้าได้ (คลัง) หรือฝ่ายขาย/วิศวกร (แก้ข้อมูลประกอบการขาย)
 */
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const prompt = (name: string) => `You read an equipment datasheet and write the technical specification for a Thai government Terms of Reference (TOR / ขอบเขตของงาน).
${name ? `The product in the system is named: "${name}".` : ""}
Rules:
- Write every item in Thai, one requirement per item, in TOR style: "…ไม่น้อยกว่า …", "…ไม่เกิน …", "รองรับ …", "มี … อย่างน้อย …".
- Brand-neutral: never write the brand, model number or a feature name that only one maker uses; describe the capability instead.
- Use the datasheet numbers as minimum requirements (keep units: MP, fps, W, Gbps, port, °C, IP67 …). Do not invent values that are not in the datasheet.
- 8–25 items, most important first (type/form factor, core performance, interfaces/ports, power, environment/standards, certification).
- Skip marketing text, prices, ordering codes and accessories that are not part of the item.
Return ONLY JSON: {"brand": "", "model": "", "productType": "short Thai type, e.g. กล้อง IP ชนิดโดม", "items": ["…", "…"]}`;

export async function POST(request: Request) {
  try {
    const ct = request.headers.get("content-type") || "";
    let companyId = "", productName = "", data = "", mime = "", attachmentId = "";
    if (ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      companyId = String(fd.get("companyId") || "").slice(0, 80);
      productName = String(fd.get("productName") || "").slice(0, 200);
      const file = fd.get("file") as File | null;
      if (!file) throw new AiError(400, "ไม่พบไฟล์ datasheet");
      if (file.size > MAX_BYTES) throw new AiError(413, "ไฟล์ใหญ่เกิน 10 MB กรุณาลดขนาดหรือเลือกเฉพาะหน้าสเปก");
      mime = file.type || "application/pdf";
      data = Buffer.from(await file.arrayBuffer()).toString("base64");
    } else {
      const body = await request.json().catch(() => ({}));
      companyId = String(body.companyId || "").slice(0, 80);
      productName = String(body.productName || "").slice(0, 200);
      attachmentId = String(body.attachmentId || "");
      if (!/^[A-Za-z0-9]{1,60}$/.test(attachmentId)) throw new AiError(400, "ไม่พบไฟล์ที่แนบ");
    }
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const user = await requireApiUser(request, companyId);
    if (!["inventory:edit", "sales:edit", "projects:edit"].some((p) => can(user.roles, p as any))) throw new ApiAuthError(403, "ไม่มีสิทธิ์แก้ข้อมูลสินค้า");
    if (attachmentId) {
      const snap = await adminDb.doc(`companies/${companyId}/attachments/${attachmentId}`).get();
      if (!snap.exists || snap.get("ownerType") !== "product") throw new AiError(404, "ไม่พบไฟล์ datasheet ของสินค้า");
      mime = String(snap.get("mime") || "");
      data = String(snap.get("data") || "").replace(/^data:[^;]+;base64,/, "");
    }
    if (!TYPES.includes(mime)) throw new AiError(400, "รองรับเฉพาะ PDF และรูป JPG/PNG/WebP");
    await limitAi(user.uid, "datasheet_spec");

    const result = await geminiModel({ generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
      .generateContent([prompt(productName), { inlineData: { data, mimeType: mime } }]);
    const text = result.response.text();
    if (!text.trim()) throw new AiError(422, "AI อ่าน datasheet นี้ไม่ได้ กรุณาใช้ไฟล์ที่ชัดขึ้น หรือพิมพ์คุณลักษณะเอง");
    const j = parseAiJson<any>(text);
    const items = normalizeSpecItems(j.items);
    if (!items.length) throw new AiError(422, "AI ไม่พบข้อมูลสเปกใน datasheet นี้ กรุณาตรวจไฟล์ หรือพิมพ์คุณลักษณะเอง");
    return NextResponse.json({ success: true, brand: String(j.brand || "").slice(0, 80), model: String(j.model || "").slice(0, 120), productType: String(j.productType || "").slice(0, 120), items });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    return aiErrorResponse(error, "AI_DATASHEET_SPEC");
  }
}
