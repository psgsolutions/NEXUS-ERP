"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Copy, LayoutGrid, Loader2, Minus, Plus, Printer, QrCode, Save, Trash2, Warehouse } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { binLocation, isValidPartCode, MAX_BINS, MAX_LEVELS, rackPrefix, receivingLocation, type RackDef, type ZoneDef } from "@/lib/warehouse-location";

// สีประจำโซน (ใช้เป็นแถบระบุโซน ไม่ใช่สื่อความหมายสถานะ)
const ZONE_COLORS = ["#199e70", "#3b82f6", "#d97706", "#a855f7", "#e11d48", "#0891b2"];
const nextCode = (used: string[], prefix: string, width = 2) => { for (let i = 1; i < 1000; i++) { const c = `${prefix}${String(i).padStart(width, "0")}`; if (!used.includes(c)) return c; } return prefix; };
const nextLetter = (used: string[]) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((c) => !used.includes(c)) || nextCode(used, "Z");

type Sel = { zone: number; rack: number | null } | null;

export default function WarehouseLayoutPage() {
  const router = useRouter();
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const canEdit = can(roles, "inventory:edit");
  const [list, setList] = useState<any>(null);
  const [whId, setWhId] = useState("");
  const [zones, setZones] = useState<ZoneDef[]>([]);
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [saving, setSaving] = useState(false);
  const [newWh, setNewWh] = useState<{ code: string; name: string } | null>(null);

  const load = useCallback(async (keep?: string) => {
    if (!companyId) return;
    const res = await apiFetch("/api/inventory/warehouses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "list" }) });
    const d = await res.json();
    if (!d.success) return void showAlert(d.error || "โหลดผังคลังไม่สำเร็จ");
    setList(d);
    const id = keep || whId || d.warehouses[0]?.id || "";
    setWhId(id);
    const w = d.warehouses.find((x: any) => x.id === id);
    setZones(JSON.parse(JSON.stringify(w?.zones || [])));
    setDirty(false);
  }, [companyId, whId, showAlert]);
  useEffect(() => { load(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const wh = list?.warehouses.find((w: any) => w.id === whId);
  const whCode = wh?.code || "";
  const stock: Record<string, { qty: number; items: number }> = list?.stock || {};
  const totalLocations = zones.reduce((s, z) => s + z.racks.reduce((t, r) => t + r.levels * r.bins, 0), 0);

  const update = (fn: (z: ZoneDef[]) => void) => { setZones((prev) => { const next: ZoneDef[] = JSON.parse(JSON.stringify(prev)); fn(next); return next; }); setDirty(true); };
  const addZone = () => update((z) => { const code = nextLetter(z.map((x) => x.code)); z.push({ code, name: `โซน ${code}`, color: ZONE_COLORS[z.length % ZONE_COLORS.length], racks: [] }); setSel({ zone: z.length - 1, rack: null }); });
  const addRack = (zi: number, copyFrom?: RackDef) => update((z) => {
    const zone = z[zi];
    const code = nextCode(zone.racks.map((r) => r.code), "R");
    zone.racks.push({ code, name: "", levels: copyFrom?.levels || 4, bins: copyFrom?.bins || 3, note: "" });
    setSel({ zone: zi, rack: zone.racks.length - 1 });
  });
  const removeZone = async (zi: number) => {
    if (!(await showConfirm(`ลบโซน ${zones[zi].code} และชั้นวางทั้งหมดในโซนนี้?`))) return;
    update((z) => { z.splice(zi, 1); }); setSel(null);
  };
  const removeRack = async (zi: number, ri: number) => {
    if (!(await showConfirm(`ลบชั้นวาง ${zones[zi].racks[ri].code}?`))) return;
    update((z) => { z[zi].racks.splice(ri, 1); }); setSel({ zone: zi, rack: null });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/inventory/warehouses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "saveLayout", warehouseId: whId, zones }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      await load(whId);
      showAlert(`บันทึกผังแล้ว · ตำแหน่งจัดเก็บทั้งหมด ${d.locations} ตำแหน่ง`);
    } catch (e: any) { showAlert(e.message); } finally { setSaving(false); }
  };
  const createWh = async () => {
    if (!newWh) return;
    const res = await apiFetch("/api/inventory/warehouses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "create", ...newWh }) });
    const d = await res.json();
    if (!res.ok || !d.success) return void showAlert(d.error || "เพิ่มคลังไม่สำเร็จ");
    setNewWh(null); await load(d.id);
  };
  const switchWh = async (id: string) => {
    if (dirty && !(await showConfirm("ผังยังไม่ได้บันทึก ต้องการเปลี่ยนคลังโดยไม่บันทึก?"))) return;
    setSel(null); await load(id);
  };
  const printHref = (zone?: string, rack?: string) => `/inventory/locations/labels?wh=${encodeURIComponent(whId)}${zone ? `&zone=${encodeURIComponent(zone)}` : ""}${rack ? `&rack=${encodeURIComponent(rack)}` : ""}`;

  const zone = sel ? zones[sel.zone] : null;
  const rack = zone && sel?.rack !== null && sel?.rack !== undefined ? zone.racks[sel.rack] : null;

  const header = (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/inventory")} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">ผังคลังและชั้นวาง</h1>
          <p className="text-sm text-white/60 font-medium mt-1">คลัง › โซน › ชั้นวาง › ชั้น › ช่อง — ทุกช่องมีรหัสตำแหน่งสำหรับพิมพ์ QR และสแกนรับเข้าชั้นวาง</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <PillSelect value={whId} onChange={(e) => switchWh(e.target.value)} className="h-9 px-4 w-[240px] text-sm">
          {(list?.warehouses || []).map((w: any) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
        </PillSelect>
        {canEdit && <PillButton variant="glass" className="h-9 px-4 text-xs font-bold" onClick={() => setNewWh({ code: "", name: "" })}><Plus size={14} className="mr-1" /> เพิ่มคลัง</PillButton>}
        <PillButton variant="glass" className="h-9 px-4 text-xs font-bold" onClick={() => router.push(printHref())} disabled={!whId || dirty} title={dirty ? "บันทึกผังก่อนพิมพ์ฉลาก" : undefined}><Printer size={14} className="mr-1" /> พิมพ์ฉลาก QR ทั้งคลัง</PillButton>
        {canEdit && <PillButton variant="confirm" className="h-9 px-5 text-xs font-bold" onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />} บันทึกผัง</PillButton>}
      </div>
    </div>
  );

  const left = !list ? (
    <div className="py-16 flex items-center justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลดผังคลัง…</div>
  ) : (
    <div className="space-y-4 pb-10">
      {newWh && (
        <GlassCard className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1"><label className="block text-[12px] font-bold text-white/70 ml-1">รหัสคลัง</label><PillInput value={newWh.code} onChange={(e) => setNewWh({ ...newWh, code: e.target.value.toUpperCase() })} placeholder="WH-02" className="h-9 w-[140px] text-sm font-mono" /></div>
          <div className="space-y-1"><label className="block text-[12px] font-bold text-white/70 ml-1">ชื่อคลัง</label><PillInput value={newWh.name} onChange={(e) => setNewWh({ ...newWh, name: e.target.value })} placeholder="เช่น คลังสาขา 2" className="h-9 w-[260px] text-sm" /></div>
          <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" onClick={createWh}>เพิ่มคลัง</PillButton>
          <PillButton variant="ghost" className="h-9 px-4 text-xs" onClick={() => setNewWh(null)}>ยกเลิก</PillButton>
        </GlassCard>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["โซน", zones.length], ["ชั้นวาง", zones.reduce((s, z) => s + z.racks.length, 0)], ["ตำแหน่งจัดเก็บ", totalLocations], ["ตำแหน่งที่มีสินค้า", Object.keys(stock).filter((k) => k.startsWith(`${whCode}-`)).length]].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <p className="text-[12px] text-white/50">{l}</p>
            <p className="text-[18px] font-bold font-mono text-white">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* โครงสร้าง: โซน › ชั้นวาง */}
        <GlassCard className="p-4 w-full xl:w-[320px] flex-shrink-0 space-y-3 self-start">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-white flex items-center gap-2"><Warehouse size={16} className="text-nexus-teal" /> {wh?.name || "-"}</h3>
            {canEdit && <button type="button" onClick={addZone} className="text-[12px] text-nexus-teal hover:underline flex items-center gap-1"><Plus size={13} /> โซน</button>}
          </div>
          <div className="rounded-xl border border-dashed border-white/15 px-3 py-2 text-[12px] text-white/60 flex items-center justify-between">
            <span>พื้นที่รับสินค้า</span><span className="font-mono text-white/80">{receivingLocation(whCode)}</span>
          </div>
          {zones.length === 0 && <p className="text-[13px] text-white/40 text-center py-6">ยังไม่มีโซน กด &quot;+ โซน&quot; เพื่อเริ่มสร้างผัง</p>}
          {zones.map((z, zi) => (
            <div key={zi} className="space-y-1">
              <button type="button" onClick={() => setSel({ zone: zi, rack: null })}
                className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left", sel?.zone === zi && sel.rack === null ? "bg-white/[0.06] border-white/20" : "border-transparent hover:bg-white/[0.03]")}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: z.color || ZONE_COLORS[zi % ZONE_COLORS.length] }} />
                <span className="text-[13px] font-semibold text-white truncate">โซน {z.code}{z.name && z.name !== `โซน ${z.code}` ? ` · ${z.name}` : ""}</span>
                <span className="ml-auto text-[11px] text-white/40 whitespace-nowrap">{z.racks.length} ชั้นวาง</span>
              </button>
              <div className="pl-5 space-y-0.5">
                {z.racks.map((r, ri) => {
                  const used = Object.keys(stock).filter((k) => k.startsWith(rackPrefix(whCode, z.code, r.code) + "-")).length;
                  return (
                    <button key={ri} type="button" onClick={() => setSel({ zone: zi, rack: ri })}
                      className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left", sel?.zone === zi && sel.rack === ri ? "bg-nexus-teal/10 text-nexus-teal" : "text-white/70 hover:bg-white/[0.03]")}>
                      <LayoutGrid size={13} className="flex-shrink-0" />
                      <span className="text-[13px] truncate">{r.code}{r.name ? ` · ${r.name}` : ""}</span>
                      <span className="ml-auto text-[11px] text-white/40 whitespace-nowrap">{r.levels}×{r.bins}{used ? ` · มีของ ${used}` : ""}</span>
                    </button>
                  );
                })}
                {canEdit && <button type="button" onClick={() => addRack(zi)} className="w-full text-left px-3 py-1.5 text-[12px] text-white/40 hover:text-nexus-teal flex items-center gap-1"><Plus size={12} /> เพิ่มชั้นวาง</button>}
              </div>
            </div>
          ))}
        </GlassCard>

        {/* รายละเอียดที่เลือก */}
        <div className="flex-1 min-w-0 space-y-4">
          {!zone ? (
            <GlassCard className="p-10 text-center space-y-2">
              <Boxes size={28} className="mx-auto text-white/30" />
              <p className="text-[14px] text-white/70">เลือกโซนหรือชั้นวางทางซ้ายเพื่อแก้ไข</p>
              <p className="text-[12px] text-white/40">ขั้นตอน: เพิ่มโซน → เพิ่มชั้นวาง → กำหนดจำนวนชั้นและช่อง → บันทึกผัง → พิมพ์ฉลาก QR ติดแต่ละช่อง</p>
            </GlassCard>
          ) : !rack ? (
            <ZoneEditor zone={zone} canEdit={canEdit} whCode={whCode} stock={stock}
              onChange={(patch) => update((z) => { Object.assign(z[sel!.zone], patch); })}
              onRemove={() => removeZone(sel!.zone)}
              onOpenRack={(ri) => setSel({ zone: sel!.zone, rack: ri })}
              onAddRack={() => addRack(sel!.zone)}
              printHref={dirty ? "" : printHref(zone.code)} />
          ) : (
            <RackEditor zone={zone} rack={rack} whCode={whCode} stock={stock} canEdit={canEdit}
              onChange={(patch) => update((z) => { Object.assign(z[sel!.zone].racks[sel!.rack!], patch); })}
              onRemove={() => removeRack(sel!.zone, sel!.rack!)}
              onDuplicate={() => addRack(sel!.zone, rack)}
              printHref={dirty ? "" : printHref(zone.code, rack.code)} />
          )}
          {dirty && <p className="text-[12px] text-warning">มีการแก้ไขที่ยังไม่บันทึก กด &quot;บันทึกผัง&quot; เพื่อใช้งานตำแหน่งใหม่และพิมพ์ฉลาก</p>}
        </div>
      </div>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1"><label className="block text-[12px] font-bold text-white/70 ml-1">{label}</label>{children}</div>
);

function Stepper({ value, min, max, onChange, disabled }: { value: number; min: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className="w-9 h-9 rounded-full border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-30 flex items-center justify-center" aria-label="ลด"><Minus size={14} /></button>
      <span className="w-10 text-center font-mono font-bold text-white text-[15px]">{value}</span>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className="w-9 h-9 rounded-full border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-30 flex items-center justify-center" aria-label="เพิ่ม"><Plus size={14} /></button>
    </div>
  );
}

function ZoneEditor({ zone, canEdit, whCode, stock, onChange, onRemove, onOpenRack, onAddRack, printHref }: { zone: ZoneDef; canEdit: boolean; whCode: string; stock: Record<string, any>; onChange: (p: Partial<ZoneDef>) => void; onRemove: () => void; onOpenRack: (i: number) => void; onAddRack: () => void; printHref: string }) {
  const router = useRouter();
  const codeOk = isValidPartCode(zone.code);
  return (
    <GlassCard className="p-5 space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="รหัสโซน (ใช้ในรหัสตำแหน่ง)">
          <PillInput value={zone.code} disabled={!canEdit} onChange={(e) => onChange({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })} className={cn("h-9 w-[120px] text-sm font-mono", !codeOk && "border-danger")} />
        </Field>
        <Field label="ชื่อโซน"><PillInput value={zone.name || ""} disabled={!canEdit} onChange={(e) => onChange({ name: e.target.value })} placeholder="เช่น โซนอะไหล่" className="h-9 w-[240px] text-sm" /></Field>
        <Field label="สีโซน">
          <div className="flex gap-1.5 h-9 items-center">
            {ZONE_COLORS.map((c) => <button key={c} type="button" disabled={!canEdit} onClick={() => onChange({ color: c })} className={cn("w-6 h-6 rounded-full border-2", zone.color === c ? "border-white" : "border-transparent")} style={{ background: c }} aria-label="เลือกสี" />)}
          </div>
        </Field>
        <div className="ml-auto flex gap-2">
          <PillButton variant="glass" className="h-9 px-4 text-xs font-bold" disabled={!printHref} onClick={() => router.push(printHref)}><QrCode size={14} className="mr-1" /> พิมพ์ฉลากทั้งโซน</PillButton>
          {canEdit && <PillButton variant="ghost" className="h-9 px-4 text-xs text-danger" onClick={onRemove}><Trash2 size={14} className="mr-1" /> ลบโซน</PillButton>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
        {zone.racks.map((r, ri) => {
          const used = Object.keys(stock).filter((k) => k.startsWith(rackPrefix(whCode, zone.code, r.code) + "-")).length;
          return (
            <button key={ri} type="button" onClick={() => onOpenRack(ri)} className="text-left rounded-xl border border-white/10 bg-white/[0.02] hover:border-nexus-teal/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-white">{r.code}{r.name ? ` · ${r.name}` : ""}</span>
                <span className="text-[11px] text-white/40">{r.levels} ชั้น × {r.bins} ช่อง</span>
              </div>
              <MiniRack rack={r} />
              <p className="text-[11px] text-white/40">{r.levels * r.bins} ตำแหน่ง · มีสินค้า {used}</p>
            </button>
          );
        })}
        {canEdit && (
          <button type="button" onClick={onAddRack} className="rounded-xl border border-dashed border-white/15 hover:border-nexus-teal/40 text-white/40 hover:text-nexus-teal p-4 flex flex-col items-center justify-center gap-1 min-h-[150px]">
            <Plus size={18} /><span className="text-[13px]">เพิ่มชั้นวาง</span>
          </button>
        )}
      </div>
    </GlassCard>
  );
}

function MiniRack({ rack }: { rack: RackDef }) {
  const levels = Array.from({ length: rack.levels }, (_, i) => rack.levels - i);
  return (
    <div className="space-y-[3px]">
      {levels.map((l) => (
        <div key={l} className="flex gap-[3px]">
          {Array.from({ length: Math.min(rack.bins, 12) }, (_, b) => <div key={b} className="h-2.5 flex-1 rounded-[2px] bg-white/10" />)}
        </div>
      ))}
    </div>
  );
}

function RackEditor({ zone, rack, whCode, stock, canEdit, onChange, onRemove, onDuplicate, printHref }: { zone: ZoneDef; rack: RackDef; whCode: string; stock: Record<string, { qty: number; items: number }>; canEdit: boolean; onChange: (p: Partial<RackDef>) => void; onRemove: () => void; onDuplicate: () => void; printHref: string }) {
  const router = useRouter();
  const levels = Array.from({ length: rack.levels }, (_, i) => rack.levels - i); // ชั้นบนสุดอยู่ด้านบน
  const codeOk = isValidPartCode(rack.code);
  const [picked, setPicked] = useState<string>("");
  return (
    <GlassCard className="p-5 space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="รหัสชั้นวาง"><PillInput value={rack.code} disabled={!canEdit} onChange={(e) => onChange({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })} className={cn("h-9 w-[110px] text-sm font-mono", !codeOk && "border-danger")} /></Field>
        <Field label="ชื่อ/คำอธิบาย"><PillInput value={rack.name || ""} disabled={!canEdit} onChange={(e) => onChange({ name: e.target.value })} placeholder="เช่น สายไฟ" className="h-9 w-[200px] text-sm" /></Field>
        <Field label="จำนวนชั้น"><Stepper value={rack.levels} min={1} max={MAX_LEVELS} disabled={!canEdit} onChange={(n) => onChange({ levels: n })} /></Field>
        <Field label="ช่องต่อชั้น"><Stepper value={rack.bins} min={1} max={MAX_BINS} disabled={!canEdit} onChange={(n) => onChange({ bins: n })} /></Field>
        <div className="ml-auto flex gap-2 flex-wrap">
          <PillButton variant="glass" className="h-9 px-4 text-xs font-bold" disabled={!printHref} onClick={() => router.push(printHref)} title={!printHref ? "บันทึกผังก่อนพิมพ์" : undefined}><QrCode size={14} className="mr-1" /> พิมพ์ฉลากชั้นวางนี้</PillButton>
          {canEdit && <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={onDuplicate}><Copy size={14} className="mr-1" /> ทำซ้ำ</PillButton>}
          {canEdit && <PillButton variant="ghost" className="h-9 px-4 text-xs text-danger" onClick={onRemove}><Trash2 size={14} className="mr-1" /> ลบ</PillButton>}
        </div>
      </div>

      {/* มุมมองหน้าชั้นวาง: ชั้นบนสุดอยู่ด้านบน ช่องเรียงซ้าย→ขวา */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] text-white/70">มุมมองด้านหน้า · โซน {zone.code} · ชั้นวาง {rack.code}</span>
          <span className="text-[12px] text-white/40">คลิกช่องเพื่อดูรหัสตำแหน่ง</span>
        </div>
        <div className="space-y-1.5">
          {levels.map((l) => (
            <div key={l} className="flex items-stretch gap-1.5">
              <div className="w-12 flex-shrink-0 flex items-center justify-center text-[12px] font-mono text-white/50 rounded-lg bg-white/[0.03]">ชั้น {l}</div>
              <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${rack.bins}, minmax(0, 1fr))` }}>
                {Array.from({ length: rack.bins }, (_, b) => {
                  const code = binLocation(whCode, zone.code, rack.code, l, b + 1, rack.bins);
                  const s = stock[code];
                  return (
                    <button key={b} type="button" onClick={() => setPicked(code)} title={code}
                      className={cn("h-12 rounded-lg border text-[11px] font-mono flex flex-col items-center justify-center min-w-0 px-1",
                        picked === code ? "border-nexus-teal bg-nexus-teal/15 text-nexus-teal" : s ? "border-white/20 bg-white/[0.08] text-white" : "border-white/10 bg-white/[0.02] text-white/40 hover:border-white/25")}>
                      <span className="truncate max-w-full">{rack.bins > 1 ? `B${String(b + 1).padStart(2, "0")}` : `L${l}`}</span>
                      {s && <span className="text-[10px] text-white/60 truncate max-w-full">{s.items} รายการ</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className="text-white/50">รวม {rack.levels * rack.bins} ตำแหน่ง · รหัสแบบ <span className="font-mono text-white/70">{binLocation(whCode, zone.code, rack.code, 1, 1, rack.bins)}</span></span>
        {picked && <span className="text-white/80">ตำแหน่งที่เลือก: <span className="font-mono font-bold text-nexus-teal">{picked}</span>{stock[picked] ? ` · ${stock[picked].items} รายการ ${stock[picked].qty.toLocaleString("th-TH")} หน่วย` : " · ว่าง"}</span>}
      </div>
    </GlassCard>
  );
}
