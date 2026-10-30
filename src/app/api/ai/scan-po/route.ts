import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, authErrorResponse } from "@/lib/api-auth";
import { AiError, aiErrorInfo, geminiModel, limitAi, parseAiJson } from "@/lib/gemini.server";

/**
 * [NEXUS-AI] อ่านใบสั่งซื้อของลูกค้าจากไฟล์ (รูป/PDF) — ผลเป็นร่างให้ผู้ใช้ตรวจก่อนบันทึกเสมอ (status: VERIFIED/NEEDS_REVIEW)
 * รุ่น/timeout/จำกัดการเรียก/ข้อความ error ใช้ตัวกลาง gemini.server.ts
 */
const MAX_BYTES = 10 * 1024 * 1024;

const PROMPT = `
You are an expert purchase order scanner for NEXUS ERP (Intelligence OS). Extract the PO details from this document and return ONLY a valid JSON object.
Keys:
{
  "poNumber": "PO document number",
  "poDate": "YYYY-MM-DD",
  "customerName": "customer/client name",
  "items": [
    {
      "productCode": "item SKU or code",
      "name": "item description",
      "qty": number,
      "unit": "unit of measure",
      "price": number
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const apiUser = await requireApiUser(request);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) throw new AiError(400, "ไม่พบไฟล์ใบสั่งซื้อ");
    if (file.size > MAX_BYTES) throw new AiError(413, "ไฟล์ใหญ่เกิน 10 MB กรุณาลดขนาดไฟล์");
    await limitAi(apiUser.uid, "scan_po");

    const base64Data = Buffer.from(await file.arrayBuffer()).toString('base64');
    const result = await geminiModel({ generationConfig: { responseMimeType: "application/json" } })
      .generateContent([PROMPT, { inlineData: { data: base64Data, mimeType: file.type || 'image/jpeg' } }]);
    const text = result.response.text();
    if (!text.trim()) throw new AiError(422, "AI อ่านเอกสารนี้ไม่ได้ กรุณาใช้ไฟล์ที่ชัดขึ้น หรือกรอกเอง");
    return NextResponse.json({ success: true, status: 'VERIFIED', data: parseAiJson(text) });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    const { status, message } = aiErrorInfo(error);
    if (status >= 500) console.error('[AI_SCAN_PO_ERROR]', error);
    return NextResponse.json({ success: false, status: 'NEEDS_REVIEW', error: message }, { status });
  }
}
