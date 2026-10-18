"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Mail, MessageCircle, Send, XCircle } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";

/**
 * ส่งเอกสารให้ลูกค้า/คู่ค้า: ลิงก์เปิดดู (ไม่ต้องล็อกอิน) / อีเมลจากระบบ / ส่งผ่าน LINE ของผู้ใช้
 * ไม่เก็บไฟล์ — ผู้รับเปิดลิงก์แล้วระบบสร้าง PDF จากข้อมูลที่บันทึกไว้
 */

interface ShareInfo { token: string; url: string; expiresAt: number; revoked: boolean; views: number; lastViewedAt: number | null }
interface SendInfo { channel: string; to: string; status: string; error: string; byName: string; at: number | null }
interface Status { internal: boolean; emailReady: boolean; shares: ShareInfo[]; sends: SendInfo[] }

const CHANNEL: Record<string, string> = { link: "สร้างลิงก์", line: "LINE", email: "อีเมล" };
const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-");

export function DocumentSharePanel({ type, id, title }: { type: string; id: string; title: string }) {
  const { companyId } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attach, setAttach] = useState(true);

  const call = useCallback(async (body: Record<string, any>) => {
    const res = await apiFetch("/api/documents/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, type, id, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "ทำรายการไม่สำเร็จ");
    return d;
  }, [companyId, type, id]);

  const refresh = useCallback(async () => {
    try { setStatus(await call({ action: "status" })); } catch (e: any) { setMsg({ text: e.message, error: true }); }
  }, [call]);
  useEffect(() => { if (companyId) refresh(); }, [companyId, refresh]);

  const now = Date.now();
  const active = status?.shares.filter((s) => !s.revoked && s.expiresAt > now).sort((a, b) => b.expiresAt - a.expiresAt)[0];

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setMsg(null);
    try { await fn(); await refresh(); } catch (e: any) { setMsg({ text: e.message, error: true }); } finally { setBusy(""); }
  };

  const copyLink = () => run("link", async () => {
    const d = await call({ action: "link", channel: "link" });
    await navigator.clipboard.writeText(d.url).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    setMsg({ text: "คัดลอกลิงก์แล้ว นำไปวางส่งให้ลูกค้าได้เลย" });
  });

  // เปิดหน้าต่างก่อนรอผล (เบราว์เซอร์บล็อก popup ที่เปิดหลัง await)
  const shareLine = () => {
    const w = window.open("", "_blank");
    run("line", async () => {
      try {
        const d = await call({ action: "link", channel: "line" });
        const text = `${d.title} เลขที่ ${d.number} จาก ${d.sellerName}\nเปิดดู/ดาวน์โหลด: ${d.url}`;
        const url = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
        if (w) w.location.href = url; else window.location.href = url;
        setMsg({ text: "เปิด LINE แล้ว เลือกแชทของลูกค้าเพื่อส่ง" });
      } catch (e) { w?.close(); throw e; }
    });
  };

  const sendEmail = () => run("email", async () => {
    const d = await call({ action: "email", to, cc, subject, message, attachPdf: attach });
    setMsg({ text: `ส่งอีเมลถึง ${d.to.join(", ")} แล้ว` });
    setTo(""); setCc("");
  });

  const revoke = (token: string) => run(`revoke:${token}`, async () => {
    await call({ action: "revoke", token });
    setMsg({ text: "ยกเลิกลิงก์แล้ว ผู้ที่ได้รับลิงก์นี้จะเปิดไม่ได้อีก" });
  });

  if (!status) return <div className="p-5 text-white/50 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> กำลังโหลด…</div>;
  if (status.internal) return <div className="p-5 text-white/60 text-[13px]">{title} เป็นเอกสารภายใน ส่งให้บุคคลภายนอกไม่ได้</div>;

  const label = "text-[12px] font-bold text-white/60 ml-1";
  return (
    <div className="p-4 space-y-5 text-[13px]">
      {msg && <div className={cn("rounded-xl px-3 py-2 text-[13px] font-semibold", msg.error ? "bg-danger/10 text-danger border border-danger/25" : "bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/25")}>{msg.text}</div>}

      <section className="space-y-2">
        <h4 className="text-[13px] font-bold text-white flex items-center gap-2"><Link2 size={15} /> ลิงก์เปิดดู / ดาวน์โหลด</h4>
        <p className="text-[12px] text-white/45">ผู้รับเปิดได้โดยไม่ต้องล็อกอิน ลิงก์ใช้ได้ 30 วัน ยกเลิกได้ทุกเมื่อ</p>
        {active && <p className="text-[12px] text-white/70 font-mono break-all bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">{active.url}</p>}
        <div className="grid grid-cols-2 gap-2">
          <PillButton variant="glass" className="h-9 text-xs font-bold" disabled={!!busy} onClick={copyLink}>
            {busy === "link" ? <Loader2 size={14} className="animate-spin" /> : copied ? <Check size={14} /> : <Copy size={14} />} คัดลอกลิงก์
          </PillButton>
          <PillButton variant="glass" className="h-9 text-xs font-bold" disabled={!!busy} onClick={shareLine}>
            {busy === "line" ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} ส่งผ่าน LINE
          </PillButton>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-[13px] font-bold text-white flex items-center gap-2"><Mail size={15} /> ส่งอีเมล</h4>
        {!status.emailReady ? (
          <p className="text-[12px] text-warning">ยังไม่ได้ตั้งค่าอีเมลของระบบ (ผู้ดูแลระบบต้องตั้ง Gmail App Password ก่อน) ระหว่างนี้ใช้ "คัดลอกลิงก์" แล้วส่งจากอีเมลของคุณได้</p>
        ) : (
          <>
            <div className="space-y-1"><label className={label}>ถึง (คั่นหลายอีเมลด้วย ,)</label><PillInput value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" className="h-9" inputMode="email" /></div>
            <div className="space-y-1"><label className={label}>สำเนา (CC)</label><PillInput value={cc} onChange={(e) => setCc(e.target.value)} placeholder="ไม่บังคับ" className="h-9" inputMode="email" /></div>
            <div className="space-y-1"><label className={label}>หัวเรื่อง</label><PillInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`${title} (ค่าเริ่มต้น)`} className="h-9" /></div>
            <div className="space-y-1">
              <label className={label}>ข้อความ</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="เรียน ลูกค้า ขอส่งเอกสารตามลิงก์ด้านล่าง (ค่าเริ่มต้น)"
                className="w-full px-4 py-2 leading-[1.9] rounded-2xl bg-white/[0.03] border border-white/10 text-white text-[14px] focus:outline-none focus:border-nexus-teal/40 placeholder:text-white/30 resize-none" />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-white/70 cursor-pointer"><input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} /> แนบไฟล์ PDF ไปด้วย</label>
            <PillButton variant="confirm" className="h-9 w-full text-xs font-bold" disabled={!!busy || !to.trim()} onClick={sendEmail}>
              {busy === "email" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} ส่งอีเมล
            </PillButton>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-[13px] font-bold text-white">ประวัติการส่ง</h4>
        {status.sends.length === 0 ? <p className="text-[12px] text-white/40">ยังไม่เคยส่ง</p> : (
          <div className="divide-y divide-white/[0.06]">
            {status.sends.map((s, i) => (
              <div key={i} className="py-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] text-white/80 truncate">{CHANNEL[s.channel] || s.channel}{s.to ? ` · ${s.to}` : ""}</p>
                  <p className="text-[11px] text-white/40 truncate">{when(s.at)} · {s.byName}</p>
                </div>
                <span className={cn("text-[11px] font-bold shrink-0", s.status === "failed" ? "text-danger" : "text-nexus-teal")} title={s.error}>{s.status === "failed" ? "ไม่สำเร็จ" : s.status === "sent" ? "ส่งแล้ว" : "สร้างลิงก์"}</span>
              </div>
            ))}
          </div>
        )}
        {status.shares.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[12px] font-bold text-white/60">ลิงก์ที่สร้าง</p>
            {status.shares.sort((a, b) => b.expiresAt - a.expiresAt).map((s) => {
              const live = !s.revoked && s.expiresAt > now;
              return (
                <div key={s.token} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className={cn("truncate", live ? "text-white/70" : "text-white/35 line-through")}>
                    …{s.token.slice(-6)} · เปิดดู {s.views} ครั้ง{s.lastViewedAt ? ` (ล่าสุด ${when(s.lastViewedAt)})` : ""} · {s.revoked ? "ยกเลิกแล้ว" : `ถึง ${new Date(s.expiresAt).toLocaleDateString("th-TH")}`}
                  </span>
                  {live && (
                    <button type="button" className="text-danger/80 hover:text-danger shrink-0" disabled={!!busy} onClick={() => revoke(s.token)} title="ยกเลิกลิงก์" aria-label="ยกเลิกลิงก์">
                      {busy === `revoke:${s.token}` ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
