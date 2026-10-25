import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { canAny } from "@/lib/permissions";
import { lineContent, lineReady, lineReply, verifyLineSignature } from "@/lib/line.server";
import { analyzeInbox } from "@/lib/expense-ai.server";
import { ATTACHMENT_MAX } from "@/lib/attachments";
import { INBOX_DOC_TYPES, needsSubstitute } from "@/lib/expense-inbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * [WEBHOOK] LINE Official Account — POST /api/line/webhook (LINE เรียก ตรวจลายเซ็นทุกครั้ง)
 *  - พิมพ์ "เชื่อม 123456" = ผูกบัญชี LINE กับผู้ใช้ในระบบ (รหัสจากหน้า ถ่ายบิลเบิกเงิน)
 *  - ส่งรูปบิล/ใบเสร็จ = เข้ากล่องรูปบิลรอยืนยัน → AI อ่าน → ตอบสรุปกลับ (ยังไม่เป็นรายจ่ายจนฝ่ายบัญชียืนยัน)
 */
const CLAIM_ROLES = ["finance:edit", "projects:edit", "inventory:edit", "sales:edit", "hr:edit", "service:field"] as any[];
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** รูปจาก LINE: ย่อด้วย sharp ให้พอดีที่เก็บ (ด้านยาว 1600px JPEG) */
async function shrink(buf: Buffer): Promise<string> {
  const sharp = (await import("sharp")).default;
  for (const [max, q] of [[1600, 80], [1300, 70], [1000, 60]] as const) {
    const out = await sharp(buf).rotate().resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).jpeg({ quality: q }).toBuffer();
    const data = `data:image/jpeg;base64,${out.toString("base64")}`;
    if (data.length <= ATTACHMENT_MAX) return data;
  }
  throw new Error("รูปใหญ่เกินไป");
}

async function handleImage(ev: any, link: { uid: string; companyId: string }, origin: string) {
  const user = (await adminDb.doc(`users/${link.uid}`).get()).data();
  if (!user || user.companyId !== link.companyId || String(user.status || "ACTIVE").toUpperCase() !== "ACTIVE") return lineReply(ev.replyToken, "บัญชีผู้ใช้นี้ใช้งานไม่ได้แล้ว — ติดต่อผู้ดูแลระบบ");
  const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean);
  if (!canAny(roles, CLAIM_ROLES)) return lineReply(ev.replyToken, "บัญชีนี้ไม่มีสิทธิ์ส่งบิลเบิกค่าใช้จ่าย");
  const { buf } = await lineContent(ev.message.id);
  const data = await shrink(buf);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const name = String(user.name || user.displayName || user.email || link.uid).slice(0, 80);
  const ref = await adminDb.collection(`companies/${link.companyId}/photo_inbox`).add({ companyId: link.companyId, status: "DRAFT", source: "line", createdBy: link.uid, createdByName: name, createdAt: now, updatedAt: now });
  await adminDb.collection(`companies/${link.companyId}/attachments`).add({ ownerType: "photo_inbox", ownerId: ref.id, name: `LINE-${ev.message.id}.jpg`, mime: "image/jpeg", size: Math.round(data.length * 0.74), data, companyId: link.companyId, uploadedBy: link.uid, uploadedByName: name, createdAt: now });
  const { data: d, error } = await analyzeInbox(link.companyId, ref.id);
  const url = `${origin}/finance/expense-claims/photos`;
  if (error || !(d.total > 0)) return lineReply(ev.replyToken, `รับรูปบิลแล้ว แต่ AI อ่านยอดเงินไม่ได้ — เปิดตรวจ/กรอกเองที่\n${url}`);
  return lineReply(ev.replyToken, [
    `รับบิลแล้ว ✓`, `${d.vendorName || "ร้านค้า"} · ${money(d.total)} บาท`, `${INBOX_DOC_TYPES[d.docType]}${needsSubstitute(d) ? " → ออกใบรับรองแทนใบเสร็จให้" : ""}`,
    `สถานะ: รอฝ่ายบัญชียืนยัน (ยังไม่เป็นรายจ่าย)`, `ตรวจ/แก้ข้อมูล: ${url}`,
  ].join("\n"));
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!lineReady() || !verifyLineSignature(raw, request.headers.get("x-line-signature"))) return NextResponse.json({ success: false }, { status: 401 });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ success: false }, { status: 400 }); }
  for (const ev of Array.isArray(body.events) ? body.events : []) {
    try {
      const lineUserId = String(ev?.source?.userId || "");
      if (!lineUserId || ev?.source?.type !== "user") continue;
      if (ev.type === "follow") { await lineReply(ev.replyToken, "สวัสดีครับ — เปิดเมนู \"ถ่ายบิลเบิกเงิน\" ในระบบ กด \"ส่งรูปผ่าน LINE\" แล้วพิมพ์ เชื่อม <รหัส> ที่นี่ จากนั้นส่งรูปบิลได้เลย"); continue; }
      if (ev.type !== "message") continue;
      const m = ev.message || {};
      if (m.type === "text") {
        const code = String(m.text || "").replace(/\s+/g, " ").trim().match(/^เชื่อม\s*(\d{6})$/)?.[1];
        if (!code) { await lineReply(ev.replyToken, "ส่งรูปบิล/ใบเสร็จได้เลย ระบบจะอ่านและส่งให้ฝ่ายบัญชียืนยัน · ถ้ายังไม่ได้เชื่อมบัญชี พิมพ์ เชื่อม <รหัส 6 หลัก>"); continue; }
        const ref = adminDb.doc(`line_links/${code}`);
        const snap = await ref.get();
        const l = snap.data();
        if (!l || l.expiresAt?.toDate?.() < new Date()) { await lineReply(ev.replyToken, "รหัสไม่ถูกต้องหรือหมดอายุ — ขอรหัสใหม่ในระบบ"); continue; }
        await adminDb.doc(`line_users/${lineUserId}`).set({ uid: l.uid, companyId: l.companyId, linkedAt: admin.firestore.FieldValue.serverTimestamp() });
        await ref.delete();
        await lineReply(ev.replyToken, "เชื่อมบัญชีเรียบร้อย ✓ ส่งรูปบิล/ใบเสร็จในแชตนี้ได้เลย");
        continue;
      }
      if (m.type === "image") {
        const link = (await adminDb.doc(`line_users/${lineUserId}`).get()).data() as { uid: string; companyId: string } | undefined;
        if (!link) { await lineReply(ev.replyToken, "ยังไม่ได้เชื่อมบัญชี — ในระบบเปิด \"ถ่ายบิลเบิกเงิน\" กด \"ส่งรูปผ่าน LINE\" แล้วพิมพ์ เชื่อม <รหัส> ที่นี่"); continue; }
        await handleImage(ev, link, origin);
      }
    } catch (e: any) {
      console.error("[LINE_WEBHOOK]", e);
      await lineReply(ev?.replyToken, `รับรูปไม่สำเร็จ: ${String(e?.message || e).slice(0, 120)} — ลองส่งใหม่ หรืออัปโหลดในระบบ`);
    }
  }
  return NextResponse.json({ success: true });
}
