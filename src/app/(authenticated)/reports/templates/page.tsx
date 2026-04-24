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
import { db } from "@/lib/firebase";
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

export default function TemplatesPage() {
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

    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบแม่แบบรายงานนี้?")) return;

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
      case "QUOTATION": return "ใบเสนอราคา (COMMERCE)";
      case "SERVICE_REPORT": return "ใบงานบริการ (PROJECT)";
      case "MAINTENANCE_TICKET": return "แจ้งซ่อม & SLA (SUPPORT)";
      case "INVENTORY_ADJUST": return "ปรับสต็อกสินค้า (INVENTORY)";
      default: return module;
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto">
      
      {/* 1. Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/reports">
            <PillButton variant="glass" className="h-10 w-10 p-0 rounded-full">
              <ArrowLeft size={16} />
            </PillButton>
          </Link>
          <div>
            <div className="flex gap-2 mb-2">
              <span className="px-2 py-0.5 rounded bg-nexus-blue/10 border border-nexus-blue/20 text-[10px] text-nexus-blue font-black uppercase tracking-widest">
                โมดูลรายงานอัจฉริยะ (Report Engine)
              </span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/40 font-black uppercase tracking-widest">
                การตั้งค่าระบบหลังบ้าน
              </span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              จัดการแม่แบบแบบฟอร์มเอกสาร (Form Templates)
            </h1>
          </div>
        </div>

        <PillButton 
          onClick={() => {
            setEditingTemplate(null);
            setIsBuilderOpen(true);
          }} 
          className="px-8 shadow-neon-teal text-black"
        >
          <Plus size={18} />
          สร้างแม่แบบฟอร์มใหม่
        </PillButton>
      </div>

      {/* 2. Statistical Metric Cards */}
      <div className="grid grid-cols-3 gap-6">
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
      <GlassCard className="p-6 bg-[#0a0a0c] border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <Layers size={18} className="text-nexus-teal" />
          <h3 className="text-xs font-black text-white/60 uppercase tracking-widest">
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
                className="p-12 text-center text-[11px] text-white/25 uppercase font-black tracking-[0.3em] border-0 bg-transparent"
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
                <NexusTableCell mono={true} className="text-nexus-teal text-[13px] font-black uppercase tracking-wide">
                  {tmpl.templateId}
                </NexusTableCell>

                {/* Title */}
                <NexusTableCell wrap={true} className="max-w-[300px] font-black text-white">
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
