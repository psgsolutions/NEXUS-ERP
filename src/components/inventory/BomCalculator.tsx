"use client";

/**
 * ตัวคำนวณสูตร BOM แบบมีตัวแปร: กรอกระยะ/ขนาดท่อ → รายการอุปกรณ์ ข้อต่อ ค่าแรง ต่อ 1 หน่วยงาน พร้อมต้นทุน ราคาขาย (markup)
 * ใช้ในหน้างานบริการ (ค่าเริ่มต้นของสูตร) และใบเสนอราคา (เฟส 3)
 */

import React, { useMemo, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { NexusTable, NexusTableCell, NexusTableRow, PillSelect, cn } from "@/components/ui/Base";
import { NumCell } from "@/components/projects/ProjectPlanEditors";
import { PIPE_SIZES, expandBom, salePrice, type BomInputs, type BomSettings, type BomSpec, type CodeResolver } from "@/lib/bom";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyText = (n: number) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 4 });
const TONE: Record<string, string> = { WEB: "text-nexus-blue", Y: "text-danger" };

export function BomCalculator({ spec, inputs, onInputs, settings, resolve, unit = "จุด", disabled, showCost = true }: {
  spec: BomSpec; inputs: BomInputs; onInputs: (v: BomInputs) => void; settings: BomSettings; resolve: CodeResolver; unit?: string; disabled?: boolean; showCost?: boolean;
}) {
  const res = useMemo(() => expandBom(spec, inputs, settings, resolve), [spec, inputs, settings, resolve]);
  // ค่าล่าสุดเสมอ (กรอก/กดแท็บเร็วต่อกันหลายช่อง ค่าช่องก่อนหน้าไม่หาย)
  const latest = useRef(inputs);
  latest.current = inputs;
  const setInput = (k: string, v: number | string) => { latest.current = { ...latest.current, [k]: v }; onInputs(latest.current); };
  const sale = salePrice(res.costPerUnit, settings.markup);
  const est = res.items.filter((i) => i.status === "Y");
  return (
    <div className="space-y-3" data-bom-calculator>
      <div className="flex flex-wrap gap-3 items-end">
        {spec.inputs.map((d) => (
          <label key={d.key} className="space-y-1 block">
            <span className="text-[11px] text-white/55">{d.label}{d.unit ? ` (${d.unit})` : ""}</span>
            {d.kind === "size" ? (
              <div className="w-[110px]">
                <PillSelect value={String(inputs[d.key] ?? "")} disabled={disabled} onChange={(e) => setInput(d.key, e.target.value)} className="h-9 w-full text-sm" aria-label={d.label}>
                  {PIPE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </PillSelect>
              </div>
            ) : d.kind === "choice" ? (
              <div className="w-[110px]">
                <PillSelect value={String(inputs[d.key] ?? d.default ?? d.options?.[0] ?? "")} disabled={disabled} onChange={(e) => setInput(d.key, Number(e.target.value))} className="h-9 w-full text-sm" aria-label={d.label}>
                  {(d.options || []).map((o) => <option key={o} value={String(o)}>{o}</option>)}
                </PillSelect>
              </div>
            ) : (
              <div className="w-[120px]"><NumCell kind="pct" value={Number(inputs[d.key]) || 0} disabled={disabled} onChange={(v) => setInput(d.key, v)} suffix={d.unit} /></div>
            )}
          </label>
        ))}
      </div>
      {res.missing.length > 0 && (
        <p className="flex gap-2 text-[12px] text-danger"><AlertTriangle size={14} className="shrink-0 mt-0.5" />ไม่พบราคากลางของ: {res.missing.join(", ")} — นำเข้าราคากลางให้ครบที่ คลัง › ราคากลาง</p>
      )}
      {est.length > 0 && <p className="flex gap-2 text-[12px] text-warning"><AlertTriangle size={14} className="shrink-0 mt-0.5" />มีราคาประมาณการ (ต้องยืนยัน) {est.length} รายการ: {est.map((i) => i.code).join(", ")}</p>}
      {showCost && (
        <NexusTable headers={["รหัส", "รายการ", "กลุ่ม", `จำนวน/${unit}`, "หน่วย", "ต้นทุน/หน่วย", `ต้นทุน/${unit}`]}>
          {res.items.map((i) => (
            <NexusTableRow key={i.code} className={cn(i.missing && "opacity-60")}>
              <NexusTableCell mono><span className={TONE[i.status || ""] || ""}>{i.code}</span></NexusTableCell>
              <NexusTableCell title={i.name}><span className={TONE[i.status || ""] || ""}>{i.name}</span>{i.labor && <span className="ml-1.5 text-[11px] text-white/40">ค่าแรง</span>}{i.roundJob && <span className="ml-1.5 text-[11px] text-white/40" title="รวมทั้งงานแล้วปัดขึ้น">ปัดทั้งงาน</span>}</NexusTableCell>
              <NexusTableCell><span className="text-[12px] text-white/55">{i.group}</span></NexusTableCell>
              <NexusTableCell align="right" mono>{qtyText(i.qtyPerUnit)}</NexusTableCell>
              <NexusTableCell>{i.unit}</NexusTableCell>
              <NexusTableCell align="right" mono>{i.missing ? "-" : money(i.unitCost)}</NexusTableCell>
              <NexusTableCell align="right" mono>{money(i.costPerUnit)}</NexusTableCell>
            </NexusTableRow>
          ))}
        </NexusTable>
      )}
      <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-[14px]" data-bom-total>
        {showCost && <span className="text-white/70">ต้นทุน/{unit} <b className="font-mono text-white">{money(res.costPerUnit)}</b></span>}
        <span className="text-white/70">ราคาขาย/{unit} (markup {Math.round(settings.markup * 1000) / 10}%) <b className="font-mono text-nexus-teal">{money(sale)}</b></span>
      </div>
    </div>
  );
}
