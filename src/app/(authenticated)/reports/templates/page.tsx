// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  Settings, 
  Layers, 
  Activity, 
  ArrowLeft,
  Calendar,
  Layers3,
  FileSpreadsheet
} from "lucide-react";
import { 
  PillButton, 
  GlassCard, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  Modal, 
  Toast,
  MasterMetricCard
} from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { FormTemplate } from "@/types/database";
import FormBuilder from "@/components/reports/FormBuilder";
import Link from "next/link";
import { useSystemDialog } from "@/context/DialogContext";

export default function TemplatesPage() {
  const { showAlert, showConfirm } = useSystemDialog();

  const { companyId } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [toast, setToast] = useState({ message: "", isVisible: false, type: "success" as "success" | "error" });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, isVisible: true, type });
  };

  // 1. Fetch Form Templates scoped to companyId (Multi-tenancy Scoping)
  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, "form_templates"),
      where("companyId", "==", companyId),
      where("isDeleted", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: FormTemplate[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as FormTemplate);
      });
      setTemplates(list);
    });

    return () => unsubscribe();
  }, [companyId]);

  // 2. Handle Soft Delete Template
  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering row click

    if (!(await showConfirm("คุณแน่ใจหรือไม่ที่จะลบแม่แบบรายงานนี้?"))) return;

    try {
      const templateRef = doc(db, "form_templates", templateId);
      await updateDoc(templateRef, { isDeleted: true });
      showToast("ลบแม่แบบรายงานสำเร็จ");
    } catch (err) {
      console.error("Failed to delete template:", err);
      showToast("เกิดข้อผิดพลาดในการลบแม่แบบ", "error");
    }
  };

  // Calculate modules count
  const getModulesCount = () => {
    const modules = new Set(templates.map(t => t.module));
    return modules.size;
  };

  const getModuleThaiName = (module: string) => {
    switch (module) {
      case "QUOTATION": return "ใบเสนอราคา";
      case "SERVICE_REPORT": return "ใบงานบริการ";
      case "MAINTENANCE_TICKET": return "แจ้งซ่อม & SLA (SUPPORT)";
      case "INVENTORY_ADJUST": return "ปรับสต็อกสินค้า";
      default: return module;
    }
  };

  return (
    <div className="p-5 space-y-3 animate-in fade-in duration-700 max-w-7xl mx-auto">
      
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <PillButton variant="glass" className="w-10 h-10 p-0 flex items-center justify-center">
              <ArrowLeft size={20} />
            </PillButton>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">
                จัดการแม่แบบแบบฟอร์มเอกสาร
              </h1>
              <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
                TEMPLATES
              </span>
            </div>
            <p className="text-sm text-white/60 font-medium mt-1">
              ปรับแต่งและจัดการแม่แบบเอกสารสำหรับพิมพ์และส่งออกในระบบ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <PillButton 
            variant="confirm"
            onClick={() => {
              setEditingTemplate(null);
              setIsBuilderOpen(true);
            }} 
            className="h-8 px-5 font-bold text-xs"
          >
            <Plus size={14} className="mr-1.5" />
            สร้างแม่แบบฟอร์มใหม่
          </PillButton>
        </div>
      </div>

      {/* 2. Statistical Metric Cards */}
      <div className="grid grid-cols-3 gap-5">
        <MasterMetricCard 
          icon={<Layers3 />} 
          label="จำนวนแม่แบบทั้งหมด" 
          value={`${templates.length} TEMPLATES`} 
          color="text-nexus-teal" 
        />
        <MasterMetricCard 
          icon={<FileSpreadsheet />} 
          label="โมดูลที่มีการใช้ร่วมกัน" 
          value={`${getModulesCount()} MODULES`} 
          color="text-nexus-blue" 
        />
        <MasterMetricCard 
          icon={<Activity />} 
          label="สถานะระบบออกแบบ" 
          value="STRATEGIC V3.1" 
          color="text-nexus-teal" 
          neon="shadow-neon-teal/20"
        />
      </div>

      {/* 3. Standardized Resilient Table */}
      <GlassCard className="p-4 bg-surface-0 border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <Layers size={18} className="text-nexus-teal" />
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest">
            รายการเทมเพลตแบบฟอร์มทั้งหมด ({templates.length} แม่แบบ)
          </h3>
        </div>

        <NexusTable 
          headers={[
            "รหัสแม่แบบ",
            "ชื่อแบบฟอร์มรายงาน",
            "โมดูลเชื่อมโยง",
            "จำนวนฟิลด์ข้อมูล",
            "เครื่องมือจัดการ"
          ]}
          minWidth="min-w-[900px]"
        >
          {templates.length === 0 ? (
            <NexusTableRow>
              <NexusTableCell 
                colSpan={5} 
                className="p-12 text-center text-[12px] text-white/25 uppercase font-medium tracking-[0.3em] border-0 bg-transparent"
              >
                ยังไม่พบแม่แบบแบบฟอร์มในระบบ กรุณากดปุ่ม "สร้างแม่แบบฟอร์มใหม่"
              </NexusTableCell>
            </NexusTableRow>
          ) : (
            templates.map((tmpl) => (
              <NexusTableRow key={tmpl.id} onClick={() => {
                setEditingTemplate(tmpl);
                setIsBuilderOpen(true);
              }}>
                {/* ID */}
                <NexusTableCell mono={true} className="text-nexus-teal text-[13px] font-bold uppercase tracking-wide">
                  {tmpl.templateId}
                </NexusTableCell>

                {/* Title */}
                <NexusTableCell wrap={true} className="max-w-[300px] font-bold text-white">
                  {tmpl.title}
                </NexusTableCell>

                {/* Module */}
                <NexusTableCell className="text-white/60">
                  {getModuleThaiName(tmpl.module)}
                </NexusTableCell>

                {/* Fields count */}
                <NexusTableCell className="text-center font-bold text-nexus-blue">
                  {tmpl.fields?.length || 0} ฟิลด์
                </NexusTableCell>

                {/* Action Buttons */}
                <NexusTableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <PillButton 
                      onClick={() => {
                        setEditingTemplate(tmpl);
                        setIsBuilderOpen(true);
                      }}
                      variant="glass" 
                      className="h-7 px-3 text-[11px]"
                    >
                      <Settings size={12} /> แก้ไขโครงสร้าง
                    </PillButton>
                    <button
                      onClick={(e) => handleDeleteTemplate(tmpl.id!, e)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white/20 hover:text-danger hover:bg-danger/10 transition-all border border-transparent hover:border-danger/10"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </NexusTableCell>
              </NexusTableRow>
            ))
          )}
        </NexusTable>
      </GlassCard>

      {/* 4. Fullscreen Builder Modal */}
      <Modal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        title={editingTemplate ? `ปรับปรุงแม่แบบโครงสร้าง: ${editingTemplate.title}` : "สร้างเครื่องมือฟอร์มรายงานดึงข้อมูลไดนามิก"}
        maxWidth="max-w-7xl"
      >
        <div className="h-[75vh]">
          <FormBuilder 
            initialTemplate={editingTemplate}
            onSaveSuccess={() => {
              setIsBuilderOpen(false);
              showToast(editingTemplate ? "ปรับปรุงเทมเพลตเสร็จสิ้น" : "สร้างเทมเพลตเสร็จสิ้น");
            }}
            onClose={() => setIsBuilderOpen(false)}
          />
        </div>
      </Modal>

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} type={toast.type} />
    </div>
  );
}

