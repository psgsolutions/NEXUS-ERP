"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Search, 
  Calendar, 
  Sparkles, 
  Filter, 
  Layers, 
  Eye, 
  Plus, 
  TrendingUp, 
  Activity,
  ListFilter,
  CheckCircle2,
  FileDown
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
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
  getDoc, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { FormTemplate, FormSubmission } from "@/types/database";
import FormRenderer from "@/components/reports/FormRenderer";
import ReportExporter from "@/components/reports/ReportExporter";

export default function ReportsPage() {
  const { user, companyId } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<FormSubmission[]>([]);
  
  // Filtering states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [companyName, setCompanyName] = useState("บริษัท พีเอสจี โซลูชั่น จำกัด");

  // Submission Detail Modal
  const [activeSubmission, setActiveSubmission] = useState<FormSubmission | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // New Submission Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newSubValues, setNewSubValues] = useState<Record<string, any>>({});

  const [toast, setToast] = useState({ message: "", isVisible: false });
  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  // 1. Fetch Company Config to get actual tenant name
  useEffect(() => {
    if (!companyId) return;
    const fetchCompany = async () => {
      try {
        const companyRef = doc(db, "companies", companyId);
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
          setCompanyName(companySnap.data().name || "บริษัท พีเอสจี โซลูชั่น จำกัด");
        }
      } catch (err) {
        console.error("Failed to load company config", err);
      }
    };
    fetchCompany();
  }, [companyId]);

  // 2. Fetch Form Templates scoped to companyId (Multi-tenancy Scoping)
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
      // Auto select first template if none is selected
      if (list.length > 0 && !selectedTemplate) {
        setSelectedTemplate(list[0]);
      }
    });

    return () => unsubscribe();
  }, [companyId]);

  // 3. Fetch Submissions for the selected template scoped to companyId
  useEffect(() => {
    if (!companyId || !selectedTemplate) {
      setSubmissions([]);
      setFilteredSubmissions([]);
      return;
    }

    const q = query(
      collection(db, "form_submissions"),
      where("templateId", "==", selectedTemplate.id),
      where("companyId", "==", companyId),
      where("isDeleted", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: FormSubmission[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as FormSubmission);
      });
      // Sort submissions by creation time (newest first)
      list.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setSubmissions(list);
      setFilteredSubmissions(list);
    });

    return () => unsubscribe();
  }, [companyId, selectedTemplate]);

  // 4. Apply search & date range filters locally
  useEffect(() => {
    let result = [...submissions];

    // Filter by Date Range
    if (startDate) {
      const startSec = new Date(startDate).getTime() / 1000;
      result = result.filter(sub => (sub.createdAt?.seconds || 0) >= startSec);
    }
    if (endDate) {
      // Add one day to include the entire end date till end of day
      const endSec = (new Date(endDate).getTime() + 86400000) / 1000;
      result = result.filter(sub => (sub.createdAt?.seconds || 0) <= endSec);
    }

    // Filter by Search Query (searches in subId and values)
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      result = result.filter(sub => {
        const idMatch = sub.submissionId.toLowerCase().includes(qLower);
        const valueMatch = Object.values(sub.values || {}).some(val => 
          typeof val === "string" && val.toLowerCase().includes(qLower)
        );
        return idMatch || valueMatch;
      });
    }

    setFilteredSubmissions(result);
  }, [submissions, startDate, endDate, searchQuery]);

  // 5. Handle New Form Submission Creation
  const handleCreateSubmission = async () => {
    if (!selectedTemplate || !companyId || !user) return;

    // Check required fields
    const missingFields = selectedTemplate.fields.filter(f => f.required && !newSubValues[f.id]);
    if (missingFields.length > 0) {
      showToast(`กรุณากรอกฟิลด์ข้อมูลที่จำเป็น: ${missingFields.map(f => f.label).join(", ")}`);
      return;
    }

    try {
      const newSubmission = {
        submissionId: `SUB-${Date.now()}`,
        templateId: selectedTemplate.id,
        module: selectedTemplate.module,
        refId: "", // Optional reference ID
        values: newSubValues,
        companyId,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        isDeleted: false
      };

      await addDoc(collection(db, "form_submissions"), newSubmission);
      setIsNewModalOpen(false);
      setNewSubValues({});
      showToast("บันทึกข้อมูลธุรกรรมสำเร็จ!");
    } catch (err) {
      console.error("Failed to add submission", err);
      showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  // Calculate sum totals of numeric fields/tables in current filtered submissions
  const calculateAggregateStats = () => {
    let grandTotal = 0;
    filteredSubmissions.forEach((sub) => {
      selectedTemplate?.fields.forEach((field) => {
        if (field.type === "table") {
          const tableRows = Array.isArray(sub.values?.[field.id]) ? sub.values[field.id] : [];
          grandTotal += tableRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        } else if (field.type === "number") {
          grandTotal += Number(sub.values?.[field.id] || 0);
        }
      });
    });
    return grandTotal;
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto">
      
      {/* 1. Page Header with Title & Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-nexus-teal rounded-full flex items-center justify-center shadow-neon-teal">
            <Activity size={24} className="text-black" />
          </div>
          <div>
            <div className="flex gap-2 mb-2">
              <span className="px-2 py-0.5 rounded bg-nexus-teal/10 border border-nexus-teal/20 text-[10px] text-nexus-teal font-black uppercase tracking-widest">
                โมดูลรายงานอัจฉริยะ (Report Engine)
              </span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-white/40 font-black uppercase tracking-widest">
                องค์กร: {companyName}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              ระบบวิเคราะห์ข้อมูลและสร้างแบบฟอร์มเอกสาร
            </h1>
          </div>
        </div>

        {selectedTemplate && (
          <PillButton 
            onClick={() => {
              setNewSubValues({});
              setIsNewModalOpen(true);
            }} 
            className="px-8 shadow-neon-teal text-black"
          >
            <Plus size={18} />
            บันทึกข้อมูลธุรกรรมใหม่
          </PillButton>
        )}
      </div>

      {/* 2. Statistical Metric Cards */}
      <div className="grid grid-cols-4 gap-6">
        <MasterMetricCard 
          icon={<FileText />} 
          label="เทมเพลตที่พร้อมใช้" 
          value={`${templates.length} TEMPLATES`} 
          color="text-nexus-blue" 
        />
        <MasterMetricCard 
          icon={<CheckCircle2 />} 
          label="รายการธุรกรรมรวม" 
          value={`${submissions.length} Records`} 
          color="text-nexus-teal" 
        />
        <MasterMetricCard 
          icon={<Filter />} 
          label="รายการที่กรองผล" 
          value={`${filteredSubmissions.length} Records`} 
          color="text-nexus-teal" 
        />
        <MasterMetricCard 
          icon={<TrendingUp />} 
          label="มูลค่าธุรกรรมงวดนี้" 
          value={`฿${calculateAggregateStats().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          color="text-nexus-teal" 
          neon="shadow-neon-teal/20"
        />
      </div>

      {/* 3. Filtering & Control Dashboard Area */}
      <GlassCard className="p-6 bg-[#0a0a0c]/80 border-white/5 space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3 text-white/60">
            <ListFilter size={18} className="text-nexus-teal" />
            <h4 className="text-[12px] font-black uppercase tracking-widest">กรองเงื่อนไขและประเภทแบบฟอร์ม / ค้นหาข้อมูล</h4>
          </div>
          
          {selectedTemplate && filteredSubmissions.length > 0 && (
            <ReportExporter 
              template={selectedTemplate} 
              data={filteredSubmissions} 
              dateRange={{ start: startDate, end: endDate }}
              companyName={companyName}
            />
          )}
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Template Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest">เลือกแบบฟอร์มเอกสาร</label>
            <PillSelect 
              value={selectedTemplate?.id || ""} 
              onChange={(e) => {
                const found = templates.find(t => t.id === e.target.value);
                if (found) setSelectedTemplate(found);
              }}
              className="w-full"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.title} ({t.module})</option>
              ))}
            </PillSelect>
          </div>

          {/* Date Picker Start */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest">ตั้งแต่วันที่</label>
            <div className="relative">
              <PillInput 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-white" 
              />
            </div>
          </div>

          {/* Date Picker End */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest">ถึงวันที่</label>
            <div className="relative">
              <PillInput 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-white" 
              />
            </div>
          </div>

          {/* Text Search Input */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-white/30 uppercase tracking-widest">ค้นหาคำสำคัญ</label>
            <div className="relative">
              <PillInput 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ระบุข้อความเพื่อสืบค้น..."
                className="w-full pl-5 pr-10" 
              />
              <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 4. Beautiful Unified Table Layout (PSG UI V3.1 Standards) */}
      <GlassCard className="p-6 bg-[#0a0a0c] border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <Layers size={18} className="text-nexus-teal" />
          <h3 className="text-xs font-black text-white/60 uppercase tracking-widest">
            ตารางรายการธุรกรรมที่จัดเก็บ ({filteredSubmissions.length} รายการ)
          </h3>
        </div>

        {/* Outer scroll wrapper preventing table UI elements from clipping or hiding text */}
        <NexusTable 
          headers={[
            "รหัสธุรกรรม",
            "วันที่จัดทำ",
            selectedTemplate?.fields[0]?.label || "ฟิลด์ข้อมูลที่ 1",
            selectedTemplate?.fields[1]?.label || "ฟิลด์ข้อมูลที่ 2",
            "จำนวนรายการย่อย",
            "ยอดรวมสุทธิ",
            "เครื่องมือ"
          ]}
          minWidth="min-w-[1000px]"
        >
          {filteredSubmissions.length === 0 ? (
            <NexusTableRow>
              <NexusTableCell 
                colSpan={7} 
                className="p-12 text-center text-[11px] text-white/25 uppercase font-black tracking-[0.3em] border-0 bg-transparent"
              >
                ยังไม่พบรายการข้อมูลในฐานข้อมูลหรือเงื่อนไขการค้นหา
              </NexusTableCell>
            </NexusTableRow>
          ) : (
            filteredSubmissions.map((sub, idx) => {
              const val1 = sub.values?.[selectedTemplate?.fields[0]?.id || ""] || "-";
              const val2 = sub.values?.[selectedTemplate?.fields[1]?.id || ""] || "-";
              const displayVal1 = typeof val1 === "object" ? "[ตารางรายละเอียด]" : String(val1);
              const displayVal2 = typeof val2 === "object" ? "[ตารางรายละเอียด]" : String(val2);

              let totalAmount = 0;
              let itemRows = 0;
              selectedTemplate?.fields.forEach((field) => {
                if (field.type === "table") {
                  const tableRows = Array.isArray(sub.values?.[field.id]) ? sub.values[field.id] : [];
                  itemRows += tableRows.length;
                  totalAmount += tableRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
                } else if (field.type === "number") {
                  totalAmount += Number(sub.values?.[field.id] || 0);
                }
              });

              return (
                <NexusTableRow key={sub.id} onClick={() => {
                  setActiveSubmission(sub);
                  setIsDetailModalOpen(true);
                }}>
                  {/* Sub ID - Monospace & Non-italic */}
                  <NexusTableCell mono={true} className="text-nexus-teal text-[13px] font-black uppercase tracking-wide">
                    {sub.submissionId}
                  </NexusTableCell>

                  {/* Date */}
                  <NexusTableCell>
                    {sub.createdAt ? new Date(sub.createdAt.seconds * 1000).toLocaleDateString("th-TH") : "-"}
                  </NexusTableCell>

                  {/* Custom Dynamic Value 1 - wrap to avoid clip */}
                  <NexusTableCell wrap={true} className="max-w-[220px] text-white/90">
                    {displayVal1}
                  </NexusTableCell>

                  {/* Custom Dynamic Value 2 - wrap to avoid clip */}
                  <NexusTableCell wrap={true} className="max-w-[220px] text-white/70">
                    {displayVal2}
                  </NexusTableCell>

                  {/* Sub-rows Count */}
                  <NexusTableCell className="text-center font-bold">
                    {itemRows > 0 ? `${itemRows} แถว` : "-"}
                  </NexusTableCell>

                  {/* Grand Total Value - Monospace Numbers */}
                  <NexusTableCell mono={true} className="text-right text-[14px] font-black text-nexus-teal select-all">
                    ฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </NexusTableCell>

                  {/* Action */}
                  <NexusTableCell onClick={(e) => e.stopPropagation()}>
                    <PillButton 
                      onClick={() => {
                        setActiveSubmission(sub);
                        setIsDetailModalOpen(true);
                      }}
                      variant="glass" 
                      className="h-7 px-3 text-[11px]"
                    >
                      <Eye size={12} /> รายละเอียด
                    </PillButton>
                  </NexusTableCell>
                </NexusTableRow>
              );
            })
          )}
        </NexusTable>
      </GlassCard>

      {/* 5. Modal: Dynamic Form Details (View Mode) */}
      {selectedTemplate && activeSubmission && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`รายละเอียดข้อมูลเอกสาร: ${activeSubmission.submissionId}`}
          maxWidth="max-w-4xl"
        >
          <div className="p-8 space-y-6 bg-[#0a0a0c]">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <span className="px-2 py-0.5 rounded bg-nexus-blue/10 border border-nexus-blue/20 text-[10px] text-nexus-blue font-black uppercase tracking-widest">
                  รหัสเอกสาร: {activeSubmission.submissionId}
                </span>
                <p className="text-xs text-white/40 mt-1">
                  สร้างเมื่อ: {activeSubmission.createdAt ? new Date(activeSubmission.createdAt.seconds * 1000).toLocaleString("th-TH") : "-"}
                </p>
              </div>
            </div>

            <FormRenderer 
              template={selectedTemplate} 
              values={activeSubmission.values} 
              onChange={() => {}} 
              disabled={true} 
            />

            <div className="pt-6 border-t border-white/5 flex justify-end">
              <PillButton onClick={() => setIsDetailModalOpen(false)} variant="glass" className="h-9 px-6 rounded-full">
                ปิดหน้าจอรายละเอียด
              </PillButton>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. Modal: Record New Submission (Create Mode) */}
      {selectedTemplate && (
        <Modal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          title={`กรอกข้อมูลเอกสารใหม่: ${selectedTemplate.title}`}
          maxWidth="max-w-4xl"
        >
          <div className="p-8 space-y-6 bg-[#0a0a0c]">
            <p className="text-xs text-white/30 border-b border-white/5 pb-4 uppercase tracking-widest font-black">
              กรุณาระบุรายละเอียดให้ครบถ้วนก่อนบันทึกข้อมูลธุรกรรมเข้าสู่ระบบ Multi-tenant
            </p>

            <FormRenderer 
              template={selectedTemplate} 
              values={newSubValues} 
              onChange={setNewSubValues} 
              disabled={false} 
            />

            <div className="pt-6 border-t border-white/5 flex justify-end gap-3">
              <PillButton onClick={() => setIsNewModalOpen(false)} variant="glass" className="h-9 px-6 text-white/50">
                ยกเลิก
              </PillButton>
              <PillButton onClick={handleCreateSubmission} variant="primary" className="h-9 px-6 shadow-neon-teal text-black">
                ยืนยันการบันทึก (SAVE RECORD)
              </PillButton>
            </div>
          </div>
        </Modal>
      )}

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} />
    </div>
  );
}
