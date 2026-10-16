import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError, type ApiUser } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { canAny } from "@/lib/permissions";
import { prepareSequence } from "@/lib/sequence-server";
import { notifyInTx } from "@/lib/notifications.server";
import { auditServer } from "@/services/audit.server";
import { JOB_TYPES } from "@/lib/jobs";
import { SLA_HOURS, TICKET_CATEGORIES, TICKET_CHANNELS, jobTypeForCategory, type TicketPriority } from "@/lib/service-tickets";

/**
 * [API-SERVER] ใบแจ้งซ่อม/งานบริการ
 * Endpoint: POST /api/service/tickets
 *  - { action: "list" }                                   ใบแจ้งทั้งหมด + คำขอจากพอร์ทัลลูกค้าที่ยังไม่รับเรื่อง
 *  - { action: "lookupSerial", serial }                   ตรวจข้อมูลรับประกันจากหมายเลขเครื่อง
 *  - { action: "create", ticket, portalId? }              รับแจ้ง (portalId = รับเรื่องจากพอร์ทัล)
 *  - { action: "toJob", ticketNo, assignees?, scheduledDate?, scheduledTime?, note? }  ส่งให้ช่าง (สร้างงานในศูนย์จ่ายงาน)
 *  - { action: "note", ticketNo, note }                   บันทึกการติดตาม
 *  - { action: "resolve" | "close" | "reopen" | "cancel", ticketNo, note? }
 * - ผู้ใช้งานได้: ฝ่ายขาย โครงการ คลัง (ผู้รับเรื่องและจ่ายงานบริการ) และผู้บริหาร
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];
const hist = (u: ApiUser, action: string, note = "") => ({ at: new Date().toISOString(), by: u.uid, byName: u.email || u.uid, action, ...(note ? { note } : {}) });
const iso = (v: any) => v?.toDate?.()?.toISOString?.() || (typeof v === "string" ? v : null);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    if (!canAny(apiUser.roles, ["sales:view", "projects:view", "inventory:view", "service:field"])) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");
    const canEdit = canAny(apiUser.roles, ["sales:edit", "projects:edit", "inventory:edit", "projects:approve"]);
    const action = str(body.action, 20);
    const col = adminDb.collection(`companies/${companyId}/service_tickets`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "list") {
      const [tickets, portal, jobs] = await Promise.all([
        col.orderBy("createdAt", "desc").limit(500).get(),
        adminDb.collection("service_tickets").where("companyId", "==", companyId).get(),
        adminDb.collection(`companies/${companyId}/jobs`).where("links.ticketId", ">", "").get(),
      ]);
      const jobByTicket = new Map<string, any[]>();
      jobs.docs.forEach((d) => { const j = d.data(); const t = j.links?.ticketId; if (t) jobByTicket.set(t, [...(jobByTicket.get(t) || []), { jobNo: j.jobNo || d.id, status: j.status, assigneeNames: j.assigneeNames || [], scheduledDate: j.scheduledDate || "" }]); });
      return NextResponse.json({
        success: true,
        tickets: tickets.docs.map((d) => ({ ...d.data(), ticketNo: d.id, createdAt: iso(d.data().createdAt), jobs: jobByTicket.get(d.id) || [] })),
        portal: portal.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: iso(d.data().createdAt) })).filter((p: any) => !p.ticketNo && String(p.status || "NEW").toUpperCase() === "NEW"),
      });
    }

    if (action === "lookupSerial") {
      const serial = str(body.serial, 80);
      if (!serial) return NextResponse.json({ success: true, found: false });
      const sc = adminDb.collection(`companies/${companyId}/serial_numbers`);
      const direct = await sc.doc(serial).get();
      const snap = direct.exists ? direct : (await sc.where("sn", "==", serial).limit(1).get()).docs[0] || (await sc.where("serialNo", "==", serial).limit(1).get()).docs[0];
      if (!snap || !snap.exists) return NextResponse.json({ success: true, found: false });
      const s = snap.data() as any;
      const end = typeof s.warrantyEndDate === "string" ? s.warrantyEndDate.slice(0, 10) : iso(s.warrantyEndDate)?.slice(0, 10) || "";
      return NextResponse.json({ success: true, found: true, serial: { sn: s.sn || s.serialNo || snap.id, productName: s.productName || s.name || "", customerName: s.customerName || "", warrantyEndDate: end, inWarranty: !!end && end >= new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) } });
    }

    if (!canEdit) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอสำหรับการจัดการงานบริการ");

    if (action === "create") {
      const t = body.ticket || {};
      const symptom = str(t.symptom, 2000);
      const customerName = str(t.customerName, 160);
      const phone = str(t.phone, 40);
      if (!symptom) throw new ApiAuthError(400, "กรุณาระบุอาการ/เรื่องที่แจ้ง");
      if (!customerName && !phone) throw new ApiAuthError(400, "กรุณาระบุชื่อลูกค้าหรือเบอร์โทร");
      const priority = (PRIORITIES.includes(String(t.priority)) ? String(t.priority) : "NORMAL") as TicketPriority;
      const portalId = str(body.portalId, 120);
      const portalRef = portalId ? adminDb.doc(`service_tickets/${portalId}`) : null;
      const take = await prepareSequence("TK", companyId);
      const ticketNo = await adminDb.runTransaction(async (tx) => {
        if (portalRef) {
          const p = await tx.get(portalRef);
          if (!p.exists || p.data()!.companyId !== companyId) throw new ApiAuthError(404, "ไม่พบคำขอจากพอร์ทัล");
          if (p.data()!.ticketNo) throw new ApiAuthError(409, `รับเรื่องนี้แล้ว (${p.data()!.ticketNo})`);
        }
        const seq = await take(tx); const no = seq.number; seq.commit();
        tx.create(col.doc(no), {
          ticketNo: no, companyId,
          customerId: str(t.customerId, 120), customerName, phone, contact: str(t.contact, 120), address: str(t.address, 500),
          category: TICKET_CATEGORIES.some((c) => c.value === t.category) ? t.category : "REPAIR",
          channel: TICKET_CHANNELS.some((c) => c.value === t.channel) ? t.channel : portalId ? "PORTAL" : "PHONE",
          serialNumber: str(t.serialNumber, 80), productName: str(t.productName, 160), inWarranty: t.inWarranty === true,
          symptom, priority,
          slaDueAt: new Date(Date.now() + SLA_HOURS[priority] * 3600000).toISOString(),
          status: "NEW", portalId: portalId || "",
          history: [hist(apiUser, "รับแจ้ง")],
          createdBy: apiUser.uid, createdAt: now, updatedAt: now, isDeleted: false,
        });
        if (portalRef) tx.update(portalRef, { ticketNo: no, status: "ACCEPTED", acceptedBy: apiUser.uid, acceptedAt: now });
        return no;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "SERVICE_TICKET", ticketNo, { priority });
      return NextResponse.json({ success: true, ticketNo });
    }

    const ticketNo = str(body.ticketNo, 60);
    if (!ticketNo || ticketNo.includes("/")) throw new ApiAuthError(400, "ไม่พบใบแจ้ง");
    const ref = col.doc(ticketNo);

    if (action === "toJob") {
      const ids = Array.from(new Set((Array.isArray(body.assignees) ? body.assignees : []).map((x: any) => str(x, 128)).filter(Boolean))).slice(0, 10) as string[];
      const users = ids.length ? await adminDb.getAll(...ids.map((id) => adminDb.doc(`users/${id}`))) : [];
      if (users.some((u) => !u.exists || u.data()!.companyId !== companyId)) throw new ApiAuthError(400, "ผู้รับงานไม่อยู่ในบริษัท");
      const take = await prepareSequence("JOB", companyId);
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบแจ้ง");
        const t = snap.data()!;
        if (!["NEW", "SCHEDULED", "IN_PROGRESS"].includes(t.status)) throw new ApiAuthError(409, "ใบแจ้งนี้ปิดแล้ว");
        const seq = await take(tx); const jobNo = seq.number; seq.commit();
        const type = jobTypeForCategory(t.category);
        const tpl = JOB_TYPES.find((x) => x.value === type)!;
        const names = users.map((u) => String(u.data()!.name || u.data()!.email || u.id));
        tx.create(adminDb.doc(`companies/${companyId}/jobs/${jobNo}`), {
          jobNo, companyId, type,
          title: `${t.category === "INSTALL" ? "ติดตั้ง" : t.category === "MA" ? "MA" : "ซ่อม"}: ${t.productName || t.symptom.slice(0, 60)}`,
          description: [t.symptom, t.serialNumber ? `หมายเลขเครื่อง ${t.serialNumber}${t.inWarranty ? " (อยู่ในประกัน)" : ""}` : "", str(body.note, 1000)].filter(Boolean).join("\n"),
          priority: t.priority || "NORMAL",
          site: { name: t.customerName || "", address: t.address || "", contact: t.contact || t.customerName || "", phone: t.phone || "" },
          customerId: t.customerId || "", customerName: t.customerName || "",
          scheduledDate: isDate(body.scheduledDate) ? body.scheduledDate : "", scheduledTime: /^\d{2}:\d{2}$/.test(String(body.scheduledTime || "")) ? body.scheduledTime : "",
          dueDate: String(t.slaDueAt || "").slice(0, 10), estimatedHours: 0,
          assignees: ids, assigneeNames: names, equipment: [],
          checklist: tpl.checklist.map((text) => ({ text, done: false })),
          links: { ticketId: ticketNo }, status: ids.length ? "ASSIGNED" : "OPEN",
          history: [hist(apiUser, "สร้างงานจากใบแจ้งซ่อม", ticketNo), ...(ids.length ? [hist(apiUser, "จ่ายงาน", names.join(", "))] : [])],
          createdBy: apiUser.uid, createdByEmail: apiUser.email || "", createdAt: now, updatedAt: now, isDeleted: false,
        });
        tx.update(ref, { status: "SCHEDULED", updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "ส่งให้ช่าง", `${jobNo}${names.length ? ` · ${names.join(", ")}` : ""}`)) });
        for (const uid of ids) notifyInTx(tx, companyId, { type: "JOB_ASSIGNED", title: `งานใหม่ ${jobNo}`, message: t.symptom.slice(0, 120), link: "/mobile/technician", targetUserId: uid, documentNo: jobNo }, apiUser.uid);
        return { jobNo };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "SERVICE_TICKET", ticketNo, null, { action, ...result });
      return NextResponse.json({ success: true, ...result });
    }

    if (["note", "resolve", "close", "reopen", "cancel"].includes(action)) {
      const note = str(body.note, 1000);
      const status = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบใบแจ้ง");
        const t = snap.data()!;
        const open = ["NEW", "SCHEDULED", "IN_PROGRESS"].includes(t.status);
        if (action === "note") {
          if (!note) throw new ApiAuthError(400, "กรุณาพิมพ์บันทึก");
          tx.update(ref, { updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "บันทึกติดตาม", note)) });
          return t.status;
        }
        const next = action === "resolve" ? "RESOLVED" : action === "close" ? "CLOSED" : action === "reopen" ? "NEW" : "CANCELLED";
        if (action === "resolve" && !open) throw new ApiAuthError(409, "ใบแจ้งนี้ไม่ได้เปิดอยู่");
        if (action === "close" && !["RESOLVED", ...(open ? [t.status] : [])].includes(t.status)) throw new ApiAuthError(409, "ปิดเรื่องได้หลังแก้ไขแล้ว");
        if (action === "reopen" && !["RESOLVED", "CLOSED"].includes(t.status)) throw new ApiAuthError(409, "เปิดเรื่องซ้ำได้เฉพาะเรื่องที่แก้ไข/ปิดแล้ว");
        if (action === "cancel" && !open) throw new ApiAuthError(409, "ยกเลิกได้เฉพาะเรื่องที่ยังเปิดอยู่");
        if (action === "cancel" && note.length < 3) throw new ApiAuthError(400, "กรุณาระบุเหตุผลที่ยกเลิก");
        const label = { resolve: "แก้ไขแล้ว", close: "ปิดเรื่อง", reopen: "เปิดเรื่องอีกครั้ง", cancel: "ยกเลิก" }[action as "resolve"];
        tx.update(ref, { status: next, ...(next === "RESOLVED" ? { resolvedAt: now } : {}), ...(next === "CLOSED" ? { closedAt: now } : {}), updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, label, note)) });
        return next;
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "SERVICE_TICKET", ticketNo, null, { action, status });
      return NextResponse.json({ success: true, status });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[SERVICE_TICKET_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
