import { NextResponse } from "next/server";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { canAny } from "@/lib/permissions";
import { DOCUMENT_TYPES } from "@/lib/documents/adapters.server";
import { renderDocumentPdf, pdfFileName } from "@/lib/documents/render.server";
import { createShare, listSends, listShares, logSend, publicOrigin, revokeShare, shareUrl, SHARE_DAYS_MAX } from "@/lib/documents/share.server";
import { mailConfigured, parseEmails, sendDocumentEmail } from "@/lib/mailer.server";
import { consumeRateLimit } from "@/lib/rate-limit.server";
import { auditServer } from "@/services/audit.server";

export const runtime = "nodejs";

/**
 * [API-SERVER] แชร์และส่งเอกสาร (ลิงก์ให้ลูกค้าเปิดดู / อีเมล / LINE)
 * POST /api/documents/share
 *  - { action: "status", type, id }                     ลิงก์ที่มี + ประวัติการส่ง + ระบบอีเมลพร้อมหรือไม่
 *  - { action: "link", type, id, days?, channel? }      สร้าง (หรือใช้ลิงก์เดิมที่ยังไม่หมดอายุ) channel: "link" | "line"
 *  - { action: "email", type, id, to, cc?, subject, message, attachPdf? }
 *  - { action: "revoke", type, id, token }              ยกเลิกลิงก์ (ลิงก์ที่ส่งไปแล้วเปิดไม่ได้อีก)
 * สิทธิ์: เปิดเอกสารประเภทนั้นได้ / เอกสารภายใน (ใบสำคัญบัญชี ใบขอซื้อ ใบรับสินค้า) ส่งออกภายนอกไม่ได้
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    const type = str(body.type, 40);
    const id = str(body.id, 160);
    const def = DOCUMENT_TYPES[type];
    if (!def || !id || id.includes("/")) throw new ApiAuthError(400, "ไม่พบเอกสาร");
    if (!canAny(apiUser.roles, ([] as any[]).concat(def.permission))) throw new ApiAuthError(403, `ไม่มีสิทธิ์เปิด${def.label}`);
    const action = str(body.action, 20);
    const origin = publicOrigin(request);

    if (action === "status") {
      const [shares, sends] = await Promise.all([listShares(companyId, type, id), listSends(companyId, type, id)]);
      return NextResponse.json({
        success: true, internal: !!def.internal, emailReady: mailConfigured(),
        shares: shares.map((s) => ({ token: s.token, url: shareUrl(origin, s.token), expiresAt: s.expiresAt.toMillis(), revoked: s.revoked, views: s.views || 0, lastViewedAt: s.lastViewedAt?.toMillis?.() || null })),
        sends: sends.map((s) => ({ channel: s.channel, to: s.to || "", status: s.status, error: s.error || "", byName: s.byName || "", at: s.at?.toMillis?.() || null })),
      });
    }

    if (def.internal) throw new ApiAuthError(400, `${def.label}เป็นเอกสารภายใน ส่งให้บุคคลภายนอกไม่ได้`);
    const byName = apiUser.email || apiUser.uid;

    if (action === "revoke") {
      const token = str(body.token, 64);
      const s = await revokeShare(companyId, token, apiUser.uid);
      if (!s || s.type !== type || s.id !== id) throw new ApiAuthError(404, "ไม่พบลิงก์");
      await auditServer.logUpdate(apiUser.uid, companyId, "DOCUMENT_SHARE", `${type}/${id}`, null, { revoked: token.slice(0, 6) });
      return NextResponse.json({ success: true });
    }

    // เอกสารต้องมีอยู่จริงและเปิดได้ก่อนส่ง
    const doc = await def.load(companyId, id);

    if (action === "link") {
      const channel = body.channel === "line" ? "line" : "link";
      const days = Math.min(SHARE_DAYS_MAX, Math.max(1, Number(body.days) || 30));
      const share = await createShare({ companyId, type, id, number: doc.number, title: doc.title, uid: apiUser.uid, days, reuse: !body.renew });
      const url = shareUrl(origin, share.token);
      await logSend(companyId, { type, id, number: doc.number, channel, token: share.token, status: "created", uid: apiUser.uid, byName });
      return NextResponse.json({ success: true, url, token: share.token, expiresAt: share.expiresAt.toMillis(), title: doc.title, number: doc.number, sellerName: doc.seller.name });
    }

    if (action === "email") {
      if (!mailConfigured()) throw new ApiAuthError(503, "ยังไม่ได้ตั้งค่าอีเมลของระบบ (SMTP_USER / SMTP_PASS) กรุณาติดต่อผู้ดูแลระบบ");
      const to = parseEmails(body.to, 5);
      const cc = parseEmails(body.cc, 5);
      if (!to || !to.length) throw new ApiAuthError(400, "อีเมลผู้รับไม่ถูกต้อง (สูงสุด 5 รายชื่อ)");
      if (!cc) throw new ApiAuthError(400, "อีเมลสำเนา (CC) ไม่ถูกต้อง");
      const limit = await consumeRateLimit([
        { scope: "mail_user_h", key: apiUser.uid, limit: 30, windowSec: 3600 },
        { scope: "mail_co_d", key: companyId, limit: 300, windowSec: 86400 },
      ]);
      if (!limit.ok) throw new ApiAuthError(429, `ส่งอีเมลเกินจำนวนที่กำหนด กรุณาลองใหม่ในอีก ${Math.ceil(limit.retryAfterSec / 60)} นาที`);
      const share = await createShare({ companyId, type, id, number: doc.number, title: doc.title, uid: apiUser.uid });
      const url = shareUrl(origin, share.token);
      const subject = str(body.subject, 200) || `${doc.title} เลขที่ ${doc.number} จาก ${doc.seller.name}`;
      const message = str(body.message, 3000) || `เรียน ลูกค้า\n\nขอส่ง${doc.title} เลขที่ ${doc.number} ตามรายละเอียดในลิงก์ด้านล่าง`;
      try {
        const pdf = body.attachPdf === false ? undefined : { filename: pdfFileName(doc, "original"), content: await renderDocumentPdf(doc, "original", origin) };
        await sendDocumentEmail({ to, cc, subject, message, senderName: doc.seller.name, replyTo: doc.seller.email, docTitle: doc.title, docNumber: doc.number, link: url, pdf });
      } catch (err: any) {
        console.error("[DOCUMENT_EMAIL]", err?.code || err?.message);
        const reason = err?.code === "EAUTH" ? "เข้าสู่ระบบอีเมลไม่สำเร็จ (ตรวจ App Password)" : "เซิร์ฟเวอร์อีเมลไม่ตอบรับ";
        await logSend(companyId, { type, id, number: doc.number, channel: "email", to: to.join(", "), token: share.token, status: "failed", error: reason, uid: apiUser.uid, byName });
        throw new ApiAuthError(502, `ส่งอีเมลไม่สำเร็จ: ${reason}`);
      }
      await logSend(companyId, { type, id, number: doc.number, channel: "email", to: [...to, ...cc].join(", "), token: share.token, status: "sent", uid: apiUser.uid, byName });
      return NextResponse.json({ success: true, url, to });
    }

    throw new ApiAuthError(400, "ไม่รู้จักคำสั่ง");
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DOCUMENT_SHARE]", err);
    return NextResponse.json({ success: false, error: "ทำรายการไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
