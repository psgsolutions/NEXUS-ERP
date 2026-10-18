import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { requireApiUser, authErrorResponse, ApiAuthError } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { can } from "@/lib/permissions";
import { auditServer } from "@/services/audit.server";
import { normalizeLines } from "@/lib/quotation.server";
import { projectItemsToQuotationLines, quotationTotals } from "@/lib/project-quotation";
import { REVISABLE, quotationDocNo, writeQuotationRevision } from "@/lib/quotation-revision.server";
import { normalizeProjectStatus } from "@/lib/project-status";
import { notifyInTx } from "@/lib/notifications.server";
import { CHANGEABLE_STATUSES, CHANGE_ORDER_TYPES, changeOrderPatch, normalizeChangeOrder } from "@/lib/change-orders";

/**
 * [API-SERVER] การเปลี่ยนแปลงระหว่างดำเนินโครงการ
 * Endpoint: POST /api/projects/change-orders
 * body:
 *  - { companyId, projectDocId, action: "create", type, reason, payload }
 *  - { companyId, projectDocId, action: "approve" | "reject", coId, note? }
 *  - { companyId, projectDocId, action: "reviseQuotation", coId }   ปรับใบเสนอราคาของโครงการตามคำขอเปลี่ยนรายการที่อนุมัติแล้ว
 *      ส่งลูกค้าแล้ว -> ออกฉบับแก้ไข (-R{n}) / ยังไม่ส่ง -> แทนรายการในใบเดิม / ได้งานแล้ว -> ปรับไม่ได้ (แก้ที่ใบสั่งขาย)
 *
 * - ยื่นได้เมื่อโครงการอนุมัติแล้ว/กำลังดำเนินการ (ผู้มีสิทธิ์แก้ไขโครงการ)
 * - อนุมัติ/ไม่อนุมัติ: ผู้ดูแลระบบ (คนเดียวกับผู้ยื่นได้ ตามนโยบายปัจจุบัน)
 * - อนุมัติแล้วปรับข้อมูลโครงการในทรานแซกชันเดียวกัน (ตรวจว่าค่าเดิมยังตรงก่อน)
 */

const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);
const isApprover = (roles: string[]) => can(roles, "projects:approve");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyId = str(body.companyId, 80);
    const docId = str(body.projectDocId);
    if (!companyId || !docId) throw new ApiAuthError(400, "ข้อมูลไม่ครบ");
    const apiUser = await requireApiUser(request, companyId);
    const action = String(body.action || "");
    // ปรับใบเสนอราคาเป็นงานฝ่ายขาย ส่วนการยื่น/อนุมัติคำขอเป็นงานโครงการ
    if (action === "reviseQuotation" ? !can(apiUser.roles, "sales:edit") : !can(apiUser.roles, "projects:edit")) throw new ApiAuthError(403, "สิทธิ์การใช้งานไม่เพียงพอ");

    const projectRef = adminDb.doc(`companies/${companyId}/projects/${docId}`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === "reviseQuotation") {
      const coRef = projectRef.collection("change_orders").doc(str(body.coId));
      const quotations = adminDb.collection(`companies/${companyId}/quotations`);
      const result = await adminDb.runTransaction(async (tx) => {
        const [pSnap, cSnap] = await Promise.all([tx.get(projectRef), tx.get(coRef)]);
        if (!pSnap.exists || !cSnap.exists) throw new ApiAuthError(404, "ไม่พบคำขอเปลี่ยนแปลง");
        const p = pSnap.data()!;
        const co = cSnap.data()!;
        if (co.status !== "APPROVED") throw new ApiAuthError(409, `${co.coNo} ยังไม่อนุมัติ`);
        if (co.type !== "EQUIPMENT") throw new ApiAuthError(400, "ปรับใบเสนอราคาได้เฉพาะคำขอเปลี่ยนรายการอุปกรณ์");
        if (co.quotationUpdate) throw new ApiAuthError(409, `${co.coNo} ปรับใบเสนอราคาไปแล้ว (${co.quotationUpdate.docNo})`);
        if (!p.quotationDocId) throw new ApiAuthError(400, "โครงการนี้ไม่ได้ผูกกับใบเสนอราคา");
        // ใบล่าสุดของสายฉบับแก้ไข
        let qRef = quotations.doc(String(p.quotationDocId));
        let qSnap = await tx.get(qRef);
        for (let i = 0; i < 20 && qSnap.exists && qSnap.data()!.supersededBy; i++) {
          qRef = quotations.doc(String(qSnap.data()!.supersededBy));
          qSnap = await tx.get(qRef);
        }
        if (!qSnap.exists) throw new ApiAuthError(404, "ไม่พบใบเสนอราคาของโครงการ");
        const q = qSnap.data()!;
        const docNo = quotationDocNo(q, qSnap.id);
        const status = String(q.status || "DRAFT").toUpperCase();
        if (q.linkedSo || ["APPROVED", "WON", "CONVERTED"].includes(status)) {
          throw new ApiAuthError(409, `${docNo} แปลงเป็นใบสั่งขายแล้ว ให้ปรับที่ใบสั่งขายหรือออกใบลดหนี้/เพิ่มหนี้`);
        }
        const linesSnap = await tx.get(qRef.collection("lines"));
        const lines = normalizeLines(projectItemsToQuotationLines(p.items));
        if (!lines.some((l) => l.itemType !== "GROUP_HEADER")) throw new ApiAuthError(400, "โครงการไม่มีรายการ");
        const totals = quotationTotals(lines, q.taxType, q.docDiscountAmount);
        const changeSummary = `${co.coNo}: ${co.summary || ""} — ${co.reason || ""}`.slice(0, 500);

        let out: { mode: "revision" | "updated"; quotationId: string; docNo: string };
        if (REVISABLE.includes(status)) {
          const newRef = quotations.doc();
          const r = writeQuotationRevision(tx, {
            companyId, origRef: qRef, orig: q, origId: qSnap.id, newRef, oldLines: [], lines, totals,
            uid: apiUser.uid, changeSummary, extra: { changeOrderRef: { projectDocId: docId, coId: coRef.id, coNo: co.coNo } },
          });
          out = { mode: "revision", quotationId: newRef.id, docNo: r.newDocNo };
        } else if (["DRAFT", "REJECTED", "PENDING_APPROVAL"].includes(status)) {
          linesSnap.forEach((d) => tx.delete(d.ref));
          lines.forEach((l) => tx.set(qRef.collection("lines").doc(), l));
          // รออนุมัติอยู่: เนื้อหาเปลี่ยน ต้องส่งอนุมัติใหม่
          tx.update(qRef, { ...totals, ...(status === "PENDING_APPROVAL" ? { status: "DRAFT" } : {}), lastChangeOrderNo: co.coNo, updatedAt: now, updatedBy: apiUser.uid });
          out = { mode: "updated", quotationId: qSnap.id, docNo };
        } else {
          throw new ApiAuthError(409, `${docNo} อยู่ในสถานะที่ปรับไม่ได้`);
        }
        tx.update(coRef, { quotationUpdate: { ...out, at: now, by: apiUser.uid }, updatedAt: now });
        tx.update(projectRef, {
          quotationDocId: out.quotationId,
          ...(p.clientReference && p.clientReference === docNo ? { clientReference: out.docNo } : {}),
          updatedAt: now, updatedBy: apiUser.uid,
        });
        return { ...out, coNo: co.coNo, projectNo: p.projectId || docId, grandTotal: totals.grandTotal };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "PROJECT_CHANGE_ORDER", `${result.projectNo}/${result.coNo}`, null, { quotation: result.docNo, mode: result.mode });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "create") {
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(projectRef);
        if (!snap.exists) throw new ApiAuthError(404, "ไม่พบโครงการ");
        const p = snap.data()!;
        if (p.isSample) throw new ApiAuthError(400, "โครงการตัวอย่างขอเปลี่ยนแปลงไม่ได้");
        const status = normalizeProjectStatus(p.status);
        if (!CHANGEABLE_STATUSES.includes(status)) {
          throw new ApiAuthError(409, status === "Draft" || status === "Rejected" ? "โครงการยังไม่อนุมัติ แก้ไขโครงการได้โดยตรง" : "โครงการนี้ขอเปลี่ยนแปลงไม่ได้แล้ว");
        }
        const n = normalizeChangeOrder(body, p);
        if ("error" in n) throw new ApiAuthError(400, n.error);
        const seq = (Number(p.changeOrderSeq) || 0) + 1;
        const coNo = `CO-${String(seq).padStart(2, "0")}`;
        const coRef = projectRef.collection("change_orders").doc();
        tx.create(coRef, {
          id: coRef.id, companyId, coNo, seq, type: n.value.type, reason: n.value.reason, payload: n.value.payload, before: n.before ?? null,
          summary: n.summary, status: "PENDING",
          requestedBy: apiUser.uid, requestedByName: apiUser.email || apiUser.uid, requestedAt: now, updatedAt: now,
        });
        tx.update(projectRef, { changeOrderSeq: seq, pendingChangeOrders: admin.firestore.FieldValue.increment(1), updatedAt: now });
        const projectNo = p.projectId || docId;
        notifyInTx(tx, companyId, {
          type: "PROJECT_CHANGE_ORDER",
          title: `โครงการ ${projectNo} ขอเปลี่ยนแปลง ${coNo}`,
          message: `${CHANGE_ORDER_TYPES.find((t) => t.code === n.value.type)?.label}: ${n.summary}`,
          link: `/projects/${encodeURIComponent(docId)}?tab=changes`,
          targetRoles: ["EXECUTIVE"],
          documentNo: projectNo,
        }, apiUser.uid);
        return { id: coRef.id, coNo, projectNo };
      });
      await auditServer.logCreate(apiUser.uid, companyId, "PROJECT_CHANGE_ORDER", `${result.projectNo}/${result.coNo}`, { type: body.type });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "approve" || action === "reject") {
      if (!isApprover(apiUser.roles)) throw new ApiAuthError(403, "อนุมัติการเปลี่ยนแปลงได้เฉพาะผู้บริหาร");
      const coId = str(body.coId);
      const note = str(body.note, 500);
      if (action === "reject" && note.length < 3) throw new ApiAuthError(400, "กรุณาระบุเหตุผลที่ไม่อนุมัติ");
      const coRef = projectRef.collection("change_orders").doc(coId);
      const result = await adminDb.runTransaction(async (tx) => {
        const [pSnap, cSnap] = await Promise.all([tx.get(projectRef), tx.get(coRef)]);
        if (!pSnap.exists || !cSnap.exists) throw new ApiAuthError(404, "ไม่พบคำขอเปลี่ยนแปลง");
        const p = pSnap.data()!;
        const co = cSnap.data()!;
        if (co.status !== "PENDING") throw new ApiAuthError(409, `${co.coNo} พิจารณาไปแล้ว`);
        let patch: Record<string, any> = {};
        if (action === "approve") {
          if (!CHANGEABLE_STATUSES.includes(normalizeProjectStatus(p.status))) throw new ApiAuthError(409, "โครงการนี้ปรับเปลี่ยนไม่ได้แล้ว");
          const r = changeOrderPatch(p, co as any);
          if ("error" in r) throw new ApiAuthError(409, r.error);
          patch = r.patch;
        }
        tx.update(coRef, {
          status: action === "approve" ? "APPROVED" : "REJECTED",
          decidedBy: apiUser.uid, decidedByName: apiUser.email || apiUser.uid, decidedAt: now, decisionNote: note, updatedAt: now,
        });
        tx.update(projectRef, {
          ...patch,
          pendingChangeOrders: admin.firestore.FieldValue.increment(-1),
          ...(action === "approve" ? { lastChangeOrderAt: now, lastChangeOrderNo: co.coNo } : {}),
          updatedAt: now, updatedBy: apiUser.uid,
        });
        const projectNo = p.projectId || docId;
        if (co.requestedBy && co.requestedBy !== apiUser.uid) {
          notifyInTx(tx, companyId, {
            type: "PROJECT_CHANGE_ORDER_DECIDED",
            title: `${co.coNo} โครงการ ${projectNo} ${action === "approve" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}`,
            message: note || co.summary || "",
            link: `/projects/${encodeURIComponent(docId)}?tab=changes`,
            targetUserId: co.requestedBy,
            documentNo: projectNo,
          }, apiUser.uid);
        }
        return { coNo: co.coNo, projectNo };
      });
      await auditServer.logUpdate(apiUser.uid, companyId, "PROJECT_CHANGE_ORDER", `${result.projectNo}/${result.coNo}`, { status: "PENDING" }, { status: action === "approve" ? "APPROVED" : "REJECTED" });
      return NextResponse.json({ success: true, ...result, status: action === "approve" ? "APPROVED" : "REJECTED" });
    }

    throw new ApiAuthError(400, "คำสั่งไม่ถูกต้อง");
  } catch (error: any) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[PROJECT_CHANGE_ORDER_ERROR]:", error);
    return NextResponse.json({ success: false, error: "บันทึกการเปลี่ยนแปลงไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
