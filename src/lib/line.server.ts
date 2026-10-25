import crypto from "node:crypto";

/**
 * LINE Official Account (Messaging API) — รับรูปบิลจากแชตเข้ากล่องรูปบิลรอยืนยัน
 * ตั้งค่า (Vercel › Environment Variables):
 *   LINE_CHANNEL_SECRET        Channel secret (ตรวจลายเซ็น webhook)
 *   LINE_CHANNEL_ACCESS_TOKEN  Channel access token (long-lived) สำหรับดึงรูปและตอบกลับ
 *   LINE_BOT_NAME              (ไม่บังคับ) ชื่อ/ไอดี LINE OA ที่แสดงในหน้าจอ เช่น @nexuserp
 * Webhook URL ใน LINE Developers: https://<โดเมน>/api/line/webhook (เปิด Use webhook)
 */
export const lineReady = () => !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);

/** ตรวจลายเซ็น X-Line-Signature (HMAC-SHA256 ของ body ดิบ, base64) */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !process.env.LINE_CHANNEL_SECRET) return false;
  const expected = crypto.createHmac("sha256", process.env.LINE_CHANNEL_SECRET).update(rawBody).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const auth = () => ({ Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` });

export async function lineReply(replyToken: string, text: string) {
  if (!replyToken || !lineReady()) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  }).catch(() => undefined);
}

/** เนื้อรูปที่ผู้ใช้ส่งในแชต */
export async function lineContent(messageId: string): Promise<{ mime: string; buf: Buffer }> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, { headers: auth() });
  if (!res.ok) throw new Error(`ดึงรูปจาก LINE ไม่สำเร็จ (${res.status})`);
  return { mime: res.headers.get("content-type") || "image/jpeg", buf: Buffer.from(await res.arrayBuffer()) };
}
