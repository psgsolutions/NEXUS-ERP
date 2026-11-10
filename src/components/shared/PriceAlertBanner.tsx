"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { GlassCard, PillButton, cn } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { apiFetch } from "@/lib/api-client";
import { keepMarginPrice } from "@/lib/price-alerts";

const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "-" : `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}%`);

/**
 * แถบเตือน "ต้นทุนเปลี่ยน" บนหน้าใบเสนอราคา/โครงการ (มาจากการรับสินค้าที่ราคาล็อตใหม่ต่างจากเดิมเกิน 5%)
 * ใช้ราคาซื้อล่าสุดเป็นต้นทุน (ราคาขายคงเดิม) หรือรับทราบ · แสดงราคาขายที่คงกำไรต่อหน่วยเดิมให้ปรับเองได้
 */
export function PriceAlertBanner({ companyId, docType, docId, onApplied }: { companyId: string; docType: "quotation" | "project"; docId: string; onApplied?: () => void }) {
  const { showAlert } = useSystemDialog();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!companyId || !docId) return;
    const res = await apiFetch("/api/price-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "list", docType, docId }) });
    const d = await res.json().catch(() => ({}));
    if (d.success) setAlerts(d.alerts || []);
  }, [companyId, docType, docId]);
  useEffect(() => { load(); }, [load]);

  const act = async (a: any, action: "apply" | "dismiss") => {
    setBusy(a.id + action);
    try {
      const res = await apiFetch("/api/price-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action, alertId: a.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "ทำรายการไม่สำเร็จ");
      setAlerts((x) => x.filter((y) => y.id !== a.id));
      if (action === "apply") { showAlert(`ปรับต้นทุน ${a.productName} เป็น ${money(a.newCost)} บาทแล้ว · GP ใหม่ ${d.gpAfter ?? "-"}%`, "ปรับต้นทุนแล้ว", "info"); onApplied?.(); }
    } catch (e: any) { showAlert(e.message, "ทำรายการไม่สำเร็จ", "error"); } finally { setBusy(""); }
  };

  if (!alerts.length) return null;
  return (
    <div data-price-alerts>
    <GlassCard className="p-4 border-warning/30 bg-warning/10 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-warning shrink-0" />
        <p className="text-[14px] font-bold text-warning">ต้นทุนสินค้าเปลี่ยน {alerts.length} รายการ — ต้นทุนใน{docType === "quotation" ? "ใบเสนอราคา" : "โครงการ"}นี้ยังเป็นราคาเดิม</p>
      </div>
      <div className="space-y-2">
        {alerts.map((a) => {
          const up = Number(a.newCost) > Number(a.lineCost);
          const Trend = up ? TrendingUp : TrendingDown;
          const suggest = keepMarginPrice(Number(a.unitPrice) || 0, Number(a.lineCost) || 0, Number(a.newCost) || 0);
          return (
            <div key={a.id} className="rounded-xl border border-white/10 bg-surface-0/60 p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[14px] font-semibold text-white truncate">{a.productName || a.productId}</p>
                {a.viaRecipe && <p className="text-[12px] text-white/60">วัสดุในสูตรงานบริการ: {a.materialName} ราคาซื้อล่าสุด <b className="font-mono text-white/85">{money(a.materialCost)}</b></p>}
                <p className="text-[12px] text-white/70 flex flex-wrap items-center gap-x-2">
                  <span>{a.viaRecipe ? "ต้นทุนงานในเอกสาร" : "ทุนในเอกสาร"} <b className="font-mono text-white/90">{money(a.lineCost)}</b></span>
                  <span>→ {a.viaRecipe ? "ต้นทุนใหม่" : "ราคาซื้อล่าสุด"} <b className="font-mono text-white/90">{money(a.newCost)}</b></span>
                  <span className={cn("inline-flex items-center gap-1 font-bold", up ? "text-danger" : "text-success")}><Trend size={12} /> {pct(a.changePct)}</span>
                  <span>· GP <b className="text-white/90">{a.gpBefore ?? "-"}%</b> → <b className={cn(up ? "text-danger" : "text-success")}>{a.gpAfter ?? "-"}%</b></span>
                </p>
                <p className="text-[11px] text-white/50">
                  {a.supplierName ? `จาก ${a.supplierName} · ` : ""}ใบรับสินค้า {a.grNo}
                  {suggest !== Number(a.unitPrice) && Number(a.unitPrice) > 0 ? ` · ราคาขายที่คงกำไรต่อหน่วยเดิม ≈ ${money(suggest)} (ตอนนี้ ${money(a.unitPrice)})` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <PillButton variant="primary" className="h-8 px-3 text-xs" disabled={!!busy} onClick={() => act(a, "apply")} title="เปลี่ยนต้นทุนในเอกสารเป็นราคาซื้อล่าสุด ราคาขายที่เสนอลูกค้าคงเดิม">
                  {busy === a.id + "apply" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} ใช้ราคาซื้อล่าสุดเป็นต้นทุน
                </PillButton>
                <PillButton variant="ghost" className="h-8 px-3 text-xs" disabled={!!busy} onClick={() => act(a, "dismiss")}>รับทราบ</PillButton>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-white/50">ราคาขายที่ส่งลูกค้าแล้วไม่เปลี่ยนอัตโนมัติ — ถ้าต้องปรับราคาขาย ให้แก้ราคาหรือออกฉบับปรับปรุง (revision)</p>
    </GlassCard>
    </div>
  );
}
