"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, ExternalLink, Search, Trash2 } from "lucide-react";
import { NexusTable, NexusTableCell, NexusTableRow, PillButton, PillCheckbox, PillInput, PillTabs, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can, type Permission } from "@/lib/permissions";
import { useCustomers, useSuppliers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

/**
 * จัดการข้อมูลที่นำเข้าจาก Excel แล้ว (อ่านจากฐานข้อมูล — ใช้ได้แม้ปิดหน้า/โหลดใหม่)
 *  - เลือกทีละรายการ หรือเลือกทั้งหมดตามคำค้น · เปิดดู/แก้ไขที่หน้ารายการ
 *  - ลบ: ได้เมื่อยังไม่ถูกใช้ในเอกสาร (คืนเลขผู้เสียภาษี/รหัสให้นำเข้าใหม่ได้ · สินค้าที่มีแค่ยอดยกมา กลับรายการยอดยกมาให้)
 *  - ถูกใช้แล้ว: ตั้งเป็นระงับใช้งานแทน (ลูกค้า ผู้ขาย สินค้า) · พนักงานที่มีประวัติ เปลี่ยนสถานะเป็นลาออกที่หน้าพนักงาน
 */
type Kind = "customers" | "suppliers" | "products" | "employees";

interface Row { id: string; code: string; name: string; detail: string; status: string; href: string; raw: any }

// ลบ: รายการที่นำเข้าจาก Excel ใช้สิทธิ์เดียวกับการนำเข้า (server ตรวจซ้ำ)
const KINDS: { id: Kind; label: string; view: Permission; remove: Permission; suspend?: Permission }[] = [
  { id: "customers", label: "ลูกค้า", view: "sales:view", remove: "sales:edit", suspend: "sales:edit" },
  { id: "suppliers", label: "ผู้ขาย", view: "procurement:view", remove: "procurement:edit", suspend: "procurement:edit" },
  { id: "products", label: "สินค้า", view: "inventory:view", remove: "inventory:edit", suspend: "inventory:edit" },
  { id: "employees", label: "พนักงาน", view: "hr:view", remove: "hr:edit" },
];

const imported = (r: any) => r && r.importedFrom === "excel" && r.isDeleted !== true;
const inactive = (k: Kind, r: any) =>
  k === "products" ? ["PHASE_OUT", "DISCONTINUED", "INACTIVE"].includes(String(r.lifecycleStatus || "").toUpperCase())
  : k === "employees" ? r.status === "resigned"
  : r.isActive === false || String(r.status || "").toLowerCase() === "inactive";

function toRow(k: Kind, r: any): Row {
  if (k === "products") return { id: r.id, code: r.sku || r.productCode || r.id, name: r.name || "", detail: `${r.unit || r.baseUnit || ""}${r.stockStatus?.onHand ? ` · คงเหลือ ${r.stockStatus.onHand}` : ""}`, status: inactive(k, r) ? "เลิกขาย" : "ใช้งาน", href: `/inventory/${r.id}`, raw: r };
  if (k === "employees") return { id: r.id, code: r.employeeId || r.id, name: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim(), detail: r.position || "", status: inactive(k, r) ? "ลาออก" : "ปฏิบัติงาน", href: `/hr/employees/${r.id}`, raw: r };
  const code = k === "customers" ? r.customerId || r.id : r.supplierCode || r.id;
  return { id: r.id, code, name: r.name || r.customerName || r.supplierName || "", detail: r.taxId || r.tax_id || "", status: inactive(k, r) ? "ระงับใช้งาน" : "ใช้งาน", href: k === "customers" ? `/customers/${r.id}` : `/procurement/suppliers/${r.id}`, raw: r };
}

type Source = { data: any[]; loading: boolean };
const useRows = (kind: Kind, src: Source) =>
  useMemo(() => (src.data || []).filter(imported).map((r: any) => toRow(kind, r)).sort((a, b) => a.code.localeCompare(b.code)), [src.data, kind]);

// โหลดเฉพาะชนิดที่เปิดดู (หนึ่ง component ต่อชนิด — ประหยัดการอ่านฐานข้อมูล)
function CustomersPanel() { const src = useCustomers<any>(); return <KindPanel kind="customers" rows={useRows("customers", src)} loading={src.loading} />; }
function SuppliersPanel() { const src = useSuppliers<any>(); return <KindPanel kind="suppliers" rows={useRows("suppliers", src)} loading={src.loading} />; }
function ProductsPanel() { const src = useProducts<any>(); return <KindPanel kind="products" rows={useRows("products", src)} loading={src.loading} />; }
function EmployeesPanel() { const src = useRealtimeCollection<any>("employees"); return <KindPanel kind="employees" rows={useRows("employees", src)} loading={src.loading} />; }
const PANELS: Record<Kind, () => React.ReactElement> = { customers: CustomersPanel, suppliers: SuppliersPanel, products: ProductsPanel, employees: EmployeesPanel };

export function ImportedRecordsManager() {
  const { roles } = useAuth();
  const kinds = KINDS.filter((k) => can(roles, k.view));
  const [kind, setKind] = useState<Kind>(kinds[0]?.id || "customers");
  if (!kinds.length) return null;
  return (
    <div className="space-y-4">
      <PillTabs className="w-full" tabs={kinds.map((k) => ({ id: k.id, label: k.label }))} activeTab={kind} onTabChange={(id) => setKind(id as Kind)} />
      {React.createElement(PANELS[kind], { key: kind })}
    </div>
  );
}

function KindPanel({ kind, rows, loading }: { kind: Kind; rows: Row[]; loading: boolean }) {
  const { companyId, roles } = useAuth();
  const { showConfirm } = useSystemDialog();
  const meta = KINDS.find((k) => k.id === kind)!;
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => `${r.code} ${r.name} ${r.detail}`.toLowerCase().includes(t)) : rows;
  }, [rows, q]);
  const chosen = shown.filter((r) => picked.has(r.id));
  const allOn = shown.length > 0 && chosen.length === shown.length;
  const canRemove = can(roles, meta.remove);
  const canSuspend = !!meta.suspend && can(roles, meta.suspend);

  const toggle = (id: string) => setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(shown.map((r) => r.id)));

  const post = async (url: string, body: Record<string, any>) => {
    const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.success === false) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  };

  const run = async (mode: "remove" | "suspend") => {
    if (!chosen.length || busy) return;
    const text = mode === "remove"
      ? `ลบ${meta.label}ที่นำเข้า ${chosen.length} รายการ? — ลบได้เฉพาะรายการที่ยังไม่ถูกใช้ในเอกสาร${kind === "products" ? " (สินค้าที่มีแค่ยอดยกมา ระบบกลับรายการยอดยกมาให้)" : ""} · รายการที่ใช้แล้วจะแจ้งเหตุผล`
      : `ตั้ง${meta.label} ${chosen.length} รายการเป็นระงับใช้งาน? — ข้อมูลและประวัติยังอยู่ แต่เลือกใช้ในเอกสารใหม่ไม่ได้`;
    if (!(await showConfirm(text))) return;
    setBusy(true); setSummary("");
    let ok = 0;
    const next: typeof notes = {};
    for (const r of chosen) {
      try {
        if (mode === "remove") {
          if (kind === "employees") await post("/api/hr/employees", { action: "delete", employeeDocId: r.id });
          else {
            const d = await post("/api/master-data", { action: "remove", entity: kind, id: r.id });
            // ผู้ขายที่นำเข้า สร้างผู้รับเหมารหัสเดียวกันไว้ด้วย
            if (kind === "suppliers") await post("/api/master-data", { action: "remove", entity: "contractors", id: r.id }).catch(() => undefined);
            next[r.id] = { ok: true, text: d.reversedOpeningQty ? `ลบแล้ว · กลับรายการยอดยกมา ${d.reversedOpeningQty}` : "ลบแล้ว" };
            ok++;
            continue;
          }
          next[r.id] = { ok: true, text: "ลบแล้ว" };
        } else {
          const changes = kind === "products" ? { lifecycleStatus: "PHASE_OUT" } : kind === "customers" ? { status: "INACTIVE", isActive: false } : { status: "inactive", isActive: false };
          await post("/api/master-data", { action: "update", entity: kind, id: r.id, scope: "company", changes });
          next[r.id] = { ok: true, text: "ระงับใช้งานแล้ว" };
        }
        ok++;
      } catch (err: any) {
        next[r.id] = { ok: false, text: err.message };
      }
    }
    setNotes((cur) => ({ ...cur, ...next }));
    setPicked(new Set(chosen.filter((r) => !next[r.id]?.ok).map((r) => r.id)));
    setSummary(`${mode === "remove" ? "ลบ" : "ระงับใช้งาน"}แล้ว ${ok} จาก ${chosen.length} รายการ${ok < chosen.length ? " — ที่เหลือดูเหตุผลในตาราง (ยังเลือกไว้ กดระงับใช้งานแทนได้)" : ""}`);
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <PillInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={`ค้นหา${meta.label}ที่นำเข้า (รหัส ชื่อ เลขผู้เสียภาษี)`} className="w-full h-9 pl-9" />
        </div>
        <span className="text-[12px] text-white/60">เลือก <span className="font-mono font-bold text-white">{chosen.length}</span> / {shown.length}</span>
        {canSuspend && <PillButton variant="ghost" onClick={() => run("suspend")} disabled={busy || !chosen.length} className="h-9 px-4 text-xs"><Ban size={13} /> ระงับใช้งาน</PillButton>}
        {canRemove && <PillButton variant="danger" onClick={() => run("remove")} disabled={busy || !chosen.length} className="h-9 px-4 text-xs"><Trash2 size={13} /> {busy ? "กำลังดำเนินการ…" : `ลบที่เลือก (${chosen.length})`}</PillButton>}
      </div>
      {summary && <p className="text-[12px] text-white/70">{summary}</p>}
      {loading ? (
        <p className="text-[12px] text-white/50 py-6 text-center">กำลังโหลด…</p>
      ) : !rows.length ? (
        <p className="text-[12px] text-white/50 py-6 text-center">ยังไม่มี{meta.label}ที่นำเข้าจาก Excel</p>
      ) : (
        <NexusTable headers={["เลือก", "รหัส", "ชื่อ", kind === "products" ? "หน่วย/คงเหลือ" : kind === "employees" ? "ตำแหน่ง" : "เลขผู้เสียภาษี", "สถานะ", "ผลล่าสุด", ""]} itemCount={shown.length}>
          <NexusTableRow>
            <NexusTableCell><PillCheckbox checked={allOn} onChange={toggleAll} aria-label="เลือกทั้งหมด" /></NexusTableCell>
            <NexusTableCell className="text-[12px] text-white/60" colSpan={6}>เลือกทั้งหมด{q ? "ที่ตรงกับคำค้น" : ""} ({shown.length})</NexusTableCell>
          </NexusTableRow>
          {shown.map((r) => (
            <NexusTableRow key={r.id} onClick={() => toggle(r.id)} className={cn("cursor-pointer", picked.has(r.id) && "bg-nexus-teal/10")}>
              <NexusTableCell><span onClick={(e) => e.stopPropagation()}><PillCheckbox checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`เลือก ${r.name}`} /></span></NexusTableCell>
              <NexusTableCell className="font-mono text-[12px] text-nexus-blue">{r.code}</NexusTableCell>
              <NexusTableCell className="text-white/85">{r.name}</NexusTableCell>
              <NexusTableCell className="font-mono text-[12px] text-white/60">{r.detail || "-"}</NexusTableCell>
              <NexusTableCell className="text-[12px] text-white/70">{r.status}</NexusTableCell>
              <NexusTableCell className={cn("text-[12px]", notes[r.id] ? (notes[r.id].ok ? "text-nexus-teal" : "text-danger") : "text-white/30")} title={notes[r.id]?.text}>{notes[r.id]?.text || "-"}</NexusTableCell>
              <NexusTableCell>
                <span onClick={(e) => e.stopPropagation()}>
                  <Link href={r.href} target="_blank" className="inline-flex items-center gap-1 text-[12px] text-white/70 hover:text-white"><ExternalLink size={12} /> เปิด/แก้ไข</Link>
                </span>
              </NexusTableCell>
            </NexusTableRow>
          ))}
        </NexusTable>
      )}
    </div>
  );
}
