"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PillButton } from "@/components/ui/Base";
import { DocumentPdfViewer } from "@/components/documents/DocumentPdfViewer";

/** หน้าดูเอกสาร: /documents/view/{ประเภท}/{เลขที่} — พิมพ์ ต้นฉบับ/สำเนา ดาวน์โหลด PDF (ใช้แชร์ลิงก์ภายในทีมได้) */
const TYPE_LABEL: Record<string, string> = { quotation: "ใบเสนอราคา", sample: "ตัวอย่างเอกสาร" };

export default function DocumentViewPage() {
  const router = useRouter();
  const p = useParams();
  const type = String(p?.type || "");
  const id = decodeURIComponent(String(p?.id || ""));
  return (
    <div className="flex flex-col h-[calc(100vh-72px)] px-4 py-3 gap-3 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center" aria-label="ย้อนกลับ"><ArrowLeft size={18} /></PillButton>
        <h1 className="text-[18px] font-semibold text-white">{TYPE_LABEL[type] || "เอกสาร"} {type !== "sample" ? id : ""}</h1>
      </div>
      <div className="flex-1 min-h-0 rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02] flex flex-col">
        <DocumentPdfViewer source={{ type, id }} className="flex-1" />
      </div>
    </div>
  );
}
