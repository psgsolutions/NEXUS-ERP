import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { AiError, aiErrorInfo, geminiModel, limitAi, parseAiJson } from "@/lib/gemini.server";

/**
 * [NEXUS-AI] อ่านข้อมูลจากรูป (นามบัตร ฉลากสินค้า ใบเสนอราคา/ใบสั่งซื้อ) — ผลเป็นร่างให้ผู้ใช้ตรวจก่อนบันทึก
 * body: { imageBase64, type: "business_card" | "product_label" | "quotation" | "purchase_order" | อื่น ๆ }
 */
const MAX_BASE64 = 14_000_000; // ~10 MB

const PROMPTS: Record<string, string> = {
  business_card: `
You are an expert data extractor for NEXUS ERP (Intelligence OS). Extract information from this business card image and return ONLY a valid JSON object.
Keys:
{
  "name": "full name of person",
  "company": "company name",
  "email": "email address",
  "phone": "phone number",
  "position": "job title"
}`,
  product_label: `
You are an expert data extractor for NEXUS ERP (Intelligence OS). Extract information from this product label or barcode and return ONLY a valid JSON object.
Keys:
{
  "name": "product name",
  "brand": "brand name",
  "model": "model number",
  "specifications": "key specs"
}`,
  document: `
You are an expert document scanner for NEXUS ERP (Intelligence OS). Extract line items and prices from this commercial document and return ONLY a valid JSON object.
Keys:
{
  "vendor": "company/vendor name",
  "poNumber": "document or PO number",
  "items": [
    {
      "description": "item description",
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ],
  "grandTotal": number
}`,
  other: `Extract all text and tabular information from this image as JSON with key "text" and "extractedAt".`,
};

export async function POST(req: NextRequest) {
  try {
    const apiUser = await requireApiUser(req);
    const { imageBase64, type } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") throw new AiError(400, "ไม่พบรูปที่ต้องการอ่าน");
    if (imageBase64.length > MAX_BASE64) throw new AiError(413, "รูปใหญ่เกิน 10 MB กรุณาลดขนาดรูป");
    await limitAi(apiUser.uid, "vision");

    const m = imageBase64.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,/);
    const mimeType = m ? m[1].replace("jpg", "jpeg") : "image/jpeg";
    const data = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const prompt = type === "business_card" || type === "product_label" ? PROMPTS[type]
      : type === "quotation" || type === "purchase_order" ? PROMPTS.document : PROMPTS.other;

    const result = await geminiModel({ generationConfig: { responseMimeType: "application/json" } })
      .generateContent([prompt, { inlineData: { data, mimeType } }]);
    const text = result.response.text();
    if (!text.trim()) throw new AiError(422, "AI อ่านรูปนี้ไม่ได้ กรุณาถ่ายให้ชัดขึ้น หรือกรอกเอง");
    return NextResponse.json({ success: true, status: 'VERIFIED', data: parseAiJson(text) });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    const { status, message } = aiErrorInfo(error);
    if (status >= 500) console.error('[AI_VISION_ERROR]', error);
    return NextResponse.json({ success: false, status: 'NEEDS_REVIEW', error: message }, { status });
  }
}
