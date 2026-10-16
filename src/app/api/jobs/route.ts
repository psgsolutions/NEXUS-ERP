import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError, type ApiUser } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { prepareSequence } from "@/lib/sequence-server";
import { processStockMovements, type StockMovement } from "@/lib/stock-service";
import { notifyInTx } from "@/lib/notifications.server";
import { auditServer } from "@/services/audit.server";
import { JOB_TYPES, OPEN_JOB_STATUSES, canDispatchJobs, type Job, type JobItem, type JobStatus } from "@/lib/jobs";

/**
 * [API-SERVER] งานมอบหมาย (ศูนย์จ่ายงาน / หน้างานของฉัน / แอปภายนอก)
 * Endpoint: POST /api/jobs   ส่ง Firebase ID token ใน Authorization: Bearer <token>
 *
 * ผู้จ่ายงาน (โครงการ คลัง ขาย จัดซื้อ ผู้บริหาร):
 *  - { action: "board", status?, from?, to? }       งานทั้งหมด
 *  - { action: "assignees" }                         รายชื่อผู้รับงานได้
 *  - { action: "create", job }                       สร้างงาน (มีผู้รับงาน = จ่ายทันที)
 *  - { action: "update", jobNo, job }                แก้ไขรายละเอียด (ก่อนรับงาน)
 *  - { action: "assign", jobNo, assignees }          จ่าย/เปลี่ยนผู้รับงาน
 *  - { action: "cancel", jobNo, reason }
 * ผู้รับงาน:
 *  - { action: "mine", includeDone? }                งานของฉัน (+ ใบสั่งงานบริการที่มอบหมาย)
 *  - { action: "get", jobNo }
 *  - { action: "accept", jobNo }                     รับงาน + รับอุปกรณ์ (วัสดุตัดสต็อก เครื่องมือบันทึกการยืม)
 *  - { action: "reject", jobNo, reason }
 *  - { action: "start", jobNo }
 *  - { action: "check", jobNo, index, done }         ติ๊กเช็กลิสต์
 *  - { action: "complete", jobNo, note?, returnTools? }
 *  - { action: "returnTools", jobNo }                คืนเครื่องมือ (ผู้รับงานหรือผู้จ่ายงาน)
 */

const str = (v: any, max = 300) => String(v ?? "").trim().slice(0, max);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const nowIso = () => new Date().toISOString();
const TYPES = JOB_TYPES.map((t) => t.value) as string[];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

function cleanEquipment(raw: any): JobItem[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 50).map((e: any) => ({
    kind: e?.kind === "TOOL" ? "TOOL" : "MATERIAL",
    productId: str(e?.productId, 120) || undefined,
    sku: str(e?.sku, 60) || undefined,
    name: str(e?.name, 120),
    qty: Math.max(0, Math.round((Number(e?.qty) || 0) * 100) / 100),
    unit: str(e?.unit, 20) || undefined,
    issuedQty: 0, returnedQty: 0,
  })).filter((e) => e.name && e.qty > 0).map((e) => JSON.parse(JSON.stringify(e)));
}

function cleanJobFields(j: any) {
  const type = TYPES.includes(String(j?.type)) ? String(j.type) : "OTHER";
  const title = str(j?.title, 160);
  if (!title) throw new ApiAuthError(400, "กรุณาระบุชื่องาน");
  const tpl = JOB_TYPES.find((t) => t.value === type)!;
  const checklist = (Array.isArray(j?.checklist) ? j.checklist.map((c: any) => str(typeof c === "string" ? c : c?.text, 160)) : tpl.checklist)
    .filter(Boolean).slice(0, 30).map((text: string) => ({ text, done: false }));
  return {
    type, title,
    description: str(j?.description, 3000),
    priority: PRIORITIES.includes(String(j?.priority)) ? String(j.priority) : "NORMAL",
    site: { name: str(j?.site?.name, 160), address: str(j?.site?.address, 500), contact: str(j?.site?.contact, 120), phone: str(j?.site?.phone, 40), mapUrl: str(j?.site?.mapUrl, 500) },
    customerId: str(j?.customerId, 120), customerName: str(j?.customerName, 160),
    scheduledDate: isDate(j?.scheduledDate) ? String(j.scheduledDate) : "",
    scheduledTime: /^\d{2}:\d{2}$/.test(String(j?.scheduledTime || "")) ? String(j.scheduledTime) : "",
    dueDate: isDate(j?.dueDate) ? String(j.dueDate) : "",
    estimatedHours: Math.max(0, Math.min(999, Number(j?.estimatedHours) || 0)),
    equipment: cleanEquipment(j?.equipment),
    checklist,
    warehouseLocation: str(j?.warehouseLocation, 60),
    links: { soId: str(j?.links?.soId, 120), woId: str(j?.links?.woId, 120), ticketId: str(j?.links?.ticketId, 120), projectId: str(j?.links?.projectId, 120), poId: str(j?.links?.poId, 120) },
  };
}

async function resolveAssignees(companyId: string, raw: any) {
  const ids = Array.from(new Set((Array.isArray(raw) ? raw : []).map((x: any) => str(x, 128)).filter(Boolean))).slice(0, 10);
  if (!ids.length) return { assignees: [] as string[], assigneeNames: [] as string[] };
  const snaps = await adminDb.getAll(...ids.map((id) => adminDb.doc(`users/${id}`)));
  const ok = snaps.filter((s) => s.exists && s.data()!.companyId === companyId && String(s.data()!.status || "ACTIVE").toUpperCase() === "ACTIVE");
  if (ok.length !== ids.length) throw new ApiAuthError(400, "ผู้รับงานบางคนไม่อยู่ในบริษัทหรือบัญชีถูกระงับ");
  return { assignees: ok.map((s) => s.id), assigneeNames: ok.map((s) => String(s.data()!.name || s.data()!.displayName || s.data()!.email || s.id)) };
}

const hist = (u: ApiUser, action: string, note = "") => ({ at: nowIso(), by: u.uid, byName: u.email || u.uid, action, ...(note ? { note } : {}) });
const serialize = (id: string, d: any) => ({ ...d, jobNo: d.jobNo || id, createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null, updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || null });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    if (!companyId) throw new ApiAuthError(400, "ไม่พบรหัสบริษัท");
    const apiUser = await requireApiUser(request, companyId);
    const action = str(body.action, 20);
    const col = adminDb.collection(`companies/${companyId}/jobs`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const dispatcher = canDispatchJobs(apiUser.roles);
    const needDispatcher = () => { if (!dispatcher) throw new ApiAuthError(403, "จ่ายงานได้เฉพาะหัวหน้างาน/ผู้มีสิทธิ์จ่ายงาน"); };

    // ---------- อ่าน ----------
    if (action === "mine") {
      const [jobs, wos] = await Promise.all([
        col.where("assignees", "array-contains", apiUser.uid).get(),
        adminDb.collection(`companies/${companyId}/work_orders`).where("technicianUid", "==", apiUser.uid).get(),
      ]);
      const includeDone = body.includeDone === true;
      const list = jobs.docs.map((d) => serialize(d.id, d.data())).filter((j: any) => includeDone || OPEN_JOB_STATUSES.includes(j.status))
        .sort((a: any, b: any) => String(a.scheduledDate || "9999").localeCompare(String(b.scheduledDate || "9999")));
      const workOrders = wos.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((w: any) => includeDone || ["ASSIGNED", "IN_PROGRESS"].includes(String(w.status).toUpperCase()))
        .map((w: any) => ({ id: w.id, woCode: w.woCode, customerName: w.customerName, scheduleDate: w.scheduleDate, status: w.status, soCode: w.soCode }));
      return NextResponse.json({ success: true, jobs: list, workOrders });
    }
    if (action === "get") {
      const snap = await col.doc(str(body.jobNo, 60)).get();
      if (!snap.exists) throw new ApiAuthError(404, "ไม่พบงาน");
      const j = snap.data()!;
      if (!dispatcher && !(j.assignees || []).includes(apiUser.uid)) throw new ApiAuthError(403, "งานนี้ไม่ได้มอบหมายให้คุณ");
      return NextResponse.json({ success: true, job: serialize(snap.id, j) });
    }
    if (action === "board") {
      needDispatcher();
      const snap = await col.orderBy("createdAt", "desc").limit(500).get();
      const status = str(body.status, 20);
      const jobs = snap.docs.map((d) => serialize(d.id, d.data())).filter((j: any) => !status || j.status === status);
      return NextResponse.json({ success: true, jobs });
    }
    if (action === "assignees") {
      needDispatcher();
      const users = await adminDb.collection("users").where("companyId", "==", companyId).get();
      const open = await col.where("status", "in", ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"]).get();
      const load = new Map<string, number>();
      open.docs.forEach((d) => (d.data().assignees || []).forEach((u: string) => load.set(u, (load.get(u) || 0) + 1)));
      const list = users.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((u: any) => String(u.status || "ACTIVE").toUpperCase() === "ACTIVE" && !(u.roles || [u.role]).includes("CUSTOMER"))
        .map((u: any) => ({ uid: u.id, name: u.name || u.displayName || u.email || u.id, roles: u.roles || (u.role ? [u.role] : []), openJobs: load.get(u.id) || 0 }))
        .sort((a, b) => a.name.localeCompare(b.name, "th"));
      return NextResponse.json({ success: true, assignees: list });
    }

    // ---------- สร้าง/แก้ไข (ผู้จ่ายงาน) ----------
    if (action === "create") {
      needDispatcher();
      const f = cleanJobFields(body.job);
      const people = await resolveAssignees(companyId, body.job?.assignees);
      const take = await prepareSequence("JOB", companyId);
      const jobNo = await adminDb.runTransaction(async (tx) => {
        const seq = await take(tx); const no = seq.number; seq.commit();
        const status: JobStatus = people.assignees.length ? "ASSIGNED" : "OPEN";
        tx.create(col.doc(no), {
          jobNo: no, companyId, ...f, ...people, status,
          history: [hist(apiUser, "สร้างงาน"), ...(people.assignees.length ? [hist(apiUser, "จ่ายงาน", people.assigneeNames.join(", "))] : [])],
          createdBy: apiUser.uid, createdByEmail: apiUser.email || "", createdAt: now, updatedAt: now, isDeleted: false,
        });
        for (const uid of people.assignees) notifyInTx(tx, companyId, { type: "JOB_ASSIGNED", title: `งานใหม่ ${no}`, message: f.title, link: "/mobile/technician", targetUserId: uid, documentNo: no }, apiUser.uid);
        return no;
      });
      await auditServer.logCreate(apiUser.uid, companyId, "JOB", jobNo, { type: f.type, assignees: people.assignees });
      return NextResponse.json({ success: true, jobNo });
    }

    const jobNo = str(body.jobNo, 60);
    if (!jobNo || jobNo.includes("/")) throw new ApiAuthError(400, "ไม่พบงาน");
    const ref = col.doc(jobNo);

    if (action === "update" || action === "assign" || action === "cancel") {
      needDispatcher();
      const people = action === "assign" ? await resolveAssignees(companyId, body.assignees) : null;
      const f = action === "update" ? cleanJobFields(body.job) : null;
      const status = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบงาน");
        const j = snap.data() as Job;
        if (["DONE", "CANCELLED"].includes(j.status)) throw new ApiAuthError(409, "งานนี้ปิดแล้ว");
        if (action === "update") {
          if (["ACCEPTED", "IN_PROGRESS"].includes(j.status)) {
            // รับงานแล้ว: แก้ได้เฉพาะรายละเอียดทั่วไป ไม่แตะอุปกรณ์ที่เบิกไปแล้ว
            const { equipment: _e, checklist: _c, ...rest } = f!;
            void _e; void _c;
            tx.update(ref, { ...rest, updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "แก้ไขรายละเอียด")) });
          } else {
            tx.update(ref, { ...f, updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "แก้ไขรายละเอียด")) });
          }
          return j.status;
        }
        if (action === "assign") {
          if (["ACCEPTED", "IN_PROGRESS"].includes(j.status) && (j.equipment || []).some((e) => (Number(e.issuedQty) || 0) > 0)) {
            throw new ApiAuthError(409, "ผู้รับงานเบิกอุปกรณ์ไปแล้ว ต้องปิดงานหรือคืนเครื่องมือก่อนเปลี่ยนผู้รับงาน");
          }
          const next: JobStatus = people!.assignees.length ? "ASSIGNED" : "OPEN";
          tx.update(ref, { ...people, status: next, rejectReason: "", updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, people!.assignees.length ? "จ่ายงาน" : "ถอนผู้รับงาน", people!.assigneeNames.join(", "))) });
          for (const uid of people!.assignees.filter((u) => !(j.assignees || []).includes(u))) {
            notifyInTx(tx, companyId, { type: "JOB_ASSIGNED", title: `งานใหม่ ${jobNo}`, message: j.title, link: "/mobile/technician", targetUserId: uid, documentNo: jobNo }, apiUser.uid);
          }
          return next;
        }
        const reason = str(body.reason, 300);
        if (reason.length < 3) throw new ApiAuthError(400, "กรุณาระบุเหตุผลที่ยกเลิก");
        tx.update(ref, { status: "CANCELLED", cancelReason: reason, cancelledAt: now, updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "ยกเลิกงาน", reason)) });
        return "CANCELLED";
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "JOB", jobNo, null, { action, status });
      return NextResponse.json({ success: true, status });
    }

    // ---------- ผู้รับงาน ----------
    const mustAssignee = (j: Job) => { if (!(j.assignees || []).includes(apiUser.uid)) throw new ApiAuthError(403, "งานนี้ไม่ได้มอบหมายให้คุณ"); };

    if (action === "accept") {
      const pre = await ref.get();
      if (!pre.exists) throw new ApiAuthError(404, "ไม่พบงาน");
      const pj = pre.data() as Job;
      const materials = (pj.equipment || []).filter((e) => e.kind === "MATERIAL" && e.productId && !(Number(e.issuedQty) > 0));
      let accepted = false;
      const doAccept = (tx: FirebaseFirestore.Transaction, j: Job) => {
        // ผู้รับงานยืนยันรับอุปกรณ์ครบตามรายการ (วัสดุที่มีรหัสสินค้าถูกตัดสต็อกแล้ว)
        const equipment = (j.equipment || []).map((e) => ({ ...e, issuedQty: e.qty }));
        tx.update(ref, { status: "ACCEPTED", equipment, acceptedBy: apiUser.uid, acceptedAt: now, updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "รับงานและรับอุปกรณ์")) });
        accepted = true;
      };
      let current: Job | null = null;
      const validate = async (tx: FirebaseFirestore.Transaction) => {
        const snap = await tx.get(ref);
        const j = snap.data() as Job;
        mustAssignee(j);
        if (j.status !== "ASSIGNED") throw new ApiAuthError(409, j.status === "ACCEPTED" || j.status === "IN_PROGRESS" ? "รับงานนี้ไปแล้ว" : "งานนี้ไม่ได้อยู่ในสถานะรอรับงาน");
        current = j;
      };
      if (materials.length) {
        // วัสดุตัดสต็อกในทรานแซกชันเดียวกับการรับงาน (สต็อกไม่พอ = รับงานไม่ได้ แจ้งผู้จ่ายงานปรับรายการ)
        const movements: StockMovement[] = materials.map((m) => ({ companyId, productId: m.productId!, type: "OUT", quantity: m.qty, referenceId: jobNo, userId: apiUser.email || apiUser.uid, ...(pj.warehouseLocation ? { fromLocation: pj.warehouseLocation } : {}) }));
        try {
          await processStockMovements(movements, (tx) => doAccept(tx, current!), validate);
        } catch (e: any) {
          if (e instanceof ApiAuthError) throw e;
          throw new ApiAuthError(409, `รับงานไม่ได้: ${e.message}`);
        }
      } else {
        await adminDb.runTransaction(async (tx) => { await validate(tx); doAccept(tx, current!); });
      }
      await auditServer.logUpdate(apiUser.uid, companyId, "JOB", jobNo, null, { action, materials: materials.length });
      return NextResponse.json({ success: accepted, status: "ACCEPTED", issuedMaterials: materials.length });
    }

    if (["reject", "start", "check", "complete", "returnTools"].includes(action)) {
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบงาน");
        const j = snap.data() as Job;
        if (action === "returnTools") { if (!dispatcher) mustAssignee(j); } else mustAssignee(j);
        if (action === "reject") {
          if (j.status !== "ASSIGNED") throw new ApiAuthError(409, "ปฏิเสธได้เฉพาะงานที่ยังไม่รับ");
          const reason = str(body.reason, 300);
          if (reason.length < 3) throw new ApiAuthError(400, "กรุณาระบุเหตุผลที่ปฏิเสธ");
          tx.update(ref, { status: "REJECTED", rejectReason: reason, updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "ปฏิเสธงาน", reason)) });
          notifyInTx(tx, companyId, { type: "JOB_REJECTED", title: `${jobNo} ถูกปฏิเสธ`, message: `${j.title}: ${reason}`, link: "/service/dispatch", targetUserId: (j as any).createdBy, documentNo: jobNo }, apiUser.uid);
          return "REJECTED";
        }
        if (action === "start") {
          if (j.status !== "ACCEPTED") throw new ApiAuthError(409, j.status === "ASSIGNED" ? "กดรับงานก่อนเริ่มงาน" : "เริ่มงานนี้ไม่ได้");
          tx.update(ref, { status: "IN_PROGRESS", startedBy: apiUser.uid, startedAt: now, updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "เริ่มงาน")) });
          return "IN_PROGRESS";
        }
        if (action === "check") {
          if (!["ACCEPTED", "IN_PROGRESS"].includes(j.status)) throw new ApiAuthError(409, "ติ๊กเช็กลิสต์ได้หลังรับงาน");
          const i = Number(body.index);
          const list = [...(j.checklist || [])];
          if (!Number.isInteger(i) || !list[i]) throw new ApiAuthError(400, "ไม่พบรายการ");
          list[i] = { ...list[i], done: body.done === true, doneBy: apiUser.uid, doneAt: nowIso() };
          tx.update(ref, { checklist: list, updatedAt: now });
          return j.status;
        }
        const equipment = (j.equipment || []).map((e) => (e.kind === "TOOL" ? { ...e, returnedQty: Number(e.issuedQty) || 0 } : e));
        if (action === "returnTools") {
          if (!(j.equipment || []).some((e) => e.kind === "TOOL" && (Number(e.issuedQty) || 0) > (Number(e.returnedQty) || 0))) throw new ApiAuthError(409, "ไม่มีเครื่องมือค้างคืน");
          tx.update(ref, { equipment, updatedAt: now, history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "คืนเครื่องมือ")) });
          return j.status;
        }
        // complete
        if (!["ACCEPTED", "IN_PROGRESS"].includes(j.status)) throw new ApiAuthError(409, "ปิดงานได้หลังรับงานแล้ว");
        const note = str(body.note, 2000);
        tx.update(ref, {
          status: "DONE", resultNote: note, completedBy: apiUser.uid, completedAt: now, updatedAt: now,
          ...(body.returnTools ? { equipment } : {}),
          history: admin.firestore.FieldValue.arrayUnion(hist(apiUser, "ปิดงาน", note)),
        });
        if ((j as any).createdBy && (j as any).createdBy !== apiUser.uid) notifyInTx(tx, companyId, { type: "JOB_DONE", title: `${jobNo} เสร็จแล้ว`, message: j.title, link: "/service/dispatch", targetUserId: (j as any).createdBy, documentNo: jobNo }, apiUser.uid);
        return "DONE";
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "JOB", jobNo, null, { action, status: result });
      return NextResponse.json({ success: true, status: result });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[JOBS_ERROR]:", error);
    return NextResponse.json({ success: false, error: "ดำเนินการกับงานไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
