"use client";

import React, { useMemo, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { documentProfileOf } from "@/lib/documents/profile";
import type { DocumentModel } from "@/lib/documents/model";
import { GUARANTEE_LABELS, warrantyEnd, type ProjectContract } from "@/lib/gov-contract";
import { LETTER_LABELS, buildLetter, type LetterKind } from "@/lib/letters";

/**
 * ทำหนังสือจากข้อมูลโครงการ: เลือกชนิด → ระบบเติมข้อความให้ → แก้ได้ → ดูตัวอย่าง/พิมพ์/ดาวน์โหลด (ไม่บันทึกในระบบ)
 */
const todayBkk = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const area = "w-full min-h-[150px] rounded-2xl bg-white/[0.03] border border-white/10 px-4 py-3 text-[14px] leading-[1.9] text-white focus:outline-none focus:border-nexus-teal/50";

export function LetterBuilder({ companyId, project, contract }: { companyId: string; project: any; contract: ProjectContract }) {
  const { data: company } = useRealtimeDocument<any>(companyId ? `companies/${companyId}` : null);
  const seller = useMemo(() => documentProfileOf(company), [company]);
  const [kind, setKind] = useState<LetterKind | "">("");
  const [to, setTo] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(todayBkk());
  const [signer, setSigner] = useState("");
  const [signerTitle, setSignerTitle] = useState("กรรมการผู้จัดการ");
  const [from, setFrom] = useState(todayBkk());
  const [until, setUntil] = useState(todayBkk());
  const [location, setLocation] = useState("");
  const [workers, setWorkers] = useState("");
  const [vehicles, setVehicles] = useState("");
  const [gIndex, setGIndex] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [extra, setExtra] = useState<{ refs: string[]; attachments: string[] }>({ refs: [], attachments: [] });
  const [preview, setPreview] = useState<DocumentModel | null>(null);

  const returnable = contract.guarantees.filter((g) => !g.returned);
  const generate = (k: LetterKind = kind as LetterKind) => {
    if (!k) return;
    const g = returnable[gIndex] || contract.guarantees[0];
    const content = buildLetter(k, {
      customerName: String(project?.customerName || project?.customer?.name || "ลูกค้า"),
      projectName: String(project?.projectName || project?.name || ""),
      contractNo: contract.contractNo, orderNo: contract.orderNo, signDate: contract.signDate, contractValue: contract.contractValue,
      handoverDate: contract.handoverDate, warrantyEnd: warrantyEnd(contract) || undefined,
      guarantee: g ? { label: GUARANTEE_LABELS[g.type], number: g.number, issuer: g.issuer, amount: g.amount } : undefined,
      from, to: until, location, vehicles, workers: workers.split("\n").map((w) => w.trim()).filter(Boolean),
      sellerName: seller.name || "บริษัทฯ",
    });
    setSubject(content.subject);
    setBody(content.body.join("\n"));
    setExtra({ refs: content.refs, attachments: content.attachments });
  };
  const pick = (k: LetterKind) => {
    setKind(k);
    if (!to) setTo(String(project?.customerName || ""));
    generate(k);
  };

  const open = () => setPreview({
    type: "letter", title: LETTER_LABELS[kind as LetterKind], number, date, meta: [], seller, lines: [], totals: [], signatures: [],
    letter: { to, subject, refs: extra.refs, attachments: extra.attachments, body: body.split("\n").map((p) => p.trim()).filter(Boolean), signerName: signer, signerTitle },
  });

  return (
    <GlassCard className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-white"><FileText size={17} className="text-nexus-teal" /> ทำหนังสือ</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LETTER_LABELS) as LetterKind[]).map((k) => (
            <PillButton key={k} variant={kind === k ? "primary" : "glass"} className="h-8 px-3 text-xs" onClick={() => pick(k)}>{LETTER_LABELS[k]}</PillButton>
          ))}
        </div>
      </div>
      {!kind ? (
        <p className="text-[13px] text-white/55">เลือกชนิดหนังสือ ระบบเติมข้อมูลโครงการ สัญญา และหลักประกันให้ แล้วแก้ข้อความได้ก่อนพิมพ์</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="space-y-1 md:col-span-2"><label className="text-[12px] font-bold text-white/70 ml-1">เรียน</label><PillInput value={to} onChange={(e) => setTo(e.target.value)} placeholder="เช่น ผู้อำนวยการโรงพยาบาล..." className="w-full h-9 text-sm" /></div>
            <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">เลขที่หนังสือ</label><PillInput value={number} onChange={(e) => setNumber(e.target.value)} placeholder="เช่น PSG 012/2569" className="w-full h-9 text-sm" /></div>
            <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">วันที่</label><PillInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-9 text-sm font-mono" /></div>
            <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">ผู้ลงนาม</label><PillInput value={signer} onChange={(e) => setSigner(e.target.value)} className="w-full h-9 text-sm" /></div>
            <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">ตำแหน่ง</label><PillInput value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className="w-full h-9 text-sm" /></div>
            {kind === "SITE_ACCESS" && (
              <>
                <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">เข้าพื้นที่ตั้งแต่</label><PillInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full h-9 text-sm font-mono" /></div>
                <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">ถึง</label><PillInput type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-full h-9 text-sm font-mono" /></div>
                <div className="space-y-1 md:col-span-2"><label className="text-[12px] font-bold text-white/70 ml-1">สถานที่</label><PillInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="อาคาร/ชั้น/ห้อง" className="w-full h-9 text-sm" /></div>
                <div className="space-y-1 md:col-span-2"><label className="text-[12px] font-bold text-white/70 ml-1">ทะเบียนรถ</label><PillInput value={vehicles} onChange={(e) => setVehicles(e.target.value)} className="w-full h-9 text-sm" /></div>
                <div className="space-y-1 md:col-span-2 xl:col-span-4">
                  <label className="text-[12px] font-bold text-white/70 ml-1">รายชื่อผู้ปฏิบัติงาน (บรรทัดละคน: ชื่อ-นามสกุล เลขบัตร)</label>
                  <textarea value={workers} onChange={(e) => setWorkers(e.target.value)} className={cn(area, "min-h-[90px]")} />
                </div>
              </>
            )}
            {kind === "GUARANTEE_RETURN" && returnable.length > 1 && (
              <div className="space-y-1 md:col-span-2"><label className="text-[12px] font-bold text-white/70 ml-1">หลักประกันที่ขอคืน</label>
                <PillSelect value={String(gIndex)} onChange={(e) => setGIndex(Number(e.target.value))} className="w-full h-9 text-sm">
                  {returnable.map((g, i) => <option key={g.id} value={i}>{GUARANTEE_LABELS[g.type]} {g.number || ""}</option>)}
                </PillSelect>
              </div>
            )}
          </div>
          <div className="space-y-1"><label className="text-[12px] font-bold text-white/70 ml-1">เรื่อง</label><PillInput value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-9 text-sm" /></div>
          <div className="space-y-1">
            <label className="text-[12px] font-bold text-white/70 ml-1 flex items-center justify-between">เนื้อความ (บรรทัดละย่อหน้า)
              <button type="button" onClick={() => generate()} className="flex items-center gap-1 text-[12px] text-nexus-teal hover:underline"><RefreshCw size={12} /> สร้างข้อความใหม่จากข้อมูลล่าสุด</button>
            </label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className={area} />
          </div>
          <div className="flex justify-end">
            <PillButton variant="primary" onClick={open} disabled={!to.trim() || !subject.trim()} className="h-9 px-5 text-xs">ดูตัวอย่าง / พิมพ์</PillButton>
          </div>
        </div>
      )}
      <DocumentPdfModal open={!!preview} onClose={() => setPreview(null)} model={preview || undefined} title={preview ? `${preview.title} ${number}`.trim() : ""} />
    </GlassCard>
  );
}
