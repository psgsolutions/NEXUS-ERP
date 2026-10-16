"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, PillButton, PillInput, PillSelect } from "@/components/ui/Base";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";

const money = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => (n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const dateTh = (d: string) => { if (!d) return "-"; const [y, m, dd] = d.split("-").map(Number); return `${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`; };
const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
const TYPE: Record<string, string> = { IN: "รับเข้า", OUT: "เบิกออก", SALE: "ขาย", RETURN: "รับคืน", ADJUST: "ปรับปรุง", TRANSFER: "โอนย้าย" };

/** บัญชีคุมสินค้า (stock card) รายสินค้า: รับ จ่าย คงเหลือ และต้นทุนเฉลี่ย */
export default function StockCardPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { companyId } = useAuth();
  const [productId, setProductId] = useState(search?.get("product") || "");
  const [from, setFrom] = useState(() => `${thisMonth().slice(0, 4)}-01`);
  const [to, setTo] = useState(thisMonth);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/reports/subledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, report: "stock-card", from, to, productId }) });
      const r = await res.json();
      if (!res.ok || !r.success) throw new Error(r.error || "โหลดข้อมูลไม่สำเร็จ");
      setData(r);
      if (!productId && r.productId) setProductId(r.productId);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [companyId, from, to, productId]);
  useEffect(() => { load(); }, [load]);

  const card = data?.card;
  const cost = !!data?.showCost;
  const exportCsv = () => {
    if (!card) return;
    const head = ["วันที่", "อ้างอิง", "ประเภท", "ตำแหน่ง", "รับ", "จ่าย", "คงเหลือ", ...(cost ? ["ต้นทุนต่อหน่วย", "ต้นทุนเฉลี่ย", "มูลค่าคงเหลือ"] : [])];
    const rows = card.entries.map((e: any) => [dateTh(e.date), e.ref, TYPE[e.type] || e.type, e.location, e.inQty, e.outQty, e.balanceQty, ...(cost ? [e.unitCost, e.wac, e.value] : [])]);
    const csv = "﻿" + [[`บัญชีคุมสินค้า ${data.product?.sku || ""} ${data.product?.name || ""}`], head, ["", "", "ยอดยกมา", "", "", "", card.openingQty], ...rows].map((r) => r.join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `stock-card_${data.product?.sku || productId}_${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.push("/inventory")} className="w-10 h-10 p-0 flex items-center justify-center"><ArrowLeft size={20} /></PillButton>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">บัญชีคุมสินค้า</h1>
          <p className="text-sm text-white/60 font-medium mt-1">ความเคลื่อนไหวรายสินค้า รับ จ่าย คงเหลือ{cost ? " และต้นทุนเฉลี่ยถ่วงน้ำหนัก" : ""}</p>
        </div>
      </div>
    </div>
  );

  const left = (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <PillSelect value={productId} onChange={(e) => setProductId(e.target.value)} className="h-9 px-4 w-[420px] max-w-full text-sm">
          {(data?.products || []).length === 0 && <option value="">ยังไม่มีสินค้า</option>}
          {(data?.products || []).map((p: any) => <option key={p.id} value={p.id}>{p.sku ? `${p.sku} · ` : ""}{p.name}</option>)}
        </PillSelect>
        <PillInput type="month" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-9 w-[160px] px-4 text-sm font-mono" aria-label="ตั้งแต่เดือน" />
        <span className="text-white/40 text-sm">ถึง</span>
        <PillInput type="month" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-9 w-[160px] px-4 text-sm font-mono" aria-label="ถึงเดือน" />
        <PillButton variant="glass" className="h-9 px-4 text-xs font-bold ml-auto" onClick={exportCsv} disabled={!card}><Download size={14} className="mr-1.5" /> ส่งออก Excel</PillButton>
      </div>
      {error && <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-bold">{error}</div>}
      <GlassCard accentColor="teal" className="p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/5 flex-wrap">
          <div>
            <h3 className="text-[16px] font-semibold text-white leading-normal">{data?.product ? `${data.product.sku ? data.product.sku + " · " : ""}${data.product.name}` : "เลือกสินค้า"}</h3>
            <p className="text-[13px] text-white/50 leading-normal">หน่วย {data?.product?.unit || "-"}</p>
          </div>
          {card && <span className="text-[13px] text-white/70">คงเหลือสิ้นงวด <span className="font-mono font-bold text-white">{qty(card.closingQty)}</span>{cost && <> · มูลค่า <span className="font-mono font-bold text-white">{money(card.closingValue)}</span></>}</span>}
        </div>
        {loading && !card ? (
          <div className="py-16 flex items-center justify-center gap-2 text-[13px] text-white/40"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>
        ) : !card ? (
          <div className="py-16 text-center text-[13px] text-white/40">ไม่มีข้อมูล</div>
        ) : (
          <NexusTable headers={["วันที่", "เลขที่อ้างอิง", "ประเภท", "ตำแหน่ง", "รับ", "จ่าย", "คงเหลือ", ...(cost ? ["ต้นทุนต่อหน่วย", "ต้นทุนเฉลี่ย", "มูลค่าคงเหลือ"] : [])]} itemCount={card.entries.length}>
            <NexusTableRow className="bg-white/[0.03] cursor-default">
              <NexusTableCell>{""}</NexusTableCell><NexusTableCell>{""}</NexusTableCell>
              <NexusTableCell className="font-bold text-white">ยอดยกมา</NexusTableCell><NexusTableCell>{""}</NexusTableCell>
              <NexusTableCell>{""}</NexusTableCell><NexusTableCell>{""}</NexusTableCell>
              <NexusTableCell mono className="font-bold text-white">{qty(card.openingQty)}</NexusTableCell>
              {cost && <><NexusTableCell>{""}</NexusTableCell><NexusTableCell>{""}</NexusTableCell><NexusTableCell mono className="font-bold text-white">{money(card.openingValue)}</NexusTableCell></>}
            </NexusTableRow>
            {card.entries.length === 0 && (
              <NexusTableRow className="cursor-default"><NexusTableCell colSpan={cost ? 10 : 7} className="text-center text-[13px] text-white/40 py-10">ไม่มีความเคลื่อนไหวในช่วงนี้</NexusTableCell></NexusTableRow>
            )}
            {card.entries.map((e: any, i: number) => (
              <NexusTableRow key={i} className="cursor-default">
                <NexusTableCell mono>{dateTh(e.date)}</NexusTableCell>
                <NexusTableCell mono>{e.ref || "-"}</NexusTableCell>
                <NexusTableCell>{TYPE[e.type] || e.type || "-"}</NexusTableCell>
                <NexusTableCell mono>{e.location || "-"}</NexusTableCell>
                <NexusTableCell mono>{e.inQty ? qty(e.inQty) : "-"}</NexusTableCell>
                <NexusTableCell mono>{e.outQty ? qty(e.outQty) : "-"}</NexusTableCell>
                <NexusTableCell mono className={e.balanceQty < 0 ? "text-danger" : ""}>{qty(e.balanceQty)}</NexusTableCell>
                {cost && <><NexusTableCell mono>{money(e.unitCost)}</NexusTableCell><NexusTableCell mono>{money(e.wac)}</NexusTableCell><NexusTableCell mono>{money(e.value)}</NexusTableCell></>}
              </NexusTableRow>
            ))}
          </NexusTable>
        )}
      </GlassCard>
    </div>
  );

  return <NexusPageLayout header={header} leftContent={left} />;
}
