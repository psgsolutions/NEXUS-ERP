import { NextResponse } from "next/server";
import { DOCUMENT_TYPES } from "@/lib/documents/adapters.server";
import { renderDocumentPdf, pdfFileName } from "@/lib/documents/render.server";
import { withSigning } from "@/lib/documents/esign.server";
import { markViewed, resolveShare } from "@/lib/documents/share.server";
import { thaiDate } from "@/lib/documents/format";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit.server";

export const runtime = "nodejs";

/**
 * [API-PUBLIC] เปิดเอกสารจากลิงก์ที่ส่งให้ลูกค้า (ไม่ต้องล็อกอิน)
 * GET /api/public/documents/{token}                 ข้อมูลหัวเอกสาร (หน้า /d/{token})
 * GET /api/public/documents/{token}?pdf=1[&download=1][&copy=1]   ไฟล์ PDF
 * - สร้าง PDF จากข้อมูลที่บันทึก ณ ขณะเปิด (เอกสารที่ถูกยกเลิกจะมีลายน้ำ "ยกเลิก")
 * - จำกัดจำนวนครั้งต่อ IP และต่อลิงก์ กันการดึงข้อมูลจำนวนมาก
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const ip = clientIp(request);
    const limit = await consumeRateLimit([
      { scope: "share_ip_m", key: ip, limit: 60, windowSec: 600 },
      { scope: "share_tok_d", key: token.slice(0, 64), limit: 300, windowSec: 86400 },
    ]);
    if (!limit.ok) return NextResponse.json({ success: false, error: "เปิดเอกสารบ่อยเกินไป กรุณารอสักครู่" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });

    const r = await resolveShare(token);
    if (!r.ok) return NextResponse.json({ success: false, error: r.reason }, { status: 404 });
    const { share } = r;
    const def = DOCUMENT_TYPES[share.type];
    if (!def || def.internal) return NextResponse.json({ success: false, error: "ไม่พบเอกสาร" }, { status: 404 });
    const doc = await withSigning(share.companyId, await def.load(share.companyId, share.id));
    const url = new URL(request.url);

    if (url.searchParams.get("pdf")) {
      const copy = url.searchParams.get("copy") ? "copy" : "original";
      const pdf = await renderDocumentPdf(doc, copy, url.origin);
      if (!url.searchParams.get("download")) await markViewed(token);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename="${encodeURIComponent(pdfFileName(doc, copy))}"`,
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex",
        },
      });
    }

    const grand = doc.totals.find((t) => t.strong);
    return NextResponse.json({
      success: true,
      document: {
        title: doc.title, number: doc.number, date: doc.date ? thaiDate(doc.date) : "-",
        seller: { name: doc.seller.name, phone: doc.seller.phone || "", email: doc.seller.email || "", logo: doc.seller.logo || "", brandColor: doc.seller.brandColor || "" },
        partyName: doc.party?.name || "", total: grand ? grand.amount : null, totalLabel: grand?.label || "",
        cancelled: doc.watermark === "ยกเลิก", formCopies: !!doc.wht50,
        expiresAt: share.expiresAt.toMillis(),
      },
    }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
  } catch (err: any) {
    console.error("[PUBLIC_DOCUMENT]", err?.message);
    return NextResponse.json({ success: false, error: "เปิดเอกสารไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
