import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import { buildBusinessSnapshot } from "@/lib/business-snapshot.server";

/**
 * [API-SERVER] ถามคำถามธุรกิจด้วยภาษาธรรมชาติ
 * Endpoint: POST /api/ai/ask  { companyId, question, history?: [{ role: "user" | "model", text }] }
 * ส่งสรุปข้อมูลจริงของบริษัท (business snapshot) ให้ Gemini ตอบโดยอ้างอิงเฉพาะข้อมูลนั้น
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "");
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    // ข้อมูลสรุปมีตัวเลขการเงิน: เฉพาะผู้ที่ดูการเงินได้
    if (!can(apiUser.role, "finance:view")) throw new ApiAuthError(403, "การวิเคราะห์ด้วย AI ใช้ได้เฉพาะผู้มีสิทธิ์ดูข้อมูลการเงิน");
    const question = String(body.question || "").trim().slice(0, 1000);
    if (!question) throw new ApiAuthError(400, "กรุณาพิมพ์คำถาม");
    if (!genAI) throw new ApiAuthError(503, "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์");

    const snapshot = await buildBusinessSnapshot(companyId);
    const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
      .filter((h: any) => (h.role === "user" || h.role === "model") && typeof h.text === "string")
      .map((h: any) => ({ role: h.role, parts: [{ text: String(h.text).slice(0, 2000) }] }));

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: [
        "คุณคือผู้ช่วยวิเคราะห์ธุรกิจของระบบ NEXUS ERP ตอบเป็นภาษาไทย กระชับ ตรงประเด็น",
        "ใช้เฉพาะข้อมูลใน BUSINESS_DATA ด้านล่างเท่านั้น ห้ามแต่งตัวเลขหรือรายการที่ไม่มีในข้อมูล",
        "ถ้าข้อมูลไม่พอที่จะตอบ ให้บอกตรง ๆ ว่าไม่มีข้อมูลส่วนไหน",
        "แสดงจำนวนเงินเป็นบาทพร้อมคั่นหลักพัน ใช้หัวข้อย่อยหรือรายการเมื่อช่วยให้อ่านง่าย",
        "ข้อมูลกำไรขาดทุนมาจากรายการบัญชี (รวมรายการที่ยังรออนุมัติ) ให้ระบุข้อจำกัดนี้เมื่อพูดถึงกำไร",
        `BUSINESS_DATA (ณ วันที่ ${snapshot.asOf}):`,
        JSON.stringify(snapshot),
      ].join("\n"),
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(question);
    const answer = result.response.text().trim();
    if (!answer) throw new Error("empty answer");
    return NextResponse.json({ success: true, answer, asOf: snapshot.asOf, model: MODEL });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("API_KEY_INVALID")) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY บนเซิร์ฟเวอร์ไม่ถูกต้อง กรุณาตั้งค่าคีย์ใหม่" }, { status: 503 });
    }
    console.error("[AI_ASK_ERROR]:", error?.message || error);
    return NextResponse.json({ success: false, error: "AI ตอบไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
  }
}
