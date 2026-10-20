"use client";

import React, { useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { ShoppingCart, X } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, cn } from "@/components/ui/Base";
import { WhatHappens } from "@/components/guide/Guidance";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { apiFetch } from "@/lib/api-client";

/**
 * ขอซื้อตาม BOQ ของโครงการ: เลือกรายการสินค้า/วัสดุ ใส่จำนวนที่ต้องการ -> ใบขอซื้อ 1 ใบอ้างอิงโครงการ
 * แสดงจำนวนที่ขอซื้อไปแล้ว (ใบขอซื้อของโครงการนี้ที่ยังไม่ยกเลิก) เพื่อไม่ขอซ้ำ — แอดมินออกใบสั่งซื้อต่อจากใบขอซื้อ
 */
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const keyOf = (l: any) => String(l.sku || l.productId || l.name || "").trim().toLowerCase();

export function BoqPurchasePanel({ companyId, docId, project, lines, requester, onClose }: { companyId: string; docId: string; project: any; lines: any[]; requester: string; onClose: () => void }) {
  const constraints = useMemo(() => [where("projectId", "==", docId)], [docId]);
  const { data: prs } = useRealtimeCollection<any>(`companies/${companyId}/purchase_requests`, constraints);
  const requested = useMemo(() => {
    const m = new Map<string, number>();
    for (const pr of prs) {
      if (["CANCELLED", "REJECTED"].includes(String(pr.status || "").toUpperCase())) continue;
      for (const it of Array.isArray(pr.items) ? pr.items : []) m.set(keyOf(it), (m.get(keyOf(it)) || 0) + (Number(it.qty) || 0));
    }
    return m;
  }, [prs]);

  const buyable = useMemo(() => lines.filter((l) => l.kind === "PRODUCT" && (Number(l.qty) || 0) > 0 && !l.isOptional), [lines]);
  const [pick, setPick] = useState<Record<string, string>>(() =>
    Object.fromEntries(buyable.map((l, i) => {
      const left = Math.max(0, (Number(l.qty) || 0) - (requested.get(keyOf(l)) || 0));
      return [String(l.lineId || i), left > 0 ? String(left) : ""];
    })));
  const [requiredDate, setRequiredDate] = useState(todayBkk());
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = buyable.map((l, i) => ({ l, qty: Number(pick[String(l.lineId || i)]) || 0 })).filter((x) => x.qty > 0);
  const total = chosen.reduce((s, x) => s + x.qty * (Number(x.l.unitCost) || 0), 0);

  const submit = async () => {
    if (!chosen.length) return setMsg({ text: "เลือกรายการและใส่จำนวนอย่างน้อย 1 รายการ", error: true });
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/api/procurement/purchase-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, action: "create",
          header: {
            requester, department: "โครงการ", requestDate: todayBkk(), requiredDate, priority: "NORMAL",
            projectId: docId, projectName: String(project?.projectName || project?.name || ""),
            reason: `ขอซื้อตาม BOQ โครงการ ${project?.projectCode || project?.projectNo || ""} ${project?.projectName || ""}`.trim(),
          },
          items: chosen.map(({ l, qty }) => ({ productId: l.productId || null, sku: l.sku || "", name: l.name, details: l.details || "", itemType: "PRODUCT", qty, unit: l.unit || "ชิ้น", price: Number(l.unitCost) || 0, cost: Number(l.unitCost) || 0 })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "สร้างใบขอซื้อไม่สำเร็จ");
      setMsg({ text: `สร้างใบขอซื้อ ${d.prCode || d.prId || d.id || ""} แล้ว — รออนุมัติ แล้วแอดมินออกใบสั่งซื้อต่อ` });
      setPick({});
    } catch (e: any) {
      setMsg({ text: e.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard accentColor="teal" className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-white"><ShoppingCart size={17} className="text-nexus-teal" /> ขอซื้อตาม BOQ</h3>
        <button type="button" onClick={onClose} aria-label="ปิด" className="p-1.5 rounded-full text-white/50 hover:text-white"><X size={16} /></button>
      </div>
      <WhatHappens items={["สร้างใบขอซื้อ 1 ใบ อ้างอิงโครงการนี้ (ต้นทุนเข้าโครงการเมื่อซื้อจริง)", "ผู้อนุมัติอนุมัติ แล้วแอดมินการเงินออกใบสั่งซื้อ/สั่งของ", "จำนวนที่ตั้งไว้ให้ = จำนวนใน BOQ ลบที่ขอซื้อไปแล้ว"]} />
      {msg && <div className={cn("p-3 rounded-xl text-xs font-bold border", msg.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{msg.text}</div>}
      {!buyable.length ? (
        <p className="text-[13px] text-white/55">BOQ นี้ไม่มีรายการสินค้า/วัสดุ (ค่าแรงและบริการไม่ต้องขอซื้อ)</p>
      ) : (
        <>
          <NexusTable headers={["รายการ", "จำนวนใน BOQ", "ขอแล้ว", "จำนวนที่ขอซื้อ", "หน่วย", "ต้นทุนต่อหน่วย"]}>
            {buyable.map((l, i) => {
              const k = String(l.lineId || i);
              return (
                <NexusTableRow key={k}>
                  <NexusTableCell className="text-white/85">{l.name}{l.sku ? <span className="text-white/40 ml-2 font-mono text-[12px]">{l.sku}</span> : null}</NexusTableCell>
                  <NexusTableCell mono>{(Number(l.qty) || 0).toLocaleString("th-TH")}</NexusTableCell>
                  <NexusTableCell mono className="text-white/60">{(requested.get(keyOf(l)) || 0).toLocaleString("th-TH")}</NexusTableCell>
                  <NexusTableCell><PillInput inputMode="decimal" value={pick[k] ?? ""} onChange={(e) => setPick((p) => ({ ...p, [k]: e.target.value.replace(/[^\d.]/g, "") }))} className="h-8 w-24 text-right font-mono text-sm" /></NexusTableCell>
                  <NexusTableCell>{l.unit}</NexusTableCell>
                  <NexusTableCell mono>{money(Number(l.unitCost) || 0)}</NexusTableCell>
                </NexusTableRow>
              );
            })}
          </NexusTable>
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <span className="text-[13px] text-white/60">ต้องการภายใน</span>
            <PillInput type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className="h-9 w-[160px] text-sm font-mono" />
            <span className="text-[13px] text-white/60">{chosen.length} รายการ · ประมาณ <span className="font-mono text-white">{money(total)}</span> บาท</span>
            <PillButton variant="primary" onClick={submit} disabled={busy || !chosen.length} className="h-9 px-5 text-xs">{busy ? "กำลังสร้าง..." : "สร้างใบขอซื้อ"}</PillButton>
          </div>
        </>
      )}
    </GlassCard>
  );
}
