"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrainCircuit, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { GlassCard, PillButton, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";

interface Msg { role: "user" | "model"; text: string; error?: boolean }

const SUGGESTIONS = [
  "สรุปรายได้ ค่าใช้จ่าย และกำไร 6 เดือนล่าสุด",
  "ลูกค้ารายไหนค้างชำระมากที่สุด และมีใบไหนเลยกำหนดบ้าง",
  "สินค้าตัวไหนใกล้หมดและควรสั่งซื้อเพิ่ม",
  "โครงการไหนใช้งบเกินหรือเสี่ยงไม่ทันกำหนด",
  "เงินเข้า-ออก 30 วันล่าสุดเป็นอย่างไร",
];

export default function AIHubPage() {
  const { companyId, role, roles } = useAuth();
  const allowed = can(roles, "finance:view");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy || !companyId) return;
    const history = messages.filter((m) => !m.error).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await apiFetch("/api/ai/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, question, history }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "AI ตอบไม่สำเร็จ");
      setMessages((m) => [...m, { role: "model", text: json.answer }]);
    } catch (err: any) {
      setMessages((m) => [...m, { role: "model", text: err.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/10"><BrainCircuit size={20} /></div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">ผู้ช่วยวิเคราะห์ธุรกิจ</h1>
            <p className="text-xs font-semibold text-white/60 mt-1 leading-none">ถามเป็นภาษาไทย AI ตอบจากข้อมูลจริงของบริษัท</p>
          </div>
        </div>
        {messages.length > 0 && (
          <PillButton variant="glass" onClick={() => setMessages([])} disabled={busy} className="h-8 px-3 text-xs"><RotateCcw size={13} className="mr-1.5" /> เริ่มใหม่</PillButton>
        )}
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-4xl mx-auto space-y-4">
          {!allowed && <div className="p-3 rounded-xl text-xs font-bold border bg-warning/10 border-warning/20 text-warning">ผู้ช่วยวิเคราะห์ใช้ได้เฉพาะผู้มีสิทธิ์ดูข้อมูลการเงิน</div>}

          {messages.length === 0 && allowed && (
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold"><Sparkles size={18} className="text-nexus-teal" /> ลองถามเช่น</div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="px-3.5 py-2 rounded-full border border-white/10 bg-white/[0.03] text-[13px] text-white/80 hover:border-nexus-teal/40 hover:text-white transition-colors text-left">{s}</button>
                ))}
              </div>
              <p className="text-[12px] text-white/40">ระบบส่งเฉพาะตัวเลขสรุป (ยอดขาย ลูกหนี้ เจ้าหนี้ สต็อก โครงการ) ให้ AI ไม่ส่งเงินเดือนรายคน เลขบัตรประชาชน หรือเลขบัญชีธนาคาร · คำตอบควรตรวจสอบกับรายงานก่อนตัดสินใจ</p>
            </GlassCard>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap",
                m.role === "user" ? "bg-nexus-teal/15 border border-nexus-teal/25 text-white" : m.error ? "bg-danger/10 border border-danger/20 text-danger" : "bg-white/[0.04] border border-white/10 text-white/90",
              )}>
                {m.text}
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-[13px] text-white/50"><Loader2 size={14} className="animate-spin" /> กำลังวิเคราะห์ข้อมูล...</div>}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-white/5 bg-black/20 p-4 pr-24 shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="max-w-4xl mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            rows={1}
            disabled={!allowed || busy}
            placeholder="พิมพ์คำถาม แล้วกด Enter (Shift+Enter ขึ้นบรรทัดใหม่)"
            className="flex-1 min-h-[44px] max-h-40 resize-none rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 text-[14px] text-white focus:outline-none focus:border-nexus-teal/40"
          />
          <PillButton type="submit" variant="confirm" disabled={!allowed || busy || !input.trim()} className="h-11 w-11 p-0 flex items-center justify-center shrink-0" title="ส่งคำถาม">
            <Send size={16} />
          </PillButton>
        </form>
      </div>
    </div>
  );
}
