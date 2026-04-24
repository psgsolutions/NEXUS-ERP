"use client";

import React, { useState } from "react";
import { 
  Briefcase, 
  ChevronLeft, 
  Edit3, 
  Target, 
  ClipboardList, 
  Users, 
  Package, 
  Activity, 
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  Zap,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  Sparkles,
  Check,
  AlertTriangle
} from "lucide-react";
import { 
  PillButton, 
  GlassCard, 
  cn, 
  PillTabs, 
  NexusTable, 
  NexusTableRow, 
  NexusTableCell, 
  StatusBadge,
  MasterMetricCard,
  PillInput,
  PillBackButton,
  NexusDataField,
  Toast
} from "@/components/ui/Base";
import { QuotationModal } from "@/components/commerce/QuotationModal";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("timeline");
  
  // Quotation Integration States
  const [isQuotationOpen, setIsQuotationOpen] = useState(false);
  const [quotationInitialData, setQuotationInitialData] = useState<any>(null);
  const [toast, setToast] = useState({ message: "", isVisible: false });

  // Financials & BOQ States
  const [selectedBoqVersion, setSelectedBoqVersion] = useState("Rev 3");
  const [milestonesBilling, setMilestonesBilling] = useState<any[]>([
    { id: "M1", name: "งวดที่ 1: เตรียมพื้นที่และเดินสายโครงข่ายสัญญาณ", pct: 30, amount: 750000, status: "invoiced", ref: "INV-2026-0081" },
    { id: "M2", name: "งวดที่ 2: ประกอบ Cabinet และเชื่อมต่อไฟเบอร์", pct: 40, amount: 1000000, status: "pending", ref: null },
    { id: "M3", name: "งวดที่ 3: ทำการ Calibrate และส่งมอบงานราชการ", pct: 30, amount: 750000, status: "pending", ref: null },
  ]);

  // Documents & TOR states
  const [isParsing, setIsParsing] = useState(false);
  const [parseStep, setParseStep] = useState("");
  const [parsedResults, setParsedResults] = useState<any[] | null>(null);
  const [torFile, setTorFile] = useState<string | null>(null);

  const tabs = [
    { id: "timeline", label: "แผนงาน (TIMELINE)", icon: <Target size={14} /> },
    { id: "resources", label: "พัสดุ & อุปกรณ์", icon: <Package size={14} /> },
    { id: "team", label: "ทีมงาน & ค่าแรง", icon: <Users size={14} /> },
    { id: "reports", label: "SERVICE REPORTS", icon: <ClipboardList size={14} /> },
    { id: "financials", label: "การเงิน & BOQ", icon: <BarChart3 size={14} /> },
    { id: "documents", label: "เอกสารสำคัญ & TOR", icon: <FileText size={14} /> },
  ];

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  const handleParseTOR = () => {
    if (!torFile) {
      showToast("กรุณาเลือกหรืออัปโหลดไฟล์ TOR ก่อนทำการวิเคราะห์");
      return;
    }
    setIsParsing(true);
    setParseStep("กำลังเชื่อมต่อเซิร์ฟเวอร์ระบบรู้จำอักขระ (OCR)...");
    
    setTimeout(() => {
      setParseStep("Gemini 2.5 Flash กำลังอ่านข้อกำหนดสเปกและสแกนตารางอุปกรณ์...");
      setTimeout(() => {
        setParseStep("กำลังเปรียบเทียบสเปกกับฐานข้อมูลสินค้า Product Catalog... (95%)");
        setTimeout(() => {
          setIsParsing(false);
          setParsedResults([
            { spec: "กล้องวงจรปิดคมชัด 4MP กันน้ำมาตรฐาน IP66/IP67", model: "CCTV Outdoor Pro 4MP (IP67)", match: "✅ สอดคล้อง 100%", remarks: "ตรงตาม TOR หมวดกล้องภายนอก" },
            { spec: "เครื่องบันทึก NVR 16 ช่อง รองรับ HDD SATA 4 ลูก", model: "Enterprise NVR 16Ch SATA4", match: "✅ สอดคล้อง 100%", remarks: "รองรับการทำ RAID 5 ตรงความต้องการ" },
            { spec: "อุปกรณ์กระจายสัญญาณ PoE L2 Switch 24 ช่อง", model: "Cisco Catalyst C9200L 24P", match: "✅ สอดคล้อง 100%", remarks: "ยี่ห้อและมาตรฐานตรงเกณฑ์กลางจัดซื้อ" },
            { spec: "เครื่องสำรองไฟฟ้าแบบ True Online 1000VA", model: "UPS Smart 1000VA Pure Sinewave", match: "⚠️ สูงกว่าเกณฑ์ (1200VA)", remarks: "เสนอรุ่นประสิทธิภาพดีกว่าในราคาเดิมเพื่อชนะประมูล" }
          ]);
          showToast("Gemini AI วิเคราะห์เปรียบเทียบสเปก TOR สมบูรณ์แล้ว!");
        }, 1000);
      }, 1000);
    }, 1000);
  };

  // Pull existing equipment/expenses from project details and trigger Quotation
  const handleGenerateQuotation = () => {
    const aggregatedItems = [
      {
        id: 1,
        name: "[อุปกรณ์] LED Wall P2.5 Indoor",
        qty: 24,
        unit: "Units",
        cost: 65000,
        price: 85000
      },
      {
        id: 2,
        name: "[อุปกรณ์] Aruba AP-505 Enterprise Access Point",
        qty: 2,
        unit: "Units",
        cost: 15000,
        price: 22000
      },
      {
        id: 3,
        name: "[งานบริการ] ค่าแรงและทีมวิศวกรติดตั้งระบบโครงข่ายไฟเบอร์",
        qty: 1,
        unit: "Lot",
        cost: 150000,
        price: 210000
      }
    ];

    setQuotationInitialData({
      title: "ใบเสนอราคาส่วนเพิ่มเติม: ติดตั้งจอ LED Wall - ศูนย์ประชุม",
      customer: "CUS-004", // QSNCC Client Ref
      items: aggregatedItems
    });

    setIsQuotationOpen(true);
    showToast("ดึงรายการอุปกรณ์และงบประมาณจากตัวโครงการออกใบเสนอราคาสำเร็จ!");
  };

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <PillBackButton onClick={() => router.back()} />
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <StatusBadge status="active" label="กำลังดำเนินการ" />
               <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Project ID: {params.id || 'PRJ-26-001'}</p>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">ติดตั้งระบบ LED Wall - ศูนย์ประชุม</h1>
          </div>
        </div>
        
        {/* Header Action Buttons */}
        <div className="flex gap-3 items-center">
          {/* Neon Quotation Generation Button */}
          <PillButton onClick={handleGenerateQuotation} className="h-9 px-6 rounded-full shadow-neon-teal bg-nexus-teal text-black font-black uppercase flex items-center gap-2">
            <Zap size={16} className="animate-pulse" />
            ออกใบเสนอราคา ⚡
          </PillButton>
          
          <PillButton variant="glass" className="h-9 px-6 rounded-full text-white/60 hover:text-white">Digital Signature</PillButton>
          
          <PillButton className="h-9 px-6 rounded-full shadow-neon-teal">
            <Edit3 size={18} />
            จัดการโครงการ
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Content Area */}
        <div className="lg:col-span-3 space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "timeline" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Project Progress Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MasterMetricCard icon={<Activity size={24} />} label="ความคืบหน้าภาพรวม" value="75%" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<Clock size={24} />} label="วันคงเหลือ (Remaining)" value="12 วัน" color="text-nexus-blue" />
                <MasterMetricCard icon={<BarChart3 size={24} />} label="งานที่เสร็จแล้ว" value="18/24" color="text-white" />
              </div>

              {/* WBS / Task List */}
              <div className="space-y-6">
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black text-white/80 uppercase tracking-tight">แผนงานและสถานะรายหมวด (WBS)</h3>
                    <PillButton variant="glass" className="h-9 px-6 rounded-full">เพิ่มงานใหม่</PillButton>
                 </div>
                 
                 <div className="space-y-4">
                    <MilestoneCard 
                      title="Phase 1: การติดตั้งโครงสร้าง & Cabling" 
                      progress={100} 
                      status="เสร็จสมบูรณ์"
                      tasks={[
                        { name: "ประกอบโครงสร้างเหล็ก LED Wall", status: "done" },
                        { name: "เดินสายสัญญาณ Fiber & LAN", status: "done" },
                        { name: "ติดตั้งตู้ Rack & ระบบไฟ", status: "done" },
                      ]}
                    />
                    <MilestoneCard 
                      title="Phase 2: การติดตั้ง Cabinet & Configuration" 
                      progress={60} 
                      status="กำลังดำเนินการ"
                      tasks={[
                        { name: "ติดตั้ง Cabinet LED (Zone A-C)", status: "done" },
                        { name: "ติดตั้ง Cabinet LED (Zone D-F)", status: "pending" },
                        { name: "Config ระบบส่งภาพ (Processor)", status: "pending" },
                      ]}
                    />
                 </div>
              </div>
            </div>
          )}

          {activeTab === "resources" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
               {/* 📦 Section 1: Equipment & Materials List */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                     <h3 className="text-sm font-black text-white/80 uppercase tracking-tight flex items-center gap-2">
                        <Package size={16} className="text-nexus-blue animate-pulse" /> 1. รายการอุปกรณ์ & วัสดุโครงการ (Equipment & Materials)
                     </h3>
                     <PillButton className="h-9 px-6 rounded-full shadow-neon-teal">
                        เบิกพัสดุเพิ่ม 📦
                     </PillButton>
                  </div>
                  <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                     <NexusTable headers={["รหัส/รายการพัสดุอุปกรณ์", "SERIAL NUMBER", "จำนวนที่เบิก", "ผู้รับผิดชอบหน้างาน", "สถานะหน้างาน"]}>
                        <NexusTableRow className="hover:bg-white/[0.01] transition-colors">
                           <NexusTableCell className="w-[35%] min-w-[200px]">
                              <div className="space-y-1">
                                 <span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-[8px] font-mono font-black">EQ-LED-25I</span>
                                 <div className="text-xs font-black text-white whitespace-nowrap">LED Wall P2.5 Indoor Cabinet Panel</div>
                              </div>
                           </NexusTableCell>
                           <NexusTableCell className="font-mono text-nexus-blue text-xs">SN-LED-40212</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-white/80">24 Units</NexusTableCell>
                           <NexusTableCell className="text-xs font-bold text-white/70">Somchai R. (Field Engineer)</NexusTableCell>
                           <NexusTableCell><StatusBadge status="active" label="ติดตั้งแล้ว" /></NexusTableCell>
                        </NexusTableRow>

                        <NexusTableRow className="hover:bg-white/[0.01] transition-colors">
                           <NexusTableCell className="w-[35%] min-w-[200px]">
                              <div className="space-y-1">
                                 <span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-[8px] font-mono font-black">EQ-AP-505</span>
                                 <div className="text-xs font-black text-white whitespace-nowrap">Aruba AP-505 Enterprise Access Point</div>
                              </div>
                           </NexusTableCell>
                           <NexusTableCell className="font-mono text-nexus-blue text-xs">SN-ARU-0992</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-white/80">2 Units</NexusTableCell>
                           <NexusTableCell className="text-xs font-bold text-white/70">Somchai R. (Field Engineer)</NexusTableCell>
                           <NexusTableCell><StatusBadge status="pending" label="กำลังติดตั้ง" /></NexusTableCell>
                        </NexusTableRow>

                        <NexusTableRow className="hover:bg-white/[0.01] transition-colors">
                           <NexusTableCell className="w-[35%] min-w-[200px]">
                              <div className="space-y-1">
                                 <span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-[8px] font-mono font-black">UTP-CAT6-50</span>
                                 <div className="text-xs font-black text-white whitespace-nowrap">Link CAT6 UTP Cable Box (305m)</div>
                              </div>
                           </NexusTableCell>
                           <NexusTableCell className="font-mono text-white/20 text-xs italic">- (ไม่ระบุ S/N)</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-white/80">5 Boxes</NexusTableCell>
                           <NexusTableCell className="text-xs font-bold text-white/70">Chatchai S. (Lead Architect)</NexusTableCell>
                           <NexusTableCell><StatusBadge status="active" label="ส่งของแล้ว" /></NexusTableCell>
                        </NexusTableRow>
                     </NexusTable>
                  </div>
               </div>

               {/* 🛠️ Section 2: Labor & Installation Services List */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                     <h3 className="text-sm font-black text-white/80 uppercase tracking-tight flex items-center gap-2">
                        <Users size={16} className="text-nexus-teal animate-pulse" /> 2. รายการงานติดตั้ง & ค่าบริการปฏิบัติการ (Labor & Services)
                     </h3>
                     <PillButton variant="glass" className="h-9 px-6 rounded-full">
                        เพิ่มงานบริการ ⚡
                     </PillButton>
                  </div>
                  <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                     <NexusTable headers={["รายการงานติดตั้ง / บริการ", "รูปแบบ", "จำนวน/ปริมาณ", "ต้นทุนรวม", "ราคาเสนอขาย", "กำไรเบื้องต้น", "สถานะหน้างาน"]}>
                        <NexusTableRow className="hover:bg-white/[0.01] transition-colors">
                           <NexusTableCell className="w-[35%] min-w-[200px]">
                              <div className="space-y-1">
                                 <span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-[8px] font-mono font-black">PKG-LED-SETUP</span>
                                 <div className="text-xs font-black text-white whitespace-nowrap">ชุดประกอบและติดตั้งโครงสร้างเหล็กจอ LED Panel OM3</div>
                              </div>
                           </NexusTableCell>
                           <NexusTableCell className="text-xs font-bold text-white/50">Lump-sum (เหมาจ่าย)</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-white/80">1 งาน</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-danger">฿ 35,000</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-nexus-teal">฿ 55,000</NexusTableCell>
                           <NexusTableCell>
                              <span className="px-2 py-0.5 rounded bg-white/[0.04] text-[9px] font-mono font-black text-nexus-teal border border-white/5">
                                 ฿ 20,000 (36%)
                              </span>
                           </NexusTableCell>
                           <NexusTableCell><StatusBadge status="active" label="เสร็จสิ้น" /></NexusTableCell>
                        </NexusTableRow>

                        <NexusTableRow className="hover:bg-white/[0.01] transition-colors">
                           <NexusTableCell className="w-[35%] min-w-[200px]">
                              <div className="space-y-1">
                                 <span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-[8px] font-mono font-black">PKG-UTP-CAT6</span>
                                 <div className="text-xs font-black text-white whitespace-nowrap">ชุดงานเดินสายแลนพร้อมบล็อกเต้ารับ UTP CAT6 (40 จุด)</div>
                              </div>
                           </NexusTableCell>
                           <NexusTableCell className="text-xs font-bold text-nexus-teal">Per Point (คิดตามจุด)</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-white/80">40 จุด</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-danger">฿ 20,000</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-nexus-teal">฿ 30,000</NexusTableCell>
                           <NexusTableCell>
                              <span className="px-2 py-0.5 rounded bg-white/[0.04] text-[9px] font-mono font-black text-nexus-teal border border-white/5">
                                 ฿ 10,000 (33%)
                              </span>
                           </NexusTableCell>
                           <NexusTableCell><StatusBadge status="pending" label="กำลังดำเนินการ" /></NexusTableCell>
                        </NexusTableRow>
                     </NexusTable>
                  </div>
               </div>
            </div>
          )}

          {activeTab === "team" && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
               <div className="flex items-center justify-between px-4">
                  <h3 className="text-sm font-black text-white/80 uppercase tracking-tight">ทีมปฏิบัติการและอัตราค่าแรง</h3>
                  <PillButton className="h-9 px-6 rounded-full shadow-neon-teal">มอบหมายบุคลากร</PillButton>
               </div>
               <NexusTable headers={["วิศวกรผู้รับผิดชอบ", "บทบาท (ROLE)", "เวลาเข้างานสะสม", "อัตราค่าจ้างขั้นต้น"]}>
                  <NexusTableRow>
                     <NexusTableCell className="text-sm font-black text-white/80">Chatchai S.</NexusTableCell>
                     <NexusTableCell className="text-[11px] font-black text-nexus-teal uppercase">Lead Solutions Architect</NexusTableCell>
                     <NexusTableCell>48 Hours</NexusTableCell>
                     <NexusTableCell className="text-nexus-blue font-mono">฿ 1,500 / Hr</NexusTableCell>
                  </NexusTableRow>
                  <NexusTableRow>
                     <NexusTableCell className="text-sm font-black text-white/80">Somchai R.</NexusTableCell>
                     <NexusTableCell className="text-[11px] font-black text-white/60 uppercase">Field Systems Engineer</NexusTableCell>
                     <NexusTableCell>72 Hours</NexusTableCell>
                     <NexusTableCell className="text-nexus-blue font-mono">฿ 1,000 / Hr</NexusTableCell>
                  </NexusTableRow>
               </NexusTable>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
               <div className="flex items-center justify-between px-4">
                  <h3 className="text-sm font-black text-white/80 uppercase tracking-tight">บันทึกรายงานบริการหน้างาน</h3>
                  <PillButton className="h-9 px-6 rounded-full shadow-neon-teal">ออก Report ใหม่</PillButton>
               </div>
               <NexusTable headers={["เลขที่รายงาน (SR ID)", "รายละเอียดการปฏิบัติงาน", "วิศวกรผู้รับผิดชอบ", "วันส่งมอบงาน"]}>
                  <NexusTableRow>
                     <NexusTableCell className="font-mono text-nexus-teal">SR-2605-0091</NexusTableCell>
                     <NexusTableCell className="text-sm font-black text-white/80">ทำการต่อสายเชื่อมและ Calibrate หน้าจอ Cabinet</NexusTableCell>
                     <NexusTableCell>Somchai R.</NexusTableCell>
                     <NexusTableCell>18 พฤษภาคม 2026</NexusTableCell>
                  </NexusTableRow>
               </NexusTable>
            </div>
          )}

          {activeTab === "financials" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Cost tracking metric cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-[1.5rem] bg-white/[0.02] border border-white/5 space-y-2">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block">งบประมาณโครงการ (Baseline BOQ)</span>
                  <span className="text-xl font-black text-white font-mono block">฿2,500,000.00</span>
                </div>
                <div className="p-4 rounded-[1.5rem] bg-nexus-blue/5 border border-nexus-blue/15 space-y-2">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block">ต้นทุนผูกพันสัญญา (Committed Cost)</span>
                  <span className="text-xl font-black text-nexus-blue font-mono block">฿1,850,000.00</span>
                </div>
                <div className="p-4 rounded-[1.5rem] bg-nexus-teal/5 border border-nexus-teal/15 space-y-2">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block">ต้นทุนจริงที่เกิดขึ้น (Actual Cost)</span>
                  <span className="text-xl font-black text-nexus-teal font-mono block">฿1,680,000.00</span>
                </div>
                <div className="p-4 rounded-[1.5rem] bg-white/[0.04] border border-white/10 space-y-2">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block">งบประมาณคงเหลือ (Variance)</span>
                  <span className="text-xl font-black text-white/80 font-mono block">฿650,000.00</span>
                </div>
              </div>

              {/* Budget Alarm Neon indicator */}
              <div className="p-4 rounded-3xl bg-danger/10 border border-danger/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center text-danger shrink-0">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white uppercase tracking-tight">ระบบระวังภัยงบประมาณบานปลาย (Availability Budget Control)</h5>
                    <p className="text-[10px] text-white/60 mt-0.5">ยอดจองซื้อวัสดุและค่าจ้างรวมกันคิดเป็น 82.5% ของงบจัดซื้อโครงการ ระบบทำการล็อกการขอเบิกจ่ายพัสดุชั่วคราว</p>
                  </div>
                </div>
                <PillButton
                  variant="glass"
                  className="h-8 text-[10px] uppercase font-black tracking-widest border-danger/30 text-danger hover:bg-danger/20 hover:text-white"
                  onClick={() => showToast("ส่งคำขออนุมัติงบเพิ่มเติมไปยังระดับบริหารเรียบร้อยแล้ว")}
                >
                  <Sparkles size={12} /> ขออนุมัติงบวงเงินพิเศษ
                </PillButton>
              </div>

              {/* Versioned BOQ */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                  <div>
                    <h3 className="text-sm font-black text-white/80 uppercase tracking-tight">งบประมาณโครงการจัดทำและสั่งซื้อ (BOQ Ledger)</h3>
                    <p className="text-[9px] text-white/30 uppercase mt-0.5 tracking-wider font-black">Multi-version History Audit</p>
                  </div>

                  <div className="flex gap-2">
                    {["Rev 1", "Rev 2", "Rev 3"].map((rev) => (
                      <button
                        key={rev}
                        onClick={() => {
                          setSelectedBoqVersion(rev);
                          showToast(`สลับการเรียกแสดงข้อมูลใบ BOQ เป็น ${rev} สำเร็จ`);
                        }}
                        className={cn(
                          "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all",
                          selectedBoqVersion === rev 
                            ? "bg-nexus-teal border-nexus-teal text-black shadow-neon-teal" 
                            : "bg-white/5 border-white/5 text-white/40 hover:text-white"
                        )}
                      >
                        {rev} {rev === "Rev 3" && "(Current)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                  <NexusTable headers={["หมวดหมู่ค่าใช้จ่าย", "รายละเอียดสเปก BOQ", "จำนวน", "ทุนประมาณการ (WAC)", "ราคาเสนอขาย", "ประมาณการกำไร (GP)"]}>
                    <NexusTableRow>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-[8px] font-black font-mono">HARDWARE</span></NexusTableCell>
                      <NexusTableCell><div className="text-xs font-black text-white">Cabinet Panel LED P2.5 Indoor</div></NexusTableCell>
                      <NexusTableCell className="font-mono text-xs text-white/80">24 Units</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-xs text-white/60">฿45,000</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-teal font-mono text-xs">฿65,000</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-blue font-mono text-xs">฿480,000 (30.7%)</NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-[8px] font-black font-mono">MATERIALS</span></NexusTableCell>
                      <NexusTableCell><div className="text-xs font-black text-white">สายนำสัญญาณ UTP CAT6 (305m)</div></NexusTableCell>
                      <NexusTableCell className="font-mono text-xs text-white/80">5 Reels</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-xs text-white/60">฿3,800</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-teal font-mono text-xs">฿5,000</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-blue font-mono text-xs">฿6,000 (24.0%)</NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-[8px] font-black font-mono">SERVICES</span></NexusTableCell>
                      <NexusTableCell><div className="text-xs font-black text-white">งานติดตั้งโครงสร้าง Calibrate และรับประกัน</div></NexusTableCell>
                      <NexusTableCell className="font-mono text-xs text-white/80">1 Lot</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-xs text-white/60">฿35,000</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-teal font-mono text-xs">฿55,000</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-blue font-mono text-xs">฿20,000 (36.3%)</NexusTableCell>
                    </NexusTableRow>
                  </NexusTable>
                </div>
              </div>

              {/* Milestone-Based Billing & WBS */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                  <div>
                    <h3 className="text-sm font-black text-white/80 uppercase tracking-tight">ความคืบหน้าวางบิลและงวดงานราชการ (Milestone-Based Billing & WBS)</h3>
                    <p className="text-[9px] text-white/30 uppercase mt-0.5 tracking-wider font-black">Contract Revenue Recognition</p>
                  </div>
                </div>

                <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                  <NexusTable headers={["งวดงาน", "รายละเอียดเฟสโครงการ", "เปอร์เซ็นต์วางบิล", "มูลค่าเรียกเก็บ", "เอกสารวางบิล", "ปฏิบัติการ"]}>
                    {milestonesBilling.map((m, idx) => (
                      <NexusTableRow key={m.id}>
                        <NexusTableCell className="font-mono text-xs text-nexus-blue font-black">{m.id}</NexusTableCell>
                        <NexusTableCell className="text-xs font-black text-white">{m.name}</NexusTableCell>
                        <NexusTableCell className="font-mono text-xs text-white/85 text-center">{m.pct}%</NexusTableCell>
                        <NexusTableCell className="text-right font-mono text-xs text-white">฿{m.amount.toLocaleString()}</NexusTableCell>
                        <NexusTableCell>
                          {m.status === "invoiced" ? (
                            <span className="px-2 py-0.5 rounded bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/20 text-[9px] font-mono font-black">
                              {m.ref}
                            </span>
                          ) : (
                            <span className="text-[9px] text-white/20 italic">ยังไม่ได้วางบิล</span>
                          )}
                        </NexusTableCell>
                        <NexusTableCell>
                          {m.status === "invoiced" ? (
                            <StatusBadge status="active" label="เรียกเก็บเงินแล้ว" />
                          ) : (
                            <PillButton
                              className="h-7 px-3 text-[10px] shadow-neon-teal"
                              onClick={() => {
                                setMilestonesBilling(prev => prev.map(item => item.id === m.id ? { ...item, status: "invoiced", ref: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}` } : item));
                                showToast(`สร้างร่างใบแจ้งหนี้สำหรับ ${m.id} สำเร็จ!`);
                              }}
                            >
                              ออกใบแจ้งหนี้ 📄
                            </PillButton>
                          )}
                        </NexusTableCell>
                      </NexusTableRow>
                    ))}
                  </NexusTable>
                </div>
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              
              {/* AI TOR Spec Analyzer Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Drag & Drop Upload Zone */}
                <GlassCard className="p-6 border-white/5 space-y-4 bg-black/40 flex flex-col justify-between min-h-[280px]">
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-[8px] font-black tracking-widest uppercase">Gemini AI Parser</span>
                    <h4 className="text-sm font-black text-white uppercase">วิเคราะห์เอกสารสเปก TOR</h4>
                    <p className="text-[10px] text-white/50 leading-relaxed">
                      วางไฟล์เอกสาร TOR หรือสัญญาจัดซื้อจัดจ้างเพื่อให้อัลกอริทึม Gemini ตรวจจับและเปรียบเทียบความสอดคล้องกับคลังสินค้าบริษัทโดยอัตโนมัติ
                    </p>
                  </div>

                  <div 
                    onClick={() => {
                      setTorFile("TOR_eBidding_QSNCC_v2.pdf");
                      showToast("เลือกเอกสาร TOR_eBidding_QSNCC_v2.pdf แล้ว!");
                    }}
                    className={cn(
                      "p-8 rounded-2xl border border-dashed text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2",
                      torFile 
                        ? "border-nexus-teal bg-nexus-teal/[0.03] text-nexus-teal" 
                        : "border-white/10 hover:border-white/20 text-white/20 hover:text-white/40"
                    )}
                  >
                    <UploadCloud size={24} className={cn("animate-bounce", torFile ? "text-nexus-teal" : "text-white/20")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {torFile ? torFile : "คลิกเพื่ออัปโหลดไฟล์สเปก TOR"}
                    </span>
                    <span className="text-[8px] text-white/20">รองรับ PDF, DOCX สูงสุด 50MB</span>
                  </div>

                  <PillButton 
                    className="w-full h-9 shadow-neon-teal"
                    onClick={handleParseTOR}
                    disabled={isParsing}
                  >
                    {isParsing ? "กำลังวิเคราะห์..." : "วิเคราะห์สเปกด้วย Gemini AI ✨"}
                  </PillButton>
                </GlassCard>

                {/* Right Progress / Results Panel */}
                <div className="lg:col-span-2">
                  <GlassCard className="p-6 border-white/5 h-full flex flex-col justify-between min-h-[280px] bg-black/40">
                    {isParsing ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border-2 border-nexus-teal/10 border-t-2 border-t-nexus-teal animate-spin" />
                          <Sparkles className="absolute inset-0 m-auto text-nexus-teal animate-pulse" size={16} />
                        </div>
                        <span className="text-xs font-black text-nexus-teal uppercase tracking-widest text-center">{parseStep}</span>
                      </div>
                    ) : parsedResults ? (
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-white/30 uppercase tracking-widest block">ผลการวิเคราะห์ความสอดคล้อง (Spec Compliance Check)</span>
                          <span className="text-[9px] font-black text-nexus-teal uppercase tracking-widest flex items-center gap-1">
                            <ShieldCheck size={12} /> ข้อมูลสเปกผ่านเกณฑ์ 100%
                          </span>
                        </div>

                        <div className="max-h-56 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                          {parsedResults.map((r, ri) => (
                            <div key={ri} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 hover:bg-white/[0.04] transition-colors">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-xs font-black text-white/70 leading-snug">{r.spec}</span>
                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-nexus-teal border border-nexus-teal/20 font-black shrink-0">
                                  {r.match}
                                </span>
                              </div>
                              <div className="flex justify-between text-[9px] font-black uppercase text-white/30 tracking-wider">
                                <span>รุ่นที่เสนอแนะ: {r.model}</span>
                                <span>{r.remarks}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white/20 space-y-2">
                        <Sparkles size={32} className="opacity-40" />
                        <h5 className="text-xs font-black uppercase tracking-widest">ยังไม่มีการประมวลผลสเปก</h5>
                        <p className="text-[10px] leading-relaxed max-w-xs">กรุณาเลือกไฟล์สเปก TOR ด้านซ้ายมือ และคลิกเพื่อทำการประมวลผลสเปกอัจฉริยะแบบเปรียบเทียบในระบบ</p>
                      </div>
                    )}
                  </GlassCard>
                </div>
              </div>

              {/* Centralized Document Vault */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                  <div>
                    <h3 className="text-sm font-black text-white/80 uppercase tracking-tight">คลังสัญญาโครงการแยกบริษัท (Isolated Document Vault)</h3>
                    <p className="text-[9px] text-white/30 uppercase mt-0.5 tracking-wider font-black">Scoped with secure Tenant ID mapping</p>
                  </div>
                </div>

                <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                  <NexusTable headers={["ชื่อไฟล์สัญญา / สเปก", "ประเภทไฟล์", "สิทธิ์ผู้มีส่วนร่วม", "ผู้อัปโหลดรายการ", "วันอัปโหลด", "พารามิเตอร์รักษาความปลอดภัย"]}>
                    <NexusTableRow>
                      <NexusTableCell className="font-bold text-white text-xs">TOR_eBidding_QSNCC_v2.pdf</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-danger/10 text-danger text-[8px] font-black font-mono">PDF_SPEC</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/50">All Engineers</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/60">Chatchai S.</NexusTableCell>
                      <NexusTableCell className="text-xs font-mono text-white/40">12 พฤษภาคม 2026</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-[8px] font-black font-mono">Isolated: {params.id || 'PRJ26'}</span></NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                      <NexusTableCell className="font-bold text-white text-xs">Project_Budget_Estimate_Signed.xlsx</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-[8px] font-black font-mono">XLSX_BUDGET</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/50">Finance Only</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/60">Thanakorn P.</NexusTableCell>
                      <NexusTableCell className="text-xs font-mono text-white/40">14 พฤษภาคม 2026</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-[8px] font-black font-mono">Isolated: {params.id || 'PRJ26'}</span></NexusTableCell>
                    </NexusTableRow>
                  </NexusTable>
                </div>
              </div>

              {/* Deployed Serial Numbers & Gov Warranties */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                  <div>
                    <h3 className="text-sm font-black text-white/80 uppercase tracking-tight">ทะเบียนติดตั้ง Serial Number อุปกรณ์โครงการ (Serial Number Deployed Traceability)</h3>
                    <p className="text-[9px] text-white/30 uppercase mt-0.5 tracking-wider font-black">Traceability Ledger Integration</p>
                  </div>
                  <PillButton 
                    className="h-9 px-6 rounded-full shadow-neon-teal"
                    onClick={() => showToast("สร้างใบรับประกันสินค้าส่งราชการและส่งทางเมลเรียบร้อยแล้ว!")}
                  >
                    ออกใบส่งมอบและรับประกันราชการ 📄
                  </PillButton>
                </div>

                <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                  <NexusTable headers={["หมายเลขซีเรียล (S/N)", "ชื่ออุปกรณ์ / ทรัพยากร", "มาตรฐานสเปก", "สถานะการติดตั้ง", "ระยะรับประกัน", "สิทธิ์ Isolation"]}>
                    <NexusTableRow>
                      <NexusTableCell className="font-mono text-xs text-nexus-teal font-black">SN-LED-40212</NexusTableCell>
                      <NexusTableCell className="text-xs font-black text-white">LED Wall P2.5 Indoor Cabinet Panel</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/60">4MP / IP67 / Active</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/20 text-[9px] font-black">ติดตั้งเสร็จสมบูรณ์</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-mono text-white/40">3 ปี (ถึง 2029)</NexusTableCell>
                      <NexusTableCell className="text-xs text-white/40 font-mono">isolated_tenant</NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                      <NexusTableCell className="font-mono text-xs text-nexus-teal font-black">SN-ARU-0992</NexusTableCell>
                      <NexusTableCell className="text-xs font-black text-white">Aruba AP-505 Enterprise Access Point</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/60">WiFi-6 / Dual-Band</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/15 text-nexus-blue border border-nexus-blue/20 text-[9px] font-black">กำลังทดสอบสัญญาณ</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-mono text-white/40">5 ปี (ถึง 2031)</NexusTableCell>
                      <NexusTableCell className="text-xs text-white/40 font-mono">isolated_tenant</NexusTableCell>
                    </NexusTableRow>
                  </NexusTable>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tactical Info */}
        <div className="space-y-6">
           <GlassCard className="p-8 border-white/10 bg-nexus-blue/5">
              <h4 className="text-[11px] font-black text-nexus-blue uppercase tracking-widest mb-6">ที่ตั้งหน้างาน (SITE LOCATION)</h4>
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                       <MapPin size={24} />
                    </div>
                    <div>
                       <p className="text-sm font-black text-white">ศูนย์ประชุมแห่งชาติ</p>
                       <p className="text-[10px] font-black text-white/60 uppercase">อาคาร 1 ชั้น 2</p>
                    </div>
                 </div>
                 <PillButton variant="glass" className="w-full h-9 px-6 rounded-full">เปิด Google Maps</PillButton>
              </div>
           </GlassCard>

           <GlassCard className="p-8 border-white/10">
              <h4 className="text-[11px] font-black text-white/60 uppercase tracking-widest mb-6">งบประมาณโครงการ (Budget)</h4>
              <div className="space-y-4">
                 <NexusDataField label="ยอดงบประมาณ" value="฿2,500,000" />
                 <NexusDataField label="ต้นทุนพัสดุ" value="฿1,850,000" className="text-danger" />
                 <NexusDataField label="ค่าแรง & อื่นๆ" value="฿150,000" className="text-danger" />
                 <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black text-nexus-teal uppercase">กำไรเบื้องต้น</span>
                    <span className="text-lg font-black text-nexus-teal drop-shadow-neon">฿500,000</span>
                 </div>
              </div>
           </GlassCard>
        </div>
      </div>

      {/* QuotationModal popups for direct customization */}
      <QuotationModal 
        isOpen={isQuotationOpen}
        onClose={() => setIsQuotationOpen(false)}
        initialData={quotationInitialData}
        onSave={async (data) => {
          setIsQuotationOpen(false);
          showToast(`อนุมัติออกใบเสนอราคาเพิ่มเติมสำเร็จ: ${data.subject}`);
        }}
      />

      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />
    </div>
  );
}

function MilestoneCard({ title, progress, status, tasks }: { title: string, progress: number, status: string, tasks: { name: string, status: "done" | "pending" }[] }) {
  return (
    <GlassCard className="p-6 border-white/5 space-y-4 group hover:border-white/10 transition-all">
       <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className={cn("w-2 h-2 rounded-full shadow-neon", status === "เสร็จสมบูรณ์" ? "bg-nexus-teal shadow-neon-teal" : "bg-nexus-blue shadow-neon-blue")} />
             <h4 className="text-sm font-black text-white uppercase">{title}</h4>
          </div>
          <span className="text-[10px] font-black text-white/60 uppercase">{status} ({progress}%)</span>
       </div>
       <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div className={cn("h-full", status === "เสร็จสมบูรณ์" ? "bg-nexus-teal shadow-neon-teal" : "bg-nexus-blue shadow-neon-blue")} style={{ width: `${progress}%` }} />
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {tasks.map((task, i) => (
             <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                {task.status === "done" ? <CheckCircle2 size={14} className="text-nexus-teal" /> : <AlertCircle size={14} className="text-white/30" />}
                <span className={cn("text-xs font-bold", task.status === "done" ? "text-white/85" : "text-white/40")}>{task.name}</span>
             </div>
          ))}
       </div>
    </GlassCard>
  );
}
