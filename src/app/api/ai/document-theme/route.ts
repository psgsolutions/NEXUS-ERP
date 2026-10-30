import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import { aiErrorResponse, GEMINI_MODEL as MODEL, geminiModel, limitAi, parseAiJson } from "@/lib/gemini.server";
import { TEMPLATES, normalizeTheme } from "@/lib/documents/design";

/**
 * [API-SERVER] ให้ AI ช่วยแต่งธีมเอกสารของบริษัท
 * Endpoint: POST /api/ai/document-theme
 * body: { companyId, prompt?, logo? (data URL PNG/JPEG), current? (ธีมปัจจุบัน) }
 * คืน { theme } ที่ตรวจค่าแล้ว (normalizeTheme) — ธีมใช้กับทุกเอกสารของบริษัท จึงได้สไตล์เดียวกันทั้งชุด
 * AI เลือกได้เฉพาะค่าที่ระบบรองรับ (ฟอนต์ สี รูปแบบหัว/ตาราง/ยอดรวม ฯลฯ) ไม่แตะข้อมูลที่กฎหมายบังคับ
 */

const str = (v: any, max: number) => String(v ?? "").slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ออกแบบเอกสารได้เฉพาะผู้ดูแลระบบ");

    const prompt = str(body.prompt, 1000).trim();
    const logo = str(body.logo, 400_000);
    const logoMatch = logo.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
    if (!prompt && !logoMatch) throw new ApiAuthError(400, "บอกสไตล์ที่ต้องการ หรือแนบโลโก้ให้ AI ดู");
    await limitAi(apiUser.uid, "document_theme");

    const model = geminiModel({
      generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
      systemInstruction: [
        "คุณคือนักออกแบบเอกสารธุรกิจไทย (ใบเสนอราคา ใบกำกับภาษี ใบเสร็จ) ออกแบบธีมที่อ่านง่าย ดูเป็นมืออาชีพ และพิมพ์ขาวดำได้",
        "ตอบเป็น JSON object ตามโครงสร้างนี้เท่านั้น:",
        '{"templateId":"ai","font":"Sarabun|THSarabunNew|THSarabunIT9","fontSize":7.5-12,"primary":"#RRGGBB","accent":"#RRGGBB","text":"#RRGGBB","muted":"#RRGGBB","header":"logo-left|logo-right|centered|banner","logoSize":32-120,"party":"accent-bar|boxed|plain","table":"tint|solid|lines|grid|zebra","rounded":true|false,"totals":"solid|outline|plain","signatures":"line|box","margin":20-60,"showPageNumber":true,"watermark":""}',
        "ถ้ามีโลโก้ ให้ใช้สีหลักของโลโก้เป็น primary/accent (สีเข้มพอให้ตัวอักษรขาวอ่านได้) และเลือกตำแหน่งหัวเอกสารที่เข้ากับรูปทรงโลโก้",
        "text ต้องเข้มเกือบดำ muted เป็นเทากลาง ห้ามใช้สีสดเป็นตัวอักษรเนื้อหา",
        "งานราชการ/ทางการ ใช้ THSarabunIT9 หัวกึ่งกลาง ตาราง grid",
        `แม่แบบอ้างอิง: ${JSON.stringify(TEMPLATES.map((t) => ({ id: t.id, theme: t.theme })))}`,
      ].join("\n"),
    });
    const parts: any[] = [`ธีมปัจจุบัน: ${JSON.stringify(body.current || {}).slice(0, 2000)}\nความต้องการ: ${prompt || "ออกแบบให้เข้ากับโลโก้"}`];
    if (logoMatch) parts.push({ inlineData: { mimeType: logoMatch[1], data: logoMatch[2] } });
    const result = await model.generateContent(parts);
    const parsed: any = parseAiJson(result.response.text());
    const theme = normalizeTheme({ ...parsed, templateId: "ai" });
    return NextResponse.json({ success: true, theme, model: MODEL });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    return aiErrorResponse(error, "AI_DOCUMENT_THEME_ERROR");
  }
}
