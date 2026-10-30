import { describe, expect, it } from "vitest";
import { AiError, aiErrorInfo, parseAiJson } from "@/lib/gemini.server";

describe("AI error handling (C-06)", () => {
  it("parses JSON answers with or without code fences", () => {
    expect(parseAiJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseAiJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it("turns a malformed answer into a Thai retry message", () => {
    expect(() => parseAiJson("ขออภัย ไม่สามารถอ่านได้")).toThrow(AiError);
    expect(aiErrorInfo((() => { try { parseAiJson("x"); } catch (e) { return e; } })())).toMatchObject({ status: 502 });
  });

  it("maps provider errors to Thai messages that say what to do", () => {
    expect(aiErrorInfo(new Error("[429 Too Many Requests] RESOURCE_EXHAUSTED quota"))).toMatchObject({ status: 429, message: expect.stringContaining("โควตา") });
    expect(aiErrorInfo(new Error("Request aborted: timeout"))).toMatchObject({ status: 504, message: expect.stringContaining("นานเกินไป") });
    expect(aiErrorInfo(new Error("API key not valid. Please pass a valid API key. API_KEY_INVALID"))).toMatchObject({ status: 503, message: expect.stringContaining("GEMINI_API_KEY") });
    expect(aiErrorInfo(new Error("[404 Not Found] models/gemini-1.5-flash is not found"))).toMatchObject({ status: 502, message: expect.stringContaining("GEMINI_MODEL") });
    expect(aiErrorInfo(new Error("Candidate was blocked due to SAFETY"))).toMatchObject({ status: 422 });
    expect(aiErrorInfo(new Error("socket hang up"))).toMatchObject({ status: 502, message: "AI ตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
  });

  it("keeps known errors as they are", () => {
    expect(aiErrorInfo(new AiError(413, "ไฟล์ใหญ่เกิน 10 MB กรุณาลดขนาดไฟล์"))).toEqual({ status: 413, message: "ไฟล์ใหญ่เกิน 10 MB กรุณาลดขนาดไฟล์" });
  });
});
