"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileStack, LayoutGrid, List, Loader2, Search } from "lucide-react";
import { GlassCard, PillButton, PillInput, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { renderPdfPages } from "@/components/settings/usePdfPageImage";
import { money, thaiDate } from "@/lib/documents/format";

/**
 * ประวัติเอกสาร — เอกสารและหนังสือที่บริษัทออกทั้งหมด (เฉพาะชนิดที่ผู้ใช้มีสิทธิ์เปิด)
 * ดูเป็นภาพหน้าเอกสาร (โหลดเมื่อเลื่อนมาถึง) หรือเป็นรายการ · คลิกเพื่อเปิดดูเต็ม พิมพ์ ดาวน์โหลด ส่งต่อ
 */
const TYPE_LABEL: Record<string, string> = {
  quotation: "ใบเสนอราคา", sales_order: "ใบสั่งขาย", invoice: "ใบกำกับภาษี/ใบแจ้งหนี้", billing_note: "ใบวางบิล", receipt: "ใบเสร็จรับเงิน",
  delivery_note: "ใบส่งของ", cndn: "ใบลดหนี้/เพิ่มหนี้", purchase_order: "ใบสั่งซื้อ", payment: "ใบสำคัญจ่าย", work_order: "ใบสั่งงาน", letter: "หนังสือ",
};
type Row = { type: string; id: string; number: string; party: string; date: string; amount: number | null; status: string; cancelled: boolean; createdAt: string };

// ภาพย่อ: เก็บไว้ทั้งหน้า · วาดทีละ 2 ฉบับ (อ่านข้อมูลจากฐานข้อมูลเท่าที่เห็นบนจอ)
const thumbs = new Map<string, string>();
let running = 0;
const queue: (() => void)[] = [];
const runQueued = (job: () => Promise<void>) => new Promise<void>((done) => {
  const go = () => { running++; job().finally(() => { running--; done(); queue.shift()?.(); }); };
  if (running < 2) go(); else queue.push(go);
});

function Thumb({ row, companyId }: { row: Row; companyId: string }) {
  const key = `${row.type}:${row.id}`;
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(thumbs.get(key) || "");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (url) return;
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      runQueued(async () => {
        try {
          const res = await apiFetch("/api/documents/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, type: row.type, id: row.id, format: "json" }) });
          const d = await res.json();
          if (!res.ok || !d.success) throw new Error(d.error);
          const [img] = await renderPdfPages(d.document, 240, 1);
          thumbs.set(key, img);
          if (alive) setUrl(img);
        } catch { if (alive) setFailed(true); }
      });
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [key, url, companyId, row.type, row.id]);
  return (
    <div ref={ref} className="w-full aspect-[1/1.414] rounded-md bg-white overflow-hidden flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- ภาพหน้าเอกสารที่วาดในเบราว์เซอร์ (data URL) */}
      {url ? <img src={url} alt={`${TYPE_LABEL[row.type]} ${row.number}`} className="w-full h-full object-cover object-top" />
        : failed ? <span className="text-[11px] text-slate-400">แสดงภาพไม่ได้</span> : <Loader2 size={16} className="animate-spin text-slate-300" />}
    </div>
  );
}

export default function DocumentHistoryPage() {
  const { companyId } = useAuth();
  const [types, setTypes] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState<Row | null>(null);

  const load = useCallback(async (t: string, after?: string) => {
    if (!companyId) return;
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/documents/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, type: t, ...(after ? { after } : {}) }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "โหลดประวัติเอกสารไม่สำเร็จ");
      setTypes(d.types);
      setRows((old) => (after ? [...old, ...d.docs] : d.docs));
      setMore(!!d.more);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { load(type); }, [load, type]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? rows.filter((r) => `${r.number} ${r.party}`.toLowerCase().includes(k)) : rows;
  }, [rows, q]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center gap-3 bg-black/20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><FileStack size={20} /></div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">ประวัติเอกสาร</h1>
          <p className="text-xs font-semibold text-white/60 mt-1 leading-none">เอกสารและหนังสือที่บริษัทออกแล้ว — คลิกเพื่อดูภาพเอกสาร พิมพ์ซ้ำ หรือส่งต่อ</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1600px] mx-auto space-y-4">
          <GlassCard className="p-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {["", ...types].map((t) => (
                <button key={t || "all"} type="button" onClick={() => setType(t)}
                  className={cn("h-8 px-3 rounded-full text-[12.5px] border", type === t ? "border-nexus-teal/60 bg-nexus-teal/15 text-nexus-teal font-bold" : "border-white/10 text-white/60 hover:text-white")}>{t ? TYPE_LABEL[t] || t : "ทั้งหมด (ล่าสุด)"}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-[420px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <PillInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขที่ หรือชื่อลูกค้า/ผู้ขาย/ผู้รับ" className="w-full h-9 pl-8 text-sm" />
              </div>
              <div className="ml-auto flex rounded-full bg-white/5 p-1 border border-white/10">
                {([["grid", "ภาพเอกสาร", LayoutGrid], ["list", "รายการ", List]] as const).map(([v, label, I]) => (
                  <button key={v} type="button" onClick={() => setView(v)} className={cn("h-8 px-3 rounded-full text-[12.5px] flex items-center gap-1.5", view === v ? "bg-nexus-teal/20 text-nexus-teal font-bold" : "text-white/55 hover:text-white")}><I size={14} /> {label}</button>
                ))}
              </div>
            </div>
            {!type && <p className="text-[11.5px] text-white/40">ทั้งหมด = ฉบับล่าสุดของแต่ละชนิด · เลือกชนิดเพื่อดูย้อนหลังทั้งหมด</p>}
          </GlassCard>

          {error && <div className="p-3 rounded-xl text-xs font-bold border bg-danger/10 border-danger/20 text-danger">{error}</div>}
          {!loading && !shown.length && !error && <GlassCard className="p-8 text-center text-[13px] text-white/55">ยังไม่มีเอกสาร{q ? "ที่ตรงกับคำค้น" : ""}</GlassCard>}

          {view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-7 gap-3">
              {shown.map((r) => (
                <button key={`${r.type}:${r.id}`} type="button" onClick={() => setOpen(r)} className="text-left rounded-xl border border-white/10 bg-white/[0.02] hover:border-nexus-teal/50 p-2 space-y-1.5 transition-colors">
                  <div className="relative">
                    {companyId && <Thumb row={r} companyId={companyId} />}
                    {r.cancelled && <span className="absolute top-1.5 right-1.5 text-[10.5px] px-1.5 py-0.5 rounded bg-danger text-white font-bold">ยกเลิก</span>}
                  </div>
                  <p className="text-[11px] text-nexus-teal font-semibold truncate">{TYPE_LABEL[r.type] || r.type}</p>
                  <p className="text-[13px] text-white font-bold truncate font-mono">{r.number}</p>
                  <p className="text-[12px] text-white/60 truncate">{r.party || "-"}</p>
                  <div className="flex items-center justify-between text-[11.5px] text-white/50">
                    <span>{r.date ? thaiDate(r.date) : "-"}</span>
                    {r.amount !== null && <span className="font-mono text-white/75">{money(r.amount)}</span>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <GlassCard className="p-0 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-white/50 text-[12px]">
                  <tr className="border-b border-white/10">
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">วันที่</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">ชนิด</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">เลขที่</th>
                    <th className="text-left font-semibold px-3 py-2 w-full">ลูกค้า/ผู้ขาย/ผู้รับ</th>
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">จำนวนเงิน</th>
                    <th className="text-center font-semibold px-3 py-2 whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={`${r.type}:${r.id}`} onClick={() => setOpen(r)} className="border-b border-white/5 hover:bg-white/5 cursor-pointer">
                      <td className="px-3 py-2 whitespace-nowrap text-white/70">{r.date ? thaiDate(r.date) : "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-white/70">{TYPE_LABEL[r.type] || r.type}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-white font-mono">{r.number}</td>
                      <td className="px-3 py-2 text-white/80 truncate max-w-0">{r.party || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-white/80">{r.amount !== null ? money(r.amount) : "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">{r.cancelled ? <span className="text-danger text-[12px] font-bold">ยกเลิก</span> : <span className="text-white/50 text-[12px]">{r.status || "-"}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}

          {loading && <div className="py-6 flex justify-center gap-2 text-white/40 text-sm"><Loader2 size={16} className="animate-spin" /> กำลังโหลด…</div>}
          {more && !loading && type && (
            <div className="flex justify-center">
              <PillButton variant="glass" className="h-9 px-5 text-xs" onClick={() => load(type, rows[rows.length - 1]?.createdAt)}>โหลดเพิ่ม</PillButton>
            </div>
          )}
        </div>
      </div>

      <DocumentPdfModal open={!!open} onClose={() => setOpen(null)} title={open ? `${TYPE_LABEL[open.type] || ""} ${open.number}` : ""} source={open ? { type: open.type, id: open.id } : undefined} shareSource={open && open.type !== "letter" ? { type: open.type, id: open.id } : undefined} />
    </div>
  );
}
