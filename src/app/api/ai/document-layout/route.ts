import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";
import { DESIGNABLE_DOCS } from "@/lib/documents/build";
import { normalizeFreeLayout, pageOf } from "@/lib/documents/design";

export const maxDuration = 60;

/**
 * [API-SERVER] ให้ AI อ่านตัวอย่างเอกสาร (รูป/หน้าแรกของ PDF) แล้วแปลงเป็นผังลากวางที่แก้ได้ทุกชิ้น
 * Endpoint: POST /api/ai/document-layout
 * body: { companyId, docType, image (data URL PNG/JPEG), landscape? }
 * คืน { layout } — ข้อความคงที่ = กล่องข้อความ · ข้อมูลที่เปลี่ยนตามเอกสาร = ช่องข้อมูลที่ดึงจากระบบ
 * กรอบ/เส้น/แถบสี/ตารางรายการ/ยอดรวม/ช่องลงนาม แยกเป็นกล่อง · ผ่าน normalizeFreeLayout (กล่องที่กฎหมายบังคับเติมให้ครบ)
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const str = (v: any, max: number) => String(v ?? "").slice(0, max);

const SELLER_KEYS = ["seller.name", "seller.nameEn", "seller.address", "seller.taxId", "seller.contact"];
const CUSTOMER_KEYS = ["customer.name", "customer.address", "customer.taxId", "customer.contact", "customer.phone", "customer.email"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!can(apiUser.roles, "settings:manage")) throw new ApiAuthError(403, "ออกแบบเอกสารได้เฉพาะผู้ดูแลระบบ");
    if (!genAI) throw new ApiAuthError(503, "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์");

    const def = DESIGNABLE_DOCS.find((d) => d.type === str(body.docType, 40));
    if (!def) throw new ApiAuthError(400, "ไม่รู้จักชนิดเอกสาร");
    const m = str(body.image, 6_000_000).match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new ApiAuthError(400, "แนบรูปตัวอย่างเอกสาร (PNG/JPG) หรือ PDF");
    const landscape = !!body.landscape;
    const page = pageOf({ landscape });

    const keys = [
      "number", "date", "title", "titleEn",
      ...def.meta.map((l) => `m:${l}`), ...(def.fields || []).map((f) => `f:${f.key}`),
      ...SELLER_KEYS, ...CUSTOMER_KEYS,
    ];
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      systemInstruction: [
        `คุณคือผู้เชี่ยวชาญจัดหน้าเอกสารธุรกิจไทย อ่านรูปตัวอย่าง "${def.title}" แล้วสร้างผังหน้าเอกสารให้เหมือนต้นฉบับมากที่สุด`,
        `หน่วยเป็น pt บนกระดาษ ${landscape ? "แนวนอน" : "แนวตั้ง"} กว้าง ${Math.round(page.w)} สูง ${Math.round(page.h)} (มุมซ้ายบน = 0,0) — วัดตำแหน่ง/ขนาดจากรูปตามสัดส่วน`,
        "ตอบเป็น JSON object: {\"blocks\":[...]} เท่านั้น แต่ละกล่องมี kind x y w h และค่าเพิ่มตามชนิด:",
        '- "text": ข้อความที่พิมพ์คงที่ทุกฉบับ (หัวข้อ ป้าย เช่น "วันที่", หมายเหตุคงที่) {text, fontSize 6-28, bold, align:"left|center|right", color "#RRGGBB"}',
        `- "field": ข้อมูลที่เปลี่ยนตามแต่ละเอกสาร (ค่าจริง) {field: หนึ่งใน ${JSON.stringify(keys)}, hideLabel: ค่าเริ่มต้น true (แสดงเฉพาะค่า — ป้ายที่เห็นในตัวอย่างให้สร้างเป็น text แยก), fontSize, bold, align}`,
        "- ห้ามสร้างป้ายซ้ำ: ถ้ามี text \"วันที่\" แล้ว field date ต้อง hideLabel:true",
        '- "rect": กรอบหรือแถบสี {border "#RRGGBB" หรือไม่ใส่, bg "#RRGGBB" หรือไม่ใส่, borderWidth, radius}',
        '- "line": เส้นตรง (แนวนอน h ≈ ความหนา, แนวตั้ง w ≈ ความหนา) {color}',
        '- "items": พื้นที่ตารางรายการสินค้า/บริการทั้งตาราง (หัวตาราง+แถว) {cols: เลือกจาก ["no","code","description","qty","unit","price","discount","amount"] ตามที่เห็นในตัวอย่าง}',
        '- "totals": ยอดรวม (รวมเป็นเงิน ภาษี รวมทั้งสิ้น) ทั้งชุด · "words": จำนวนเงินตัวอักษร · "signatures": แถวช่องลงนามทั้งหมด · "notes": หมายเหตุ · "payment": ข้อมูลบัญชีธนาคาร',
        '- "logo": ตำแหน่งโลโก้บริษัท',
        "ข้อมูลผู้ขาย/ลูกค้า/เลขที่/วันที่ ให้ใช้ field (ไม่ใช่ text) เพื่อดึงข้อมูลจริง · ห้ามคัดลอกตัวเลขหรือชื่อในตัวอย่างเป็น text",
        "อย่าใส่กล่องซ้อนกันโดยไม่จำเป็น เรียงจากบนลงล่าง ไม่เกิน 60 กล่อง",
      ].join("\n"),
    });
    const result = await model.generateContent([`แปลงเอกสารตัวอย่างนี้เป็นผัง ${def.title}`, { inlineData: { mimeType: m[1], data: m[2] } }]);
    let parsed: any;
    try { parsed = JSON.parse(result.response.text().trim().replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error("invalid AI json"); }
    const blocks = (Array.isArray(parsed?.blocks) ? parsed.blocks : []).slice(0, 60).map((b: any, i: number) => ({
      ...b, id: `ai-${String(b?.kind || "x")}-${i}`,
      // ช่องข้อมูล: แสดงเฉพาะค่าเป็นค่าเริ่มต้น (ป้ายในตัวอย่างเป็นกล่องข้อความแยก) — ไม่ให้ป้ายซ้ำ
      ...(b?.kind === "field" ? { hideLabel: b.hideLabel !== false } : {}),
      // ตารางรายการ: คอลัมน์ที่ AI เห็น (ต้องมีรายการและจำนวนเงิน)
      ...(b?.kind === "items" && Array.isArray(b.cols) ? { cols: b.cols } : {}),
    }));
    const layout = normalizeFreeLayout({ enabled: true, blocks, ...(landscape ? { landscape: true } : {}) }, def.type);
    if (!layout || layout.blocks.length < 3) throw new Error("AI อ่านผังไม่ได้");
    return NextResponse.json({ success: true, layout, model: MODEL });
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    if (String(error?.message || "").includes("API_KEY_INVALID")) return NextResponse.json({ success: false, error: "GEMINI_API_KEY บนเซิร์ฟเวอร์ไม่ถูกต้อง" }, { status: 503 });
    console.error("[AI_DOCUMENT_LAYOUT_ERROR]:", error?.message || error);
    return NextResponse.json({ success: false, error: "AI แปลงตัวอย่างเป็นต้นแบบไม่สำเร็จ ลองใหม่ หรือใช้รูปที่ชัดขึ้น" }, { status: 500 });
  }
}
