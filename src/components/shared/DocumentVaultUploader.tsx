"use client";

import React, { useRef } from "react";
import { Plus, Trash2, FileText, Download, ShieldCheck, FileCheck } from "lucide-react";
import { PillButton, PillInput } from "@/components/ui/Base";
import { SmartSelect } from "@/components/ui/SmartComponents";

export interface DigitalDocumentItem {
  id: string;
  title: string;
  type: "DATA_SHEET" | "TOR" | "CERTIFICATE" | "MSDS" | "OTHER";
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
}

interface DocumentVaultUploaderProps {
  documents: DigitalDocumentItem[];
  onChange: (docs: DigitalDocumentItem[]) => void;
}

const docTypeOptions = [
  { value: "DATA_SHEET", label: "เอกสารแคตตาล็อก / Data Sheet" },
  { value: "TOR", label: "ข้อกำหนดสเปก TOR ราชการ" },
  { value: "CERTIFICATE", label: "ใบรับรองมาตรฐาน (COA / CE / ISO)" },
  { value: "MSDS", label: "เอกสารความปลอดภัย (MSDS)" },
  { value: "OTHER", label: "เอกสารแนบอื่นๆ" },
];

export function DocumentVaultUploader({
  documents,
  onChange
}: DocumentVaultUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newDoc: DigitalDocumentItem = {
        id: `DOC-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        type: "DATA_SHEET",
        fileUrl: URL.createObjectURL(file),
        fileName: file.name,
        uploadedAt: new Date().toISOString().split("T")[0]
      };
      onChange([...documents, newDoc]);
    }
  };

  const handleRemoveDoc = (id: string) => {
    onChange(documents.filter(d => d.id !== id));
  };

  const handleUpdateDoc = (id: string, field: keyof DigitalDocumentItem, value: any) => {
    onChange(documents.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  return (
    <div className="space-y-4 bg-black/40 p-5 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 text-nexus-teal">
          <FileCheck size={16} />
          <h6 className="text-xs font-semibold uppercase tracking-widest text-white">ระบบคลังจัดเก็บเอกสารและไฟล์สเปกดิจิทัล (Digital Vault)</h6>
        </div>
        <PillButton
          variant="glass"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 h-8 text-xs font-bold text-nexus-teal hover:bg-nexus-teal/20 rounded-full flex items-center gap-1.5"
        >
          <Plus size={13} />
          <span>แนบไฟล์เอกสาร</span>
        </PillButton>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg" 
          className="hidden" 
        />
      </div>

      {documents.length === 0 ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="p-6 text-center border border-dashed border-white/10 hover:border-nexus-teal/40 rounded-xl space-y-2 cursor-pointer transition-colors group"
        >
          <FileText size={32} className="mx-auto text-white/20 group-hover:text-nexus-teal transition-colors" />
          <p className="text-xs text-white/40 font-bold group-hover:text-white transition-colors">ยังไม่มีเอกสารแนบในคลังดิจิทัล</p>
          <p className="text-[10px] text-white/30">คลิกที่นี่ หรือกดปุ่ม "แนบไฟล์เอกสาร" เพื่ออัปโหลด Data Sheet, สเปก TOR หรือใบรับรองมาตรฐาน (PDF / Word / Excel)</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((docItem) => (
            <div 
              key={docItem.id} 
              className="bg-white/[0.02] border border-white/10 p-3.5 rounded-xl space-y-3 relative group hover:border-white/20 transition-all"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">ชื่อเรียกเอกสาร</label>
                  <PillInput
                    value={docItem.title}
                    onChange={(e) => handleUpdateDoc(docItem.id, "title", e.target.value)}
                    placeholder="ระบุชื่อเอกสาร..."
                    className="w-full h-9 px-4 rounded-full font-bold text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-white/60 mb-1 block">ประเภทเอกสาร</label>
                  <SmartSelect
                    options={docTypeOptions}
                    value={docItem.type}
                    onChange={(val) => handleUpdateDoc(docItem.id, "type", val)}
                    placeholder="เลือกประเภท..."
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <a
                    href={docItem.fileUrl}
                    download={docItem.fileName}
                    className="flex-1 h-9 px-4 rounded-full bg-white/5 border border-white/10 hover:bg-nexus-teal/20 hover:text-nexus-teal text-white/70 text-xs font-bold flex items-center justify-center gap-2 transition-colors truncate"
                    title={docItem.fileName}
                  >
                    <Download size={13} />
                    <span className="truncate">{docItem.fileName}</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleRemoveDoc(docItem.id)}
                    className="text-white/30 hover:text-danger p-2 rounded-md transition-colors"
                    title="ลบเอกสารนี้"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
