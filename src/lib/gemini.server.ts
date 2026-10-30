import { NextResponse } from "next/server";
import { GoogleGenerativeAI, type ModelParams } from "@google/generative-ai";
import { consumeRateLimit } from "@/lib/rate-limit.server";

/**
 * [SERVER-ONLY] ตัวเรียก Gemini กลางของทุกฟีเจอร์ AI
 *  - รุ่นเดียวทั้งระบบ: GEMINI_MODEL (ไม่ตั้ง = gemini-2.5-flash) — เปลี่ยนรุ่นที่ env ที่เดียว
 *  - timeout ทุกคำขอ (AI ค้าง = แจ้งผู้ใช้ ไม่รอจน Vercel ตัด)
 *  - จำกัดจำนวนครั้งต่อผู้ใช้ (กันค่าใช้จ่ายบานปลาย)
 *  - แปลงข้อผิดพลาดเป็นข้อความไทยที่บอกวิธีแก้
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const AI_TIMEOUT_MS = 45_000;

/** ข้อผิดพลาดที่รู้สาเหตุแล้ว (ข้อความไทยส่งถึงผู้ใช้ได้ตรง ๆ) */
export class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** โมเดลพร้อม timeout — ไม่มี GEMINI_API_KEY โยน AiError 503 */
export function geminiModel(params: Omit<ModelParams, "model"> = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError(503, "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ — ติดต่อผู้ดูแลระบบ");
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: GEMINI_MODEL, ...params }, { timeout: AI_TIMEOUT_MS });
}

/** จำกัดการเรียก AI ต่อผู้ใช้: 20 ครั้ง/10 นาที และ 200 ครั้ง/วัน */
export async function limitAi(uid: string, feature: string) {
  const r = await consumeRateLimit([
    { scope: `ai_${feature}_10m`, key: uid, limit: 20, windowSec: 600 },
    { scope: "ai_day", key: uid, limit: 200, windowSec: 86_400 },
  ]);
  if (!r.ok) throw new AiError(429, `ใช้ AI ถี่เกินไป กรุณารอประมาณ ${Math.max(1, Math.ceil(r.retryAfterSec / 60))} นาทีแล้วลองใหม่`);
}

/** อ่าน JSON ที่ AI ตอบ (ตัด ```json ออก) — ตอบผิดรูปแบบโยน AiError 502 */
export function parseAiJson<T = any>(text: string): T {
  try {
    return JSON.parse(String(text || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AiError(502, "AI ตอบกลับในรูปแบบที่อ่านไม่ได้ กรุณาลองใหม่อีกครั้ง");
  }
}

/** ข้อความไทยของข้อผิดพลาดจาก AI (ใช้ทั้งใน route และงานเบื้องหลัง) */
export function aiErrorInfo(error: any): { status: number; message: string } {
  if (error instanceof AiError) return { status: error.status, message: error.message };
  const msg = String(error?.message || error || "");
  if (/API_KEY_INVALID|API key not valid/i.test(msg)) return { status: 503, message: "GEMINI_API_KEY บนเซิร์ฟเวอร์ไม่ถูกต้อง — ติดต่อผู้ดูแลระบบ" };
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(msg)) return { status: 429, message: "โควตา AI ของระบบเต็มชั่วคราว กรุณาลองใหม่ภายหลัง หรือกรอกข้อมูลเอง" };
  if (/abort|timeout|timed out|DEADLINE/i.test(msg)) return { status: 504, message: "AI ใช้เวลานานเกินไป กรุณาลองใหม่ (ไฟล์ใหญ่ให้ลดขนาดหรือแบ่งหน้า)" };
  if (/\b404\b|not found|is not supported/i.test(msg)) return { status: 502, message: `รุ่น AI (${GEMINI_MODEL}) ไม่พร้อมใช้งาน — ติดต่อผู้ดูแลระบบให้ตั้ง GEMINI_MODEL` };
  if (/SAFETY|blocked/i.test(msg)) return { status: 422, message: "AI ไม่ตอบคำขอนี้ (ถูกตัวกรองความปลอดภัย) กรุณาปรับข้อความหรือไฟล์" };
  return { status: 502, message: "AI ตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
}

/** คำตอบ JSON เมื่อเรียก AI ไม่สำเร็จ (บันทึก error ฝั่ง server ไว้ตรวจ) */
export function aiErrorResponse(error: any, tag: string) {
  const { status, message } = aiErrorInfo(error);
  if (status >= 500) console.error(`[${tag}]`, error);
  return NextResponse.json({ success: false, error: message }, { status });
}
