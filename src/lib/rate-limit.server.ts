import { createHash } from "node:crypto";
import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * จำกัดจำนวนครั้งแบบหน้าต่างเวลาคงที่ เก็บใน root `rate_limits` (client อ่าน/เขียนไม่ได้)
 * ใช้กับ endpoint สาธารณะที่ไม่ต้องล็อกอิน เช่น พอร์ทัลแจ้งซ่อมของลูกค้า
 * ทำงานได้ข้าม instance ของ serverless เพราะนับในฐานข้อมูล
 */
export interface RateLimitRule { scope: string; key: string; limit: number; windowSec: number }

/** ที่อยู่ IP ของผู้เรียก (Vercel ใส่ x-forwarded-for) — เก็บเฉพาะค่า hash */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

export const hashKey = (value: string) =>
  createHash("sha256").update(`${process.env.RATE_LIMIT_SALT || "nexus-rl"}:${value}`).digest("hex").slice(0, 32);

/** คืน true ถ้ายังไม่เกิน (และนับเพิ่มให้ทุกกฎ) / false ถ้ากฎใดกฎหนึ่งเกินแล้ว (ไม่นับเพิ่ม) */
export async function consumeRateLimit(rules: RateLimitRule[]): Promise<{ ok: boolean; retryAfterSec: number }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const refs = rules.map((r) => {
    const bucket = Math.floor(nowSec / r.windowSec);
    return { r, bucket, ref: adminDb.doc(`rate_limits/${r.scope}_${hashKey(r.key)}_${bucket}`) };
  });
  return adminDb.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((x) => tx.get(x.ref)));
    for (let i = 0; i < refs.length; i++) {
      const count = Number(snaps[i].data()?.count || 0);
      if (count >= refs[i].r.limit) return { ok: false, retryAfterSec: (refs[i].bucket + 1) * refs[i].r.windowSec - nowSec };
    }
    refs.forEach((x, i) => {
      const expiresAt = admin.firestore.Timestamp.fromMillis((x.bucket + 2) * x.r.windowSec * 1000);
      if (snaps[i].exists) tx.update(x.ref, { count: admin.firestore.FieldValue.increment(1) });
      else tx.set(x.ref, { scope: x.r.scope, count: 1, expiresAt });
    });
    return { ok: true, retryAfterSec: 0 };
  });
}
