import { NextResponse } from "next/server";
import { GoogleGenerativeAI, type ModelParams } from "@google/generative-ai";
import { consumeRateLimit } from "@/lib/rate-limit.server";

/**
 * [SERVER-ONLY] ตัวเรียก Gemini กลางของทุกฟีเจอร์ AI
 *  - รุ่นหลัก: GEMINI_MODEL (ไม่ตั้ง = gemini-3.5-flash) — เปลี่ยนรุ่นที่ env ที่เดียว
 *  - รุ่นสำรองอัตโนมัติ: รุ่นที่ใช้ถูกยกเลิก (404 · key ใหม่ใช้รุ่นเก่าไม่ได้) หรือคนใช้มาก (503/429) → ลองรุ่นถัดไป
 *    (2026-11-22: gemini-2.5-flash ปิดสำหรับผู้ใช้ใหม่ ทำให้ AI ทั้งระบบหยุด)
 *  - timeout ทุกคำขอ (AI ค้าง = แจ้งผู้ใช้ ไม่รอจน Vercel ตัด)
 *  - จำกัดจำนวนครั้งต่อผู้ใช้ (กันค่าใช้จ่ายบานปลาย)
 *  - แปลงข้อผิดพลาดเป็นข้อความไทยที่บอกวิธีแก้
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
/** ลำดับรุ่นสำรอง (ไม่ซ้ำรุ่นหลัก) — ลองไม่เกิน 3 รุ่นต่อคำขอ */
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"];
const modelChain = () => Array.from(new Set([GEMINI_MODEL, ...FALLBACK_MODELS])).slice(0, 3);
/** ข้อผิดพลาดที่ควรลองรุ่นถัดไป: รุ่นไม่มี/ถูกยกเลิก หรือรุ่นนั้นคนใช้มากชั่วคราว (key ผิด = ไม่ลองต่อ) */
const tryNextModel = (e: any) => {
  const m = String(e?.message || e || "");
  return /\b(404|503|429)\b|not found|no longer available|high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(m) && !/API_KEY_INVALID|API key not valid/i.test(m);
};
export const AI_TIMEOUT_MS = 45_000;

/** ข้อผิดพลาดที่รู้สาเหตุแล้ว (ข้อความไทยส่งถึงผู้ใช้ได้ตรง ๆ) */
export class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * โมเดลพร้อม timeout และรุ่นสำรอง — ไม่มี GEMINI_API_KEY โยน AiError 503
 * ใช้เหมือนเดิม: geminiModel(...).generateContent(...) · geminiModel(...).startChat({ history }).sendMessage(...)
 */
export function geminiModel(params: Omit<ModelParams, "model"> = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError(503, "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ — ติดต่อผู้ดูแลระบบ");
  const client = new GoogleGenerativeAI(key);
  type Model = ReturnType<typeof client.getGenerativeModel>;
  const withFallback = async <T,>(run: (m: Model) => Promise<T>): Promise<T> => {
    const started = Date.now();
    let last: any;
    for (const model of modelChain()) {
      // เวลาเหลือไม่พอสำหรับอีกรุ่น (กันคำขอยาวเกินเวลาของเซิร์ฟเวอร์) → แจ้งข้อผิดพลาดล่าสุด
      if (last && Date.now() - started > 25_000) break;
      try {
        return await run(client.getGenerativeModel({ model, ...params }, { timeout: AI_TIMEOUT_MS }));
      } catch (e) {
        last = e;
        if (!tryNextModel(e)) throw e;
        console.warn(`[GEMINI] ${model} ใช้ไม่ได้ (${String((e as any)?.message || e).slice(0, 120)}) → ลองรุ่นถัดไป`);
      }
    }
    throw last;
  };
  return {
    generateContent: (req: Parameters<Model["generateContent"]>[0]) => withFallback((m) => m.generateContent(req)),
    startChat: (opts?: Parameters<Model["startChat"]>[0]) => ({
      sendMessage: (msg: Parameters<ReturnType<Model["startChat"]>["sendMessage"]>[0]) => withFallback((m) => m.startChat(opts).sendMessage(msg)),
    }),
  };
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
  if (/high demand|overloaded|\b503\b|UNAVAILABLE/i.test(msg)) return { status: 503, message: "บริการ AI มีผู้ใช้มากชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่" };
  if (/\b404\b|not found|is not supported|no longer available/i.test(msg)) return { status: 502, message: `รุ่น AI (${GEMINI_MODEL}) และรุ่นสำรองไม่พร้อมใช้งาน — ติดต่อผู้ดูแลระบบให้ตั้ง GEMINI_MODEL` };
  if (/SAFETY|blocked/i.test(msg)) return { status: 422, message: "AI ไม่ตอบคำขอนี้ (ถูกตัวกรองความปลอดภัย) กรุณาปรับข้อความหรือไฟล์" };
  return { status: 502, message: "AI ตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
}

/** คำตอบ JSON เมื่อเรียก AI ไม่สำเร็จ (บันทึก error ฝั่ง server ไว้ตรวจ) */
export function aiErrorResponse(error: any, tag: string) {
  const { status, message } = aiErrorInfo(error);
  if (status >= 500) console.error(`[${tag}]`, error);
  return NextResponse.json({ success: false, error: message }, { status });
}
