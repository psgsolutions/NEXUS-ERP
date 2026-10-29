import { headers } from "next/headers";

/**
 * [SERVER-ONLY] ข้อมูลของคำขอที่กำลังทำงาน (IP, เบราว์เซอร์) — ใช้บันทึก audit log โดยไม่ต้องส่ง request ต่อทุกฟังก์ชัน
 * อ่านจาก headers() ของ Next.js (ผูกกับคำขอเอง) · นอกคำขอ (งานระบบ/สคริปต์) คืนค่าว่าง
 */
export interface RequestContext { ip: string; userAgent: string }

/** IP ของผู้เรียก (Vercel ใส่ x-forwarded-for ค่าแรก = ผู้ใช้จริง) */
export function ipFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for") || "";
  return (fwd.split(",")[0].trim() || h.get("x-real-ip") || "").slice(0, 64);
}

export async function requestContext(): Promise<RequestContext | undefined> {
  try {
    const h = await headers();
    return { ip: ipFromHeaders(h), userAgent: (h.get("user-agent") || "").slice(0, 300) };
  } catch {
    return undefined;
  }
}
