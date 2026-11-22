"use client";

/**
 * BOM รวมทั้งใบเสนอราคา (เห็นเฉพาะผู้ดูต้นทุนได้) — แสดงเมื่อมีบรรทัดงานบริการแบบสูตร BOM
 *  - อุปกรณ์/ค่าแรงรวมทั้งงาน ปัดขึ้นเฉพาะรายการนับชิ้น · ส่วนต่างจากการปัด → เพิ่ม/อัปเดตบรรทัดเหมาต่องาน
 *  - คำเตือน: กำไรต่ำกว่าเกณฑ์ · ราคาประมาณการ · ไม่พบราคากลาง
 *  - รายการขอซื้อ: สินค้ากลาง → รุ่นที่ซื้อจริง (หน่วยซื้อ ปัดขึ้น)
 *  - ค่าแรง: ที่เสนอ (ราคากลาง) เทียบอัตราช่างที่ผูกรหัสค่าแรงกลาง
 */

import React, { useMemo } from "react";
import { AlertTriangle, Layers } from "lucide-react";
import { NexusTable, NexusTableCell, NexusTableRow, PillButton, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { canViewCost } from "@/lib/permissions";
import type { BomSettings, CodeResolver } from "@/lib/bom";
import { crewRatesByCode, laborCompare, purchaseRows, quoteBom, roundingLine } from "@/lib/bom-quote";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyText = (n: number) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const TONE: Record<string, string> = { WEB: "text-nexus-blue", Y: "text-danger" };

export function QuoteBomPanel({ items, settings, resolve, products, isLocked, onUpsertRounding }: {
  items: any[]; settings: BomSettings; resolve: CodeResolver; products: any[]; isLocked?: boolean; onUpsertRounding: (line: Record<string, any>) => void;
}) {
  const { roles } = useAuth();
  const seeCost = canViewCost(roles);
  const q = useMemo(() => quoteBom(items, settings, resolve), [items, settings, resolve]);
  const byId = useMemo(() => new Map<string, any>(products.map((p: any) => [p.id, p])), [products]);
  const buy = useMemo(() => purchaseRows(q.rows, byId), [q.rows, byId]);
  const labor = useMemo(() => laborCompare(q.rows, crewRatesByCode(products)), [q.rows, products]);
  if (!seeCost || !q.lines.length) return null;

  const rounding = items.find((i) => i.bomRounding);
  const roundingOk = rounding ? Math.abs(Number(rounding.cost || 0) - Math.max(0, q.roundingDiff)) < 0.005 : q.roundingDiff <= 0.005;
  const otherSale = q.sale + (rounding ? Number(rounding.price || 0) * Number(rounding.qty || 1) : 0);
  const totalCost = q.cost;
  const markup = totalCost > 0 ? otherSale / totalCost - 1 : null;
  const unmapped = buy.filter((b) => !b.mapped).length;

  return (
    <details className="border-t border-white/10 px-4 py-3" data-quote-bom>
      <summary className="cursor-pointer text-[12px] font-bold text-nexus-teal flex items-center gap-2 flex-wrap">
        <Layers size={13} /> BOM ทั้งใบ ({q.lines.length} บรรทัด · {q.rows.length} รายการ)
        <span className="font-normal text-white/60">ต้นทุนหลังปัด {money(totalCost)} · ราคาขาย {money(otherSale)}{markup !== null ? ` · markup ${Math.round(markup * 1000) / 10}%` : ""}</span>
        {q.warnings.length > 0 && <span className="font-normal text-warning flex items-center gap-1"><AlertTriangle size={12} /> เตือน {q.warnings.length}</span>}
        <span className="font-normal text-white/40">(เห็นเฉพาะผู้ดูต้นทุนได้)</span>
      </summary>

      <div className="mt-3 space-y-4">
        {q.warnings.length > 0 && (
          <ul className="space-y-1" data-quote-bom-warnings>
            {q.warnings.map((w, i) => (
              <li key={i} className={cn("flex gap-2 text-[12px]", w.kind === "estimated" ? "text-warning" : w.kind === "lowMarkup" ? "text-warning" : "text-danger")}>
                <AlertTriangle size={13} className="shrink-0 mt-0.5" /><span><b>{w.name}</b>: {w.text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-white/70" data-quote-bom-rounding>
          <span>ต้นทุนรวมของบรรทัด (ก่อนปัด) <b className="font-mono text-white">{money(q.lineCost)}</b></span>
          <span>ต้นทุนหลังปัดทั้งงาน <b className="font-mono text-white">{money(q.cost)}</b></span>
          <span>ส่วนต่างจากการปัด <b className="font-mono text-white">{money(q.roundingDiff)}</b></span>
          {!isLocked && q.roundingDiff > 0.005 && !roundingOk && (
            <PillButton type="button" variant="glass" className="h-8 px-3 text-[12px]" data-add-rounding onClick={() => onUpsertRounding(roundingLine(q.roundingDiff, settings))}>
              {rounding ? "อัปเดตบรรทัดส่วนต่างการปัด" : "เพิ่มบรรทัดส่วนต่างการปัด (เหมาต่องาน)"}
            </PillButton>
          )}
          {rounding && roundingOk && <span className="text-nexus-teal">มีบรรทัดส่วนต่างการปัดแล้ว</span>}
        </div>

        <NexusTable headers={["รหัส", "รายการ", "กลุ่ม", "จำนวนรวม", "หน่วย", "ต้นทุน/หน่วย", "ต้นทุนรวม"]}>
          {q.rows.map((r) => (
            <NexusTableRow key={r.code} className={cn(r.missing && "opacity-60")}>
              <NexusTableCell mono><span className={TONE[r.status || ""] || ""}>{r.code}</span></NexusTableCell>
              <NexusTableCell title={r.name}><span className={TONE[r.status || ""] || ""}>{r.name}</span>{r.labor && <span className="ml-1.5 text-[11px] text-white/40">ค่าแรง</span>}</NexusTableCell>
              <NexusTableCell><span className="text-[12px] text-white/55">{r.group}</span></NexusTableCell>
              <NexusTableCell align="right" mono>{qtyText(r.qty)}</NexusTableCell>
              <NexusTableCell>{r.unit}</NexusTableCell>
              <NexusTableCell align="right" mono>{r.missing ? "-" : money(r.unitCost)}</NexusTableCell>
              <NexusTableCell align="right" mono>{money(r.cost)}</NexusTableCell>
            </NexusTableRow>
          ))}
        </NexusTable>

        <div className="space-y-2" data-quote-bom-purchase>
          <p className="text-[12px] font-bold text-white/80">รายการที่ต้องซื้อ (รุ่นจริง)
            {unmapped > 0 && <span className="ml-2 font-normal text-warning">ยังไม่ผูกรุ่นจริง {unmapped} รายการ — ผูกได้ที่หน้าสินค้า › รุ่นที่ซื้อจริง</span>}
          </p>
          <NexusTable headers={["รายการในใบเสนอราคา", "รุ่นที่ซื้อ", "จำนวนซื้อ", "หน่วย"]}>
            {buy.map((b) => (
              <NexusTableRow key={b.productId || b.code}>
                <NexusTableCell title={b.genericName}>{b.genericName} <span className="text-[11px] text-white/40 font-mono">{qtyText(b.genericQty)} {b.genericUnit}</span></NexusTableCell>
                <NexusTableCell title={b.name}>{b.mapped ? b.name : <span className="text-warning">ยังไม่ผูก (ซื้อตามสินค้ากลาง)</span>}</NexusTableCell>
                <NexusTableCell align="right" mono>{qtyText(b.qty)}</NexusTableCell>
                <NexusTableCell>{b.unit}</NexusTableCell>
              </NexusTableRow>
            ))}
          </NexusTable>
        </div>

        {labor.length > 0 && (
          <div className="space-y-2" data-quote-bom-labor>
            <p className="text-[12px] font-bold text-white/80">ค่าแรง: ที่เสนอเทียบอัตราช่าง <span className="font-normal text-white/50">(ผูกรหัสค่าแรงกลางได้ที่หน้าช่าง › อัตราค่าแรง)</span></p>
            <NexusTable headers={["รหัส", "งาน", "จำนวน", "ที่เสนอ", "ช่าง", "อัตราช่าง", "ต้นทุนจริง", "ส่วนต่าง"]}>
              {labor.flatMap((l) => (l.crews.length ? l.crews : [null]).map((c, i) => (
                <NexusTableRow key={`${l.code}-${c?.productId || i}`}>
                  <NexusTableCell mono>{i === 0 ? l.code : ""}</NexusTableCell>
                  <NexusTableCell title={l.name}>{i === 0 ? l.name : ""}</NexusTableCell>
                  <NexusTableCell align="right" mono>{i === 0 ? `${qtyText(l.qty)} ${l.unit}` : ""}</NexusTableCell>
                  <NexusTableCell align="right" mono>{i === 0 ? money(l.quotedCost) : ""}</NexusTableCell>
                  <NexusTableCell>{c ? c.contractorName || "-" : <span className="text-white/40">ยังไม่มีช่างที่ผูกรหัสนี้</span>}</NexusTableCell>
                  <NexusTableCell align="right" mono>{c ? money(c.rate) : "-"}</NexusTableCell>
                  <NexusTableCell align="right" mono>{c ? money(c.cost) : "-"}</NexusTableCell>
                  <NexusTableCell align="right" mono>{c ? <span className={c.diff > 0 ? "text-danger" : "text-nexus-teal"}>{c.diff > 0 ? "+" : ""}{money(c.diff)}</span> : "-"}</NexusTableCell>
                </NexusTableRow>
              )))}
            </NexusTable>
          </div>
        )}
      </div>
    </details>
  );
}
