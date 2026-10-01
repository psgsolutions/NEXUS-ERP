// @ts-nocheck
"use client";

import React, { useState } from "react";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Maximize2, 
  Grid, 
  Type, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  FileText,
  Palette,
  Eye,
  Sliders,
  Settings,
  HelpCircle,
  Database,
  Columns,
  Sparkles,
  Link as LinkIcon
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  PillSelect, 
  PillCheckbox, 
  GlassCard,
  Toast,
  cn
} from "@/components/ui/Base";
import Link from "next/link";

interface TextBlock {
  id: string;
  type: "text" | "heading" | "divider" | "spacer" | "table";
  content: string;
  alignment: "left" | "center" | "right";
  fontSize: "sm" | "base" | "lg" | "xl" | "2xl";
  paddingTop: number;
  paddingBottom: number;
  width?: "8.33%" | "16.66%" | "25%" | "33.33%" | "41.66%" | "50%" | "58.33%" | "66.66%" | "75%" | "83.33%" | "91.66%" | "100%"; // 12-column sub-grid system
  marginLeft?: number; // Shifter Left
  marginRight?: number; // Shifter Right
  textColor?: string; // HEX or Theme
  borderColor?: string; // Border HEX
  borderStyle?: "none" | "solid" | "dashed" | "double";
  borderWidth?: number;
  tableBgColor?: string; // Header background color
  tableHeaderTextColor?: string; // Header text color
  tableRowStripedColor?: string; // Alternating zebra stripes
  showGridLines?: boolean;
  showOuterBorder?: boolean;
  tableCols?: string;
  blockBgColor?: string; // Custom background highlight
}

export default function DocumentFormBuilderPage() {
  const [docTitle, setDocTitle] = useState("ใบเสนอราคาต้นแบบ");
  const [themeColor, setThemeColor] = useState("cyan");
  const [fontFamily, setFontFamily] = useState("Sarabun");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  
  // High-fidelity A4 canvas blocks
  const [blocks, setBlocks] = useState<TextBlock[]>([
    { id: "b1", type: "heading", content: "PSG SOLUTIONS CO., LTD.", alignment: "left", fontSize: "2xl", paddingTop: 12, paddingBottom: 4, width: "100%", textColor: "theme" },
    { id: "b2", type: "text", content: "1/1 Vibhavadi Rangsit Rd, Chatuchak, Bangkok 10900 | TAX: 0105564000000", alignment: "left", fontSize: "sm", paddingTop: 0, paddingBottom: 16, width: "100%", textColor: "slate" },
    { id: "b3", type: "divider", content: "", alignment: "center", fontSize: "base", paddingTop: 4, paddingBottom: 16, borderStyle: "double", borderColor: "theme", borderWidth: 3, width: "100%" },
    { id: "b4", type: "heading", content: "ใบเสนอราคา / QUOTATION", alignment: "center", fontSize: "xl", paddingTop: 12, paddingBottom: 12, width: "100%", textColor: "theme" },
    
    // Sub-grid side-by-side blocks
    { id: "b5_1", type: "text", content: "ลูกค้าผู้ติดต่อ: {{customer.name}}", alignment: "left", fontSize: "base", paddingTop: 8, paddingBottom: 12, width: "50%", textColor: "dark", marginRight: 8 },
    { id: "b5_2", type: "text", content: "เลขที่เอกสาร: {{doc.id}}", alignment: "left", fontSize: "base", paddingTop: 8, paddingBottom: 12, width: "50%", textColor: "dark", marginLeft: 8 },
    
    { id: "b6", type: "table", content: "รายการสินค้าและบริการ", alignment: "left", fontSize: "base", paddingTop: 16, paddingBottom: 24, tableCols: "ลำดับ:10%, รายละเอียด:50%, จำนวน:15%, รวม:25%", borderStyle: "solid", borderColor: "standard", borderWidth: 1, showGridLines: true, showOuterBorder: true, width: "100%", tableBgColor: "light", tableHeaderTextColor: "white" },
    { id: "b7", type: "divider", content: "", alignment: "center", fontSize: "base", paddingTop: 16, paddingBottom: 16, borderStyle: "dashed", borderColor: "standard", borderWidth: 1, width: "100%" },
    { id: "b8", type: "text", content: "เงื่อนไขการรับประกันคุณภาพ: {{warranty.info}}", alignment: "left", fontSize: "sm", paddingTop: 8, paddingBottom: 8, width: "100%", textColor: "slate" }
  ]);

  const [toast, setToast] = useState({ message: "", isVisible: false, type: "success" as "success" | "error" });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, isVisible: true, type });
  };

  const activeBlock = blocks.find(b => b.id === selectedBlockId);

  const updateBlock = (id: string, updates: Partial<TextBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const addBlock = (type: "text" | "heading" | "divider" | "spacer" | "table") => {
    const newBlock: TextBlock = {
      id: `block_${Date.now()}`,
      type,
      content: type === "divider" ? "" : type === "spacer" ? "" : type === "table" ? "ตารางรายการสินค้า" : "พิมพ์ชุดข้อความใหม่...",
      alignment: "left",
      fontSize: type === "heading" ? "xl" : "base",
      paddingTop: 12,
      paddingBottom: 12,
      width: "100%",
      marginLeft: 0,
      marginRight: 0,
      textColor: "dark",
      borderStyle: type === "divider" || type === "table" ? "solid" : undefined,
      borderColor: type === "divider" || type === "table" ? "standard" : undefined,
      borderWidth: type === "divider" || type === "table" ? 1 : undefined,
      showGridLines: type === "table" ? true : undefined,
      showOuterBorder: type === "table" ? true : undefined,
      tableCols: type === "table" ? "รายการ:50%, จำนวน:20%, รวม:30%" : undefined,
      tableBgColor: type === "table" ? "light" : undefined,
      tableHeaderTextColor: type === "table" ? "white" : undefined
    };
    setBlocks([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    showToast("เพิ่มชุดองค์กรใหม่บนกระดาษสำเร็จ");
  };

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
    showToast("ลบส่วนประกอบสำเร็จ");
  };

  const insertVariable = (variable: string) => {
    if (!selectedBlockId || !activeBlock || activeBlock.type === "divider" || activeBlock.type === "spacer") {
      showToast("กรุณาเลือกบล็อกข้อความก่อนแทรกตัวแปร", "error");
      return;
    }
    const updatedContent = activeBlock.content + " " + variable;
    updateBlock(selectedBlockId, { content: updatedContent });
    showToast(`แทรกตัวแปร ${variable} เรียบร้อย`);
  };

  // Helper colors resolver
  const getResolvedColor = (colorStr?: string) => {
    const val = colorStr || "dark";
    if (val === "dark") return "#111827";
    if (val === "slate") return "#4B5563";
    if (val === "blue") return "#1E40AF";
    if (val === "danger") return "#C2410C";
    if (val === "theme") {
      return themeColor === "blue" ? "#0066FF" :
             themeColor === "emerald" ? "#10B981" :
             themeColor === "amber" ? "#F59E0B" :
             themeColor === "purple" ? "#8B5CF6" :
             themeColor === "rose" ? "#EF4444" : "#00FFD1";
    }
    return val; // HEX
  };

  const getResolvedBorderColor = (colorStr?: string) => {
    const val = colorStr || "standard";
    if (val === "standard") return "#E5E7EB";
    if (val === "dark") return "#4B5563";
    if (val === "blue") return "#2563EB";
    if (val === "rose") return "#EF4444";
    if (val === "theme") {
      return themeColor === "blue" ? "#0066FF" :
             themeColor === "emerald" ? "#10B981" :
             themeColor === "amber" ? "#F59E0B" :
             themeColor === "purple" ? "#8B5CF6" :
             themeColor === "rose" ? "#EF4444" : "#00FFD1";
    }
    return val; // HEX
  };

  const getResolvedTableHeaderBg = (colorStr?: string) => {
    const val = colorStr || "light";
    if (val === "light") return "#F3F4F6";
    if (val === "muted") return "#E5E7EB";
    if (val === "white") return "#FFFFFF";
    if (val === "theme") {
      return themeColor === "blue" ? "#0066FF" :
             themeColor === "emerald" ? "#10B981" :
             themeColor === "amber" ? "#F59E0B" :
             themeColor === "purple" ? "#8B5CF6" :
             themeColor === "rose" ? "#EF4444" : "#00FFD1";
    }
    return val; // HEX
  };

  const getResolvedTableHeaderText = (colorStr?: string) => {
    const val = colorStr || "white";
    if (val === "white") return "#FFFFFF";
    if (val === "dark") return "#111827";
    if (val === "theme") {
      return themeColor === "blue" ? "#0066FF" :
             themeColor === "emerald" ? "#10B981" :
             themeColor === "amber" ? "#F59E0B" :
             themeColor === "purple" ? "#8B5CF6" :
             themeColor === "rose" ? "#EF4444" : "#00FFD1";
    }
    return val; // HEX
  };

  const getResolvedRowStripedColor = (colorStr?: string) => {
    const val = colorStr || "lightgray";
    if (val === "transparent") return "transparent";
    if (val === "lightgray") return "#F9FAFB";
    if (val === "theme-tint") {
      return themeColor === "blue" ? "#F0F6FF" :
             themeColor === "emerald" ? "#ECFDF5" :
             themeColor === "amber" ? "#FEF3C7" :
             themeColor === "purple" ? "#F5F3FF" :
             themeColor === "rose" ? "#FFF1F2" : "#E6FFFA";
    }
    return val; // HEX
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-0">
      
      {/* 1. TYPOGRAPHY & DATA BINDING TOOLBAR */}
      <header className="h-20 bg-surface-1 border-b border-white/5 px-8 flex items-center justify-between shrink-0 gap-5 z-20">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <PillButton variant="glass" className="h-9 w-9 p-0 rounded-full flex items-center justify-center">
              <ArrowLeft size={16} />
            </PillButton>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-nexus-teal/10 border border-nexus-teal/20 text-[10px] text-nexus-teal font-normal uppercase tracking-widest leading-none">
                Master Document Architect V3.9
              </span>
            </div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider mt-1.5 leading-none">Document Form Builder</h1>
          </div>
        </div>

        {/* Toolbar Settings */}
        <div className="flex items-center gap-4 flex-1 justify-center max-w-4xl bg-black/30 p-2 rounded-full border border-white/5">
          <div className="flex items-center gap-1.5 border-r border-white/5 pr-4 shrink-0">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest mr-2">ฟอนต์ดีไซน์</span>
            <PillSelect 
              value={fontFamily} 
              onChange={(e) => setFontFamily(e.target.value)} 
              className="h-9 px-6 rounded-full text-xs text-white"
            >
              <option value="Sarabun">Sarabun TH (มาตรฐาน)</option>
              <option value="Prompt">Prompt (โมเดิร์น)</option>
              <option value="Inter">Inter (สากล)</option>
            </PillSelect>
          </div>

          <div className="flex items-center gap-1.5 border-r border-white/5 pr-4 shrink-0">
            <button 
              disabled={!selectedBlockId}
              onClick={() => activeBlock && updateBlock(selectedBlockId, { alignment: "left" })}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-all", activeBlock?.alignment === "left" && "bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20")}
            >
              <AlignLeft size={14} />
            </button>
            <button 
              disabled={!selectedBlockId}
              onClick={() => activeBlock && updateBlock(selectedBlockId, { alignment: "center" })}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-all", activeBlock?.alignment === "center" && "bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20")}
            >
              <AlignCenter size={14} />
            </button>
            <button 
              disabled={!selectedBlockId}
              onClick={() => activeBlock && updateBlock(selectedBlockId, { alignment: "right" })}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-all", activeBlock?.alignment === "right" && "bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20")}
            >
              <AlignRight size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Database size={13} className="text-nexus-teal" />
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest mr-1">ผูกตัวแปรระบบ</span>
            <PillSelect 
              value="" 
              onChange={(e) => {
                if (e.target.value) {
                  insertVariable(e.target.value);
                  e.target.value = ""; // Reset
                }
              }} 
              className="h-9 px-6 rounded-full text-sm text-nexus-teal font-medium"
            >
              <option value="">เลือกตัวแปรระบบ...</option>
              <option value="{{customer.name}}">ชื่อลูกค้า</option>
              <option value="{{customer.tax_id}}">เลขผู้เสียภาษี (customer.tax_id)</option>
              <option value="{{doc.id}}">รหัสเอกสาร</option>
              <option value="{{doc.date}}">วันที่ออก</option>
              <option value="{{product.name}}">รายละเอียดของตาราง</option>
              <option value="{{grand.total}}">ยอดเงินสุทธิ</option>
              <option value="{{warranty.info}}">ข้อมูลรับประกัน</option>
            </PillSelect>
          </div>
        </div>

        {/* Save Doc */}
        <div className="flex items-center gap-3 shrink-0">
          <PillButton 
            onClick={() => showToast("บันทึกสถาปัตยกรรมและแม่แบบเลย์เอาต์เสร็จสมบูรณ์")}
            className="h-9 px-6 rounded-full shadow-neon-teal text-black"
          >
            <Save size={16} /> บันทึกสถาปัตยกรรมฟอร์ม
          </PillButton>
        </div>
      </header>

      {/* 2. DUAL-VIEWPORT WORKSPACE */}
      <div className="flex-1 flex overflow-hidden divide-x divide-white/5">
        
        {/* Left Side: Element Adder panel */}
        <div className="w-80 bg-surface-1 p-5 flex flex-col shrink-0 overflow-y-auto custom-scrollbar space-y-3">
          <div className="space-y-1">
            <span className="text-[10px] text-white/20 font-normal tracking-widest uppercase">Toolbox</span>
            <h3 className="text-sm font-medium text-white uppercase tracking-wider flex items-center gap-2">
              <Plus size={14} className="text-nexus-teal" /> เพิ่มองค์ประกอบเอกสาร
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <button 
              onClick={() => addBlock("heading")}
              className="h-10 w-full rounded-full border border-white/5 bg-white/[0.02] text-left px-5 text-[12px] font-medium uppercase text-white hover:border-nexus-teal/30 hover:bg-nexus-teal/5 transition-all flex items-center justify-between"
            >
              <span>[ H ] ส่วนหัวข้อเรื่อง</span>
              <Type size={12} className="text-white/30" />
            </button>
            <button 
              onClick={() => addBlock("text")}
              className="h-10 w-full rounded-full border border-white/5 bg-white/[0.02] text-left px-5 text-[12px] font-medium uppercase text-white hover:border-nexus-teal/30 hover:bg-nexus-teal/5 transition-all flex items-center justify-between"
            >
              <span>[ T ] ข้อความอิสระ</span>
              <FileText size={12} className="text-white/30" />
            </button>
            <button 
              onClick={() => addBlock("table")}
              className="h-10 w-full rounded-full border border-white/5 bg-white/[0.02] text-left px-5 text-[12px] font-medium uppercase text-white hover:border-nexus-teal/30 hover:bg-nexus-teal/5 transition-all flex items-center justify-between"
            >
              <span>[ ▦ ] ตารางข้อมูลตาราง</span>
              <Columns size={12} className="text-white/30" />
            </button>
            <button 
              onClick={() => addBlock("divider")}
              className="h-10 w-full rounded-full border border-white/5 bg-white/[0.02] text-left px-5 text-[12px] font-medium uppercase text-white hover:border-nexus-teal/30 hover:bg-nexus-teal/5 transition-all flex items-center justify-between"
            >
              <span>[ ─ ] เส้นคั่นหน้า</span>
              <Palette size={12} className="text-white/30" />
            </button>
            <button 
              onClick={() => addBlock("spacer")}
              className="h-10 w-full rounded-full border border-white/5 bg-white/[0.02] text-left px-5 text-[12px] font-medium uppercase text-white hover:border-nexus-teal/30 hover:bg-nexus-teal/5 transition-all flex items-center justify-between"
            >
              <span>[ ⬜ ] กล่องเว้นระยะ</span>
              <Sliders size={12} className="text-white/30" />
            </button>
          </div>

          <div className="pt-6 border-t border-white/5 space-y-3">
             <div className="space-y-1">
               <span className="text-[10px] text-white/20 font-normal tracking-widest uppercase">Global Styling</span>
               <h3 className="text-sm font-medium text-white uppercase tracking-wider">สไตล์เลย์เอาต์หน้า</h3>
             </div>
             
             <div className="space-y-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
               <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-widest">ธีมสีคุมโทน</label>
                  <PillSelect value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-full h-9 px-6 rounded-full text-white text-xs">
                     <option value="cyan">Cyan (สีฟ้านีออน)</option>
                     <option value="blue">Blue (น้ำเงินคอสมิก)</option>
                     <option value="emerald">Emerald (เขียวมรกต)</option>
                     <option value="amber">Amber (ส้มอำพัน)</option>
                     <option value="purple">Purple (ม่วงอวกาศ)</option>
                     <option value="rose">Rose (แดงโรส)</option>
                  </PillSelect>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-widest">ชื่อแม่แบบฟอร์ม</label>
                  <PillInput value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="w-full h-9 px-6 rounded-full text-white text-xs" />
               </div>
             </div>
          </div>
        </div>

        {/* 2. DOCUMENT CANVAS */}
        <div className="flex-1 bg-surface-1 p-10 overflow-y-auto custom-scrollbar flex items-start justify-center">
          <div 
            style={{ 
              fontFamily: fontFamily === "Sarabun" ? "Sarabun, sans-serif" : fontFamily === "Prompt" ? "Prompt, sans-serif" : "Inter, sans-serif" 
            }}
            className="w-[800px] bg-white text-black min-h-[1050px] shadow-2xl p-16 flex flex-col relative transition-all duration-500 box-border"
          >
            {/* Visual Guidelines */}
            <div className="absolute top-4 left-4 text-xs font-mono text-gray-300 font-bold uppercase select-none pointer-events-none">
              A4 Design Sheet Guidelines
            </div>

            <div className="w-full flex flex-wrap gap-y-1.5 items-start">
              {blocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                
                const ptVal = `${block.paddingTop}px`;
                const pbVal = `${block.paddingBottom}px`;
                const alignment = block.alignment || "left";

                const mlVal = block.marginLeft ? `${block.marginLeft}px` : "0px";
                const mrVal = block.marginRight ? `${block.marginRight}px` : "0px";

                const sizeClass = 
                  block.fontSize === "sm" ? "text-[13px]" :
                  block.fontSize === "lg" ? "text-lg" :
                  block.fontSize === "xl" ? "text-xl font-bold" :
                  block.fontSize === "2xl" ? "text-2xl font-medium" : "text-sm font-medium";

                let resolvedContent = block.content;
                resolvedContent = resolvedContent.replace("{{customer.name}}", "โรงพยาบาลตากสิน");
                resolvedContent = resolvedContent.replace("{{doc.id}}", "QT-2605-0042");
                resolvedContent = resolvedContent.replace("{{warranty.info}}", "รับประกันอุปกรณ์ระบบโครงสร้างเครือข่าย 1 ปีเต็ม");

                return (
                  <div 
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    style={{ 
                      paddingTop: ptVal, 
                      paddingBottom: pbVal,
                      paddingLeft: mlVal,
                      paddingRight: mrVal,
                      textAlign: alignment as any,
                      width: block.width || "100%",
                      backgroundColor: block.blockBgColor || "transparent"
                    }}
                    className={cn(
                      "relative rounded group transition-all duration-300 cursor-pointer min-h-[24px] px-2 flex-shrink-0 box-border",
                      isSelected ? "ring-2 ring-nexus-teal ring-offset-2 bg-gray-50/50" : "hover:bg-gray-50/30"
                    )}
                  >
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-nexus-teal opacity-0 group-hover:opacity-100 transition-opacity" />

                    {block.type === "divider" ? (
                      <div className="py-2 w-full">
                        <hr 
                          style={{ 
                            borderTopStyle: block.borderStyle === "none" ? "none" : (block.borderStyle || "solid"), 
                            borderTopWidth: `${block.borderWidth || 1}px`,
                            borderColor: getResolvedBorderColor(block.borderColor)
                          }}
                          className="border-b-0 border-x-0" 
                        />
                      </div>
                    ) : block.type === "spacer" ? (
                      <div className="w-full bg-gray-100/50 border border-dashed border-gray-200 rounded flex items-center justify-center py-2 text-[10px] font-mono text-gray-400 select-none">
                        [ SPACER {block.paddingTop + block.paddingBottom} ]
                      </div>
                    ) : block.type === "table" ? (
                      <div 
                        style={{
                          borderStyle: block.showOuterBorder ? (block.borderStyle || "solid") : "none",
                          borderWidth: block.showOuterBorder ? `${block.borderWidth || 1}px` : "0px",
                          borderColor: getResolvedBorderColor(block.borderColor)
                        }}
                        className="w-full rounded-xl overflow-hidden text-left mt-2 border"
                      >
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr 
                              style={{
                                borderBottomColor: block.showGridLines ? getResolvedBorderColor(block.borderColor) : "transparent",
                                backgroundColor: getResolvedTableHeaderBg(block.tableBgColor)
                              }}
                              className="border-b text-white"
                            >
                              {block.tableCols?.split(",").map((c, i) => (
                                <th 
                                  key={i} 
                                  className="p-3 text-[10px] font-normal uppercase tracking-widest" 
                                  style={{ 
                                    width: c.split(":")[1] || "auto",
                                    color: getResolvedTableHeaderText(block.tableHeaderTextColor)
                                  }}
                                >
                                  {c.split(":")[0]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr 
                              style={{
                                borderBottomWidth: block.showGridLines ? "1px" : "0px",
                                borderBottomStyle: block.borderStyle || "solid",
                                borderBottomColor: block.showGridLines ? getResolvedBorderColor(block.borderColor) : "transparent"
                              }}
                            >
                              {block.tableCols?.split(",").map((c, i) => (
                                <td key={i} className="p-3 text-xs font-semibold text-gray-700 italic">
                                  {i === 0 ? "1" : i === 1 ? "NEXUS Core Optical Interface" : i === 2 ? "5 units" : "฿ 45,000.00"}
                                </td>
                              ))}
                            </tr>
                            <tr 
                              style={{
                                borderBottomWidth: block.showGridLines ? "1px" : "0px",
                                borderBottomStyle: block.borderStyle || "solid",
                                borderBottomColor: block.showGridLines ? getResolvedBorderColor(block.borderColor) : "transparent",
                                backgroundColor: getResolvedRowStripedColor(block.tableRowStripedColor)
                              }}
                            >
                              {block.tableCols?.split(",").map((c, i) => (
                                <td key={i} className="p-3 text-xs font-semibold text-gray-700 italic">
                                  {i === 0 ? "2" : i === 1 ? "Optical Fiber Transceiver Module" : i === 2 ? "2 units" : "฿ 18,000.00"}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : block.type === "heading" ? (
                      <h2 
                        className={cn("tracking-tight font-bold leading-tight", sizeClass)}
                        style={{ color: getResolvedColor(block.textColor) }}
                      >
                        {resolvedContent}
                      </h2>
                    ) : (
                      <p 
                        className={cn("leading-relaxed font-semibold", sizeClass)}
                        style={{ color: getResolvedColor(block.textColor) }}
                      >
                        {resolvedContent}
                      </p>
                    )}

                    {/* Block Action controls shown on hover */}
                    <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1.5 bg-white shadow rounded-full p-1 border border-gray-100">
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                        className="p-1 text-gray-400 hover:text-danger rounded-full hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Print Footer powered brand */}
            <div className="mt-auto pt-16 flex justify-between items-center opacity-30 text-[7px] font-mono text-gray-500 border-t border-gray-100">
              <span>NEXUS VISUAL LAYOUT DESIGNS V3.9</span>
              <span>PSG MULTI-TENANCY STANDARD TEMPLATE</span>
            </div>
          </div>
        </div>

        {/* 3. LAYOUT & BORDER INSPECTOR PANEL */}
        <div className="w-[400px] bg-surface-1 p-5 flex flex-col shrink-0 overflow-y-auto custom-scrollbar space-y-3">
          
          <div className="space-y-1 border-b border-white/5 pb-4">
            <span className="text-[10px] text-white/20 font-normal tracking-widest uppercase">Geometry Inspector</span>
            <h3 className="text-sm font-medium text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders size={14} className="text-nexus-teal" /> ตัวควบคุมเชิงเลย์เอาต์
            </h3>
          </div>

          {activeBlock ? (
            <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
              
              {/* Spacing alignment */}
              <div className="space-y-3">
                 <h4 className="text-[11px] font-medium text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={12} className="text-nexus-teal" /> การจัดแนวช่องไฟและขนาดกริด
                 </h4>
                 
                 <div className="space-y-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                   <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">ขนาดกริด</label>
                        <PillSelect 
                          value={activeBlock.width || "100%"}
                          onChange={(e) => updateBlock(activeBlock.id, { width: e.target.value as any })}
                          className="w-full h-9 px-4 rounded-full text-xs text-white"
                        >
                          <option value="100%">100% (12/12 เต็มหน้า)</option>
                          <option value="75%">75% (3/4 บรรทัด)</option>
                          <option value="66.66%">66.66% (2/3 บรรทัด)</option>
                          <option value="50%">50% (ครึ่งบรรทัดคู่)</option>
                          <option value="33.33%">33.33% (1/3 บรรทัด)</option>
                          <option value="25%">25% (1/4 บรรทัด)</option>
                          <option value="16.66%">16.66% (2/12 บรรทัด)</option>
                          <option value="8.33%">8.33% (1/12 บรรทัด)</option>
                        </PillSelect>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">ขนาดตัวอักษร</label>
                        <PillSelect
                          value={activeBlock.fontSize}
                          onChange={(e) => updateBlock(activeBlock.id, { fontSize: e.target.value as any })}
                          className="w-full h-9 px-4 rounded-full text-xs text-white"
                        >
                          <option value="sm">Small (เล็ก)</option>
                          <option value="base">Normal (ปกติ)</option>
                          <option value="lg">Large (ใหญ่)</option>
                          <option value="xl">XL Title (ย่อย)</option>
                          <option value="2xl">2XL (หลัก)</option>
                        </PillSelect>
                     </div>
                   </div>

                   {/* Margin Spacers Left Right */}
                   <div className="space-y-2 pt-2 border-t border-white/5">
                     <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest block">ขยับตำแหน่งซ้าย-ขวา</label>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <div className="flex justify-between text-[10px] text-white/40">
                           <span>ขยับซ้าย:</span>
                           <span className="font-mono text-nexus-teal font-bold">{activeBlock.marginLeft || 0}px</span>
                         </div>
                         <input 
                           type="range"
                           min="0"
                           max="120"
                           step="4"
                           value={activeBlock.marginLeft || 0}
                           onChange={(e) => updateBlock(activeBlock.id, { marginLeft: parseInt(e.target.value) })}
                           className="w-full accent-nexus-teal h-1 bg-white/10 rounded-lg cursor-pointer"
                         />
                       </div>
                       <div className="space-y-1">
                         <div className="flex justify-between text-[10px] text-white/40">
                           <span>ขยับขวา:</span>
                           <span className="font-mono text-nexus-teal font-bold">{activeBlock.marginRight || 0}px</span>
                         </div>
                         <input 
                           type="range"
                           min="0"
                           max="120"
                           step="4"
                           value={activeBlock.marginRight || 0}
                           onChange={(e) => updateBlock(activeBlock.id, { marginRight: parseInt(e.target.value) })}
                           className="w-full accent-nexus-teal h-1 bg-white/10 rounded-lg cursor-pointer"
                         />
                       </div>
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                     <div className="space-y-1">
                        <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">ช่องไฟบน</label>
                        <PillSelect 
                          value={activeBlock.paddingTop}
                          onChange={(e) => updateBlock(activeBlock.id, { paddingTop: parseInt(e.target.value) })}
                          className="w-full h-9 px-4 rounded-full font-mono text-xs text-white"
                        >
                          <option value={0}>0 px</option>
                          <option value={4}>4 px</option>
                          <option value={8}>8 px</option>
                          <option value={12}>12 px</option>
                          <option value={16}>16 px</option>
                          <option value={24}>24 px</option>
                          <option value={32}>32 px</option>
                        </PillSelect>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">ช่องไฟล่าง</label>
                        <PillSelect 
                          value={activeBlock.paddingBottom}
                          onChange={(e) => updateBlock(activeBlock.id, { paddingBottom: parseInt(e.target.value) })}
                          className="w-full h-9 px-4 rounded-full font-mono text-xs text-white"
                        >
                          <option value={0}>0 px</option>
                          <option value={4}>4 px</option>
                          <option value={8}>8 px</option>
                          <option value={12}>12 px</option>
                          <option value={16}>16 px</option>
                          <option value={24}>24 px</option>
                          <option value={32}>32 px</option>
                        </PillSelect>
                     </div>
                   </div>
                 </div>
              </div>

              {/* Text content editor */}
              {activeBlock.type !== "divider" && activeBlock.type !== "spacer" && (
                <div className="space-y-3">
                   <h4 className="text-[11px] font-medium text-white/40 uppercase tracking-widest">แก้ไขคำอธิบายหรือเนื้อหาข้อความ</h4>
                   <textarea 
                     value={activeBlock.content}
                     onChange={(e) => updateBlock(activeBlock.id, { content: e.target.value })}
                     className="w-full h-24 rounded-xl bg-white/[0.02] border border-white/10 text-white text-xs p-4 focus:outline-none focus:border-nexus-teal/40 transition-all font-bold leading-relaxed"
                   />
                </div>
              )}

              {/* Text Blocks Custom Colors Swatch picker */}
              {activeBlock.type !== "divider" && activeBlock.type !== "spacer" && (
                <div className="space-y-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                  <span className="text-[10px] font-normal text-nexus-teal uppercase tracking-widest block">แก้ไขสีตัวอักษรเฉพาะบล็อก</span>
                  <div className="flex flex-wrap gap-1.5 py-1">
                    {[
                      { hex: "theme", label: "Theme" },
                      { hex: "#111827", label: "Onyx" },
                      { hex: "#4B5563", label: "Slate" },
                      { hex: "#1E3A8A", label: "Royal" },
                      { hex: "#10B981", label: "Emerald" },
                      { hex: "#EF4444", label: "Crimson" },
                    ].map(sw => (
                      <button
                        key={sw.hex}
                        type="button"
                        onClick={() => updateBlock(activeBlock.id, { textColor: sw.hex })}
                        className={cn(
                          "h-7 px-2.5 rounded-full border text-xs font-bold transition-all",
                          activeBlock.textColor === sw.hex ? "border-nexus-teal bg-nexus-teal/10 text-white" : "border-white/5 bg-white/5 text-white/55 hover:border-white/20"
                        )}
                      >
                        {sw.label}
                      </button>
                    ))}
                  </div>
                  <PillInput 
                    value={activeBlock.textColor || ""}
                    onChange={(e) => updateBlock(activeBlock.id, { textColor: e.target.value })}
                    placeholder="ระบุรหัสสีเอง เช่น #FF5733"
                    className="h-8 text-xs font-mono w-full text-white mt-1"
                  />
                </div>
              )}

              {/* Block Background Highlight Config */}
              {activeBlock.type !== "divider" && activeBlock.type !== "spacer" && (
                <div className="space-y-3 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                  <span className="text-[10px] font-normal text-nexus-teal uppercase tracking-widest block">สีพื้นหลังเน้นข้อความ</span>
                  <div className="flex flex-wrap gap-1.5 py-1">
                    {[
                      { hex: "", label: "Transparent" },
                      { hex: "#F3F4F6", label: "Gray Tint" },
                      { hex: "#EFF6FF", label: "Blue Tint" },
                      { hex: "#ECFDF5", label: "Green Tint" },
                      { hex: "#FEF3C7", label: "Amber Tint" }
                    ].map(bgsw => (
                      <button
                        key={bgsw.hex}
                        type="button"
                        onClick={() => updateBlock(activeBlock.id, { blockBgColor: bgsw.hex })}
                        className={cn(
                          "h-7 px-2.5 rounded-full border text-xs font-bold transition-all",
                          (activeBlock.blockBgColor || "") === bgsw.hex ? "border-nexus-teal bg-nexus-teal/10 text-white" : "border-white/5 bg-white/5 text-white/55 hover:border-white/20"
                        )}
                      >
                        {bgsw.label}
                      </button>
                    ))}
                  </div>
                  <PillInput 
                    value={activeBlock.blockBgColor || ""}
                    onChange={(e) => updateBlock(activeBlock.id, { blockBgColor: e.target.value })}
                    placeholder="รหัสสีพื้นหลัง เช่น #F3F4F6"
                    className="h-8 text-xs font-mono w-full text-white mt-1"
                  />
                </div>
              )}

              {/* Specific Config for Dividers & Borders */}
              {(activeBlock.type === "divider" || activeBlock.type === "table") && (
                <div className="space-y-3">
                   <h4 className="text-[11px] font-medium text-white/40 uppercase tracking-widest">ดีไซน์เส้นและกรอบตาราง</h4>
                   <div className="space-y-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                     <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                         <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">ลักษณะขอบเส้น</label>
                         <PillSelect
                           value={activeBlock.borderStyle || "solid"}
                           onChange={(e) => updateBlock(activeBlock.id, { borderStyle: e.target.value as any })}
                           className="w-full h-9 px-4 rounded-full text-xs text-white"
                         >
                           <option value="none">None (ปิดเส้นขอบ)</option>
                           <option value="solid">Solid (เส้นทึบ)</option>
                           <option value="dashed">Dashed (เส้นประ)</option>
                           <option value="double">Double (เส้นคู่)</option>
                         </PillSelect>
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">ความหนาเส้น</label>
                         <PillSelect
                           value={activeBlock.borderWidth || 1}
                           onChange={(e) => updateBlock(activeBlock.id, { borderWidth: parseInt(e.target.value) })}
                           className="w-full h-9 px-4 rounded-full text-xs text-white"
                         >
                           <option value={1}>1 px</option>
                           <option value={2}>2 px</option>
                           <option value={3}>3 px</option>
                           <option value={4}>4 px</option>
                           <option value={6}>6 px</option>
                           <option value={8}>8 px</option>
                         </PillSelect>
                       </div>
                     </div>

                     <div className="space-y-1">
                       <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">สไตล์สีเส้นขอบ</label>
                       <PillInput 
                         value={activeBlock.borderColor || ""}
                         onChange={(e) => updateBlock(activeBlock.id, { borderColor: e.target.value })}
                         placeholder="รหัสสีขอบเส้น เช่น #E5E7EB หรือ theme"
                         className="h-8 text-xs font-mono w-full text-white"
                       />
                     </div>

                     {activeBlock.type === "table" && (
                       <div className="pt-2 border-t border-white/5 space-y-2">
                         <div className="flex items-center justify-between">
                           <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">เปิดเส้นขอบด้านนอก</span>
                           <PillCheckbox 
                             checked={activeBlock.showOuterBorder !== false}
                             onChange={(e) => updateBlock(activeBlock.id, { showOuterBorder: e.target.checked })}
                           />
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">เปิดเส้นตารางด้านใน</span>
                           <PillCheckbox 
                             checked={activeBlock.showGridLines !== false}
                             onChange={(e) => updateBlock(activeBlock.id, { showGridLines: e.target.checked })}
                           />
                         </div>
                       </div>
                     )}
                   </div>
                </div>
              )}

              {/* Specific Config for Dynamic Tables & Colors */}
              {activeBlock.type === "table" && (
                <div className="space-y-3">
                   <h4 className="text-[11px] font-medium text-white/40 uppercase tracking-widest">สีตารางและการกำหนดคอลัมน์</h4>
                   <div className="space-y-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                     <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                         <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">สีพื้นหลังหัวข้อ</label>
                         <PillSelect 
                           value={activeBlock.tableBgColor || "light"}
                           onChange={(e) => updateBlock(activeBlock.id, { tableBgColor: e.target.value })}
                           className="w-full h-9 px-4 rounded-full text-xs text-white"
                         >
                           <option value="light">Theme Light</option>
                           <option value="theme">Theme Accent</option>
                           <option value="muted">Muted Gray</option>
                           <option value="white">White</option>
                         </PillSelect>
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest">สีตัวหัวข้อ</label>
                         <PillSelect 
                           value={activeBlock.tableHeaderTextColor || "white"}
                           onChange={(e) => updateBlock(activeBlock.id, { tableHeaderTextColor: e.target.value })}
                           className="w-full h-9 px-4 rounded-full text-xs text-white"
                         >
                           <option value="white">White (ขาว)</option>
                           <option value="theme">Theme Accent</option>
                           <option value="dark">Dark Slate</option>
                         </PillSelect>
                       </div>
                     </div>

                     <div className="space-y-1">
                       <label className="text-[10px] font-medium text-white/30 uppercase tracking-widest block">สีแถวตารางเว้นแถว</label>
                       <PillSelect 
                         value={activeBlock.tableRowStripedColor || "lightgray"}
                         onChange={(e) => updateBlock(activeBlock.id, { tableRowStripedColor: e.target.value })}
                         className="w-full h-9 px-4 rounded-full text-xs text-white"
                       >
                         <option value="transparent">None (ไม่มี)</option>
                         <option value="lightgray">Light Gray Stripe</option>
                         <option value="theme-tint">Theme Light Tint</option>
                       </PillSelect>
                     </div>

                     <div className="space-y-1">
                       <label className="text-[10px] font-normal text-white/30 uppercase tracking-widest">คอลัมน์และขนาดเปอร์เซ็นต์</label>
                       <PillInput
                         value={activeBlock.tableCols || ""}
                         onChange={(e) => updateBlock(activeBlock.id, { tableCols: e.target.value })}
                         className="w-full h-9 px-6 rounded-full text-xs font-bold text-white"
                       />
                       <span className="text-[10px] text-white/30 block mt-1 leading-relaxed">
                         * คั่นแต่ละคอลัมน์ด้วยจุลภาค เช่น `คอลัมน์:ขนาด%`
                       </span>
                     </div>
                   </div>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-16 text-[12px] font-medium uppercase tracking-[0.2em] text-white/15 border-2 border-dashed border-white/5 rounded-2xl">
               กรุณาเลือกส่วนประกอบบนกระดาษเพื่อเริ่มตกแต่งอิสระ
             </div>
          )}

          {/* Help box */}
          <div className="pt-6 border-t border-white/5 mt-auto">
             <div className="flex items-start gap-3 text-[10px] text-white/30 bg-white/[0.01] border border-white/5 p-4 rounded-xl leading-relaxed">
               <HelpCircle size={14} className="text-nexus-blue shrink-0 mt-0.5" />
               <span>
                  คลิกที่บล็อกหรือชุดข้อความใด ๆ บนกระดาษตรงกลาง เพื่อเริ่มต้นการขยับย้าย จัดแนวหน้า แก้ไขคำอธิบาย ผูกตัวแปรระบบ หรือประดับตกแต่งด้วยเส้นกรอบตารางอย่างอิสระ
               </span>
             </div>
          </div>
        </div>

      </div>

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} type={toast.type} />
    </div>
  );
}

