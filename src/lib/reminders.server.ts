import { adminDb } from "@/lib/firebase-admin";
import { notificationPayload, type NotificationInput } from "@/lib/notifications.server";
import { can, resolveRoles } from "@/lib/permissions";
import { inactiveReason } from "@/lib/user-status";
import { mailConfigured, sendDigestEmail } from "@/lib/mailer.server";
import { invoiceReminders, milestoneReminders } from "@/lib/reminders";

/**
 * แจ้งเตือนประจำวัน (เรียกจาก cron): ใบแจ้งหนี้ใกล้ครบ/เลยกำหนด + งวดงานที่ยังไม่เรียกเก็บ
 *  - แจ้งเตือนในระบบใช้ ID คงที่ต่อเหตุการณ์ (สร้างด้วย create) — รันซ้ำไม่แจ้งซ้ำ
 *  - ถ้าตั้งค่าอีเมลระบบแล้ว ส่งสรุป "รายการใหม่ของวันนี้" ให้ผู้มีสิทธิ์ดูการเงินของบริษัท (ไม่ส่งถึงลูกค้าอัตโนมัติ)
 */

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function createOnce(companyId: string, id: string, n: NotificationInput, extra: Record<string, any> = {}): Promise<boolean> {
  try {
    await adminDb.doc(`companies/${companyId}/notifications/${id}`).create({ ...notificationPayload(companyId, n), ...extra });
    return true;
  } catch (e: any) {
    if (e?.code === 6) return false; // ALREADY_EXISTS: แจ้งไปแล้ว
    throw e;
  }
}

export async function runBillingReminders(opts: { today: string; origin: string; companyIds?: string[]; sendEmail?: boolean }) {
  const companies = opts.companyIds
    ? opts.companyIds.map((id) => ({ id }))
    : (await adminDb.collection("companies").select().get()).docs.map((d) => ({ id: d.id }));
  const report: { companyId: string; invoices: number; milestones: number; created: number; emailed: number; emailError?: string }[] = [];

  for (const { id: companyId } of companies) {
    const base = `companies/${companyId}`;
    const [invSnap, prjSnap] = await Promise.all([adminDb.collection(`${base}/invoices`).get(), adminDb.collection(`${base}/projects`).get()]);
    const fresh: { text: string; link?: string }[] = [];

    // ---- ใบแจ้งหนี้ ----
    const invs = invoiceReminders(invSnap.docs.map((d) => ({ id: d.id, data: d.data() })), opts.today);
    for (const r of invs) {
      const overdue = r.kind === "overdue";
      const title = overdue ? `ใบแจ้งหนี้เลยกำหนด ${r.daysOverdue} วัน (${r.invoiceNo})` : `ใบแจ้งหนี้ใกล้ครบกำหนด (${r.invoiceNo})`;
      const message = `${r.customerName || "ลูกค้า"} · ค้างชำระ ${money(r.balance)} บาท · ครบกำหนด ${r.dueDate}`;
      const created = await createOnce(companyId, `ARREM-${r.invoiceId}-${r.key}`, {
        type: overdue ? "INVOICE_OVERDUE" : "INVOICE_DUE_SOON", title, message,
        link: `/finance/receipts/new?invoice=${encodeURIComponent(r.invoiceId)}`,
        targetRoles: overdue ? ["ACCOUNTANT", "EXECUTIVE"] : ["ACCOUNTANT"], documentNo: r.invoiceNo,
      }, { targetDocId: r.invoiceId });
      if (created) fresh.push({ text: `${title} — ${message}`, link: `${opts.origin}/finance/receipts/new?invoice=${encodeURIComponent(r.invoiceId)}` });
    }

    // ---- งวดงานที่ยังไม่เรียกเก็บ ----
    const billed = new Map<string, Set<string>>();
    invSnap.docs.forEach((d) => {
      const x = d.data();
      if (x.docKind !== "progress" || !x.projectDocId || String(x.status || "").toLowerCase() === "cancelled") return;
      if (!billed.has(x.projectDocId)) billed.set(x.projectDocId, new Set());
      billed.get(x.projectDocId)!.add(String(x.milestoneId || ""));
    });
    let milestoneCount = 0;
    for (const p of prjSnap.docs) {
      const project = p.data();
      const ms = milestoneReminders(p.id, project, billed.get(p.id) || new Set(), opts.today);
      milestoneCount += ms.length;
      for (const m of ms) {
        const title = `งวดงานถึงกำหนดเรียกเก็บ (${m.projectNo})`;
        const message = `${m.milestoneName} · ${money(m.amount)} บาท · ${m.reason === "completed" ? "งานเสร็จแล้ว" : `ครบกำหนด ${m.endDate}`} ยังไม่ออกใบแจ้งหนี้`;
        const link = `/projects/${encodeURIComponent(p.id)}?tab=billing`;
        const n: NotificationInput = { type: "MILESTONE_UNBILLED", title, message, link, targetRoles: ["ACCOUNTANT", "SALES"], documentNo: m.projectNo };
        const created = await createOnce(companyId, `MSREM-${p.id}-${m.milestoneId}`, n, { targetDocId: p.id });
        // ผู้จัดการโครงการได้รับแจ้งแยก (แจ้งเตือนส่งถึงคนเดียวหรือตามบทบาท อย่างใดอย่างหนึ่ง)
        if (project.projectManagerUid) await createOnce(companyId, `MSREM-${p.id}-${m.milestoneId}-pm`, { ...n, targetRoles: [], targetUserId: String(project.projectManagerUid) }, { targetDocId: p.id });
        if (created) fresh.push({ text: `${title} — ${message}`, link: `${opts.origin}${link}` });
      }
    }

    // ---- อีเมลสรุปรายการใหม่ ----
    let emailed = 0, emailError: string | undefined;
    if (opts.sendEmail !== false && fresh.length && mailConfigured()) {
      const [users, company] = await Promise.all([adminDb.collection("users").where("companyId", "==", companyId).get(), adminDb.doc(base).get()]);
      const to = Array.from(new Set(users.docs.map((u) => u.data())
        .filter((u) => !inactiveReason(u) && can(resolveRoles(u), "finance:view") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(u.email || "")))
        .map((u) => String(u.email).toLowerCase()))).slice(0, 20);
      if (to.length) {
        try {
          await sendDigestEmail({
            to, senderName: String(company.data()?.name || "NEXUS ERP"),
            subject: `รายการต้องติดตามวันที่ ${opts.today} (${fresh.length} รายการ)`,
            intro: "รายการที่ต้องติดตามใหม่วันนี้ (ใบแจ้งหนี้ใกล้ครบ/เลยกำหนด และงวดงานที่ยังไม่เรียกเก็บ)", items: fresh,
          });
          emailed = to.length;
        } catch (e: any) {
          emailError = e?.code === "EAUTH" ? "เข้าสู่ระบบอีเมลไม่สำเร็จ" : "ส่งอีเมลไม่สำเร็จ";
          console.error("[REMINDER_EMAIL]", companyId, e?.code || e?.message);
        }
      }
    }
    report.push({ companyId, invoices: invs.length, milestones: milestoneCount, created: fresh.length, emailed, ...(emailError ? { emailError } : {}) });
  }
  return report;
}
