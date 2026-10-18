import nodemailer, { type Transporter } from "nodemailer";

/**
 * ส่งอีเมลจากระบบผ่าน SMTP (ค่าเริ่มต้น Gmail)
 * ตั้งค่าใน environment:
 *   SMTP_USER  บัญชีผู้ส่ง เช่น yourcompany@gmail.com
 *   SMTP_PASS  Gmail App Password 16 ตัวอักษร (ไม่ใช่รหัสผ่านปกติ)
 *   SMTP_HOST / SMTP_PORT  (ไม่บังคับ) ค่าเริ่มต้น smtp.gmail.com:465
 * ชื่อผู้ส่งเป็นชื่อบริษัท และตอบกลับ (Reply-To) ไปที่อีเมลบริษัทในหัวเอกสาร
 */

export const mailConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Transporter | null = null;
function transporter() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || "").replace(/\s+/g, "") },
    });
  }
  return transport;
}

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;

/** แยกรายชื่ออีเมล (คั่นด้วย , ; หรือช่องว่าง) ตรวจรูปแบบ ไม่เกิน max รายชื่อ */
export function parseEmails(raw: any, max = 5): string[] | null {
  const list = String(raw ?? "").split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (list.length > max || list.some((e) => !EMAIL_RE.test(e) || e.length > 120)) return null;
  return Array.from(new Set(list));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** ชื่อผู้ส่งต้องไม่มีอักขระที่ทำให้หัวอีเมลเพี้ยน */
const safeName = (s: string) => s.replace(/["\r\n<>]/g, "").slice(0, 120);

export async function sendDocumentEmail(args: {
  to: string[]; cc?: string[]; subject: string; message: string; senderName: string; replyTo?: string;
  docTitle: string; docNumber: string; link: string; pdf?: { filename: string; content: Buffer };
}) {
  const lines = args.message.split(/\r?\n/).map((l) => esc(l)).join("<br>");
  const html = `<div style="font-family:Tahoma,Arial,sans-serif;font-size:14px;color:#222;line-height:1.7">
<p>${lines}</p>
<p style="margin:20px 0"><a href="${esc(args.link)}" style="background:#1f6f5c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">เปิดดู ${esc(args.docTitle)} ${esc(args.docNumber)}</a></p>
<p style="color:#888;font-size:12px">หรือคัดลอกลิงก์: ${esc(args.link)}<br>อีเมลนี้ส่งจากระบบของ ${esc(args.senderName)} หากมีข้อสงสัยกรุณาตอบกลับอีเมลนี้</p>
</div>`;
  const text = `${args.message}\n\nเปิดดู ${args.docTitle} ${args.docNumber}: ${args.link}\n\nอีเมลนี้ส่งจากระบบของ ${args.senderName}`;
  return transporter().sendMail({
    from: { name: safeName(args.senderName) || "NEXUS ERP", address: process.env.SMTP_USER! },
    to: args.to,
    ...(args.cc?.length ? { cc: args.cc } : {}),
    ...(args.replyTo && EMAIL_RE.test(args.replyTo) ? { replyTo: args.replyTo } : {}),
    subject: args.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
    text, html,
    ...(args.pdf ? { attachments: [{ filename: args.pdf.filename, content: args.pdf.content, contentType: "application/pdf" }] } : {}),
  });
}

/** อีเมลแจ้งเตือนภายในบริษัท (สรุปรายการต้องติดตาม) — items แสดงเป็นรายการพร้อมลิงก์ */
export async function sendDigestEmail(args: { to: string[]; subject: string; intro: string; senderName: string; items: { text: string; link?: string }[] }) {
  const list = args.items.map((i) => `<li style="margin:4px 0">${i.link ? `<a href="${esc(i.link)}">${esc(i.text)}</a>` : esc(i.text)}</li>`).join("");
  const html = `<div style="font-family:Tahoma,Arial,sans-serif;font-size:14px;color:#222;line-height:1.7"><p>${esc(args.intro)}</p><ul>${list}</ul><p style="color:#888;font-size:12px">อีเมลอัตโนมัติจากระบบ NEXUS ERP ของ ${esc(args.senderName)}</p></div>`;
  const text = `${args.intro}\n\n${args.items.map((i) => `- ${i.text}${i.link ? ` ${i.link}` : ""}`).join("\n")}`;
  return transporter().sendMail({
    from: { name: safeName(args.senderName) || "NEXUS ERP", address: process.env.SMTP_USER! },
    to: args.to, subject: args.subject.replace(/[\r\n]+/g, " ").slice(0, 200), text, html,
  });
}
