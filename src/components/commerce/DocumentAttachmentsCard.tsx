"use client";

import React, { useState } from "react";
import { Paperclip, FileText, Trash2, UploadCloud, Download, Image as ImageIcon, FileCode } from "lucide-react";
import { PillButton, cn } from "@/components/ui/Base";
import { DocumentAttachment } from "@/types/database";

interface DocumentAttachmentsCardProps {
  attachments?: DocumentAttachment[];
  onChange?: (attachments: DocumentAttachment[]) => void;
  isLocked?: boolean;
  readOnly?: boolean;
}

const ALLOWED_EXTENSIONS = [".pdf", ".dwg", ".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function DocumentAttachmentsCard({
  attachments = [],
  onChange,
  isLocked = false,
  readOnly = false
}: DocumentAttachmentsCardProps) {
  const effectiveLocked = isLocked || readOnly;
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("");
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: DocumentAttachment[] = [...attachments];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileNameLower = file.name.toLowerCase();
      const ext = fileNameLower.substring(fileNameLower.lastIndexOf("."));

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setErrorMsg(`ไฟล์ ${file.name} ไม่ได้รับอนุญาต (รองรับเฉพาะ PDF, DWG, JPG, PNG)`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMsg(`ไฟล์ ${file.name} มีขนาดเกินกำหนด (${(file.size / (1024 * 1024)).toFixed(1)}MB > สูงสุด ${MAX_FILE_SIZE_MB}MB)`);
        return;
      }

      // Convert small file to Data URL / Blob URL for client demonstration or store metadata
      const fakePath = `attachments/${Date.now()}_${file.name}`;
      const objectUrl = URL.createObjectURL(file);

      newAttachments.push({
        path: fakePath,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "ผู้ใช้งานปัจจุบัน",
        fileSize: file.size,
        fileType: file.type || ext.replace(".", ""),
        url: objectUrl
      });
    }

    if (onChange) {
      onChange(newAttachments);
    }
    e.target.value = "";
  };

  const handleRemove = (index: number) => {
    if (effectiveLocked) return;
    const updated = attachments.filter((_, i) => i !== index);
    if (onChange) onChange(updated);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    if (ext === ".pdf") return <FileText size={16} className="text-danger" />;
    if ([".jpg", ".jpeg", ".png"].includes(ext)) return <ImageIcon size={16} className="text-nexus-teal" />;
    if (ext === ".dwg") return <FileCode size={16} className="text-[#FFCC00]" />;
    return <Paperclip size={16} className="text-white/60" />;
  };

  return (
    <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl border-l-4 border-l-nexus-teal p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-nexus-teal/10 border border-nexus-teal/30 flex items-center justify-center text-nexus-teal font-bold text-xs">
            04
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Paperclip size={18} className="text-nexus-teal" />
            เอกสารแนบในเอกสารนี้ (File Attachments)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-white/50 bg-white/[0.04] px-2.5 py-1 rounded-full border border-white/10">
          {attachments.length} ไฟล์
        </span>
      </div>

      {/* Description & Requirements */}
      <div className="text-[12px] text-white/60 flex items-center justify-between">
        <span>รองรับไฟล์ประเภท: <strong className="text-nexus-teal">.PDF, .DWG, .JPG, .PNG</strong> (ขนาดไม่เกิน 10MB ต่อไฟล์)</span>
      </div>

      {errorMsg && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-2xl text-[12px] text-danger font-bold flex items-center gap-2">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      {/* Upload Zone */}
      {!effectiveLocked && (
        <label className="border-2 border-dashed border-white/20 hover:border-nexus-teal/60 bg-white/[0.01] hover:bg-white/[0.03] rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group">
          <UploadCloud size={24} className="text-nexus-teal/60 group-hover:text-nexus-teal transition-colors" />
          <span className="text-[13px] font-bold text-white/80 group-hover:text-white transition-colors">
            คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
          </span>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      )}

      {/* Attachments List */}
      <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar">
        {attachments.map((file, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10 hover:border-nexus-teal/40 transition-all group/file"
          >
            <div className="flex items-center gap-3 min-w-0">
              {getFileIcon(file.filename)}
              <div className="truncate">
                <p className="text-[13px] font-bold text-white truncate group-hover/file:text-nexus-teal transition-colors">
                  {file.filename}
                </p>
                <p className="text-[10px] font-mono text-white/40">
                  {file.fileSize ? `${(file.fileSize / 1024).toFixed(0)} KB` : "ไม่ทราบขนาด"} • อัปโหลดเมื่อ {file.uploadedAt ? file.uploadedAt.split("T")[0] : "วันนี้"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {file.url && (
                <a
                  href={file.url}
                  download={file.filename}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal hover:bg-nexus-teal/20 transition-all"
                  title="ดาวน์โหลดไฟล์"
                >
                  <Download size={14} />
                </a>
              )}
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="p-1.5 rounded-full bg-danger/10 border border-danger/30 text-danger/70 hover:text-danger hover:bg-danger/20 transition-all"
                  title="ลบไฟล์แนบ"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}

        {attachments.length === 0 && (
          <div className="py-4 text-center text-white/30 text-[12px]">
            ยังไม่มีเอกสารแนบในรายการนี้
          </div>
        )}
      </div>
    </div>
  );
}
