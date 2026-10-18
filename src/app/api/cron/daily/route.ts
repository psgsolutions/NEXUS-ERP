import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/api-auth";
import { runBillingReminders } from "@/lib/reminders.server";
import { publicOrigin } from "@/lib/documents/share.server";
import { GET as quotationExpiryCheck } from "../quotation-expiry-check/route";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * [CRON] งานประจำวัน (Vercel Cron 08:00 น.) — รวมไว้ใน cron เดียว (แพ็กเกจ Hobby ใช้ cron ได้ 2 รายการ)
 *  1. ใบเสนอราคาใกล้หมดอายุ (/api/cron/quotation-expiry-check)
 *  2. ใบแจ้งหนี้ใกล้ครบ/เลยกำหนด + งวดงานที่ยังไม่เรียกเก็บ (แจ้งเตือนในระบบ + อีเมลสรุปถึงฝ่ายบัญชี)
 * ?company=<id> จำกัดบริษัท (ใช้ทดสอบ) — ต้องมี CRON_SECRET ทุกกรณี
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("today") || "") ? url.searchParams.get("today")! : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const company = url.searchParams.get("company");
  const result: Record<string, any> = { success: true, today };
  try {
    if (!company) {
      const q = await quotationExpiryCheck(request);
      const qj = await q.json().catch(() => ({}));
      result.quotations = { expiringCount: qj.expiringCount ?? null, ok: q.ok };
    }
    result.billing = await runBillingReminders({
      today, origin: publicOrigin(request),
      ...(company ? { companyIds: [company] } : {}),
      sendEmail: url.searchParams.get("email") !== "0",
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[CRON_DAILY]", error);
    return NextResponse.json({ success: false, error: "งานประจำวันไม่สำเร็จ", partial: result }, { status: 500 });
  }
}
