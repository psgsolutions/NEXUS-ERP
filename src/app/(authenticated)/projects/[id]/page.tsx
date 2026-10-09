"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Briefcase, Building2, CalendarDays, CheckCircle2, ClipboardList, FileText, History,
  Loader2, MapPin, Package, Pencil, PlayCircle, ShieldCheck, Users, Wallet, XCircle,
} from "lucide-react";
import {
  GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillTabs, StatusBadge, cn,
} from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { computeProjectBudget } from "@/lib/project-budget";
import {
  APPROVAL_STEPS, EDITABLE_STATUSES, PROJECT_STATUS_BADGE, PROJECT_STATUS_TH, canApproveStep, normalizeProjectStatus,
  type ProjectAction,
} from "@/lib/project-status";

const baht = (n: any) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const thDate = (v: any) => {
  if (!v) return "-";
  const ms = typeof v === "string" ? new Date(v).getTime() : v.seconds ? v.seconds * 1000 : v.toMillis ? v.toMillis() : 0;
  return ms ? new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";
};
const thDateTime = (iso: any) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-");

const KIND_TH: Record<string, string> = { PRODUCT: "สินค้า", SERVICE: "บริการ", LABOR: "ค่าแรง", GROUP: "หัวข้อ" };
const ACTION_TH: Record<string, string> = {
  approve: "อนุมัติ", reject: "ไม่อนุมัติ", start: "เริ่มดำเนินการ", progress: "อัปเดตความคืบหน้า", complete: "ปิดโครงการ", cancel: "ยกเลิกโครงการ",
};

// โครงการรุ่นเก่า (ก่อนมีโครงสร้าง BOQ มาตรฐาน): แปลงรายการให้แสดงผลได้
function legacyLines(p: any): any[] {
  const eq = (p.equipments || []).map((e: any, i: number) => ({
    lineId: `E${i}`, kind: "PRODUCT", sku: e.sku || "", name: e.name || "-", qty: Number(e.qty) || 0, unit: e.unit || "ชิ้น",
    unitPrice: Number(e.price) || 0, unitCost: Number(e.cost) || 0, amount: (Number(e.qty) || 0) * (Number(e.price) || 0), costAmount: (Number(e.qty) || 0) * (Number(e.cost) || 0),
  }));
  const lb = (p.labors || []).map((l: any, i: number) => {
    const qty = l.type === "per-point" ? Number(l.points) || 1 : 1;
    const unitCost = l.type === "per-point" ? (Number(l.materialCost) || 0) + (Number(l.laborCost) || 0) : Number(l.cost) || 0;
    return { lineId: `L${i}`, kind: "LABOR", sku: "", name: l.name || "-", qty, unit: l.type === "per-point" ? "จุด" : "งาน", unitPrice: Number(l.price) || 0, unitCost, amount: qty * (Number(l.price) || 0), costAmount: qty * unitCost };
  });
  return [...eq, ...lb];
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const routeParams = useParams();
  const docId = decodeURIComponent(String(routeParams.id || ""));
  const { user, role, companyId } = useAuth();

  const { data: own, loading } = useRealtimeDocument<any>(companyId && docId ? `companies/${companyId}/projects/${docId}` : null);
  const { data: legacy, loading: legacyLoading } = useRealtimeDocument<any>(!loading && !own && docId ? `projects/${docId}` : null);
  const isLegacy = !own && !!legacy && legacy.companyId === companyId;
  const p: any = own || (isLegacy ? legacy : null);

  const { data: workOrders } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/work_orders` : "");

  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, setPending] = useState<ProjectAction | null>(null); // รอเหตุผล (ไม่อนุมัติ/ยกเลิก)
  const [comment, setComment] = useState("");
  const [progressInput, setProgressInput] = useState<number | null>(null);

  const status = normalizeProjectStatus(p?.status);
  const lines: any[] = useMemo(() => (p ? (Array.isArray(p.items) && p.items.length ? p.items : legacyLines(p)) : []), [p]);
  const budget = useMemo(() => {
    if (p?.budgetSummary) return p.budgetSummary;
    return computeProjectBudget(lines.map((l: any) => ({ discountType: "PERCENT", discountValue: 0, whtRate: 0, isOptional: false, productId: null, details: "", ...l })), { startDate: p?.startDate, endDate: p?.endDate });
  }, [p, lines]);
  const step = Number(p?.currentApprovalStep) || 0;
  const approvals: any[] = Array.isArray(p?.approvals) && p.approvals.length ? p.approvals : APPROVAL_STEPS.map((s) => ({ stepOrder: s.stepOrder, status: "Pending" }));
  const relatedWorkOrders = useMemo(
    () => workOrders.filter((w: any) => w.projectId && (w.projectId === docId || w.projectId === p?.projectId)),
    [workOrders, docId, p?.projectId]
  );

  const canEditProject = can(role, "projects:edit");
  const isOwner = p?.createdBy === user?.uid;
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
  const canEditThis = !isLegacy && EDITABLE_STATUSES.includes(status) && canEditProject && (isOwner || isAdmin);
  const canApproveNow = !isLegacy && status === "Pending Approval" && step > 0 && canApproveStep(role, step);
  const canCancel = !isLegacy && ["Draft", "Pending Approval", "Rejected", "Approved"].includes(status) && (isOwner || isAdmin);

  const runAction = async (action: ProjectAction, extra: Record<string, any> = {}) => {
    if (!companyId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/projects/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, projectDocId: docId, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      setMessage({ text: `${ACTION_TH[action]}แล้ว` });
      setPending(null);
      setComment("");
      setProgressInput(null);
    } catch (e: any) {
      setMessage({ text: e.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  if (loading || (!own && legacyLoading)) {
    return <div className="p-10 text-center text-white/50 text-sm"><Loader2 className="animate-spin inline mr-2" size={16} />กำลังโหลดโครงการ...</div>;
  }
  if (!p) {
    return (
      <div className="p-10 text-center space-y-4">
        <p className="text-white/60">ไม่พบโครงการนี้</p>
        <PillButton variant="glass" onClick={() => router.push("/projects")} className="h-9 px-5">กลับไปหน้ารายการโครงการ</PillButton>
      </div>
    );
  }

  const name = p.projectName || p.title || p.name || "-";
  const code = p.projectId || docId;

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4 min-w-0">
        <PillButton variant="glass" onClick={() => router.push("/projects")} className="w-10 h-10 p-0 flex items-center justify-center shrink-0">
          <ArrowLeft size={20} />
        </PillButton>
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white tracking-tight">{name}</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold">{code}</span>
            <StatusBadge status={PROJECT_STATUS_BADGE[status]} label={PROJECT_STATUS_TH[status]} />
          </div>
          <p className="text-sm text-white/60 mt-1">
            {p.customerName || p.customer || "-"} · {p.projectType || "-"}
            {isLegacy && <span className="text-warning ml-2">(โครงการรุ่นเก่า แสดงผลอย่างเดียว)</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {canEditThis && (
          <PillButton variant="glass" onClick={() => router.push(`/projects/new?edit=${encodeURIComponent(docId)}`)} className="h-9 px-4 text-xs font-bold">
            <Pencil size={14} className="mr-1.5" /> {status === "Rejected" ? "แก้ไขและส่งอนุมัติใหม่" : "แก้ไข / ส่งอนุมัติ"}
          </PillButton>
        )}
        {status === "Approved" && canEditProject && !isLegacy && (
          <PillButton variant="confirm" disabled={busy} onClick={() => runAction("start")} className="h-9 px-4 text-xs font-bold">
            <PlayCircle size={14} className="mr-1.5" /> เริ่มดำเนินการ
          </PillButton>
        )}
        {status === "In Progress" && canEditProject && !isLegacy && (
          <PillButton variant="confirm" disabled={busy} onClick={() => runAction("complete")} className="h-9 px-4 text-xs font-bold">
            <CheckCircle2 size={14} className="mr-1.5" /> ปิดโครงการ
          </PillButton>
        )}
        {canCancel && (
          <PillButton variant="glass" disabled={busy} onClick={() => { setPending("cancel"); setComment(""); }} className="h-9 px-4 text-xs font-bold text-danger">
            <XCircle size={14} className="mr-1.5" /> ยกเลิกโครงการ
          </PillButton>
        )}
      </div>
    </div>
  );

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/50 shrink-0">{label}</span>
      <span className="text-[13px] text-white text-right break-words min-w-0">{value || "-"}</span>
    </div>
  );

  const overview = (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Briefcase size={16} className="text-nexus-teal" /> ข้อมูลโครงการ</h3>
        {infoRow("ลูกค้า", p.customerName || p.customer)}
        {infoRow("ประเภทงาน", p.projectType)}
        {infoRow("ประเภทลูกค้า", p.sectorType === "Government" ? "ภาครัฐ" : "เอกชน")}
        {infoRow("ลำดับความสำคัญ", p.priority)}
        {infoRow("เอกสารอ้างอิงลูกค้า", p.clientReference || p.clientRef)}
        {infoRow("ระยะเวลา", `${thDate(p.startDate)} – ${thDate(p.endDate || p.deadline)}`)}
        {p.sectorType === "Government" ? (
          <>
            {infoRow("เลขที่ TOR", p.governmentDetails?.torDocNo)}
            {infoRow("ราคากลาง", p.governmentDetails?.referencePrice ? baht(p.governmentDetails.referencePrice) : "-")}
            {infoRow("เลขที่สัญญา", p.governmentDetails?.govContractNo)}
          </>
        ) : (
          <>
            {infoRow("PO ลูกค้า", p.privateDetails?.customerPO)}
            {infoRow("เงื่อนไขการชำระเงิน", p.privateDetails?.paymentTerms)}
          </>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Users size={16} className="text-nexus-blue" /> ทีมงานและหน้างาน</h3>
        {infoRow("ผู้จัดการโครงการ", p.projectManager)}
        {infoRow("ทีมงาน", (p.resources || p.team || []).length ? (
          <span className="block space-y-0.5">
            {(p.resources || p.team || []).map((m: any, i: number) => (
              <span key={i} className="block">{m.name || m}{m.role ? ` · ${m.role}` : ""}{m.allocation ? ` (${m.allocation}%)` : ""}</span>
            ))}
          </span>
        ) : "-")}
        {infoRow(<><MapPin size={12} className="inline mr-1" />สถานที่</> as any, p.siteLocation)}
        {infoRow("ผู้ติดต่อหน้างาน", [p.siteContact?.name, p.siteContact?.phone].filter(Boolean).join(" · "))}
        {(p.followers || []).length > 0 && infoRow("ผู้ติดตามหน้างาน", (
          <span className="block space-y-0.5">
            {p.followers.map((f: any, i: number) => <span key={i} className="block">{f.name}{f.role ? ` · ${f.role}` : ""}{f.phone ? ` · ${f.phone}` : ""}</span>)}
          </span>
        ))}
        {infoRow("ใบงานช่างที่เกี่ยวข้อง", relatedWorkOrders.length ? relatedWorkOrders.map((w: any) => w.woCode || w.id).join(", ") : "-")}
      </GlassCard>
    </div>
  );

  const boq = (
    <NexusTable headers={["ที่", "รายการ", "ประเภท", "จำนวน", "หน่วย", "ราคาต่อหน่วย", "จำนวนเงิน", "ต้นทุนรวม"]}>
      {lines.length === 0 && (
        <NexusTableRow><NexusTableCell colSpan={8} className="text-center py-10 text-white/40">ยังไม่มีรายการ</NexusTableCell></NexusTableRow>
      )}
      {lines.map((l: any, i: number) =>
        l.kind === "GROUP" ? (
          <NexusTableRow key={l.lineId || i} className="bg-nexus-teal/5">
            <NexusTableCell colSpan={8} className="font-bold text-nexus-teal">{l.name}</NexusTableCell>
          </NexusTableRow>
        ) : (
          <NexusTableRow key={l.lineId || i}>
            <NexusTableCell>{i + 1}</NexusTableCell>
            <NexusTableCell>{l.name}{l.sku ? <span className="text-white/40 ml-2 font-mono text-[12px]">{l.sku}</span> : null}{l.isOptional ? <span className="text-warning ml-2 text-[12px]">(ทางเลือก)</span> : null}</NexusTableCell>
            <NexusTableCell>{KIND_TH[l.kind] || l.kind}</NexusTableCell>
            <NexusTableCell mono>{(Number(l.qty) || 0).toLocaleString("th-TH")}</NexusTableCell>
            <NexusTableCell>{l.unit}</NexusTableCell>
            <NexusTableCell mono>{baht(l.unitPrice)}</NexusTableCell>
            <NexusTableCell mono>{baht(l.amount)}</NexusTableCell>
            <NexusTableCell className="text-white/60">{baht(l.costAmount)}</NexusTableCell>
          </NexusTableRow>
        )
      )}
    </NexusTable>
  );

  const financeRow = (label: string, value: string, emphasis?: string) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-[13px] text-white/60">{label}</span>
      <span className={cn("text-[14px] font-mono font-bold", emphasis || "text-white")}>{value}</span>
    </div>
  );

  const finance = (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Wallet size={16} className="text-nexus-teal" /> งบประมาณที่อนุมัติ</h3>
        {financeRow("ราคาขายก่อนภาษี", baht(budget.totalRev), "text-nexus-teal")}
        {financeRow("ต้นทุนสินค้าและพัสดุ", baht(budget.equipCost))}
        {financeRow("ต้นทุนงานบริการและค่าแรง", baht(budget.laborCost))}
        {financeRow(`สำรองความเสี่ยง (${Math.round((budget.contingencyRate ?? 0.05) * 100)}%)`, baht(budget.contingencyBuffer))}
        {financeRow("กำไรขั้นต้น", `${baht(budget.grossProfit)} (${budget.gpPercent}%)`, budget.grossProfit < 0 ? "text-danger" : "text-white")}
        {financeRow("ภาษีมูลค่าเพิ่ม", baht(budget.vatAmount))}
        {financeRow("มูลค่ารวมภาษี", baht(budget.grandTotalWithVat))}
      </GlassCard>
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><ClipboardList size={16} className="text-warning" /> ต้นทุนจริงระหว่างดำเนินงาน</h3>
        {financeRow("ต้นทุนที่ประมาณการ", baht(p.allocatedCost ?? budget.totalCost))}
        {financeRow("ต้นทุนจริงสะสม", baht(p.actualCost), Number(p.actualCost) > Number(p.allocatedCost ?? budget.totalCost) ? "text-danger" : "text-white")}
        {financeRow("งานระหว่างทำ (WIP)", baht(p.wipValue))}
        {financeRow("คงเหลือตามงบ", baht((Number(p.allocatedCost ?? budget.totalCost) || 0) - (Number(p.actualCost) || 0)))}
        <p className="text-[12px] text-white/40 mt-3">ต้นทุนจริงมาจากค่าใช้จ่ายหน้างานที่บันทึกเข้าโครงการ (หน้าช่างมือถือ)</p>
      </GlassCard>
    </div>
  );

  const docs = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(p.documentChecklist || []).length === 0 && <p className="text-[13px] text-white/40">ไม่มีรายการเอกสารบังคับ</p>}
      {(p.documentChecklist || []).map((d: any) => (
        <div key={d.docCode} className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white">{d.docName}</p>
            <p className="text-[12px] text-white/40 font-mono">{d.docCode}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {d.isMandatory && <StatusBadge status="warning" label="บังคับ" />}
            <StatusBadge status={d.isAttached ? "active" : "inactive"} label={d.isAttached ? "แนบแล้ว" : "ยังไม่แนบ"} />
          </div>
        </div>
      ))}
    </div>
  );

  const history = (
    <GlassCard className="p-0 overflow-hidden">
      {(p.history || []).length === 0 && <p className="text-[13px] text-white/40 p-6">ยังไม่มีประวัติการดำเนินการ</p>}
      {[...(p.history || [])].reverse().map((h: any, i: number) => (
        <div key={i} className="px-5 py-3 border-b border-white/5 last:border-0">
          <p className="text-[13px] text-white">
            <span className="font-bold">{ACTION_TH[h.action] || h.action}</span>
            {h.action === "progress" ? ` ${h.progress}%` : ""} โดย {h.byName}
          </p>
          <p className="text-[12px] text-white/40">{thDateTime(h.at)}{h.comment ? ` · ${h.comment}` : ""}</p>
        </div>
      ))}
    </GlassCard>
  );

  const leftContent = (
    <div className="space-y-4 pb-10">
      {message && (
        <div className={cn("p-3 rounded-xl text-xs font-bold border", message.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>
          {message.text}
        </div>
      )}
      <PillTabs
        tabs={[
          { id: "overview", label: "ภาพรวม", icon: <Building2 size={14} /> },
          { id: "boq", label: `รายการ (${lines.filter((l: any) => l.kind !== "GROUP").length})`, icon: <Package size={14} /> },
          { id: "finance", label: "งบประมาณ", icon: <Wallet size={14} /> },
          { id: "docs", label: "เอกสารบังคับ", icon: <FileText size={14} /> },
          { id: "history", label: "ประวัติ", icon: <History size={14} /> },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />
      {tab === "overview" && overview}
      {tab === "boq" && boq}
      {tab === "finance" && finance}
      {tab === "docs" && docs}
      {tab === "history" && history}
    </div>
  );

  const progress = Number(p.progress) || 0;

  const rightSidebar = (
    <div className="space-y-4 p-4">
      {/* เหตุผลสำหรับไม่อนุมัติ / ยกเลิก */}
      {pending && (
        <GlassCard className="p-4 space-y-3 border-danger/30">
          <p className="text-sm font-bold text-white">{pending === "reject" ? "เหตุผลที่ไม่อนุมัติ" : "เหตุผลที่ยกเลิกโครงการ"}</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-[13px] text-white focus:outline-none focus:border-nexus-teal/40"
            placeholder="ระบุเหตุผล (จำเป็น)"
          />
          <div className="flex gap-2 justify-end">
            <PillButton variant="glass" onClick={() => setPending(null)} className="h-9 px-4 text-xs">ปิด</PillButton>
            <PillButton variant="confirm" disabled={busy || !comment.trim()} onClick={() => runAction(pending, { comment })} className="h-9 px-4 text-xs text-danger">
              ยืนยัน{pending === "reject" ? "ไม่อนุมัติ" : "ยกเลิก"}
            </PillButton>
          </div>
        </GlassCard>
      )}

      {/* ตัวเลขสำคัญ */}
      <GlassCard className="p-4 space-y-1">
        {financeRow("มูลค่าโครงการ", baht(budget.totalRev), "text-nexus-teal")}
        {financeRow("ต้นทุนประมาณการ", baht(budget.totalCost))}
        {financeRow("กำไรขั้นต้น", `${budget.gpPercent}%`, budget.gpPercent < 15 ? "text-warning" : "text-white")}
        {financeRow("ต้นทุนจริงสะสม", baht(p.actualCost))}
        <div className="pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] text-white/60">ความคืบหน้า</span>
            <span className="text-[13px] font-mono font-bold text-white">{progress}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-nexus-teal" style={{ width: `${progress}%` }} />
          </div>
          {!isLegacy && status !== "Cancelled" && (
            <p className="mt-2 text-[12px] text-white/50">
              {Array.isArray(p.milestones) && p.milestones.length ? `คำนวณจากงวดงาน ${p.milestones.length} งวด · ` : ""}
              <Link href={`/projects/milestones/new?project=${encodeURIComponent(docId)}`} className="text-nexus-teal hover:underline">
                {Array.isArray(p.milestones) && p.milestones.length ? "จัดการงวดงาน" : "แบ่งงวดงาน"}
              </Link>
            </p>
          )}
          {status === "In Progress" && canEditProject && !isLegacy && !(Array.isArray(p.milestones) && p.milestones.length) && (
            <div className="flex items-center gap-2 mt-3">
              <PillInput
                type="number"
                value={progressInput ?? progress}
                onChange={(e) => setProgressInput(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="h-9 w-24 text-sm font-mono text-right"
              />
              <span className="text-xs text-white/40">%</span>
              <PillButton variant="glass" disabled={busy || progressInput === null} onClick={() => runAction("progress", { progress: progressInput })} className="h-9 px-4 text-xs">
                บันทึกความคืบหน้า
              </PillButton>
            </div>
          )}
        </div>
        <div className="pt-3 text-[12px] text-white/40 flex items-center gap-1.5">
          <CalendarDays size={12} /> {thDate(p.startDate)} – {thDate(p.endDate || p.deadline)}
        </div>
      </GlassCard>

      {/* การอนุมัติ 3 ชั้น */}
      <GlassCard className="p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><ShieldCheck size={16} className="text-nexus-teal" /> การอนุมัติเปิดโครงการ</h3>
        {status === "Draft" && <p className="text-[12px] text-white/50">ยังไม่ได้ส่งขออนุมัติ (ฉบับร่าง)</p>}
        {APPROVAL_STEPS.map((def) => {
          const a = approvals.find((x: any) => Number(x.stepOrder) === def.stepOrder) || {};
          const isCurrent = status === "Pending Approval" && step === def.stepOrder;
          const st = a.status === "Approved" ? "active" : a.status === "Rejected" ? "danger" : isCurrent ? "pending" : "inactive";
          const label = a.status === "Approved" ? "อนุมัติแล้ว" : a.status === "Rejected" ? "ไม่อนุมัติ" : isCurrent ? "รออนุมัติ" : "ยังไม่ถึงขั้นนี้";
          return (
            <div key={def.stepOrder} className={cn("p-3 rounded-xl border", isCurrent ? "border-warning/30 bg-warning/5" : "border-white/10 bg-white/[0.02]")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-white">ขั้นที่ {def.stepOrder}: {def.title}</span>
                <StatusBadge status={st as any} label={label} />
              </div>
              <p className="text-[12px] text-white/50 mt-0.5">{def.description}</p>
              {a.byName && <p className="text-[12px] text-white/60 mt-1">{a.byName} · {thDateTime(a.at)}</p>}
              {a.comment && <p className="text-[12px] text-white/60 mt-0.5">“{a.comment}”</p>}
              {isCurrent && canApproveNow && (
                <div className="flex gap-2 mt-2">
                  <PillButton variant="confirm" disabled={busy} onClick={() => runAction("approve")} className="h-9 px-4 text-xs">อนุมัติ</PillButton>
                  <PillButton variant="glass" disabled={busy} onClick={() => { setPending("reject"); setComment(""); }} className="h-9 px-4 text-xs text-danger">ไม่อนุมัติ</PillButton>
                </div>
              )}
              {isCurrent && !canApproveNow && (
                <p className="text-[12px] text-white/40 mt-1">ผู้อนุมัติขั้นนี้: {def.roles.join(", ")}</p>
              )}
            </div>
          );
        })}
        {status === "Cancelled" && p.cancelReason && <p className="text-[12px] text-danger">ยกเลิกแล้ว: {p.cancelReason}</p>}
        <Link href="/projects" className="block text-center text-[12px] text-white/40 hover:text-white pt-1">กลับไปหน้ารายการโครงการ</Link>
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={headerContent} leftContent={leftContent} rightSidebar={rightSidebar} />;
}
