import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";

/**
 * [API-SERVER] ให้ AI ช่วยเรียบเรียงรายละเอียดโครงการ (ร่างขอบเขตของงาน)
 * Endpoint: POST /api/ai/project-doc
 * body: { companyId, notes, project: {...สรุปข้อมูลโครงการ}, sections: { key: { number, title, current } } }
 * คืน { sections: { key: text } } เฉพาะหัวข้อที่ส่งมา — ตัวเลขเงิน/วันที่/กฎหมาย ระบบสร้างเอง ไม่ให้ AI แต่ง
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const ALLOWED = ["background", "objectives", "scope", "specs"];
const str = (v: any, max: number) => String(v ?? "").slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "projects:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    if (!genAI) throw new ApiAuthError(503, "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์");

    const rawSections = body.sections && typeof body.sections === "object" ? body.sections : {};
    const sections = Object.fromEntries(
      Object.entries(rawSections)
        .filter(([k]) => ALLOWED.includes(k))
        .map(([k, v]: [string, any]) => [k, { number: Number(v?.number) || 0, title: str(v?.title, 100), current: str(v?.current, 8000) }])
    );
    if (!Object.keys(sections).length) throw new ApiAuthError(400, "ไม่มีหัวข้อที่ให้ AI เรียบเรียง");
    const notes = str(body.notes, 4000).trim();
    const project = JSON.stringify(body.project ?? {}).slice(0, 20000);

    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      systemInstruction: [
        "คุณคือผู้เชี่ยวชาญการเขียนร่างขอบเขตของงาน (TOR) สำหรับการจัดซื้อจัดจ้างภาครัฐไทย และเอกสารโครงการของเอกชน",
        "เขียนภาษาไทยแบบภาษาราชการ สุภาพ กระชับ ชัดเจน วัดผลได้",
        "ใช้ข้อมูลโครงการ (PROJECT) และข้อมูลเพิ่มเติมจากผู้ใช้ (NOTES) เป็นหลัก ห้ามแต่งตัวเลขเงิน วันที่ จำนวน หรือชื่อหน่วยงานที่ไม่มีในข้อมูล",
        "คุณลักษณะเฉพาะ: ห้ามระบุยี่ห้อ รุ่น หรือคุณลักษณะที่ล็อกผู้ขายรายเดียว ใช้ถ้อยคำ 'ต้องมี' 'ต้องสามารถ' 'ต้องรองรับ' หรือ 'ไม่น้อยกว่า'",
        "รูปแบบคุณลักษณะเฉพาะ: '{เลขข้อ}.{ลำดับ} {ชื่อรายการ} จำนวน {จำนวน} {หน่วย} มีคุณลักษณะดังนี้' แล้วตามด้วยข้อย่อย '    {เลขข้อ}.{ลำดับ}.{ข้อย่อย} ต้อง...' ครบทุกรายการตามลำดับใน PROJECT.lines จำนวนต้องตรงกับข้อมูล",
        "เพิ่มคุณลักษณะพื้นฐานที่จำเป็นตามมาตรฐานทั่วไปของอุปกรณ์/งานประเภทนั้นได้ เมื่อรายการยังไม่มีรายละเอียดเพียงพอ",
        "วัตถุประสงค์และขอบเขตของงานให้เป็นข้อย่อยรูปแบบ '{เลขข้อ}.{ลำดับ} ข้อความ' หนึ่งข้อต่อบรรทัด",
        "ตอบเป็น JSON object เท่านั้น: key = ชื่อหัวข้อที่ได้รับ (เช่น background, specs) value = ข้อความของหัวข้อนั้น (ใช้ \\n ขึ้นบรรทัดใหม่) ไม่ต้องใส่ชื่อหัวข้อหรือเลขหัวข้อหลักนำหน้า",
      ].join("\n"),
    });

    const prompt = [
      `PROJECT: ${project}`,
      `NOTES: ${notes || "-"}`,
      `SECTIONS (เขียนใหม่ทุกหัวข้อนี้ โดยปรับปรุงจากข้อความปัจจุบัน): ${JSON.stringify(sections)}`,
    ].join("\n\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    let parsed: any;
    try {
      parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      throw new Error("invalid AI json");
    }
    const out = Object.fromEntries(
      Object.keys(sections)
        .filter((k) => typeof parsed?.[k] === "string" && parsed[k].trim())
        .map((k) => [k, String(parsed[k]).trim().slice(0, 12000)])
    );
    if (!Object.keys(out).length) throw new Error("empty AI answer");
    return NextResponse.json({ success: true, sections: out, model: MODEL });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("API_KEY_INVALID")) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY บนเซิร์ฟเวอร์ไม่ถูกต้อง" }, { status: 503 });
    }
    console.error("[AI_PROJECT_DOC_ERROR]:", error?.message || error);
    return NextResponse.json({ success: false, error: "AI เรียบเรียงไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }
}
