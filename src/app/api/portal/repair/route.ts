import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { clientIp, consumeRateLimit, hashKey } from "@/lib/rate-limit.server";

/**
 * [API-PUBLIC] พอร์ทัลแจ้งซ่อมของลูกค้า (ไม่ต้องล็อกอิน)
 *  - GET  /api/portal/repair?company=ID   ตรวจลิงก์ และคืนชื่อบริษัทสำหรับหัวหน้าพอร์ทัล
 *  - POST /api/portal/repair              { company, phoneNumber, customerName?, serialNumber?, symptom, photo?, website? }
 * คำขอเข้ากล่อง `companies/{id}/portal_requests` (สถานะ NEW) ให้เจ้าหน้าที่กด "รับเรื่อง" ที่หน้างานบริการ
 * ซึ่งจะออกเลขใบแจ้งซ่อม (TK) ผ่าน /api/service/tickets — คำขอจากภายนอกจึงไม่ใช้เลขเอกสารของบริษัท
 * กันสแปม: จำกัดต่อ IP 5 ครั้ง/ชม. และ 20 ครั้ง/วัน, ต่อบริษัท 200 ครั้ง/วัน, ช่อง website ซ่อน (honeypot)
 */

const str = (v: any, max: number) => String(v ?? "").trim().slice(0, max);
const MAX_PHOTO_CHARS = 700_000; // data URL หลังย่อรูปฝั่งเครื่องลูกค้า (~500 KB)
const COMPANY_ID = /^[A-Za-z0-9_-]{1,80}$/;

async function portalCompany(companyId: string) {
  if (!COMPANY_ID.test(companyId)) return null;
  const snap = await adminDb.doc(`companies/${companyId}`).get();
  if (!snap.exists) return null;
  const c = snap.data() as any;
  if (c.isDeleted === true || c.portalEnabled === false) return null;
  return { name: String(c.name || c.companyName || ""), phone: String(c.phone || "") };
}

const fail = (status: number, error: string, headers?: Record<string, string>) => NextResponse.json({ success: false, error }, { status, headers });

export async function GET(request: Request) {
  try {
    const companyId = str(new URL(request.url).searchParams.get("company"), 80);
    const company = await portalCompany(companyId);
    if (!company) return fail(404, "ลิงก์แจ้งซ่อมไม่ถูกต้อง กรุณาติดต่อร้านค้าเพื่อขอลิงก์ใหม่");
    return NextResponse.json({ success: true, company });
  } catch (err: any) {
    console.error("[PORTAL_REPAIR_GET]", err);
    return fail(500, "ระบบขัดข้อง กรุณาลองใหม่ภายหลัง");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    // honeypot: คนกรอกไม่เห็นช่องนี้ บอทมักกรอก — ตอบสำเร็จแต่ไม่บันทึก
    if (str(body.website, 200)) return NextResponse.json({ success: true });

    const companyId = str(body.company, 80);
    const phoneNumber = str(body.phoneNumber, 20).replace(/[^\d+]/g, "");
    const symptom = str(body.symptom, 2000);
    if (!/^\+?\d{9,12}$/.test(phoneNumber)) return fail(400, "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง");
    if (symptom.length < 3) return fail(400, "กรุณาอธิบายอาการที่พบ");
    const photo = typeof body.photo === "string" ? body.photo : "";
    if (photo && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > MAX_PHOTO_CHARS)) {
      return fail(400, "ไฟล์รูปไม่ถูกต้องหรือใหญ่เกินไป");
    }

    const company = await portalCompany(companyId);
    if (!company) return fail(404, "ลิงก์แจ้งซ่อมไม่ถูกต้อง กรุณาติดต่อร้านค้าเพื่อขอลิงก์ใหม่");

    const ip = clientIp(request);
    const limit = await consumeRateLimit([
      { scope: "portal_ip_h", key: ip, limit: 5, windowSec: 3600 },
      { scope: "portal_ip_d", key: ip, limit: 20, windowSec: 86400 },
      { scope: "portal_co_d", key: companyId, limit: 200, windowSec: 86400 },
    ]);
    if (!limit.ok) {
      return fail(429, "ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง หรือโทรติดต่อร้านค้าโดยตรง", { "Retry-After": String(limit.retryAfterSec) });
    }

    const ref = adminDb.collection(`companies/${companyId}/portal_requests`).doc();
    await ref.set({
      companyId,
      phoneNumber,
      customerName: str(body.customerName, 120),
      serialNumber: str(body.serialNumber, 80).toUpperCase(),
      symptom,
      photo,
      hasPhoto: !!photo,
      status: "NEW",
      source: "CUSTOMER_PORTAL",
      ipHash: hashKey(ip),
      userAgent: str(request.headers.get("user-agent"), 200),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, requestId: ref.id });
  } catch (err: any) {
    console.error("[PORTAL_REPAIR_POST]", err);
    return fail(500, "ระบบขัดข้อง กรุณาลองใหม่ภายหลัง");
  }
}
