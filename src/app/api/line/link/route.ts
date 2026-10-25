import { NextResponse } from "next/server";
import crypto from "node:crypto";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { lineReady } from "@/lib/line.server";

/**
 * [API-SERVER] เชื่อมบัญชี LINE กับผู้ใช้ — POST /api/line/link
 *  - { companyId, action: "code" }    รหัส 6 หลัก (ใช้ภายใน 10 นาที) ให้พิมพ์ "เชื่อม <รหัส>" ในแชต LINE OA ของบริษัท
 *  - { companyId, action: "status" }  เชื่อมแล้วหรือยัง
 *  - { companyId, action: "unlink" }  ยกเลิกการเชื่อม
 * เก็บที่ line_links / line_users (client อ่าน/เขียนไม่ได้)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "").trim();
    const apiUser = await requireApiUser(request, companyId);
    if (body.action === "status" || body.action === "unlink") {
      const linked = await adminDb.collection("line_users").where("uid", "==", apiUser.uid).limit(5).get();
      if (body.action === "unlink") await Promise.all(linked.docs.map((d) => d.ref.delete()));
      return NextResponse.json({ success: true, linked: body.action === "status" ? !linked.empty : false, ready: lineReady() });
    }
    if (body.action !== "code") throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
    if (!lineReady()) throw new ApiAuthError(400, "ยังไม่ได้เชื่อม LINE Official Account ของบริษัท (ผู้ดูแลระบบตั้งค่า LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN)");
    // รหัสสุ่ม 6 หลัก ไม่ซ้ำกับรหัสที่ยังใช้ได้
    let code = "";
    for (let i = 0; i < 5 && !code; i++) {
      const c = String(crypto.randomInt(100000, 1000000));
      if (!(await adminDb.doc(`line_links/${c}`).get()).exists) code = c;
    }
    if (!code) throw new ApiAuthError(503, "สร้างรหัสไม่สำเร็จ ลองใหม่");
    const expiresAt = new Date(Date.now() + 10 * 60e3);
    await adminDb.doc(`line_links/${code}`).set({ uid: apiUser.uid, companyId, expiresAt, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true, code, expiresAt: expiresAt.toISOString(), botName: process.env.LINE_BOT_NAME || "" });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[LINE_LINK]", err);
    return NextResponse.json({ success: false, error: err.message || "เชื่อม LINE ไม่สำเร็จ" }, { status: 500 });
  }
}
