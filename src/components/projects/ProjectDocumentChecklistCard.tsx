"use client";

import React, { useState } from "react";
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  UploadCloud, 
  Paperclip, 
  ShieldCheck, 
  Lock,
  ExternalLink,
  Plus
} from "lucide-react";
import { PillButton, PillInput, GlassCard, cn } from "@/components/ui/Base";
import { ProjectChecklistItem, ProjectTypeCode, PROJECT_TYPE_CONFIGS } from "@/types/database";

interface ProjectDocumentChecklistCardProps {
  projectTypeCode?: ProjectTypeCode;
  checklist?: ProjectChecklistItem[];
  onChecklistChange?: (updatedChecklist: ProjectChecklistItem[]) => void;
  isReadOnly?: boolean;
}

export function ProjectDocumentChecklistCard({
  projectTypeCode = 4,
  checklist,
  onChecklistChange,
  isReadOnly = false
}: ProjectDocumentChecklistCardProps) {
  const config = PROJECT_TYPE_CONFIGS[projectTypeCode] || PROJECT_TYPE_CONFIGS[4];

  // Initialize checklist items if not present
  const [items, setItems] = useState<ProjectChecklistItem[]>(() => {
    if (checklist && checklist.length > 0) return checklist;
    return config.requiredDocuments.map(doc => ({
      docCode: doc.docCode,
      docName: doc.docName,
      isMandatory: doc.isMandatory,
      isAttached: false,
      category: doc.category
    }));
  });

  const [activeUploadCode, setActiveUploadCode] = useState<string | null>(null);
  const [docUrlInput, setDocUrlInput] = useState("");

  const mandatoryCount = items.filter(i => i.isMandatory).length;
  const mandatoryAttachedCount = items.filter(i => i.isMandatory && i.isAttached).length;
  const isAllMandatoryCompleted = mandatoryAttachedCount === mandatoryCount;
  const completionPercentage = mandatoryCount > 0 ? Math.round((mandatoryAttachedCount / mandatoryCount) * 100) : 100;

  const handleToggleAttached = (docCode: string, attachedUrl?: string) => {
    const updated = items.map(item => {
      if (item.docCode === docCode) {
        const nextState = !item.isAttached;
        return {
          ...item,
          isAttached: nextState,
          attachedUrl: nextState ? (attachedUrl || item.attachedUrl || "https://drive.google.com/doc-attached") : undefined,
          uploadedAt: nextState ? new Date().toISOString() : undefined
        };
      }
      return item;
    });
    setItems(updated);
    if (onChecklistChange) onChecklistChange(updated);
    setActiveUploadCode(null);
    setDocUrlInput("");
  };

  return (
    <GlassCard accentColor="teal" className="p-6">
      {/* Header & Overall Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.04] border-b border-white/10 px-6 py-4 -mx-6 -mt-6 rounded-t-3xl mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-nexus-teal/20 border border-nexus-teal/40 flex items-center justify-center text-nexus-teal font-mono font-bold text-sm shadow-[0_0_10px_rgba(0,255,209,0.2)]">
            01
          </div>
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-nexus-teal" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                รายการเอกสารบังคับตามประเภทโครงการ ({config.nameTh})
              </h3>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              เกณฑ์เอกสารที่ต้องแนบให้ครบถ้วนก่อนสลับสถานะเป็น Active หรือปิดโครงการ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-bold text-white/40 uppercase block">เอกสารบังคับแนบแล้ว</span>
            <span className={cn("text-xs font-mono font-bold", isAllMandatoryCompleted ? "text-nexus-teal" : "text-warning")}>
              {mandatoryAttachedCount} / {mandatoryCount} รายการ ({completionPercentage}%)
            </span>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-white/10 flex items-center justify-center relative overflow-hidden bg-black/30">
            <div 
              className={cn("absolute bottom-0 w-full transition-all duration-500 opacity-20", isAllMandatoryCompleted ? "bg-nexus-teal" : "bg-warning")}
              style={{ height: `${completionPercentage}%` }}
            />
            <span className="text-xs font-mono font-black text-white relative z-10">{completionPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Warning Notice if incomplete */}
      {!isAllMandatoryCompleted && (
        <div className="p-3.5 rounded-2xl bg-warning/10 border border-warning/30 text-warning text-xs font-bold flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <div>
            <p>ยังแนบเอกสารบังคับไม่ครบถ้วนสำหรับประเภทโครงการ {config.nameTh}</p>
            <p className="text-[11px] font-normal text-warning/80 mt-0.5">
              กรุณาอัปโหลดเอกสารที่ทำเครื่องหมาย <span className="text-rose-500 font-bold ml-0.5">*</span> ให้ครบถ้วนเพื่อปลดล็อกการอนุมัติขั้นถัดไป
            </p>
          </div>
        </div>
      )}

      {/* Checklist Items Grid */}
      <div className="space-y-3">
        {items.map((item) => {
          const isPendingUpload = activeUploadCode === item.docCode;
          return (
            <div 
              key={item.docCode} 
              className={cn(
                "p-4 rounded-2xl border transition-all space-y-3",
                item.isAttached 
                  ? "bg-nexus-teal/5 border-nexus-teal/30 hover:border-nexus-teal/50" 
                  : item.isMandatory 
                  ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40" 
                  : "bg-white/[0.02] border-white/10 hover:border-white/20"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    {item.isAttached ? (
                      <CheckCircle2 size={18} className="text-nexus-teal" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/30" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{item.docName}</h4>
                      {item.isMandatory && (
                        <span className="text-rose-500 font-bold ml-0.5" title="เอกสารบังคับสำหรับประเภทโครงการนี้">*</span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-white/40 uppercase">
                        {item.category}
                      </span>
                    </div>

                    {item.isAttached && item.attachedUrl && (
                      <a 
                        href={item.attachedUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[11px] font-mono text-nexus-teal hover:underline flex items-center gap-1 mt-1"
                      >
                        <Paperclip size={12} /> {item.attachedUrl.length > 40 ? `${item.attachedUrl.slice(0, 40)}...` : item.attachedUrl} <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-2 shrink-0">
                    {item.isAttached ? (
                      <PillButton 
                        variant="glass" 
                        onClick={() => handleToggleAttached(item.docCode)}
                        className="h-7 px-3 text-[10px] text-white/50 hover:text-danger"
                      >
                        ยกเลิกการแนบ
                      </PillButton>
                    ) : (
                      <PillButton 
                        variant="glass" 
                        onClick={() => setActiveUploadCode(isPendingUpload ? null : item.docCode)}
                        className="h-7 px-4 text-[10px] text-nexus-teal border-nexus-teal/30 hover:bg-nexus-teal/20"
                      >
                        <UploadCloud size={12} className="mr-1" /> แนบเอกสาร
                      </PillButton>
                    )}
                  </div>
                )}
              </div>

              {/* Upload Link Input Drawer */}
              {isPendingUpload && (
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 animate-in fade-in">
                  <label className="text-[10px] font-bold text-white/50 uppercase block">ระบุลิงก์เอกสาร หรือ URL ของไฟล์ (Google Drive / OneDrive)</label>
                  <div className="flex gap-2">
                    <PillInput 
                      value={docUrlInput}
                      onChange={(e) => setDocUrlInput(e.target.value)}
                      placeholder="https://drive.google.com/file/d/..."
                      className="flex-1 h-8 text-xs font-mono"
                    />
                    <PillButton 
                      variant="primary"
                      onClick={() => handleToggleAttached(item.docCode, docUrlInput)}
                    >
                      ยืนยันแนบ
                    </PillButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
