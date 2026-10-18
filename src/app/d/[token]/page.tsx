"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, ExternalLink, FileText, Loader2, ShieldAlert } from "lucide-react";

/**
 * หน้าเอกสารสำหรับลูกค้า/คู่ค้า (ไม่ต้องล็อกอิน) — ลิงก์ /d/{token} ที่ส่งทางอีเมล / LINE
 * แสดงหัวเอกสาร + PDF (สร้างจากข้อมูลที่บันทึกไว้ ณ ขณะเปิด) และปุ่มดาวน์โหลด
 */

interface Info {
  title: string; number: string; date: string;
  seller: { name: string; phone: string; email: string; logo: string; brandColor: string };
  partyName: string; total: number | null; totalLabel: string; cancelled: boolean; formCopies: boolean; expiresAt: number;
}

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SharedDocumentPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [frameReady, setFrameReady] = useState(false);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    setWide(window.innerWidth >= 768);
    fetch(`/api/public/documents/${encodeURIComponent(token)}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.success) throw new Error(d.error || "เปิดเอกสารไม่สำเร็จ"); setInfo(d.document); })
      .catch((e) => setError(e.message));
  }, [token]);

  const pdf = `/api/public/documents/${encodeURIComponent(token)}?pdf=1`;
  const brand = info?.seller.brandColor || "#1f6f5c";

  if (error) {
    return (
      <div className="fixed inset-0 overflow-auto bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800 text-center gap-3">
        <ShieldAlert size={48} className="text-amber-500" />
        <p className="text-lg font-bold">{error}</p>
      </div>
    );
  }
  if (!info) {
    return <div className="fixed inset-0 bg-slate-50 flex items-center justify-center text-slate-500 gap-2"><Loader2 size={20} className="animate-spin" /> กำลังเปิดเอกสาร…</div>;
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-slate-100 text-slate-800">
      <div className="max-w-[960px] mx-auto px-4 py-6 space-y-4">
        <header className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {info.seller.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={info.seller.logo} alt="" className="w-12 h-12 object-contain shrink-0" />
              : <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: brand }}><FileText size={22} /></div>}
            <div className="min-w-0">
              <p className="text-[13px] text-slate-500 truncate">{info.seller.name}</p>
              <h1 className="text-lg font-bold leading-snug" style={{ color: brand }}>{info.title} <span className="text-slate-700 font-semibold">{info.number}</span></h1>
              <p className="text-[13px] text-slate-500">วันที่ {info.date}{info.partyName ? ` · ${info.partyName}` : ""}</p>
            </div>
          </div>
          {info.total !== null && (
            <div className="sm:text-right shrink-0">
              <p className="text-[12px] text-slate-500">{info.totalLabel}</p>
              <p className="text-xl font-bold font-mono">{money(info.total)} <span className="text-[13px] font-normal text-slate-500">บาท</span></p>
            </div>
          )}
        </header>

        {info.cancelled && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-[14px] font-semibold">เอกสารฉบับนี้ถูกยกเลิกแล้ว</div>}

        <div className="flex flex-wrap gap-2">
          <a href={pdf} target="_blank" rel="noopener" className="h-11 px-5 rounded-full text-white text-[14px] font-semibold inline-flex items-center gap-2" style={{ background: brand }}><ExternalLink size={16} /> เปิด PDF</a>
          <a href={`${pdf}&download=1`} className="h-11 px-5 rounded-full border border-slate-300 bg-white text-[14px] font-semibold inline-flex items-center gap-2"><Download size={16} /> ดาวน์โหลด{info.formCopies ? " (ฉบับที่ 1)" : ""}</a>
          {info.formCopies && <a href={`${pdf}&download=1&copy=1`} className="h-11 px-5 rounded-full border border-slate-300 bg-white text-[14px] font-semibold inline-flex items-center gap-2"><Download size={16} /> ฉบับที่ 2</a>}
        </div>

        {/* มือถือ (รวมเบราว์เซอร์ใน LINE) มักแสดง PDF ในกรอบไม่ได้ ใช้ปุ่มเปิด PDF แทน */}
        {wide && (
          <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden h-[80vh]">
            {!frameReady && <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2"><Loader2 size={18} className="animate-spin" /> กำลังสร้างเอกสาร…</div>}
            <iframe src={pdf} title={`${info.title} ${info.number}`} className="w-full h-full" onLoad={() => setFrameReady(true)} />
          </div>
        )}

        <p className="text-[12px] text-slate-500 text-center leading-relaxed">
          เอกสารจาก {info.seller.name}{info.seller.phone ? ` · โทร ${info.seller.phone}` : ""}{info.seller.email ? ` · ${info.seller.email}` : ""}
          <br />ลิงก์ใช้ได้ถึง {new Date(info.expiresAt).toLocaleDateString("th-TH", { dateStyle: "long" })}
        </p>
      </div>
    </div>
  );
}
