"use client";

import React, { useState } from "react";
import { 
  Plus, 
  Trash2, 
  Save, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  Settings, 
  Sparkles, 
  FileText,
  ListPlus,
  HelpCircle
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  PillCheckbox, 
  GlassCard,
  Toast
} from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { FormField, FormTemplate } from "@/types/database";

interface FormBuilderProps {
  initialTemplate?: FormTemplate | null;
  onSaveSuccess?: () => void;
  onClose?: () => void;
}

export default function FormBuilder({ initialTemplate, onSaveSuccess, onClose }: FormBuilderProps) {
  const { user, companyId } = useAuth();
  const [title, setTitle] = useState(initialTemplate?.title || "");
  const [module, setModule] = useState(initialTemplate?.module || "QUOTATION");
  const [fields, setFields] = useState<FormField[]>(initialTemplate?.fields || []);
  const [toast, setToast] = useState({ message: "", isVisible: false, type: "success" as "success" | "error" });
  
  // State for temporary new field editing
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, isVisible: true, type });
  };

  const handleAddField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: "text",
      label: "ฟิลด์ข้อมูลใหม่",
      required: false,
      gridSpan: 2,
      options: []
    };
    setFields([...fields, newField]);
    setEditingFieldId(newField.id);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (editingFieldId === id) setEditingFieldId(null);
  };

  const handleUpdateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => {
      if (f.id === id) {
        return { ...f, ...updates } as FormField;
      }
      return f;
    }));
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newFields = [...fields];
    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast("กรุณากรอกชื่อแบบฟอร์ม / รายงาน", "error");
      return;
    }
    if (fields.length === 0) {
      showToast("กรุณาเพิ่มฟิลด์ข้อมูลอย่างน้อย 1 ฟิลด์", "error");
      return;
    }
    if (!companyId || !user) {
      showToast("ไม่พบข้อมูลสิทธิ์บริษัทของคุณ", "error");
      return;
    }

    try {
      const templateData = {
        title,
        module,
        fields,
        companyId,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        isDeleted: false,
      };

      if (initialTemplate?.id) {
        // Edit existing
        const templateRef = doc(db, "form_templates", initialTemplate.id);
        await updateDoc(templateRef, templateData);
        showToast("บันทึกเทมเพลตฟอร์มสำเร็จ");
      } else {
        // Create new
        const newTemplate = {
          ...templateData,
          templateId: `TMPL-${Date.now()}`,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        };
        await addDoc(collection(db, "form_templates"), newTemplate);
        showToast("สร้างเทมเพลตฟอร์มใหม่สำเร็จ");
      }

      if (onSaveSuccess) {
        setTimeout(onSaveSuccess, 1000);
      }
    } catch (error) {
      console.error("Error saving template:", error);
      showToast("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง", "error");
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0A0A0C]">
      {/* Action Subheader */}
      <div className="h-16 flex items-center justify-between px-10 border-b border-white/5 bg-[#0F0F12] flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-white/40 flex items-center gap-2">
            <Layers size={16} className="text-nexus-teal" />
            <span className="text-[12px] font-black uppercase tracking-widest">โหมดออกแบบเทมเพลตฟอร์ม (Builder)</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PillButton variant="glass" className="text-white/50" onClick={onClose}>
            ยกเลิก
          </PillButton>
          <PillButton variant="primary" className="shadow-neon-teal text-black" onClick={handleSave}>
            <Save size={16} />
            บันทึกเทมเพลต (SAVE TEMPLATE)
          </PillButton>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden divide-x divide-white/5">
        {/* Left Side: General Settings & Dynamic Fields list */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-8">
          <GlassCard className="p-6 bg-[#0a0a0c]/80 border-white/5">
            <h4 className="text-[12px] font-black text-nexus-teal uppercase tracking-widest mb-6 flex items-center gap-2">
              <Sparkles size={16} /> 1. ตั้งค่าข้อมูลพื้นฐานเทมเพลต
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[12px] font-black text-white/30 uppercase tracking-widest">ชื่อแบบฟอร์มรายงาน *</label>
                <PillInput 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="เช่น ฟอร์มตรวจรับพัสดุ หรือ ใบรับงานบริการด่วน..."
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-black text-white/30 uppercase tracking-widest">โมดูลเชื่อมโยง (Target Hub)</label>
                <PillSelect 
                  value={module} 
                  onChange={(e) => setModule(e.target.value)} 
                  className="w-full"
                >
                  <option value="QUOTATION">ใบเสนอราคา (COMMERCE HUB)</option>
                  <option value="SERVICE_REPORT">ใบงานบริการ (PROJECT HUB)</option>
                  <option value="MAINTENANCE_TICKET">แจ้งซ่อม & SLA (SUPPORT TICKET)</option>
                  <option value="INVENTORY_ADJUST">ปรับสต็อกสินค้า (INVENTORY HUB)</option>
                </PillSelect>
              </div>
            </div>
          </GlassCard>

          {/* Fields Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-black text-nexus-blue uppercase tracking-widest flex items-center gap-2">
                <ListPlus size={16} /> 2. จัดการฟิลด์ข้อมูลไดนามิก ({fields.length} ฟิลด์)
              </h4>
              <PillButton onClick={handleAddField} className="h-8 px-4 text-[11px] shadow-neon-teal">
                <Plus size={14} /> เพิ่มฟิลด์ข้อมูล
              </PillButton>
            </div>

            {fields.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center text-white/20 uppercase font-black text-[12px] tracking-widest bg-white/[0.01]">
                ไม่มีฟิลด์ข้อมูล กรุณากดปุ่ม "เพิ่มฟิลด์ข้อมูล" เพื่อเริ่มต้นออกแบบ
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div 
                    key={field.id}
                    className={`p-4 rounded-xl border transition-all duration-300 ${
                      editingFieldId === field.id 
                        ? "bg-white/[0.04] border-nexus-teal/30 shadow-[0_0_20px_rgba(0,255,209,0.03)]" 
                        : "bg-[#0c0c0e] border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Drag info / Order */}
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[11px] font-mono font-black text-white/30">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button 
                            disabled={idx === 0} 
                            onClick={() => handleMoveField(idx, "up")}
                            className="text-white/20 hover:text-white disabled:opacity-20 transition-all"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button 
                            disabled={idx === fields.length - 1} 
                            onClick={() => handleMoveField(idx, "down")}
                            className="text-white/20 hover:text-white disabled:opacity-20 transition-all"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Field summary overview */}
                      <div className="flex-1 grid grid-cols-4 gap-4" onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)}>
                        <div className="col-span-2 cursor-pointer">
                          <p className="text-[11px] text-white/30 font-black uppercase tracking-wider">ชื่อหัวข้อฟิลด์ / Label</p>
                          <p className="text-[13px] font-black text-white mt-1">{field.label || "ไม่มีหัวข้อ"}</p>
                        </div>
                        <div className="cursor-pointer">
                          <p className="text-[11px] text-white/30 font-black uppercase tracking-wider">ประเภทข้อมูล</p>
                          <p className="text-[11px] font-mono font-black text-nexus-teal uppercase tracking-widest mt-1.5">{field.type}</p>
                        </div>
                        <div className="cursor-pointer">
                          <p className="text-[11px] text-white/30 font-black uppercase tracking-wider">การจัด Layout</p>
                          <p className="text-[11px] font-bold text-white/60 mt-1.5">{field.gridSpan} คอลัมน์ (Span {field.gridSpan})</p>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center border border-white/5 bg-white/5 text-white/40 hover:text-nexus-blue hover:border-nexus-blue/20 transition-all"
                        >
                          <Settings size={14} />
                        </button>
                        <button 
                          onClick={() => handleRemoveField(field.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center border border-white/5 bg-white/5 text-white/40 hover:text-danger hover:border-danger/20 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Editor Pane */}
                    {editingFieldId === field.id && (
                      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-4 gap-4 animate-in fade-in duration-300">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">หัวข้อแสดงผล / Label *</label>
                          <PillInput 
                            value={field.label}
                            onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">รหัสตัวแปร / Field ID *</label>
                          <PillInput 
                            value={field.id}
                            onChange={(e) => handleUpdateField(field.id, { id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                            placeholder="รหัสภาษาอังกฤษ e.g. age"
                            className="w-full font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">ประเภทข้อมูล</label>
                          <PillSelect 
                            value={field.type}
                            onChange={(e) => handleUpdateField(field.id, { type: e.target.value as any })}
                            className="w-full"
                          >
                            <option value="text">ข้อความทั่วไป (Text)</option>
                            <option value="number">ตัวเลขปริมาณ / ยอดเงิน (Number)</option>
                            <option value="date">ปฏิทินวันที่ (Date)</option>
                            <option value="dropdown">ตัวเลือกรายการ (Dropdown)</option>
                            <option value="table">ตารางรายละเอียด (Dynamic Table)</option>
                          </PillSelect>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">ขนาดหน้าจอ (Grid Columns)</label>
                          <PillSelect 
                            value={field.gridSpan}
                            onChange={(e) => handleUpdateField(field.id, { gridSpan: parseInt(e.target.value) as any })}
                            className="w-full"
                          >
                            <option value="1">1 คอลัมน์ (เล็กสุด)</option>
                            <option value="2">2 คอลัมน์ (กลาง)</option>
                            <option value="3">3 คอลัมน์ (กว้าง)</option>
                            <option value="4">4 คอลัมน์ (กว้างสุด - เต็มแถว)</option>
                          </PillSelect>
                        </div>

                        {/* Extra configurations depending on field type */}
                        {field.type === "dropdown" && (
                          <div className="col-span-4 space-y-1.5 bg-white/[0.01] border border-white/5 rounded-xl p-3">
                            <label className="text-[10px] font-black text-nexus-teal uppercase tracking-widest">ระบุตัวเลือก (Dropdown Options) * แยกรายการด้วยเครื่องหมายจุลภาค (Comma)</label>
                            <PillInput 
                              value={field.options?.join(", ") || ""}
                              onChange={(e) => handleUpdateField(field.id, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                              placeholder="เช่น ชำรุด, ปกติ, รอเปลี่ยนอะไหล่"
                              className="w-full"
                            />
                          </div>
                        )}

                        <div className="col-span-4 flex items-center gap-6 mt-2">
                          <PillCheckbox 
                            label="บังคับป้อนข้อมูล (Required)" 
                            checked={field.required}
                            onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live Visual rendering preview */}
        <div className="w-[450px] bg-[#0E0E11]/80 backdrop-blur-3xl overflow-y-auto p-10 flex flex-col custom-scrollbar flex-shrink-0">
          <div className="flex-1 space-y-8">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <FileText size={18} className="text-nexus-teal" />
              <div>
                <h5 className="text-[12px] font-black text-white uppercase tracking-widest">การแสดงผลตัวอย่าง (Real-time Preview)</h5>
                <p className="text-[10px] text-white/30 uppercase mt-1 tracking-wider">PSG standard layout alignment</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6">
              <div className="border-b border-white/5 pb-3">
                <span className="px-2 py-0.5 rounded bg-nexus-teal/10 border border-nexus-teal/20 text-[9px] text-nexus-teal font-black uppercase tracking-widest">เทมเพลต: {module}</span>
                <h3 className="text-md font-black text-white mt-2 leading-none uppercase">{title || "ชื่อฟอร์มตัวอย่าง"}</h3>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-10 text-[11px] font-black uppercase tracking-widest text-white/15">
                  รอรับข้อมูลเพื่อจำลองฟอร์ม...
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {fields.map(f => {
                    const spanClass = 
                      f.gridSpan === 1 ? "col-span-1" :
                      f.gridSpan === 2 ? "col-span-2" :
                      f.gridSpan === 3 ? "col-span-3" :
                      "col-span-4";
                    
                    return (
                      <div key={f.id} className={`${spanClass} space-y-1.5`}>
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                          {f.label || "ฟิลด์ข้อมูล"} {f.required && <span className="text-danger">*</span>}
                        </label>
                        {f.type === "dropdown" ? (
                          <PillSelect className="w-full" disabled>
                            <option>เลือกรายการ...</option>
                            {f.options?.map((opt, i) => (
                              <option key={i}>{opt}</option>
                            ))}
                          </PillSelect>
                        ) : f.type === "date" ? (
                          <PillInput type="date" className="w-full text-white/40" disabled />
                        ) : f.type === "number" ? (
                          <PillInput type="number" placeholder="0.00" className="w-full font-mono" disabled />
                        ) : f.type === "table" ? (
                          <div className="w-full p-3 rounded-xl border border-white/10 bg-white/[0.01] text-center text-[10px] font-black text-white/20 uppercase tracking-widest">
                            [ + ] Dynamic Table Placeholder
                          </div>
                        ) : (
                          <PillInput placeholder="กรอกข้อมูล..." className="w-full" disabled />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          <div className="pt-6 border-t border-white/5 mt-10">
            <div className="flex items-start gap-3 text-[11px] text-white/30 bg-white/[0.01] border border-white/5 rounded-xl p-3 leading-relaxed">
              <HelpCircle size={14} className="text-nexus-blue flex-shrink-0 mt-0.5" />
              <span>การลากวางออกแบบและการเรียงลำดับสามารถกดผ่านปุ่มลูกศรขึ้น/ลง เพื่อจัดวางลำดับฟิลด์ให้ออกมาเป็นโครงสร้างตารางข้อมูลรายงานที่ถูกต้อง</span>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} type={toast.type} />
    </div>
  );
}
