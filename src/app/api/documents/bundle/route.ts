import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { zipSync } from "fflate";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can, canAny } from "@/lib/permissions";
import { DOCUMENT_TYPES } from "@/lib/documents/adapters.server";
import { withSigning } from "@/lib/documents/esign.server";
import { renderDocumentPdf, pdfFileName } from "@/lib/documents/render.server";
import { documentProfileOf } from "@/lib/documents/profile";
import { mailConfigured, parseEmails, sendBundleEmail } from "@/lib/mailer.server";
import { auditServer } from "@/services/audit.server";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * [API-SERVER] ชุดเอกสาร (หลายไฟล์) — POST /api/documents/bundle
 *  - { companyId, action: "config" }                                  สำนักบัญชีที่ตั้งไว้ { name, email, cc }
 *  - { companyId, action: "saveConfig", office: { name, email, cc } }  ตั้งสำนักบัญชี (ฝ่ายบัญชี)
 *  - { companyId, action: "zip", items: [{ type, id }], title? }      ดาวน์โหลด ZIP (PDF ทุกฉบับ + สรุปรายการ.csv)
 *  - { companyId, action: "email", items, to?, cc?, subject, message }  ส่ง ZIP ทางอีเมล (ไม่ระบุ to = สำนักบัญชีที่ตั้งไว้)
 * ตรวจสิทธิ์เปิดเอกสารทีละฉบับ · ฉบับจริงใส่ลายเซ็น/ตราอิเล็กทรอนิกส์ตามที่ตั้งไว้ · สูงสุด 60 ฉบับต่อชุด
 * ใบสำคัญจ่าย: แนบรูปใบเสร็จ/บิลของค่าใช้จ่ายที่จ่ายในใบนั้นด้วย (โฟลเดอร์ ไฟล์แนบใบเสร็จ/<เลขที่ใบสำคัญจ่าย>)
 */
const str = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
const MAX_ITEMS = 60;
const MAX_BYTES = 20 * 1024 * 1024;
const TYPE_FOLDER: Record<string, string> = {
  invoice: "ใบกำกับภาษีขาย", receipt: "ใบเสร็จรับเงิน", cndn: "ใบลดหนี้-เพิ่มหนี้", billing_note: "ใบวางบิล", payment: "ใบสำคัญจ่าย",
  wht: "หนังสือรับรองหัก ณ ที่จ่าย", journal: "ใบสำคัญบัญชี", purchase_order: "ใบสั่งซื้อ", quotation: "ใบเสนอราคา", sales_order: "ใบสั่งขาย",
  delivery_note: "ใบส่งของ", work_order: "ใบสั่งงาน", service_ticket: "ใบเปิดเคส", letter: "หนังสือ",
};
const csvCell = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const cfgRef = adminDb.doc(`companies/${companyId}/document_assets/accounting_office`);

    if (action === "config") {
      if (!can(apiUser.roles, "finance:view")) throw new ApiAuthError(403, "ใช้ได้เฉพาะฝ่ายบัญชี/การเงิน");
      const d = (await cfgRef.get()).data() || {};
      return NextResponse.json({ success: true, office: { name: str(d.name), email: str(d.email), cc: str(d.cc) }, mailReady: mailConfigured() });
    }
    if (action === "saveConfig") {
      if (!can(apiUser.roles, "finance:edit")) throw new ApiAuthError(403, "ตั้งสำนักบัญชีได้เฉพาะผู้แก้ไขงานบัญชี");
      const o = body.office || {};
      const email = parseEmails(o.email, 3), cc = parseEmails(o.cc, 5);
      if (o.email && !email) throw new ApiAuthError(400, "อีเมลสำนักบัญชีไม่ถูกต้อง (สูงสุด 3 อีเมล)");
      if (o.cc && !cc) throw new ApiAuthError(400, "อีเมลสำเนาไม่ถูกต้อง");
      await cfgRef.set({ name: str(o.name, 120), email: (email || []).join(", "), cc: (cc || []).join(", "), updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: apiUser.uid });
      return NextResponse.json({ success: true });
    }
    if (action !== "zip" && action !== "email") throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");

    const items: { type: string; id: string }[] = (Array.isArray(body.items) ? body.items : []).map((x: any) => ({ type: str(x?.type, 30), id: str(x?.id, 120) }))
      .filter((x: { type: string; id: string }) => x.type && x.id && !x.id.includes("/"));
    if (!items.length) throw new ApiAuthError(400, "ยังไม่ได้เลือกเอกสาร");
    if (items.length > MAX_ITEMS) throw new ApiAuthError(400, `เลือกได้ครั้งละไม่เกิน ${MAX_ITEMS} ฉบับ — แบ่งส่งเป็นหลายชุด`);
    for (const it of items) {
      const def = DOCUMENT_TYPES[it.type];
      if (!def || it.type === "sample") throw new ApiAuthError(400, `ไม่รู้จักชนิดเอกสาร ${it.type}`);
      if (!canAny(apiUser.roles, ([] as any[]).concat(def.permission))) throw new ApiAuthError(403, `ไม่มีสิทธิ์เปิด${def.label}`);
    }

    // สร้าง PDF ทีละ 3 ฉบับ (ฉบับจริง พร้อมลายเซ็น/ตราตามที่ตั้ง)
    const origin = new URL(request.url).origin;
    const files: Record<string, Uint8Array> = {};
    const rows: string[][] = [];
    const failed: string[] = [];
    let i = 0;
    const work = async () => {
      while (i < items.length) {
        const it = items[i++];
        try {
          const doc = await withSigning(companyId, await DOCUMENT_TYPES[it.type].load(companyId, it.id));
          const pdf = await renderDocumentPdf(doc, "original", origin);
          const folder = TYPE_FOLDER[it.type] || it.type;
          let name = `${folder}/${pdfFileName(doc, "original")}`;
          for (let n = 2; files[name]; n++) name = `${folder}/${pdfFileName(doc, "original").replace(/\.pdf$/, `-${n}.pdf`)}`;
          files[name] = new Uint8Array(pdf);
          const total = doc.totals?.find((t) => t.strong)?.amount ?? doc.totals?.[doc.totals.length - 1]?.amount ?? "";
          // ใบสำคัญจ่าย: รูปใบเสร็จ/บิลของค่าใช้จ่ายที่จ่าย
          let attached = 0;
          if (it.type === "payment") {
            const pay = (await adminDb.doc(`companies/${companyId}/payments/${it.id}`).get()).data() || {};
            const expIds = Array.from(new Set((Array.isArray(pay.lines) ? pay.lines : []).map((l: any) => String(l?.expenseDocId || "")).filter(Boolean))).slice(0, 10);
            for (const expId of expIds) {
              const att = await adminDb.collection(`companies/${companyId}/attachments`).where("ownerType", "==", "expense").where("ownerId", "==", expId).limit(20).get();
              for (const a of att.docs) {
                const data = String(a.get("data") || ""), comma = data.indexOf(",");
                if (comma < 0) continue;
                const safe = String(a.get("name") || a.id).replace(/[\\/:*?"<>|]+/g, "-");
                files[`ไฟล์แนบใบเสร็จ/${doc.number.replace(/[\\/:*?"<>|\s]+/g, "-")}/${expId}-${safe}`] = new Uint8Array(Buffer.from(data.slice(comma + 1), "base64"));
                attached++;
              }
            }
          }
          rows.push([folder, doc.number, doc.date, doc.party?.name || "", String(total), [doc.watermark || "", attached ? `ไฟล์แนบ ${attached} ไฟล์` : ""].filter(Boolean).join(" · "), name]);
        } catch (e: any) { failed.push(`${TYPE_FOLDER[it.type] || it.type} ${it.id}: ${e.message}`); }
      }
    };
    await Promise.all([work(), work(), work()]);
    if (!rows.length) throw new ApiAuthError(400, `สร้างเอกสารไม่สำเร็จ: ${failed.slice(0, 3).join(" · ")}`);
    rows.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));
    const csv = "﻿" + [["ชนิดเอกสาร", "เลขที่", "วันที่", "คู่ค้า", "จำนวนเงิน", "หมายเหตุ", "ไฟล์"], ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")
      + (failed.length ? `\r\n\r\n${csvCell("สร้างไม่สำเร็จ")}\r\n${failed.map(csvCell).join("\r\n")}` : "");
    files["สรุปรายการ.csv"] = new TextEncoder().encode(csv);
    // PDF บีบอัดอยู่แล้ว — เก็บใน ZIP แบบไม่บีบซ้ำ (เร็ว)
    const zip = Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: 0 }]])) as any));
    const title = str(body.title, 80).replace(/[\\/:*?"<>|]+/g, "-") || "ชุดเอกสาร";
    const zipName = `${title}.zip`;

    if (action === "zip") {
      await auditServer.logCreate(apiUser.uid, companyId, "DOCUMENT_BUNDLE", title, { action, count: rows.length, failed: failed.length });
      return new NextResponse(new Uint8Array(zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`, "Cache-Control": "no-store", "X-Bundle-Count": String(rows.length), "X-Bundle-Failed": String(failed.length) } });
    }

    if (!mailConfigured()) throw new ApiAuthError(400, "ยังไม่ได้ตั้งค่าอีเมลผู้ส่ง (SMTP) — ดาวน์โหลด ZIP แล้วส่งเองไปก่อน");
    if (zip.length > MAX_BYTES) throw new ApiAuthError(400, `ไฟล์รวม ${(zip.length / 1048576).toFixed(1)} MB ใหญ่เกินส่งทางอีเมล (20 MB) — แบ่งเป็นหลายชุด`);
    const cfg = (await cfgRef.get()).data() || {};
    const to = parseEmails(body.to || cfg.email, 3), cc = parseEmails(body.cc ?? cfg.cc, 5);
    if (!to?.length) throw new ApiAuthError(400, "ยังไม่ได้ระบุอีเมลสำนักบัญชี");
    if (cc === null) throw new ApiAuthError(400, "อีเมลสำเนาไม่ถูกต้อง");
    const company = documentProfileOf((await adminDb.doc(`companies/${companyId}`).get()).data());
    await sendBundleEmail({
      to, cc: cc || [], senderName: company.name || "NEXUS ERP", replyTo: (apiUser as any).email,
      subject: str(body.subject, 200) || `${title} — ${company.name}`,
      message: str(body.message, 3000) || `เรียน ${str(cfg.name) || "สำนักงานบัญชี"}\n\nส่งเอกสารบัญชีจำนวน ${rows.length} ฉบับ ตามไฟล์แนบ (สรุปรายการอยู่ในไฟล์ สรุปรายการ.csv)\n\nขอบคุณครับ/ค่ะ`,
      attachments: [{ filename: zipName, content: zip, contentType: "application/zip" }],
    });
    await adminDb.collection(`companies/${companyId}/document_sends`).add({ kind: "bundle", title, to, cc: cc || [], count: rows.length, failed, sentBy: apiUser.uid, sentAt: admin.firestore.FieldValue.serverTimestamp() });
    await auditServer.logCreate(apiUser.uid, companyId, "DOCUMENT_BUNDLE", title, { action, to, count: rows.length, failed: failed.length });
    return NextResponse.json({ success: true, count: rows.length, failed, to });
  } catch (err: any) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error("[DOCUMENT_BUNDLE]", err);
    return NextResponse.json({ success: false, error: err.message || "สร้างชุดเอกสารไม่สำเร็จ" }, { status: 500 });
  }
}
