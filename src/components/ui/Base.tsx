"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { X, Sparkles, ChevronLeft, ChevronDown, Plus, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { FloatingLayer } from "./FloatingLayer";
export { cn };

/** 
 * [PSG-STANDARD-V2.9] 
 * - Height: h-8 (32px) (LOCKED for ALL Action Elements)
 * - Radius: rounded-full (LOCKED for Strategic Precision)
 * - Density: Compact Layout (Zero-Scroll Intent)
 * - Aesthetics: Neon-Glass Glassmorphism
 */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "save" | "confirm" | "warning" | "danger" | "glass" | "ghost";
  size?: number | string;
}

export function PillButton({ className, variant = "glass", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 font-bold backdrop-blur-md glow-accent-hover hover:bg-nexus-teal/35 hover:text-white hover:border-nexus-teal/60 active:scale-95 transition-all duration-300",
    save: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:bg-emerald-500/35 hover:text-white active:scale-95",
    confirm: "bg-nexus-blue/20 text-nexus-blue border border-nexus-blue/40 font-bold backdrop-blur-md shadow-[0_0_15px_rgba(0,195,255,0.15)] hover:bg-nexus-blue/35 hover:text-white active:scale-95",
    warning: "bg-warning/20 text-warning border border-warning/40 font-bold backdrop-blur-md shadow-[0_0_15px_rgba(255,193,7,0.15)] hover:bg-warning/35 hover:text-white active:scale-95",
    danger: "bg-danger/20 text-danger border border-danger/40 font-bold backdrop-blur-md shadow-[0_0_15px_rgba(244,67,54,0.15)] hover:bg-danger/35 hover:text-white active:scale-95",
    glass: "bg-white/10 text-white font-bold border border-white/20 hover:bg-white/20 active:scale-95 backdrop-blur-md",
    ghost: "bg-white/5 text-white/80 font-bold hover:text-white hover:bg-white/10 border border-transparent active:scale-95 backdrop-blur-sm"
  };

  return (
    <button
      className={cn(
        "h-8 px-5 rounded-full font-black text-[12px] transition-all flex items-center justify-center gap-2 uppercase tracking-wider whitespace-nowrap flex-shrink-0",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export const PillInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-8 px-5 py-0 leading-[1.9] rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-medium focus:outline-none focus:border-nexus-teal/40 focus:bg-white/[0.06] transition-all placeholder:text-white/30 backdrop-blur-sm truncate w-full",
          className
        )}
        {...props}
      />
    );
  }
);
PillInput.displayName = "PillInput";

export function NexusSearchInput({ 
  placeholder = "ค้นหาข้อมูล...", 
  value, 
  onChange, 
  className,
  kbd
}: { 
  placeholder?: string, 
  value?: string, 
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void, 
  className?: string,
  kbd?: string
}) {
  return (
    <div className={cn("relative group", className)}>
      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-nexus-teal transition-colors duration-300">
        <Sparkles size={18} className="animate-pulse" />
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={cn(
          "w-full h-8 pl-10 pr-12 py-0 leading-[1.9] rounded-full bg-white/[0.02] border border-white/5",
          "text-white text-[13px] font-bold tracking-wide",
          "focus:outline-none focus:border-nexus-teal/30 focus:bg-white/[0.05] focus:shadow-[0_0_30px_rgba(0,255,209,0.05)]",
          "transition-all duration-500 placeholder:text-white/10 placeholder:font-black placeholder:uppercase placeholder:tracking-widest",
          "backdrop-blur-xl"
        )}
      />
      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
        {kbd && (
          <div className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-semibold text-white/20 uppercase tracking-tighter">
            {kbd}
          </div>
        )}
        <div className="w-1.5 h-1.5 rounded-full bg-white/5 group-focus-within:bg-nexus-teal group-focus-within:shadow-neon-teal transition-all duration-500" />
      </div>
    </div>
  );
}

export function PillSelect({ className, children, value, onChange, placeholder = "เลือกรายการ...", ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const floatingRef = React.useRef<HTMLDivElement>(null);
  const optionRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Parse children to get labels and values
  const options = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === "option") {
      return {
        value: child.props.value !== undefined ? child.props.value : child.props.children,
        label: child.props.children,
        className: child.props.className
      };
    }
    return null;
  })?.filter(Boolean) || [];

  const selectedOption = options.find(opt => opt.value === value && opt.value !== "");

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    // เมนูอยู่ในชั้นลอย (นอก container) จึงนับคลิกในชั้นลอยเป็นข้างในด้วย
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (containerRef.current?.contains(t) || floatingRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOption = (optValue: any) => {
    if (onChange) {
      const event = { target: { value: optValue } } as any;
      onChange(event);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (props.disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => {
          if (options.length <= 0) return -1;
          if (prev < 0 || prev >= options.length - 1) return 0;
          return prev + 1;
        });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(options.length - 1);
      } else {
        setHighlightedIndex((prev) => {
          if (options.length <= 0) return -1;
          if (prev <= 0) return options.length - 1;
          return prev - 1;
        });
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(-1);
      } else if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        handleSelectOption(options[highlightedIndex].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        ref={triggerRef}
        tabIndex={props.disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-8 w-full px-5 pr-9 py-1 leading-normal rounded-full bg-white/[0.03] border border-white/10 text-white text-[14px] font-bold focus:outline-none focus:border-nexus-teal/60 focus:ring-1 focus:ring-nexus-teal/40 transition-all cursor-pointer flex items-center justify-between group backdrop-blur-sm",
          (!value || !selectedOption) && "text-white/30 font-normal",
          value && selectedOption && "text-white font-bold",
          isOpen && "border-nexus-teal/40 bg-white/[0.06]",
          className
        )}
      >
        <span className="truncate pr-2">{selectedOption?.label || placeholder}</span>
        <ChevronDown 
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2 text-white/20 transition-all pointer-events-none",
            isOpen ? "rotate-180 text-nexus-teal" : "group-hover:text-nexus-teal"
          )} 
          size={14} 
        />
      </div>

      <FloatingLayer
        ref={floatingRef}
        anchorRef={triggerRef}
        open={isOpen}
        maxHeight={300}
        className="bg-surface-0/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] p-1.5"
      >
          {options.map((opt: any, idx: number) => (
            <div
              key={idx}
              ref={(el) => { optionRefs.current[idx] = el; }}
              onClick={() => handleSelectOption(opt.value)}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl text-left text-[14px] font-medium transition-all cursor-pointer flex items-center justify-between group border",
                highlightedIndex === idx
                  ? "bg-white/15 border-nexus-teal/60 text-white font-bold ring-1 ring-nexus-teal/40 shadow-neon-teal"
                  : opt.value === value 
                    ? "bg-nexus-teal/20 border-nexus-teal/30 text-nexus-teal font-black" 
                    : "border-transparent text-white/90 hover:bg-white/10 hover:text-white"
              )}
            >
              <span className="truncate pr-2">{opt.label}</span>
              {opt.value === value && <div className="w-1.5 h-1.5 rounded-full bg-nexus-teal shadow-neon-teal shrink-0" />}
            </div>
          ))}
      </FloatingLayer>
    </div>
  );
}

export function PillCheckbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cn("flex items-center gap-3 cursor-pointer group select-none", className)}>
      <div className="relative flex items-center justify-center">
        <input 
          type="checkbox" 
          className="peer sr-only" 
          {...props} 
        />
        <div className="w-5 h-5 rounded-lg bg-white/[0.03] border border-white/10 transition-all peer-checked:bg-nexus-teal peer-checked:border-nexus-teal peer-checked:shadow-neon-teal" />
        <svg 
          className="absolute w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 transition-opacity" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      {label && <span className="text-[12px] font-semibold text-white/40 uppercase tracking-widest group-hover:text-white transition-colors">{label}</span>}
    </label>
  );
}

export function GlassCard({ 
  className, 
  children,
  accentColor
}: { 
  className?: string; 
  children: React.ReactNode;
  accentColor?: "teal" | "blue" | "purple" | "emerald" | "amber" | "rose";
}) {
  const accentBorders = {
    teal: "border-l-4 border-l-nexus-teal",
    blue: "border-l-4 border-l-nexus-blue",
    purple: "border-l-4 border-l-purple-500",
    emerald: "border-l-4 border-l-emerald-500",
    amber: "border-l-4 border-l-amber-500",
    rose: "border-l-4 border-l-rose-500"
  };

  return (
    <div
      className={cn(
        "bg-neutral-900/90 backdrop-blur-3xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden relative group/card",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/[0.05] before:to-transparent before:pointer-events-none",
        "hover:border-white/25 transition-all duration-300",
        accentColor && accentBorders[accentColor],
        className
      )}
    >
      {children}
    </div>
  );
}


export type DocumentStatus = "ร่าง" | "รออนุมัติ" | "รอชำระเงิน" | "ผ่านการอนุมัติ" | "บันทึกบัญชีแล้ว" | "ยกเลิกเอกสาร";

export function DocumentStatusBadge({ status }: { status: DocumentStatus | string }) {
  const styles: Record<string, string> = {
    "ร่าง": "bg-zinc-800 text-zinc-400 border-zinc-700/50",
    "รออนุมัติ": "bg-amber-950/40 text-amber-400 border-amber-900/50",
    "รอชำระเงิน": "bg-yellow-950/40 text-yellow-400 border-yellow-900/50",
    "ผ่านการอนุมัติ": "bg-blue-950/40 text-blue-400 border-blue-900/50",
    "บันทึกบัญชีแล้ว": "bg-emerald-950/40 text-emerald-400 border-emerald-900/50",
    "ยกเลิกเอกสาร": "bg-red-950/40 text-red-400 border-red-900/50",
  };

  const defaultStyle = "bg-white/5 text-white/40 border-white/10";

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[11px] font-black uppercase border tracking-widest whitespace-nowrap",
      styles[status] || defaultStyle
    )}>
      {status}
    </span>
  );
}

export function StatusBadge({ status, label, className }: { status: "active" | "inactive" | "pending" | "danger" | "warning", label: string, className?: string }) {
  const styles = {
    active: "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md glow-accent shadow-[0_0_15px_rgba(0,255,209,0.25)]",
    inactive: "bg-white/5 text-white/40 border-white/10",
    pending: "bg-warning/10 text-warning border-warning/20 shadow-[0_0_12px_rgba(255,193,7,0.15)]",
    warning: "bg-warning/10 text-warning border-warning/20 shadow-[0_0_12px_rgba(255,193,7,0.15)]",
    danger: "bg-danger/10 text-danger border-danger/20 shadow-[0_0_12px_rgba(255,59,48,0.15)]",
  };

  return (
    <span className={cn(
      "px-3 py-0.5 rounded-full text-[11px] font-bold uppercase border tracking-widest whitespace-nowrap",
      styles[status],
      className
    )}>
      {label}
    </span>
  );
}

const EN_TO_TH_MAP: Record<string, { th: string; desc: string }> = {
  // Purely English Tab Labels
  "NEXUS BRAIN": { th: "ระบบปัญญาประดิษฐ์", desc: "Nexus Brain - Quantum AI Layer" },
  "MILESTONES": { th: "งวดสัญญา", desc: "Milestones & Key Contract Phases" },
  "SERVICE REPORTS": { th: "รายงานการบริการ", desc: "Customer Service & Action Reports" },
  "BETA": { th: "ทดลองใช้งาน", desc: "Beta Features Under Active Development" },
  "OVERVIEW": { th: "สรุปภาพรวม", desc: "General System Overview" },
  "REPORTS": { th: "รายงานระบบ", desc: "System Analytical Reports" },
  "SETTINGS": { th: "ตั้งค่าระบบ", desc: "System Configurations" },
  "TIMELINE": { th: "ตารางเวลา", desc: "Timeline & Scheduling" },

  // Parenthesized English Terms / Abbreviations
  "ITEMS": { th: "รายการสินค้า", desc: "Product & Inventory Items Ledger" },
  "ASSETS": { th: "สินทรัพย์ถาวร", desc: "Fixed Assets & Register" },
  "SERIALS": { th: "เลขซีเรียล", desc: "Serial Number Traceability" },
  "BOM KITS": { th: "ชุดอุปกรณ์", desc: "BOM Kits & Configurations" },
  "LOGS": { th: "บันทึกการทำงาน", desc: "System Activity & Audit Logs" },
  "INFO": { th: "รายละเอียดข้อมูล", desc: "Product Information" },
  "PRICING": { th: "โครงสร้างราคา", desc: "Pricing & Cost Structure" },
  "STOCK": { th: "คลังสินค้า", desc: "Stock Levels & Warehouse Management" },
  "WARRANTY": { th: "การรับประกัน", desc: "Warranty & Guarantee Periods" },
  "DATA": { th: "ชุดข้อมูล", desc: "Detailed Payload Data Schema" },
  "CONTEXT": { th: "สถานะระบบ", desc: "System Execution Context" },
  "VENDORS": { th: "ผู้จำหน่าย", desc: "Supplier & Vendor Directory" },
  "REQUISITION": { th: "ใบขอจัดซื้อ", desc: "Purchase Requisition (PR)" },
  "RECEIVING": { th: "บันทึกรับสินค้า", desc: "Goods Receiving Ledger" },
  "CRM": { th: "ข้อมูลลูกค้าสัมพันธ์", desc: "Customer Relationship Management (CRM)" },
  "SO": { th: "ใบสั่งขาย", desc: "Sales Orders (SO)" },
  "LEGAL": { th: "ข้อมูลนิติบุคคล", desc: "Legal Profile & Tax Details" },
  "GEO": { th: "ข้อมูลไซต์งาน", desc: "Geographic Location & Sites" },
  "CONTACTS": { th: "สมุดรายชื่อผู้ติดต่อ", desc: "Contact Directory" },
  "HEADER": { th: "หัวเอกสาร", desc: "Document Header details" },
  "TERMS": { th: "เงื่อนไขการค้า", desc: "Terms & Conditions" },
  "LOGISTICS": { th: "การขนส่ง", desc: "Logistics & Delivery Site details" },
  "PROFILE": { th: "ข้อมูลทั่วไป", desc: "Profile Information" },
  "FINANCIAL": { th: "ข้อมูลการเงิน", desc: "Financial Profile & Bank Accounts" },
  "DIRECT ENTRY": { th: "บันทึกโดยตรง", desc: "Direct Manual Entry" },
  "RECEIVE FROM PO": { th: "รับสินค้าจากใบสั่งซื้อ", desc: "Receive Items from Purchase Order" },

  // Abbreviated modules
  "AR": { th: "ลูกหนี้การค้า", desc: "Accounts Receivable (AR)" },
  "AP": { th: "เจ้าหนี้การค้า", desc: "Accounts Payable (AP)" },
  "GL": { th: "บัญชีแยกประเภท", desc: "General Ledger (GL)" },
  "TAX HUB": { th: "ระบบภาษี", desc: "Tax Hub & Compliance" },
  "TAX": { th: "ภาษีอากร", desc: "Tax Hub & Compliance" },
  "AI": { th: "วิเคราะห์โอกาสขาย", desc: "AI-Powered Opportunities" },
  "GPS": { th: "ลงเวลาปฏิบัติงาน", desc: "GPS Location Attendance Checking" },
  "PAYROLL": { th: "การจ่ายเงินเดือน", desc: "Payroll Management" },
  "LEDGER": { th: "บัญชีแยกประเภท", desc: "General Ledger / Sub-ledger Details" },
  "FILES": { th: "เอกสารแนบ", desc: "Attached Files & Documents" },
  "ORDERS": { th: "ใบสั่งซื้อ", desc: "Purchase Orders (PO)" },
  "PROJECTS": { th: "โครงการ", desc: "All Projects Ledger" },
  "BUDGET": { th: "งบประมาณโครงการ", desc: "Project Budget & Equipment" },
  "DETAIL": { th: "รายละเอียด", desc: "Detailed Information" },
  "SITE": { th: "ข้อมูลไซต์งาน", desc: "Site Location & Details" },
  "TEAM": { th: "ทีมงานโครงการ", desc: "Project Team & Members" },
  "WORK": { th: "บันทึกการทำงาน", desc: "Work Log & Activity Details" },
  "MATERIALS": { th: "รายการวัสดุ", desc: "Materials or Parts Used" },
  "DELIVERY": { th: "การส่งมอบ", desc: "Delivery & Customer Acceptance" },
  "PREDICTION": { th: "การพยากรณ์", desc: "Predictive Analytics & Forecasting" },
  "INSIGHTS": { th: "การวิเคราะห์เชิงลึก", desc: "System Insights & Metrics" },
  "PROFILES": { th: "ทะเบียนบุคลากร", desc: "Employee Directory & Profiles" },
  "SKILLS": { th: "ทักษะและคุณวุฒิ", desc: "Skills & Certificates" },
  "AUDIT": { th: "บันทึกการแก้ไข", desc: "Audit Trail and Change History" },
  "CHECK": { th: "ตรวจสอบความถูกต้อง", desc: "Audit Verification Chain" },
  
  // Mixed labels
  "แบบจำลอง 3D LAYOUT (BETA)": { th: "จำลอง 3D", desc: "3D Layout Simulator (Beta)" },
  "แบบจำลอง 3D LAYOUT": { th: "จำลอง 3D", desc: "3D Layout Simulator" },
};

function parseTabLabel(label: string): { th: string; desc: string } {
  const clean = label.trim();
  const upper = clean.toUpperCase();
  
  if (EN_TO_TH_MAP[upper]) {
    return EN_TO_TH_MAP[upper];
  }
  
  // Handles parenthesized English/Descriptions, e.g., "ข้อมูลคู่ค้า" or "ลูกหนี้"
  const parenMatch = clean.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const mainText = parenMatch[1].trim();
    const subText = parenMatch[2].trim();
    const subTextUpper = subText.toUpperCase();
    
    // Check if the subText has a translation / desc in mapping
    if (EN_TO_TH_MAP[subTextUpper]) {
      return {
        th: EN_TO_TH_MAP[subTextUpper].th,
        desc: `${subText} - ${EN_TO_TH_MAP[subTextUpper].desc}`
      };
    }
    
    return {
      th: mainText,
      desc: subText
    };
  }
  
  // If purely English and not mapped, keep as is
  if (/^[A-Za-z\s&/_-]+$/.test(clean)) {
    return {
      th: clean,
      desc: ""
    };
  }
  
  return {
    th: clean,
    desc: ""
  };
}

export function PillTabs({ 
  tabs, 
  activeTab, 
  onTabChange, 
  className 
}: { 
  tabs: { id: string, label: string, icon?: any }[], 
  activeTab: string, 
  onTabChange: (id: string) => void,
  className?: string
}) {
  return (
    <div className={cn(
      // แท็บที่ไม่พอแถวจะขึ้นบรรทัดใหม่ (ไม่ซ่อนไว้นอกจอ)
      "flex items-center gap-1.5 2xl:gap-2 p-0 bg-transparent w-full flex-wrap",
      className
    )}>
      {tabs.map((tab) => {
        const { th, desc } = parseTabLabel(tab.label);
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={desc ? desc : undefined}
            className={cn(
              "h-9 px-3.5 2xl:px-5 rounded-full text-[12px] 2xl:text-[13px] font-black transition-all duration-300 flex items-center gap-2 2xl:gap-2.5 uppercase tracking-wide 2xl:tracking-wider whitespace-nowrap flex-shrink-0",
              activeTab === tab.id 
                ? "bg-nexus-teal/15 text-nexus-teal shadow-[0_0_10px_rgba(0,255,209,0.1)] border border-nexus-teal/30" 
                : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10 border border-transparent"
            )}
          >
            {tab.icon && React.cloneElement(tab.icon, { 
              size: 16, 
              className: cn(
                "transition-colors duration-300",
                activeTab === tab.id ? "text-nexus-teal drop-shadow-sm" : "text-white/40"
              ) 
            })}
            <span>{th}</span>
          </button>
        );
      })}
    </div>
  );
}

/* Master Table Structure */

export type NexusColumnAlign = "left" | "center" | "right";

/**
 * จัดตำแหน่งคอลัมน์ตามชนิดข้อมูลจากชื่อหัวคอลัมน์ (หัวและข้อมูลใช้ค่าเดียวกันเสมอ)
 * - ขวา: จำนวนเงิน / ปริมาณ / ราคา / เปอร์เซ็นต์
 * - กลาง: วันที่ / สถานะ / ประเภท / หน่วย / รูปภาพ / การจัดการ
 * - ซ้าย: ชื่อ คำอธิบาย รหัส เลขที่เอกสาร หมวดหมู่ และข้อความทั่วไป
 */
export function nexusColumnAlign(header: string): NexusColumnAlign {
  const h = header || "";
  const l = h.toLowerCase();
  if (
    /มูลค่า|ยอด|ราคา|ทุน|จำนวน|คงเหลือ|รวม|ภาษี|ส่วนลด|เปอร์เซ็นต์|เงิน|งบประมาณ|ค่าเสื่อม|เดบิต|เครดิต|ปริมาณ|อัตรา|%/.test(h) ||
    /debit|credit|total|amount|value|qty|price|cost|balance|wac/.test(l)
  ) {
    // ยกเว้นคอลัมน์ข้อความที่มีคำเหล่านี้ปน เช่น "วิธีชำระเงิน", "ประเภทภาษี"
    if (!/ประเภท|วิธี|ผู้|ชื่อ|รหัส|เลขที่|เลขประจำตัว/.test(h)) return "right";
  }
  if (
    (!/^ผู้/.test(h) && /สถานะ|วัน|เวลา|งวด|กำหนด|ติดตาม|ประเภท|หน่วย|รูป|จัดการ|การกระทำ|แอคชั่น|ความคืบหน้า|ระดับ|ลำดับ|^ที่$|สต็อก|การอนุมัติ|^เอกสาร$/.test(h)) ||
    /status|date|type|action|unit/.test(l) || h.trim() === ""
  ) {
    return "center";
  }
  return "left";
}

/** คอลัมน์ข้อความที่ย่อได้เมื่อพื้นที่ไม่พอ (รหัส / เลขที่เอกสาร / หมายเลข ไม่ย่อ) */
export function nexusColumnShrinkable(header: string): boolean {
  if (nexusColumnAlign(header) !== "left") return false;
  return !/รหัส|เลขที่|หมายเลข|อ้างอิง|เลขประจำตัว|เบอร์|โทร|sku|code|no\./i.test(header || "");
}

const FLEX_JUSTIFY: Record<NexusColumnAlign, string> = { left: "flex-start", center: "center", right: "flex-end" };

export function NexusTable({
  headers,
  children,
  className,
  minWidth = "min-w-[700px]",
  itemCount,
  totalCount
}: {
  headers: string[],
  children: React.ReactNode,
  className?: string,
  minWidth?: string,
  itemCount?: number,
  totalCount?: number
}) {
  // [Responsive Table] ตารางพอดีพื้นที่ 13"-27" เสมอ:
  // - ทุกช่องเป็นบรรทัดเดียว คอลัมน์กว้างตามข้อมูล (table-layout auto)
  // - หัวคอลัมน์และข้อมูลจัดตำแหน่งเดียวกันตามชนิดข้อมูล (nexusColumnAlign)
  // - ถ้ากว้างเกินพื้นที่ จะย่อเฉพาะคอลัมน์ข้อความยาว (ชิดซ้าย) ให้พอดี แสดง "…" และ tooltip ข้อความเต็ม
  //   ตัวเลข รหัส วันที่ สถานะ ไม่ถูกย่อ และไม่มี scrollbar ย่อยในตาราง
  // - minWidth เก็บไว้เพื่อความเข้ากันได้ของ props เดิม แต่ไม่บังคับใช้แล้ว
  void minWidth;
  const tableId = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const aligns = React.useMemo(() => headers.map(nexusColumnAlign), [headers]);
  const shrinkable = React.useMemo(() => headers.map(nexusColumnShrinkable), [headers]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const alignCss = React.useMemo(() => {
    const sel = `table[data-nt="${tableId}"]>tbody>tr>td:not([colspan])`;
    return aligns.map((a, i) => {
      const td = `${sel}:nth-child(${i + 1})`;
      const rules = [
        `${td}{text-align:${a}}`,
        `${td}>.nt-cell>.flex,${td}>.nt-cell>.inline-flex{justify-content:${FLEX_JUSTIFY[a]}}`,
        `${td}>.nt-cell>.flex-col{align-items:${FLEX_JUSTIFY[a]}}`,
      ];
      if (shrinkable[i]) {
        // คอลัมน์ข้อความ: ย่อได้เมื่อพื้นที่ไม่พอ (ค่าความกว้างคำนวณใน fitColumns)
        rules.push(`${td}>.nt-cell{max-width:var(--nt-max,none);overflow:hidden;text-overflow:ellipsis}`);
        rules.push(`${td}>.nt-cell>*{max-width:100%;overflow:hidden;text-overflow:ellipsis}`);
      }
      return rules.join("");
    }).join("");
  }, [aligns, shrinkable, tableId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const table = tableRef.current;
    if (!wrap || !table) return;
    let frame = 0;

    const fitColumns = () => {
      table.style.removeProperty("--nt-max");
      const avail = wrap.clientWidth;
      const need = table.scrollWidth;
      const textCols = shrinkable.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);
      const ths = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
      if (need > avail + 1 && textCols.length > 0) {
        // water-filling: ลดคอลัมน์ข้อความที่กว้างที่สุดก่อน จนรวมแล้วพอดีพื้นที่
        const widths = textCols.map((i) => ths[i]?.getBoundingClientRect().width || 0).sort((a, b) => b - a);
        let overflow = need - avail + 2;
        let cap = widths[0];
        for (let k = 0; k < widths.length && overflow > 0; k++) {
          const next = k + 1 < widths.length ? widths[k + 1] : 0;
          const room = (cap - next) * (k + 1);
          if (room >= overflow) { cap -= overflow / (k + 1); overflow = 0; }
          else { overflow -= room; cap = next; }
        }
        let max = Math.max(64, Math.floor(cap - 24));
        table.style.setProperty("--nt-max", `${max}px`);
        // วัดซ้ำจนพอดี (ความกว้างจริงขึ้นกับ padding/ตัวอักษรของแต่ละช่อง)
        for (let k = 0; k < 6 && table.scrollWidth > wrap.clientWidth + 1 && max > 64; k++) {
          max = Math.max(64, max - Math.ceil((table.scrollWidth - wrap.clientWidth + 2) / textCols.length));
          table.style.setProperty("--nt-max", `${max}px`);
        }
      }
      // tooltip ข้อความเต็มเฉพาะช่องที่ถูกย่อ
      table.querySelectorAll<HTMLElement>("td > .nt-cell").forEach((cell) => {
        const truncated = cell.scrollWidth > cell.clientWidth + 1 ||
          Array.from(cell.children).some((c) => (c as HTMLElement).scrollWidth > (c as HTMLElement).clientWidth + 1);
        if (truncated) cell.setAttribute("title", (cell.textContent || "").trim());
        else if (cell.dataset.ntTitle !== "1") cell.removeAttribute("title");
      });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitColumns);
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    const mo = new MutationObserver(schedule);
    const tbody = table.querySelector("tbody");
    if (tbody) mo.observe(tbody, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
    };
  }, [shrinkable]);

  return (
    <div ref={wrapRef} className="nexus-table-wrap w-full rounded-2xl border border-white/5 bg-black/[0.15] backdrop-blur-md relative">
      <style dangerouslySetInnerHTML={{ __html: alignCss }} />
      <table ref={tableRef} data-nt={tableId} className={cn("nexus-table w-full table-auto border-collapse", className)}>
        <thead className="sticky top-0 z-20">
          <tr className="bg-surface-0/95 border-b border-white/5 shadow-sm">
            {headers.map((header, i) => (
              <th
                key={i}
                className={cn(
                  "px-2.5 2xl:px-4 py-2.5 text-[12px] 2xl:text-[13px] font-medium text-white/60 tracking-wide leading-tight whitespace-nowrap align-middle",
                  "first:rounded-tl-2xl last:rounded-tr-2xl first:pl-4 last:pr-4",
                  aligns[i] === "right" ? "text-right" : aligns[i] === "center" ? "text-center" : "text-left"
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {children}
        </tbody>
      </table>
      {(itemCount !== undefined || totalCount !== undefined) && (
        <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium">
            แสดง 1-{itemCount || 0} จาก {totalCount || itemCount || 0} รายการ
          </p>
        </div>
      )}
    </div>
  );
}

export function NexusTableRow({ children, onClick, className }: { children: React.ReactNode, onClick?: () => void, className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "group cursor-pointer transition-all duration-300 h-12 hover:bg-white/[0.03]",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function NexusTableCell({
  children,
  className,
  mono = false,
  wrap = false,
  colSpan,
  align,
  variant,
  title,
  maxWidth
}: {
  children: React.ReactNode,
  className?: string,
  mono?: boolean,
  wrap?: boolean,
  colSpan?: number,
  align?: "left" | "center" | "right",
  variant?: "text" | "code" | "numeric",
  title?: string,
  maxWidth?: string
}) {
  // ตำแหน่งซ้าย/กลาง/ขวา กำหนดจากหัวคอลัมน์ใน NexusTable (align/className ของช่องใช้เฉพาะแถวที่ colSpan)

  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-2.5 2xl:px-4 py-2 first:pl-4 last:pr-4 text-[13px] 2xl:text-[14px] font-normal text-white/80 transition-colors duration-300 align-middle",
        // ทุกช่องบรรทัดเดียว (ยกเว้นแถวข้อความที่ต้องการตัดบรรทัด เช่น ข้อความว่าง/คำอธิบาย ที่ระบุ wrap)
        wrap || colSpan ? "whitespace-normal leading-relaxed" : "whitespace-nowrap",
        mono && "font-mono text-nexus-teal tracking-normal font-bold [font-style:normal!important]",
        variant === "code" && "font-mono text-nexus-teal",
        variant === "numeric" && "font-mono",
        maxWidth && maxWidth,
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left",
        className
      )}
    >
      <div className="nt-cell" data-nt-title={title ? "1" : undefined} title={title || undefined}>
        {children}
      </div>
    </td>
  );
}

/* 
 * Strategic Table V3.1 Standard (Scientific Aesthetic)
 * Used as the primary data listing core for the entire system.
 */
export function StrategicTable({ 
  headers, 
  children, 
  className 
}: { 
  headers: string[], 
  children: React.ReactNode, 
  className?: string 
}) {
  return (
    <div className={cn("w-full overflow-x-auto no-scrollbar", className)}>
      <table className="w-full border-separate border-spacing-y-3">
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th 
                key={i} 
                className={cn(
                  "px-8 py-2 text-[13px] font-medium text-white/50 tracking-wider whitespace-nowrap",
                  (header.includes("มูลค่า") || header.includes("ยอด") || header.toLowerCase().includes("amount") || header.includes("รหัส") || header.toLowerCase().includes("sku") || header.toLowerCase().includes("code")) ? "text-right" : 
                  (header.includes("สถานะ") || header.includes("วันที่") || header.toLowerCase().includes("date") || header.toLowerCase().includes("status")) ? "text-center" : 
                  "text-left"
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function StrategicRow({ children, onClick, className }: { children: React.ReactNode, onClick?: () => void, className?: string }) {
  return (
    <tr 
      onClick={onClick}
      className={cn(
        "group cursor-pointer transition-all duration-500",
        "bg-surface-0/60 hover:bg-white/[0.04] border border-white/5",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function StrategicCell({ 
  children, 
  className, 
  isId = false,
  isAmount = false,
  isStatus = false
}: { 
  children: React.ReactNode, 
  className?: string, 
  isId?: boolean,
  isAmount?: boolean,
  isStatus?: boolean
}) {
  return (
    <td 
      className={cn(
        "px-8 py-5 text-[14px] font-bold text-white/80 first:rounded-l-[2rem] last:rounded-r-[2rem] border-t border-b border-white/5 first:border-l last:border-r transition-all duration-500",
        isId && "font-mono text-nexus-teal tracking-normal font-black",
        isAmount && "text-right font-mono text-white",
        isStatus && "text-right",
        className
      )}
    >
      {children}
    </td>
  );
}

export function StrategicStatus({ status, label }: { status: "pending" | "success" | "danger" | "warning", label: string }) {
  const styles = {
    pending: "bg-warning/10 text-warning border-warning/20 shadow-[0_0_15px_rgba(255,197,61,0.1)]",
    warning: "bg-warning/10 text-warning border-warning/20 shadow-[0_0_15px_rgba(255,197,61,0.1)]",
    success: "bg-nexus-teal/10 text-nexus-teal border-nexus-teal/20 shadow-[0_0_15px_rgba(0,255,209,0.1)]",
    danger: "bg-danger/10 text-danger border-danger/20 shadow-[0_0_15px_rgba(255,77,79,0.1)]",
  };

  return (
    <span className={cn(
      "px-6 py-1.5 rounded-full text-[11px] font-black uppercase border tracking-[0.2em] whitespace-nowrap",
      styles[status]
    )}>
      {label}
    </span>
  );
}

/* Signature Ambient Background Glow - Shared System Identity */
export function SignatureGlow({ 
  color = "teal", 
  size = "md",
  className 
}: { 
  color?: "teal" | "blue" | "emerald" | "amber" | "rose" | "purple" | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = 
    size === "sm" ? "w-16 h-16 blur-[30px]" :
    size === "lg" ? "w-32 h-32 blur-[60px]" :
    "w-20 h-20 blur-[40px]";

  const colorClasses = 
    color === "teal" ? "bg-nexus-teal" :
    color === "blue" ? "bg-nexus-blue" :
    color === "emerald" ? "bg-emerald-500" :
    color === "amber" ? "bg-amber-500" :
    color === "rose" ? "bg-rose-500" :
    color === "purple" ? "bg-purple-500" :
    color.startsWith("bg-") ? color : `bg-${color}`;

  return (
    <div 
      className={cn(
        "absolute -right-4 -top-4 rounded-full opacity-0 group-hover:opacity-15 transition-all duration-1000 pointer-events-none z-0",
        sizeClasses,
        colorClasses,
        className
      )} 
    />
  );
}

/* Master Metric Card - Shared across all pages */
export function MasterMetricCard({ 
  icon, 
  label, 
  value, 
  color, 
  neon, 
  onClick,
  compact = true,
  className
}: { 
  icon: any, 
  label: string, 
  value: string, 
  color: string, 
  neon?: string, 
  onClick?: () => void,
  compact?: boolean,
  className?: string
}) {
  const isEmerald = color.includes("emerald");
  const isCyan = color.includes("cyan");
  const isAmber = color.includes("amber");
  const isRose = color.includes("rose");
  const isTeal = color.includes("nexus-teal");
  const isBlue = color.includes("nexus-blue");
  const isDanger = color.includes("danger");
  const isWarning = color.includes("warning");
  
  const theme = {
    border: isEmerald ? "border-emerald-500/10 hover:border-emerald-500/30" :
            isCyan ? "border-cyan-500/10 hover:border-cyan-500/30" :
            isAmber ? "border-amber-500/10 hover:border-amber-500/30" :
            isRose ? "border-rose-500/10 hover:border-rose-500/30" :
            isTeal ? "border-nexus-teal/10 hover:border-nexus-teal/30" :
            isBlue ? "border-nexus-blue/10 hover:border-nexus-blue/30" :
            isDanger ? "border-danger/10 hover:border-danger/30" :
            isWarning ? "border-warning/10 hover:border-warning/30" :
            "border-white/5 hover:border-white/20",
    bgIcon: isEmerald ? "bg-emerald-500/20 text-emerald-400" :
            isCyan ? "bg-cyan-500/20 text-cyan-400" :
            isAmber ? "bg-amber-500/20 text-amber-400" :
            isRose ? "bg-rose-500/20 text-rose-400" :
            isTeal ? "bg-nexus-teal/20 text-nexus-teal" :
            isBlue ? "bg-nexus-blue/20 text-nexus-blue" :
            isDanger ? "bg-danger/20 text-danger" :
            isWarning ? "bg-warning/20 text-warning" :
            "bg-white/10 text-white/60",
    shadow: isEmerald ? "shadow-[0_0_20px_rgba(16,185,129,0.02)]" :
            isCyan ? "shadow-[0_0_20px_rgba(6,182,212,0.02)]" :
            isAmber ? "shadow-[0_0_20px_rgba(245,158,11,0.02)]" :
            isRose ? "shadow-[0_0_20px_rgba(244,63,94,0.02)]" :
            isTeal ? "shadow-[0_0_20px_rgba(0,255,209,0.02)]" :
            isBlue ? "shadow-[0_0_20px_rgba(0,102,255,0.02)]" :
            isDanger ? "shadow-[0_0_20px_rgba(255,77,79,0.02)]" :
            isWarning ? "shadow-[0_0_20px_rgba(255,197,61,0.02)]" :
            "shadow-none"
  };

  if (compact) {
    return (
      <div 
        className={cn(
          "group relative flex items-center gap-3 2xl:gap-5 p-4 2xl:p-5 rounded-2xl bg-surface-0/60 backdrop-blur-xl border overflow-hidden transition-all duration-500",
          "hover:bg-white/[0.04] shadow-lg",
          onClick && "cursor-pointer active:scale-95",
          theme.border,
          theme.shadow,
          neon ? neon.replace("shadow-neon-", "shadow-[0_0_15px_rgba(0,255,209,0.08)]_") : "",
          className
        )}
        onClick={onClick}
      >
        {/* Dynamic Background Glow */}
        <SignatureGlow color={color.replace('text-', '')} size="md" />

        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 border border-white/5",
          theme.bgIcon
        )}>
          {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-white/20 uppercase tracking-[0.1em] leading-tight break-words group-hover:text-white/40 transition-colors">{label}</p>
          <p className="text-xl 2xl:text-2xl font-black text-white mt-2 leading-none tracking-tight mono-numbers whitespace-nowrap">{value}</p>
        </div>
        
        {onClick && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
             <div className={cn("w-6 h-6 rounded-full flex items-center justify-center bg-white/5 text-white/20", color.replace('text-', 'hover:text-'))}>
                <ChevronLeft className="rotate-180" size={12} />
             </div>
          </div>
        )}
        
        {/* Scanline */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent h-[1px] w-full -translate-y-full group-hover:animate-[scanline_2.5s_linear_infinite] pointer-events-none" />
      </div>
    );
  }

  return (
    <div className={cn(
      "group relative p-8 rounded-[2rem] bg-surface-0/60 backdrop-blur-xl border border-white/5 overflow-hidden transition-all duration-700",
      "hover:bg-white/[0.04] hover:border-white/20 hover:-translate-y-1 shadow-2xl",
      onClick && "cursor-pointer active:scale-95",
      neon,
      className
    )} onClick={onClick}>
      {/* Dynamic Background Glow */}
      <SignatureGlow color={color.replace('text-', '')} size="lg" />
      
      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-6">
          <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center transition-all mb-6 border border-white/5",
          theme.bgIcon
        )}>
          {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
          <div className="space-y-1">
             <p className="text-[11px] font-semibold text-white/20 uppercase tracking-[0.2em] group-hover:text-white/40 transition-colors">{label}</p>
             <div className="text-3xl font-black text-white tracking-tighter flex items-baseline gap-1 mono-numbers">
               {value}
             </div>
          </div>
        </div>
        
        {onClick && (
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-700 translate-x-4 group-hover:translate-x-0">
             <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-white/20", color.replace('text-', 'hover:text-'))}>
                <ChevronLeft className="rotate-180" size={16} />
             </div>
          </div>
        )}
      </div>
      
      {/* Subtle Tactical Scanline */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.03] to-transparent h-[2px] w-full -translate-y-full group-hover:animate-[scanline_3s_linear_infinite] pointer-events-none" />
    </div>
  );
}


export function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-[1600px]" }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, maxWidth?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-6 animate-in fade-in duration-300 backdrop-blur-[2px]">
      {/* Absolute root backdrop covering EVERYTHING */}
      <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl" onClick={onClose} />
      
      <div className={cn(
        "relative w-full max-w-[95vw] h-[85vh] bg-surface-0 overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] rounded-2xl border border-white/10 flex flex-col z-[100001] animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-out",
        maxWidth
      )}>
        {/* Tactical Header */}
        <div className="h-20 flex items-center justify-between px-10 bg-surface-0/90 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-6">
             <div className="w-12 h-12 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shadow-neon-teal/20">
                <Sparkles size={24} />
             </div>
             <div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tight leading-none">{title}</h3>
                <p className="text-[12px] font-semibold text-nexus-teal/60 uppercase mt-2 tracking-[0.3em] leading-none">MASTER.STRATEGIC.V3.1_STRICT</p>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-12 h-12 flex items-center justify-center rounded-full bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/20 hover:bg-nexus-teal/30 hover:text-white transition-all shadow-[0_0_15px_rgba(0,255,209,0.1)]"
          >
            <X size={28} />
          </button>
        </div>

        {/* Operational Content Container - Ensures internal scrolling */}
        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function SlideOver({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )} 
        onClick={onClose} 
      />
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-[101] w-full max-w-md bg-surface-2 border-l border-white/10 shadow-2xl transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/5">
             <h3 className="tactical-label !text-white">{title}</h3>
             <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
               <X size={20} />
             </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
             {children}
          </div>
        </div>
      </div>
    </>
  );
}

export function Toast({ message, isVisible, onClose, type = "success" }: { message: string, isVisible: boolean, onClose: () => void, type?: "success" | "error" | "warning" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className={cn(
      "fixed bottom-10 right-10 z-[200000] flex items-center gap-4 px-8 py-5 rounded-2xl border backdrop-blur-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-10 zoom-in-95 duration-500 ease-out",
      type === "success" ? "bg-nexus-teal/20 border-nexus-teal/30 text-nexus-teal shadow-neon-teal/20" : 
      type === "error" ? "bg-danger/20 border-danger/30 text-danger" : 
      "bg-warning/20 border-warning/30 text-warning"
    )}>
      <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
      <span className="text-[14px] font-semibold uppercase tracking-widest">{message}</span>
      <button onClick={onClose} className="ml-4 p-1 bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/20 hover:bg-nexus-teal/30 hover:text-white rounded-full transition-all">
        <X size={14} />
      </button>
    </div>,
    document.body
  );
}
export function PillBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95 group"
    >
      <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
    </button>
  );
}

export function NexusDataField({ label, value, highlight = false, className, color }: { label: string, value: string, highlight?: boolean, className?: string, color?: string }) {
  return (
    <div className={cn("flex justify-between items-center py-3 border-b border-white/5 last:border-0", className)}>
       <span className="text-[12px] font-semibold text-white/20 uppercase tracking-widest">{label}</span>
       <span className={cn("text-[14px] font-black", highlight ? "text-nexus-teal drop-shadow-neon" : "text-white/80", color)}>{value}</span>
    </div>
  );
}



// --- CREATABLE COMBOBOX ---
export interface CreatableComboboxProps {
  value: string;
  onChange: (val: string) => void;
  options?: { value: string; label: string }[];
  allowCustom?: boolean;
  className?: string;
  placeholder?: string;
}

export function CreatableCombobox({
  value,
  onChange,
  options = [],
  allowCustom = false,
  className,
  placeholder = "Select or type..."
}: CreatableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (containerRef.current?.contains(t) || floatingRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || value || placeholder;

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) || 
    o.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className={cn(
          "h-9 w-full px-5 pr-10 rounded-full bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus-within:border-nexus-teal/40 focus-within:bg-white/[0.06] transition-all cursor-pointer flex items-center justify-between group backdrop-blur-sm",
          isOpen && "border-nexus-teal/40 bg-white/[0.06]",
          className
        )}
      >
        <span className={cn("truncate pr-2", !value && "text-white/40")}>{selectedLabel}</span>
        <ChevronDown 
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2 text-white/20 transition-all pointer-events-none",
            isOpen ? "rotate-180 text-nexus-teal" : "group-hover:text-nexus-teal"
          )} 
          size={14} 
        />
      </div>

      <FloatingLayer
        ref={floatingRef}
        anchorRef={containerRef}
        open={isOpen}
        maxHeight={300}
        className="bg-surface-0/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] p-1.5 flex flex-col gap-1"
      >
          <input 
            autoFocus
            type="text"
            className="w-full bg-black/40 border border-white/10 rounded-xl h-10 px-4 text-[13px] text-white focus:outline-none focus:border-nexus-teal/50 mb-1"
            placeholder="Search or type new..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {filteredOptions.length === 0 && search && allowCustom && (
            <div
              className="px-4 py-2.5 rounded-xl text-[13px] text-nexus-teal font-bold hover:bg-nexus-teal/10 cursor-pointer flex items-center gap-2"
              onClick={() => {
                onChange(search);
                setIsOpen(false);
              }}
            >
              <Plus size={14} /> Add "{search}"
            </div>
          )}
          {filteredOptions.map((opt, idx) => (
            <div
              key={idx}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[13px] text-white/70 hover:text-white hover:bg-white/5 cursor-pointer transition-all",
                value === opt.value && "bg-nexus-teal/10 text-nexus-teal font-bold"
              )}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
          {filteredOptions.length === 0 && (!search || !allowCustom) && (
            <div className="px-4 py-3 text-[13px] text-white/30 text-center">
              No results found
            </div>
          )}
      </FloatingLayer>
    </div>
  );
}

// --- NEXUS DATE PICKER ---
export function NexusDatePicker({ 
  className, 
  value, 
  onChange, 
  disabled,
  ...props 
}: { 
  className?: string, 
  value?: string, 
  onChange?: (e: { target: { value: string } }) => void,
  disabled?: boolean
}) {
  return (
    <input 
      type="date"
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      className={cn(
        "h-9 px-4 rounded-full bg-white/[0.03] border border-white/10 text-white text-[13px] font-bold focus:border-nexus-teal/40 focus:bg-white/[0.06] focus:outline-none transition-all placeholder:text-white/20",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props as any}
    />
  );
}


// [PSG-STANDARD-V3] Full Page Layout
export function NexusPageLayout({ header, leftContent, rightSidebar }: { header: React.ReactNode, leftContent: React.ReactNode, rightSidebar: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full bg-surface-0 p-4 sm:p-6 gap-6 min-h-screen overflow-x-hidden">
      {header}
      <div className="flex flex-col xl:flex-row gap-6 relative items-start">
        <div className="flex-1 w-full xl:w-[75%] min-w-0">
          {leftContent}
        </div>
        <div className="w-full xl:w-[25%] shrink-0 sticky top-[96px]">
          {rightSidebar}
        </div>
      </div>
    </div>
  );
}
