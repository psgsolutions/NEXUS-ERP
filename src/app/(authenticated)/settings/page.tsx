"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Settings as SettingsIcon, 
  Building2, 
  Fingerprint, 
  Save,
  RefreshCcw,
  Zap,
  ShieldCheck,
  Globe,
  Users,
  Bell,
  Cpu,
  Database,
  Lock,
  ArrowRight,
  FileText,
  Edit3,
  Layout,
  Type,
  ImageIcon,
  Plus,
  Trash2,
  Sparkles
} from "lucide-react";
import { useRouter } from "next/navigation";
import { 
  PillButton, 
  PillInput, 
  MasterMetricCard, 
  cn, 
  Modal, 
  Toast, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge, 
  PillTabs,
  GlassCard
} from "@/components/ui/Base";

import { UltimateDocumentBuilder, getInitialTemplate } from "@/components/reports/UltimateDocumentBuilder";
import UsersPage from "./users/page";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc,
  updateDoc,
  serverTimestamp 
} from "firebase/firestore";

type SettingsTab = "company" | "sequence" | "templates" | "security" | "users";


export default function SettingsPage() {
  const { showAlert, showConfirm } = useSystemDialog();

  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "company";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [toast, setToast] = useState({ message: "", isVisible: false });

  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || "COMP-001";

  // Dynamic templates states
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  // Wizard form states
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedPresetType, setSelectedPresetType] = useState<"QUOTATION" | "PURCHASE_ORDER" | "PROJECT_INVOICE" | "CRM">("QUOTATION");
  const [selectedPresetStyle, setSelectedPresetStyle] = useState("Teal Modern");

  const fetchTemplates = async () => {
    setIsTemplatesLoading(true);
    try {
      // Query by companyId only - filter isDeleted client-side
      // because old documents may not have isDeleted field at all
      // and Firestore strict equality "isDeleted == false" won't match those
      const q = query(
        collection(db, "form_templates"),
        where("companyId", "==", currentCompanyId)
      );
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Include document if isDeleted is explicitly false OR field doesn't exist
        if (data.isDeleted !== true) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setDbTemplates(list);
    } catch (err) {
      console.error("Failed to load templates:", err);
      showToast("เกิดข้อผิดพลาดในการโหลดรายการต้นแบบ");
    } finally {
      setIsTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "templates") {
      fetchTemplates();
    }
  }, [activeTab, currentCompanyId]);

  const handleInstallStandardTemplates = async () => {
    try {
      const standardTemplateNames = [
        "ใบเสนอราคา (Quotation)",
        "ใบสั่งซื้อ (Purchase Order)",
        "ใบกำกับภาษี (Tax Invoice)",
        "ใบเสร็จรับเงิน (Receipt)"
      ];

      let installedCount = 0;

      for (const name of standardTemplateNames) {
        // Query to check if it already exists for this tenant
        // Filter isDeleted client-side to catch old docs without this field
        const q = query(
          collection(db, "form_templates"),
          where("companyId", "==", currentCompanyId),
          where("templateName", "==", name)
        );

        const querySnapshot = await getDocs(q);
        const existingActive = querySnapshot.docs.filter(d => d.data().isDeleted !== true);
        if (existingActive.length === 0) {
          // Get the standard blocks seed
          const seed = getInitialTemplate(name);
          seed.companyId = currentCompanyId;

          // Save to Firestore
          await addDoc(collection(db, "form_templates"), {
            ...seed,
            createdAt: serverTimestamp(),
            createdBy: user?.uid || "SYSTEM",
            updatedAt: serverTimestamp(),
            updatedBy: user?.uid || "SYSTEM"
          });
          installedCount++;
        }
      }

      if (installedCount > 0) {
        setToast({ message: `ติดตั้งแม่แบบสำเร็จรูปทั้ง 4 ประเภทเรียบร้อยแล้ว (${installedCount} แม่แบบใหม่)`, isVisible: true });
      } else {
        setToast({ message: "แม่แบบมาตรฐานทั้ง 4 ประเภทได้รับการติดตั้งอยู่ในระบบคลาวด์เรียบร้อยแล้ว", isVisible: true });
      }
      fetchTemplates();
    } catch (err) {
      console.error("Failed to seed standard templates:", err);
      setToast({ message: "เกิดข้อผิดพลาดในการติดตั้งแม่แบบธุรกรรม", isVisible: true });
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!(await showConfirm(`คุณแน่ใจหรือไม่ว่าต้องการลบต้นแบบเอกสาร "${name}"?`))) return;
    try {
      const docRef = doc(db, "form_templates", id);
      await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || "SYSTEM"
      });
      showToast(`ลบต้นแบบ "${name}" สำเร็จ`);
      fetchTemplates();
    } catch (err) {
      console.error("Failed to delete template:", err);
      showToast("เกิดข้อผิดพลาดในการลบต้นแบบ");
    }
  };

  const handleResetTemplate = async (id: string, name: string) => {
    if (!(await showConfirm(`คุณแน่ใจหรือไม่ว่าต้องการคืนค่าโรงงานให้กับต้นแบบเอกสาร "${name}"? การปรับแต่งทั้งหมดจะสูญหายไป`))) return;
    try {
      const freshSeed = getInitialTemplate(name);
      freshSeed.companyId = currentCompanyId;

      const docRef = doc(db, "form_templates", id);
      await updateDoc(docRef, {
        blocks: freshSeed.blocks,
        globalStyles: freshSeed.globalStyles,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || "SYSTEM"
      });
      showToast(`คืนค่ามาตรฐานต้นแบบ "${name}" เรียบร้อยแล้ว`);
      fetchTemplates();
    } catch (err) {
      console.error("Failed to reset template:", err);
      showToast("เกิดข้อผิดพลาดในการคืนค่าเริ่มต้น");
    }
  };

  const handleCreateTemplateFromWizard = async () => {
    if (!newTemplateName.trim()) {
      showToast("กรุณาระบุชื่อต้นแบบเอกสาร");
      return;
    }

    try {
      let nameForSeed = "ใบเสนอราคา (Quotation)";
      if (selectedPresetType === "PURCHASE_ORDER") nameForSeed = "ใบสั่งซื้อ (Purchase Order)";
      else if (selectedPresetType === "PROJECT_INVOICE") nameForSeed = "ใบกำกับภาษี (Tax Invoice)";
      else if (selectedPresetType === "CRM") nameForSeed = "ใบเสร็จรับเงิน (Receipt)";
      
      const seed = getInitialTemplate(nameForSeed);
      seed.templateName = newTemplateName;
      seed.targetModule = selectedPresetType;
      seed.companyId = currentCompanyId;
      seed.isDeleted = false;

      if (selectedPresetStyle === "Teal Modern") {
        seed.globalStyles.primaryColor = "#0d9488";
        seed.globalStyles.secondaryColor = "#0f766e";
      } else if (selectedPresetStyle === "Indigo Corporate") {
        seed.globalStyles.primaryColor = "#1e3a8a";
        seed.globalStyles.secondaryColor = "#172554";
      } else if (selectedPresetStyle === "Slate Steel") {
        seed.globalStyles.primaryColor = "#334155";
        seed.globalStyles.secondaryColor = "#1e293b";
      } else if (selectedPresetStyle === "Emerald Finance") {
        seed.globalStyles.primaryColor = "#047857";
        seed.globalStyles.secondaryColor = "#064e3b";
      } else if (selectedPresetStyle === "Blank Slate") {
        seed.blocks = [];
        seed.globalStyles.primaryColor = "#1f2937";
        seed.globalStyles.secondaryColor = "#4b5563";
      }

      const q = query(
        collection(db, "form_templates"),
        where("companyId", "==", currentCompanyId),
        where("templateName", "==", newTemplateName)
      );
      const querySnapshot = await getDocs(q);
      // Filter client-side to exclude deleted docs
      const activeDocs = querySnapshot.docs.filter(d => d.data().isDeleted !== true);
      
      let finalDocId = "";
      if (activeDocs.length > 0) {
        const existingDoc = activeDocs[0];
        finalDocId = existingDoc.id;
        const docRef = doc(db, "form_templates", finalDocId);
        await updateDoc(docRef, {
          ...seed,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || "SYSTEM"
        });
      } else {
        const docAdded = await addDoc(collection(db, "form_templates"), {
          ...seed,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || "SYSTEM",
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || "SYSTEM"
        });
        finalDocId = docAdded.id;
      }

      showToast(`สร้างต้นแบบ "${newTemplateName}" สำเร็จ`);
      setShowCreateWizard(false);
      setNewTemplateName("");
      fetchTemplates();

      setActiveModal(newTemplateName);
    } catch (err) {
      console.error("Failed to create template from wizard:", err);
      showToast("เกิดข้อผิดพลาดในการสร้างต้นแบบ");
    }
  };

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const tabs = [
    { id: "company", label: "ข้อมูลนิติบุคคล", icon: <Building2 size={14} /> },
    { id: "users", label: "จัดการผู้ใช้งาน", icon: <Users size={14} /> },
    { id: "sequence", label: "รูปแบบเลขที่ (ID)", icon: <Fingerprint size={14} /> },
    { id: "templates", label: "ต้นแบบเอกสาร", icon: <FileText size={14} /> },
    { id: "security", label: "ความปลอดภัย", icon: <ShieldCheck size={14} /> },
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">เลเยอร์การกำหนดค่าระบบ</p>
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                <SettingsIcon size={22} />
             </div>
             <h1 className="text-2xl font-black text-white tracking-tight uppercase">การตั้งค่าระบบ (SYSTEM HUB)</h1>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <PillTabs 
            tabs={tabs} 
            activeTab={activeTab} 
            onTabChange={(id: any) => setActiveTab(id)} 
          />
          <PillButton className="px-10 shadow-neon-teal" onClick={() => showToast("บันทึกการตั้งค่าสำเร็จ")}>
            <Save size={18} />
            บันทึกการตั้งค่า
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-10">
          
          {activeTab === "company" && (
            <GlassCard className="p-6 space-y-6 border-white/10 rounded-2xl animate-in slide-in-from-bottom duration-500">
               <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-xl bg-white/[0.02] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-white/20 hover:border-nexus-teal hover:text-nexus-teal hover:bg-nexus-teal/5 transition-all cursor-pointer">
                     <Building2 size={24} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Logo</span>
                  </div>
                  <div className="space-y-1">
                     <h2 className="text-2xl font-black text-white uppercase">โปรไฟล์นิติบุคคล</h2>
                     <p className="text-sm text-white/40 font-bold">ข้อมูลสำหรับออกใบกำกับภาษีและเอกสารทางราชการ</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">ชื่อบริษัท (ภาษาไทย) *</label>
                     <PillInput defaultValue="บริษัท พีเอสจี โซลูชั่น จำกัด" className="bg-white/[0.02] border-white/10" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">ชื่อบริษัท (ENGLISH) *</label>
                     <PillInput defaultValue="PSG SOLUTIONS CO., LTD." className="bg-white/[0.02] border-white/10 uppercase" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">เลขประจำตัวผู้เสียภาษี *</label>
                     <PillInput defaultValue="0105564000000" className="bg-white/[0.02] border-white/10 font-mono" />
                  </div>
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">เว็บไซต์ / ช่องทางออนไลน์</label>
                     <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={18} />
                        <PillInput defaultValue="www.psgsolutions.com" className="pl-12 bg-white/[0.02] border-white/10" />
                     </div>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                     <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">ที่อยู่สำนักงานใหญ่</label>
                     <textarea className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-nexus-teal/40 min-h-[100px] placeholder:text-white/10" defaultValue="เลขที่ 1/1 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900" />
                  </div>
               </div>
            </GlassCard>
          )}

          {activeTab === "sequence" && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
               <div className="px-4">
                  <h2 className="text-xl font-black text-white uppercase">การตั้งค่ารูปแบบเลขที่เอกสาร</h2>
                  <p className="text-xs text-white/40 font-bold mt-1">กำหนดรูปแบบเลขที่เอกสารอัจฉริยะ (Smart Prefix Mapping)</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SequenceCard module="คลังพัสดุ (Inventory)" prefix="NXI" example="NXI-2604-0001" />
                  <SequenceCard module="ใบเสนอราคา (Quotation)" prefix="QT" example="QT-2604-0042" />
                  <SequenceCard module="โครงการ (Project)" prefix="PRJ" example="PRJ-26-001" />
                  <SequenceCard module="ใบสั่งซื้อ (Purchase Order)" prefix="PO" example="PO-2604-0001" />
                  <SequenceCard module="ใบสั่งขาย (Sales Order)" prefix="SO" example="SO-2604-0001" />
                  <SequenceCard module="รายงานปฏิบัติงาน (Service Report)" prefix="SR" example="SR-2604-0001" />
               </div>
            </div>
          )}
          {activeTab === "templates" && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
               <div className="px-4 flex justify-between items-end">
                  <div>
                    <h2 className="text-xl font-black text-white uppercase">สถาปนิกต้นแบบเอกสาร (DOCUMENT ARCHITECT)</h2>
                    <p className="text-xs text-white/40 font-bold mt-1">ออกแบบและปรับแต่งรูปแบบการออกรายงานและเอกสารด้วยตัวเอง</p>
                  </div>
                  <div className="flex gap-3">
                    <PillButton 
                      variant="glass" 
                      className="text-nexus-teal border-nexus-teal/20 hover:bg-nexus-teal/10 h-9 px-4 text-xs font-black uppercase rounded-full"
                      onClick={handleInstallStandardTemplates}
                    >
                      <Zap size={13} className="text-nexus-teal animate-pulse" /> ติดตั้ง 4 แม่แบบมาตรฐานด่วน
                    </PillButton>
                    <PillButton className="shadow-neon-teal" onClick={() => router.push('/settings/document-builder')}>
                      <Plus size={16} /> สร้างต้นแบบใหม่
                    </PillButton>
                  </div>
               </div>

               {isTemplatesLoading ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-white/[0.01] border border-white/5 rounded-3xl h-[300px]">
                     <div className="w-12 h-12 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 animate-pulse mb-4">
                        <Database size={24} className="animate-spin text-nexus-teal [animation-duration:3s]" />
                     </div>
                     <span className="text-xs font-black uppercase tracking-widest text-white/50">กำลังเชื่อมต่อระบบจัดเก็บเอกสารคลาวด์...</span>
                  </div>
               ) : dbTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-white/[0.01] border border-white/5 rounded-3xl h-[300px] text-center space-y-4">
                     <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
                        <FileText size={22} />
                     </div>
                     <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">ยังไม่มีต้นแบบเอกสารในคลาวด์</h3>
                        <p className="text-[10px] text-white/30 uppercase mt-1 tracking-widest leading-none font-bold">No standard transaction templates loaded yet</p>
                     </div>
                     <PillButton 
                        variant="glass" 
                        className="text-nexus-teal border-nexus-teal/20 hover:bg-nexus-teal/10 h-9 px-6 text-xs font-black uppercase rounded-full"
                        onClick={handleInstallStandardTemplates}
                     >
                        <Zap size={12} className="text-nexus-teal animate-pulse" /> ติดตั้ง 4 แม่แบบมาตรฐานเริ่มต้นทันที
                     </PillButton>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {dbTemplates.map((tmpl) => (
                        <TemplateCard 
                          key={tmpl.id}
                          name={tmpl.templateName} 
                          type={
                            tmpl.targetModule === "QUOTATION" ? "ใบเสนอราคา (Teal Preset)" :
                            tmpl.targetModule === "PURCHASE_ORDER" ? "ใบสั่งซื้อ (Indigo Preset)" :
                            tmpl.targetModule === "PROJECT_INVOICE" ? "ใบกำกับภาษี (Slate Preset)" : "ใบเสร็จรับเงิน (Emerald Preset)"
                          } 
                          lastEdit={tmpl.updatedAt ? new Date(tmpl.updatedAt.seconds * 1000).toLocaleDateString("th-TH") : "เพิ่งสร้างเมื่อครู่"} 
                          primaryColor={tmpl.globalStyles?.primaryColor || "#0d9488"}
                          blocksCount={tmpl.blocks?.length || 0}
                          onEdit={() => setActiveModal(tmpl.templateName)} 
                          onReset={() => handleResetTemplate(tmpl.id, tmpl.templateName)}
                          onDelete={() => handleDeleteTemplate(tmpl.id, tmpl.templateName)}
                        />
                     ))}
                  </div>
               )}
            </div>
          )}

          {activeTab === "users" && (
            <div className="animate-in slide-in-from-bottom duration-500 -mt-6 -ml-6">
              <UsersPage />
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
               <div className="px-4">
                  <h2 className="text-xl font-black text-white uppercase">ตั้งค่าความปลอดภัย (Security Settings)</h2>
                  <p className="text-xs text-white/40 font-bold mt-1">กำหนดนโยบายความปลอดภัยและตรวจสอบการเข้าถึงระบบ</p>
               </div>
               <GlassCard className="p-8 border-white/10 rounded-2xl flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-nexus-teal/10 flex items-center justify-center text-nexus-teal">
                     <ShieldCheck size={32} />
                  </div>
                  <div>
                     <h3 className="text-lg font-black text-white uppercase">ระบบรักษาความปลอดภัย</h3>
                     <p className="text-sm text-white/40 mt-1">การตั้งค่าความปลอดภัยขั้นสูงจะพร้อมใช้งานในเร็วๆ นี้</p>
                  </div>
                  <PillButton className="mt-4 shadow-neon-teal">
                     เปิดใช้งาน 2FA ให้กับผู้ดูแลระบบ
                  </PillButton>
               </GlassCard>
            </div>
          )}
        </div>


        {/* Right Sidebar Status */}
        <div className="space-y-6">
           <GlassCard className="p-5 border-white/10 bg-nexus-teal/5">
              <h4 className="text-[11px] font-black text-nexus-teal uppercase tracking-widest mb-5">สถานะระบบ (SYSTEM HEALTH)</h4>
              <div className="space-y-4">
                 <ConfigStatusItem icon={<Database size={14} />} label="Multi-tenancy" status="เปิดใช้งาน" />
                 <ConfigStatusItem icon={<Lock size={14} />} label="การเข้ารหัสข้อมูล" status="ระดับสูงสุด" />
                 <ConfigStatusItem icon={<Cpu size={14} />} label="AI Engine Layer" status="พร้อมใช้งาน" />
                 <ConfigStatusItem icon={<Globe size={14} />} label="Cloud Node" status="BKK-01" />
              </div>
           </GlassCard>

           <GlassCard className="p-5 border-white/10">
              <h4 className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-4">ประวัติการแก้ไขล่าสุด</h4>
              <div className="space-y-4">
                 <ConfigLogItem label="ปรับปรุงอัตราภาษี" time="2 วันที่แล้ว" user="ผู้ดูแลระบบสูงสุด" />
                 <ConfigLogItem label="แก้ไข Prefix ใบสั่งขาย (SO)" time="5 วันที่แล้ว" user="ผู้ดูแลระบบ" />
              </div>
           </GlassCard>
        </div>
      </div>

      {activeModal !== null && (
         <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in zoom-in-95 duration-300">
           <div className="w-full h-full max-w-[1800px] mx-auto flex flex-col">
             <UltimateDocumentBuilder 
               templateName={activeModal} 
               onClose={() => {
                 setActiveModal(null);
                 fetchTemplates();
               }} 
             />
           </div>
         </div>
      )}

      {showCreateWizard && (
         <div className="fixed inset-0 z-[5500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="w-full max-w-[800px] bg-[#0F0F12] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-8 space-y-6">
              
              {/* Header */}
              <div className="space-y-1">
                 <span className="px-3 py-1 rounded-full bg-nexus-teal/15 border border-nexus-teal/30 text-[10px] text-nexus-teal font-black uppercase tracking-widest leading-none inline-block">
                    วิซาร์ดสร้างต้นแบบเอกสาร (Template Wizard)
                 </span>
                 <h2 className="text-xl font-black text-white uppercase tracking-tight mt-2">ตั้งค่าต้นแบบเอกสารรายงานใหม่</h2>
                 <p className="text-xs text-white/40 font-bold">กรุณากำหนดข้อมูลพื้นฐานและรูปแบบเริ่มต้นของเอกสารที่ต้องการจัดทำ</p>
              </div>

              {/* Step 1: Document Name */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-4 block">ชื่อต้นแบบเอกสาร (Template Name) *</label>
                 <PillInput 
                    value={newTemplateName} 
                    onChange={e => setNewTemplateName(e.target.value)}
                    placeholder="เช่น ใบแจ้งหนี้ลูกค้าพิเศษ, ใบเสนอราคาพาร์ทเนอร์..." 
                    className="w-full bg-white/[0.02] border-white/10 text-white" 
                 />
              </div>

              {/* Step 2: Preset Type */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-4 block">ประเภทฟังก์ชันเอกสาร (Document Preset Type)</label>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: "QUOTATION", label: "ใบเสนอราคา", desc: "Quotation" },
                      { id: "PURCHASE_ORDER", label: "ใบสั่งซื้อ", desc: "Purchase Order" },
                      { id: "PROJECT_INVOICE", label: "ใบกำกับภาษี/แจ้งหนี้", desc: "Tax Invoice" },
                      { id: "CRM", label: "ใบเสร็จรับเงิน", desc: "Receipt" }
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPresetType(p.id as any)}
                        className={`p-4 rounded-2xl bg-white/[0.02] border text-left transition-all hover:bg-white/[0.04] flex flex-col justify-between h-20 ${selectedPresetType === p.id ? "border-nexus-teal text-nexus-teal bg-nexus-teal/5 shadow-[0_0_15px_rgba(0,255,209,0.1)]" : "border-white/5 text-white/60"}`}
                      >
                        <span className="text-[11px] font-black uppercase tracking-tight block leading-none">{p.label}</span>
                        <span className="text-[9px] font-mono tracking-widest uppercase block mt-1 opacity-50">{p.desc}</span>
                      </button>
                    ))}
                 </div>
              </div>

              {/* Step 3: Base Style / Colors */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-4 block">ธีมสีและสไตล์เริ่มต้น (Theme & Styling Preset)</label>
                 <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {[
                      { id: "Teal Modern", color: "#0d9488", desc: "Modern Teal" },
                      { id: "Indigo Corporate", color: "#1e3a8a", desc: "Corporate Blue" },
                      { id: "Slate Steel", color: "#334155", desc: "Steel Slate" },
                      { id: "Emerald Finance", color: "#047857", desc: "Emerald Green" },
                      { id: "Blank Slate", color: "#4b5563", desc: "แบบร่างเปล่า" }
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={() => setSelectedPresetStyle(st.id)}
                        className={`p-3 rounded-xl bg-white/[0.01] border text-center transition-all hover:bg-white/[0.03] ${selectedPresetStyle === st.id ? "border-nexus-teal bg-nexus-teal/5" : "border-white/5"}`}
                      >
                        <div className="w-5 h-5 rounded-full mx-auto mb-2 border border-white/20" style={{ backgroundColor: st.color }} />
                        <span className="text-[10px] font-black text-white uppercase block tracking-tight leading-none">{st.id.split(" ")[0]}</span>
                        <span className="text-[8px] font-mono text-white/40 uppercase block mt-1 tracking-tighter">{st.desc}</span>
                      </button>
                    ))}
                 </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                 <PillButton 
                    variant="glass" 
                    className="h-9 px-6 text-white/50"
                    onClick={() => {
                       setShowCreateWizard(false);
                       setNewTemplateName("");
                    }}
                 >
                    ยกเลิก
                 </PillButton>
                 
                 <PillButton 
                    variant="primary" 
                    className="h-9 px-6 text-black font-black tracking-wider shadow-neon-teal"
                    onClick={handleCreateTemplateFromWizard}
                 >
                    ตกลง สร้างต้นแบบเอกสาร
                 </PillButton>
              </div>

           </div>
         </div>
      )}

      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />

    </div>
  );
}

function SequenceCard({ module, prefix, example }: { module: string, prefix: string, example: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 group hover:border-white/10 transition-all flex items-center gap-4">
       <div className="flex items-center gap-3 min-w-[160px]">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
             <Fingerprint size={14} />
          </div>
          <div>
            <p className="text-[11px] font-black text-white uppercase tracking-tight">{module}</p>
            <p className="text-[9px] text-white/30 font-mono mt-0.5">EX: {example}</p>
          </div>
       </div>
       <div className="flex-1 flex items-center gap-2">
          <PillInput 
             className="flex-1 h-8 px-2 text-[11px] font-mono text-center bg-black/40 border-white/5 text-nexus-teal focus:border-nexus-teal/50" 
             defaultValue={`[${prefix}]-[YYMM]-[0000]`} 
             title="รูปแบบเลขที่เอกสาร"
          />
          <button className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-white/5 text-white/40 hover:text-nexus-teal hover:bg-nexus-teal/10 transition-colors" title="อัปเดตรูปแบบ">
             <RefreshCcw size={13} />
          </button>
       </div>
    </div>
  );
}

function ConfigStatusItem({ icon, label, status }: { icon: any, label: string, status: string }) {
  return (
    <div className="flex justify-between items-center group">
       <div className="flex items-center gap-3">
          <div className="text-white/20 group-hover:text-nexus-teal transition-colors">{icon}</div>
          <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{label}</span>
       </div>
       <span className="text-[10px] font-black text-nexus-teal uppercase tracking-tighter shadow-neon-teal">{status}</span>
    </div>
  );
}

function ConfigLogItem({ label, time, user }: { label: string, time: string, user: string }) {
  return (
    <div className="flex items-center justify-between group">
       <div>
          <p className="text-xs font-black text-white group-hover:text-nexus-blue transition-colors">{label}</p>
          <p className="text-[10px] font-black text-white/20 uppercase">{user} • {time}</p>
       </div>
       <ArrowRight size={12} className="text-white/10 group-hover:text-white transition-all" />
    </div>
  );
}

function TemplateCard({ 
  name, 
  type, 
  lastEdit, 
  primaryColor,
  blocksCount,
  onEdit, 
  onReset,
  onDelete 
}: { 
  name: string, 
  type: string, 
  lastEdit: string, 
  primaryColor: string,
  blocksCount: number,
  onEdit: () => void, 
  onReset: () => void,
  onDelete: () => void 
}) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all relative overflow-hidden">
       <div className="flex items-start justify-between relative z-10">
          <div className="space-y-3">
             <div 
               className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all"
               style={{ 
                 backgroundColor: `${primaryColor}15`, 
                 borderColor: `${primaryColor}30`,
                 color: primaryColor 
               }}
             >
                <FileText size={20} />
             </div>
             <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">{name}</h3>
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Type: {type}</p>
             </div>
          </div>
          <div className="flex flex-col gap-2">
             <PillButton variant="glass" className="px-4 text-[10px] uppercase tracking-widest" onClick={onEdit}>
                <Edit3 size={14} /> แก้ไขต้นแบบ
             </PillButton>

             <PillButton variant="glass" className="px-4 text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100" onClick={onReset}>
                <RefreshCcw size={14} /> คืนค่าโรงงาน
             </PillButton>
          </div>
       </div>
       
       <div className="mt-5 flex items-center justify-between relative z-10 pt-4 border-t border-white/5">
          <div className="flex gap-4 col-span-3 items-center">
             <div className="flex items-center gap-1.5 text-[10px] font-black text-white/20 uppercase">
                <Layout size={10} /> {blocksCount} องค์ประกอบ
             </div>
             <div className="flex items-center gap-1.5 text-[10px] font-black text-white/20 uppercase">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} /> สีหลัก
             </div>
             <button 
               onClick={onDelete}
               className="flex items-center gap-1.5 text-[10px] font-black text-red-400/50 hover:text-red-400 uppercase transition-all"
               title="ลบต้นแบบออกจากฐานข้อมูล"
             >
                <Trash2 size={10} /> ลบต้นแบบ
             </button>
          </div>
          <p className="text-[10px] font-black text-white/10 uppercase italic">ปรับปรุง: {lastEdit}</p>
       </div>
       
       <div className="absolute bottom-0 right-0 w-32 h-32 blur-[60px] translate-y-1/2 translate-x-1/2" style={{ backgroundColor: `${primaryColor}10` }} />
    </div>
  );
}
