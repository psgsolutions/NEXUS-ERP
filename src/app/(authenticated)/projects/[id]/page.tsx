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
, Plus, Trash2} from "lucide-react";
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
    { id: "timeline", label: "แผนงาน", icon: <Target size={14} /> },
    { id: "survey", label: "สำรวจหน้างาน", icon: <MapPin size={14} /> },
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
    setParseStep("กำลังเชื่อมต่อเซิร์ฟเวอร์ระบบรู้จำอักขระ...");
    
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-5">
          <PillBackButton onClick={() => router.back()} />
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight uppercase">โครงการติดตั้งระเบียงดิจิทัลอัจฉริยะ (BANGKOK DIGITAL PORT)</h1>
               <StatusBadge status="active" label="IN-PROGRESS" />
            </div>
            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-white/60">
              <span className="flex items-center gap-1.5"><Users size={14} className="text-nexus-teal" /> ผู้จัดการโครงการ: คุณวิรุฬห์ สุวรรณฉาย</span>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-nexus-blue" /> สถานที่หน้างาน: ท่าเรือกรุงเทพ คลองเตย</span>
            </div>
          </div>
        </div>
        
        {/* Header Action Buttons */}
        <div className="flex gap-3 items-center">
          <PillButton variant="glass" className="h-9 px-6 rounded-full border-danger/30 text-danger hover:bg-danger/10 hover:text-danger hover:border-danger flex items-center gap-2">
            <Trash2 size={16} />
            ลบข้อมูลโครงการ
          </PillButton>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-4">
        
        {/* Left Content Area */}
        <div className="flex-1 w-full space-y-10">
          
          <PillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "timeline" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              {/* Project Progress Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MasterMetricCard icon={<Activity size={24} />} label="ความคืบหน้าภาพรวม" value="75%" color="text-nexus-teal" neon="shadow-neon-teal" />
                <MasterMetricCard icon={<Clock size={24} />} label="วันคงเหลือ" value="12 วัน" color="text-nexus-blue" />
                <MasterMetricCard icon={<BarChart3 size={24} />} label="งานที่เสร็จแล้ว" value="18/24" color="text-white" />
              </div>

              {/* WBS / Task List */}
              <div className="space-y-3">
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight">แผนงานและสถานะรายหมวด</h3>
                    <PillButton variant="glass" className="h-9 px-6 rounded-full">เพิ่มงานใหม่</PillButton>
                 </div>
                 
                 <div className="space-y-3">
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
                        { name: "Config ระบบส่งภาพ", status: "pending" },
                      ]}
                    />
                 </div>
              </div>
            </div>
          )}

          {activeTab === "survey" && (
            <div className="space-y-3 animate-in slide-in-from-bottom duration-500">
              <div className="flex justify-between items-center px-4">
                <div>
                  <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight">แบบฟอร์มสำรวจหน้างานและร่างจัดเตรียมอุปกรณ์</h3>
                  <p className="text-xs text-white/30 uppercase mt-0.5 tracking-wider font-bold">Mobile-Friendly Interface สำหรับช่าง/เซลล์</p>
                </div>
                <PillButton className="h-9 px-6 rounded-full shadow-neon-teal" onClick={() => showToast("บันทึกรายการสำรวจลงระบบ และพร้อมดึงเข้า BOQ แล้ว!")}>
                  <UploadCloud size={16} />
                  บันทึกแบบสำรวจ
                </PillButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <GlassCard className="p-4 border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-nexus-teal uppercase">เพิ่มรายการเบื้องต้น</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/50 uppercase">ชื่ออุปกรณ์ / รายละเอียด</label>
                      <PillInput className="w-full" placeholder="เช่น กล้องวงจรปิด PTZ 4MP, สายไฟ..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white/50 uppercase">จำนวน</label>
                        <PillInput className="w-full text-center" type="number" placeholder="1" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-white/50 uppercase">หน่วย</label>
                        <PillInput className="w-full text-center" placeholder="ตัว, เมตร, จุด..." />
                      </div>
                    </div>
                    <PillButton variant="glass" className="w-full text-xs font-bold h-10 border-white/10 hover:border-nexus-blue hover:text-nexus-blue transition-colors">
                      <Plus size={16} /> หยิบใส่ตะกร้า Survey
                    </PillButton>
                  </div>
                </GlassCard>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white/70 uppercase px-2">รายการที่เลือกไว้</h4>
                  <div className="space-y-2">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex justify-between items-center group hover:bg-white/[0.04] transition-colors">
                      <div className="space-y-1">
                        <h5 className="text-sm font-bold text-white">กล้องวงจรปิด Bullet 4MP IP67</h5>
                        <p className="text-[10px] text-white/40">หมวดหมู่: Hardware (ประมาณการ)</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-nexus-blue font-bold bg-nexus-blue/10 px-3 py-1 rounded-lg">12 ตัว</span>
                        <button className="text-white/20 hover:text-danger"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex justify-between items-center group hover:bg-white/[0.04] transition-colors">
                      <div className="space-y-1">
                        <h5 className="text-sm font-bold text-white">สาย LAN CAT6 UTP (กล่อง)</h5>
                        <p className="text-[10px] text-white/40">หมวดหมู่: Materials (ประมาณการ)</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-nexus-blue font-bold bg-nexus-blue/10 px-3 py-1 rounded-lg">4 กล่อง</span>
                        <button className="text-white/20 hover:text-danger"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "resources" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
               {/* 📦 Section 1: Equipment & Materials List */}
               <div className="space-y-3">
                  <div className="flex items-center justify-between px-4">
                     <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight flex items-center gap-2">
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
                                 <span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-xs font-mono font-medium">EQ-LED-25I</span>
                                 <div className="text-xs font-bold text-white whitespace-nowrap">LED Wall P2.5 Indoor Cabinet Panel</div>
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
                                 <span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-xs font-mono font-medium">EQ-AP-505</span>
                                 <div className="text-xs font-bold text-white whitespace-nowrap">Aruba AP-505 Enterprise Access Point</div>
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
                                 <span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-xs font-mono font-medium">UTP-CAT6-50</span>
                                 <div className="text-xs font-bold text-white whitespace-nowrap">Link CAT6 UTP Cable Box (305m)</div>
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
               <div className="space-y-3">
                  <div className="flex items-center justify-between px-4">
                     <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight flex items-center gap-2">
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
                                 <span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-xs font-mono font-medium">PKG-LED-SETUP</span>
                                 <div className="text-xs font-bold text-white whitespace-nowrap">ชุดประกอบและติดตั้งโครงสร้างเหล็กจอ LED Panel OM3</div>
                              </div>
                           </NexusTableCell>
                           <NexusTableCell className="text-xs font-bold text-white/50">Lump-sum (เหมาจ่าย)</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-white/80">1 งาน</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-danger">฿ 35,000</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-nexus-teal">฿ 55,000</NexusTableCell>
                           <NexusTableCell>
                              <span className="px-2 py-0.5 rounded bg-white/[0.04] text-xs font-mono font-bold text-nexus-teal border border-white/5">
                                 ฿ 20,000 (36%)
                              </span>
                           </NexusTableCell>
                           <NexusTableCell><StatusBadge status="active" label="เสร็จสิ้น" /></NexusTableCell>
                        </NexusTableRow>

                        <NexusTableRow className="hover:bg-white/[0.01] transition-colors">
                           <NexusTableCell className="w-[35%] min-w-[200px]">
                              <div className="space-y-1">
                                 <span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-xs font-mono font-medium">PKG-UTP-CAT6</span>
                                 <div className="text-xs font-bold text-white whitespace-nowrap">ชุดงานเดินสายแลนพร้อมบล็อกเต้ารับ UTP CAT6 (40 จุด)</div>
                              </div>
                           </NexusTableCell>
                           <NexusTableCell className="text-xs font-bold text-nexus-teal">Per Point (คิดตามจุด)</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-white/80">40 จุด</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-danger">฿ 20,000</NexusTableCell>
                           <NexusTableCell className="font-mono text-xs text-nexus-teal">฿ 30,000</NexusTableCell>
                           <NexusTableCell>
                              <span className="px-2 py-0.5 rounded bg-white/[0.04] text-xs font-mono font-bold text-nexus-teal border border-white/5">
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
            <div className="space-y-3 animate-in slide-in-from-bottom duration-500">
               <div className="flex items-center justify-between px-4">
                  <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight">ทีมปฏิบัติการและอัตราค่าแรง</h3>
                  <PillButton className="h-9 px-6 rounded-full shadow-neon-teal">มอบหมายบุคลากร</PillButton>
               </div>
               <NexusTable headers={["วิศวกรผู้รับผิดชอบ", "บทบาท", "เวลาเข้างานสะสม", "อัตราค่าจ้างขั้นต้น"]}>
                  <NexusTableRow>
                     <NexusTableCell className="text-sm font-bold text-white/80">Chatchai S.</NexusTableCell>
                     <NexusTableCell className="text-sm font-medium text-nexus-teal uppercase">Lead Solutions Architect</NexusTableCell>
                     <NexusTableCell>48 Hours</NexusTableCell>
                     <NexusTableCell className="text-nexus-blue font-mono">฿ 1,500 / Hr</NexusTableCell>
                  </NexusTableRow>
                  <NexusTableRow>
                     <NexusTableCell className="text-sm font-bold text-white/80">Somchai R.</NexusTableCell>
                     <NexusTableCell className="text-sm font-medium text-white/60 uppercase">Field Systems Engineer</NexusTableCell>
                     <NexusTableCell>72 Hours</NexusTableCell>
                     <NexusTableCell className="text-nexus-blue font-mono">฿ 1,000 / Hr</NexusTableCell>
                  </NexusTableRow>
               </NexusTable>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-3 animate-in slide-in-from-bottom duration-500">
               <div className="flex items-center justify-between px-4">
                  <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight">บันทึกรายงานบริการหน้างาน</h3>
                  <PillButton className="h-9 px-6 rounded-full shadow-neon-teal">ออก Report ใหม่</PillButton>
               </div>
               <NexusTable headers={["เลขที่รายงาน", "รายละเอียดการปฏิบัติงาน", "วิศวกรผู้รับผิดชอบ", "วันส่งมอบงาน"]}>
                  <NexusTableRow>
                     <NexusTableCell className="font-mono text-nexus-teal">SR-2605-0091</NexusTableCell>
                     <NexusTableCell className="text-sm font-bold text-white/80">ทำการต่อสายเชื่อมและ Calibrate หน้าจอ Cabinet</NexusTableCell>
                     <NexusTableCell>Somchai R.</NexusTableCell>
                     <NexusTableCell>18 พฤษภาคม 2026</NexusTableCell>
                  </NexusTableRow>
               </NexusTable>
            </div>
          )}

          {activeTab === "financials" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              
              {/* Top 4 Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <MasterMetricCard icon={<Target size={24} />} label="งบประมาณโครงการ * (BUDGET)" value="1,200,000 ฿" color="text-white" />
                <MasterMetricCard icon={<Activity size={24} />} label="ต้นทุนใช้จ่ายจริง * (ACTUAL COST)" value="650,000 ฿" color="text-warning" neon="shadow-neon-amber" />
                <MasterMetricCard icon={<TrendingUp size={24} />} label="อัตราการรับงบประมาณ * (BURNRATE)" value="54.17 %" color="text-success" neon="shadow-neon-green" />
                <MasterMetricCard icon={<BarChart3 size={24} />} label="มูลค่างานระหว่างทำ * (WIPVALUE)" value="550,000 ฿" color="text-nexus-blue" neon="shadow-neon-blue" />
              </div>

              {/* BOQ Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight">เอกสารแนบใบวิเคราะห์บัญชีต้นทุน BOQ (BILL OF QUANTITIES)</h3>
                <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                  <NexusTable headers={["หมวดงาน", "รายละเอียดรายการ *", "ต้นทุนประมาณการ * (estimatedCost)", "ราคาขายเสนอโครงการ * (estimatedPrice)", "กำไรส่วนต่างชั้นต้น *"]}>
                    <NexusTableRow>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-xs font-medium font-mono">HARDWARE</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white">Nexus Core Server Engine V9</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-xs text-white">360,000 ฿</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-blue font-mono text-xs">450,000 ฿</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-teal font-mono text-xs">90,000 ฿</NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-xs font-medium font-mono">HARDWARE</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white">IoT Atmospheric Sensor Pro</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-xs text-white">135,000 ฿</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-blue font-mono text-xs">210,000 ฿</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-teal font-mono text-xs">75,000 ฿</NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-xs font-medium font-mono">SERVICES</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white">Integration & Commissioning Works</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-xs text-white">155,000 ฿</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-blue font-mono text-xs">200,000 ฿</NexusTableCell>
                      <NexusTableCell className="text-right text-nexus-teal font-mono text-xs">45,000 ฿</NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow className="bg-white/[0.02]">
                      <NexusTableCell colSpan={2} className="text-right text-sm font-medium text-white/60 uppercase">รวมฝั่งวิเคราะห์ BOQ สุทธิ</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-sm font-bold text-warning">650,000 ฿</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-sm font-bold text-nexus-blue">860,000 ฿</NexusTableCell>
                      <NexusTableCell className="text-right font-mono text-sm font-bold text-nexus-teal">210,000 ฿</NexusTableCell>
                    </NexusTableRow>
                  </NexusTable>
                </div>
              </div>

              {/* Milestones */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight">งวดสัญญาวางบิลและการเงิน (PROJECT MILESTONES)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <GlassCard className="p-4 border-white/5 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-nexus-blue uppercase">งวดงานที่ 1 (Weight: 15%)</h4>
                      <p className="text-sm font-bold text-white">อนุมัติแผนงานทางวิศวกรรม</p>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider">Engineering Blueprints Approval</p>
                    </div>
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-sm font-medium text-white/60 uppercase">มูลค่าสัญญาวางบิล: 15%</span>
                      <span className="px-2 py-0.5 rounded bg-success/15 text-success border border-success/30 text-xs font-medium uppercase tracking-widest">วางบิลแล้ว (BILLED)</span>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 border-white/5 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-nexus-blue uppercase">งวดงานที่ 2 (Weight: 35%)</h4>
                      <p className="text-sm font-bold text-white">จัดซื้ออะไหล่และอุปกรณ์หลัก</p>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider">Hardware Procurement</p>
                    </div>
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-sm font-medium text-white/60 uppercase">มูลค่าสัญญาวางบิล: 35%</span>
                      <span className="px-2 py-0.5 rounded bg-success/15 text-success border border-success/30 text-xs font-medium uppercase tracking-widest">วางบิลแล้ว (BILLED)</span>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 border-white/5 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-warning uppercase">งวดงานที่ 3 (Weight: 50%)</h4>
                      <p className="text-sm font-bold text-white">ทดสอบความเสถียรและปิดโครงการ</p>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider">SLA Delivery & Commissioning</p>
                    </div>
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-sm font-medium text-white/60 uppercase">มูลค่าสัญญาวางบิล: 50%</span>
                      <span className="px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 text-xs font-medium uppercase tracking-widest">ยังไม่วางบิล (UNBILLED)</span>
                    </div>
                  </GlassCard>
                </div>
              </div>

            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
              
              {/* AI TOR Spec Analyzer Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* Left Drag & Drop Upload Zone */}
                <GlassCard className="p-4 border-white/5 space-y-3 bg-black/40 flex flex-col justify-between min-h-[280px]">
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-[10px] font-medium tracking-widest uppercase">Gemini AI Parser</span>
                    <h4 className="text-sm font-bold text-white uppercase">วิเคราะห์เอกสารสเปก TOR</h4>
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
                    <span className="text-sm font-medium uppercase tracking-widest">
                      {torFile ? torFile : "คลิกเพื่ออัปโหลดไฟล์สเปก TOR"}
                    </span>
                    <span className="text-[10px] text-white/20">รองรับ PDF, DOCX สูงสุด 50MB</span>
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
                  <GlassCard className="p-4 border-white/5 h-full flex flex-col justify-between min-h-[280px] bg-black/40">
                    {isParsing ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-5 space-y-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border-2 border-nexus-teal/10 border-t-2 border-t-nexus-teal animate-spin" />
                          <Sparkles className="absolute inset-0 m-auto text-nexus-teal animate-pulse" size={16} />
                        </div>
                        <span className="text-xs font-bold text-nexus-teal uppercase tracking-widest text-center">{parseStep}</span>
                      </div>
                    ) : parsedResults ? (
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white/30 uppercase tracking-widest block">ผลการวิเคราะห์ความสอดคล้อง</span>
                          <span className="text-xs font-medium text-nexus-teal uppercase tracking-widest flex items-center gap-1">
                            <ShieldCheck size={12} /> ข้อมูลสเปกผ่านเกณฑ์ 100%
                          </span>
                        </div>

                        <div className="max-h-56 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                          {parsedResults.map((r, ri) => (
                            <div key={ri} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 hover:bg-white/[0.04] transition-colors">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-xs font-bold text-white/70 leading-snug">{r.spec}</span>
                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-xs text-nexus-teal border border-nexus-teal/20 font-bold shrink-0">
                                  {r.match}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs font-medium uppercase text-white/30 tracking-wider">
                                <span>รุ่นที่เสนอแนะ: {r.model}</span>
                                <span>{r.remarks}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-5 text-center text-white/20 space-y-2">
                        <Sparkles size={32} className="opacity-40" />
                        <h5 className="text-xs font-bold uppercase tracking-widest">ยังไม่มีการประมวลผลสเปก</h5>
                        <p className="text-[10px] leading-relaxed max-w-xs">กรุณาเลือกไฟล์สเปก TOR ด้านซ้ายมือ และคลิกเพื่อทำการประมวลผลสเปกอัจฉริยะแบบเปรียบเทียบในระบบ</p>
                      </div>
                    )}
                  </GlassCard>
                </div>
              </div>

              {/* Centralized Document Vault */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-4">
                  <div>
                    <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight">คลังสัญญาโครงการแยกบริษัท</h3>
                    <p className="text-xs text-white/30 uppercase mt-0.5 tracking-wider font-bold">Scoped with secure Tenant ID mapping</p>
                  </div>
                </div>

                <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                  <NexusTable headers={["ชื่อไฟล์สัญญา / สเปก", "ประเภทไฟล์", "สิทธิ์ผู้มีส่วนร่วม", "ผู้อัปโหลดรายการ", "วันอัปโหลด", "พารามิเตอร์รักษาความปลอดภัย"]}>
                    <NexusTableRow>
                      <NexusTableCell className="font-bold text-white text-xs">TOR_eBidding_QSNCC_v2.pdf</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-danger/10 text-danger text-[10px] font-medium font-mono">PDF_SPEC</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/50">All Engineers</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/60">Chatchai S.</NexusTableCell>
                      <NexusTableCell className="text-xs font-mono text-white/40">12 พฤษภาคม 2026</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-[10px] font-medium font-mono">Isolated: {params.id || 'PRJ26'}</span></NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                      <NexusTableCell className="font-bold text-white text-xs">Project_Budget_Estimate_Signed.xlsx</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/10 text-nexus-blue text-[10px] font-medium font-mono">XLSX_BUDGET</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/50">Finance Only</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/60">Thanakorn P.</NexusTableCell>
                      <NexusTableCell className="text-xs font-mono text-white/40">14 พฤษภาคม 2026</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal text-[10px] font-medium font-mono">Isolated: {params.id || 'PRJ26'}</span></NexusTableCell>
                    </NexusTableRow>
                  </NexusTable>
                </div>
              </div>

              {/* Deployed Serial Numbers & Gov Warranties */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-4">
                  <div>
                    <h3 className="text-sm font-bold text-white/80 uppercase tracking-tight">ทะเบียนติดตั้ง Serial Number อุปกรณ์โครงการ</h3>
                    <p className="text-xs text-white/30 uppercase mt-0.5 tracking-wider font-bold">Traceability Ledger Integration</p>
                  </div>
                  <PillButton 
                    className="h-9 px-6 rounded-full shadow-neon-teal"
                    onClick={() => showToast("สร้างใบรับประกันสินค้าส่งราชการและส่งทางเมลเรียบร้อยแล้ว!")}
                  >
                    ออกใบส่งมอบและรับประกันราชการ 📄
                  </PillButton>
                </div>

                <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-white/[0.01] shadow-2xl">
                  <NexusTable headers={["หมายเลขซีเรียล", "ชื่ออุปกรณ์ / ทรัพยากร", "มาตรฐานสเปก", "สถานะการติดตั้ง", "ระยะรับประกัน", "สิทธิ์ Isolation"]}>
                    <NexusTableRow>
                      <NexusTableCell className="font-mono text-xs text-nexus-teal font-bold">SN-LED-40212</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white">LED Wall P2.5 Indoor Cabinet Panel</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/60">4MP / IP67 / Active</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/20 text-xs font-medium">ติดตั้งเสร็จสมบูรณ์</span></NexusTableCell>
                      <NexusTableCell className="text-xs font-mono text-white/40">3 ปี (ถึง 2029)</NexusTableCell>
                      <NexusTableCell className="text-xs text-white/40 font-mono">isolated_tenant</NexusTableCell>
                    </NexusTableRow>
                    <NexusTableRow>
                      <NexusTableCell className="font-mono text-xs text-nexus-teal font-bold">SN-ARU-0992</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white">Aruba AP-505 Enterprise Access Point</NexusTableCell>
                      <NexusTableCell className="text-xs font-bold text-white/60">WiFi-6 / Dual-Band</NexusTableCell>
                      <NexusTableCell><span className="px-2 py-0.5 rounded bg-nexus-blue/15 text-nexus-blue border border-nexus-blue/20 text-xs font-medium">กำลังทดสอบสัญญาณ</span></NexusTableCell>
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
        <div className="space-y-3">
           <GlassCard className="p-4 border-white/10 bg-nexus-blue/5">
              <h4 className="text-sm font-medium text-nexus-blue uppercase tracking-widest mb-6">ที่ตั้งหน้างาน</h4>
              <div className="space-y-3">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                       <MapPin size={24} />
                    </div>
                    <div>
                       <p className="text-sm font-bold text-white">ศูนย์ประชุมแห่งชาติ</p>
                       <p className="text-sm font-medium text-white/60 uppercase">อาคาร 1 ชั้น 2</p>
                    </div>
                 </div>
                 <PillButton variant="glass" className="w-full h-9 px-6 rounded-full">เปิด Google Maps</PillButton>
              </div>
           </GlassCard>

           <GlassCard className="p-4 border-white/10">
              <h4 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-6">งบประมาณโครงการ</h4>
              <div className="space-y-3">
                 <NexusDataField label="ยอดงบประมาณ" value="฿2,500,000" />
                 <NexusDataField label="ต้นทุนพัสดุ" value="฿1,850,000" className="text-danger" />
                 <NexusDataField label="ค่าแรง & อื่นๆ" value="฿150,000" className="text-danger" />
                 <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-sm font-medium text-nexus-teal uppercase">กำไรเบื้องต้น</span>
                    <span className="text-lg font-bold text-nexus-teal drop-shadow-neon">฿500,000</span>
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
    <GlassCard className="p-4 border-white/5 space-y-3 group hover:border-white/10 transition-all">
       <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className={cn("w-2 h-2 rounded-full shadow-neon", status === "เสร็จสมบูรณ์" ? "bg-nexus-teal shadow-neon-teal" : "bg-nexus-blue shadow-neon-blue")} />
             <h4 className="text-sm font-bold text-white uppercase">{title}</h4>
          </div>
          <span className="text-sm font-medium text-white/60 uppercase">{status} ({progress}%)</span>
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
