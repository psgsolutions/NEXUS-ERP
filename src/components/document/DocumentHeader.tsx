"use client";

import React from "react";
import { NexusLabel } from "@/components/ui/NexusLabel";
import { PillInput } from "@/components/ui/Base";

interface DocumentHeaderProps {
  docNo: string;
  issueDate: string;
  dueDate: string;
  entityName: string;
  entityLabelTh?: string;
  entityLabelEn?: string;
  entityPlaceholder?: string;
  taxId?: string;
  branch?: string;
  taxMode?: "VAT_EXCLUDED" | "VAT_INCLUDED" | "NON_VAT";
  creditTerms?: string;
  onDocNoChange?: (val: string) => void;
  onIssueDateChange?: (val: string) => void;
  onDueDateChange?: (val: string) => void;
  onDeliveryDateChange?: (val: string) => void;
  onCreditTermsChange?: (val: string) => void;
  onEntitySelect?: () => void;
  onTaxModeChange?: (mode: "VAT_EXCLUDED" | "VAT_INCLUDED" | "NON_VAT") => void;
}

export function DocumentHeader({
  docNo = "QT-2026-08-001",
  issueDate = "",
  dueDate = "",
  entityName = "",
  entityLabelTh = "ชื่อลูกค้า",
  entityLabelEn = "Customer Name",
  entityPlaceholder = "ค้นหาหรือเลือกรายชื่อ...",
  taxId = "0105558000001",
  branch = "สำนักงานใหญ่ (00000)",
  taxMode = "VAT_EXCLUDED",
  creditTerms = "",
  onDocNoChange,
  onIssueDateChange,
  onDueDateChange,
  onDeliveryDateChange,
  onCreditTermsChange,
  onEntitySelect,
  onTaxModeChange,
}: DocumentHeaderProps) {
  return (
    <div className="grid grid-cols-10 gap-5 p-5 bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md shadow-lg">
      
      {/* ฝั่งซ้าย: ข้อมูลลูกค้า/ผู้ติดต่อ - 5 คอลัมน์ (50%) */}
      <div className="col-span-12 xl:col-span-5 space-y-4">
        <div>
          <NexusLabel labelTh={entityLabelTh} labelEn={entityLabelEn} required />
          <div className="flex gap-2">
            <PillInput
              value={entityName}
              readOnly
              placeholder={entityPlaceholder}
              className="flex-1 cursor-pointer bg-white/[0.03]"
              onClick={onEntitySelect}
            />
            <button
              type="button"
              onClick={onEntitySelect}
              className="h-9 px-5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 text-xs font-bold transition-all flex items-center justify-center shrink-0 not-italic"
            >
              เปลี่ยน
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <NexusLabel labelTh="เลขประจำตัวผู้เสียภาษี" labelEn="Tax ID" />
            <PillInput
              value={taxId}
              readOnly
              className="font-mono bg-black/20 text-white/70 tracking-tight"
            />
          </div>
          <div>
            <NexusLabel labelTh="สาขา" labelEn="Branch" />
            <PillInput
              value={branch}
              readOnly
              className="bg-black/20 text-white/70"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <NexusLabel labelTh="เงื่อนไขชำระเงิน" labelEn="Credit Terms" />
            <PillInput
              value={creditTerms}
              onChange={(e) => onCreditTermsChange?.(e.target.value)}
              placeholder="e.g., 30 Days"
              className="bg-white/[0.03]"
            />
          </div>
          <div>
            <NexusLabel labelTh="วันที่ส่งของ" labelEn="Delivery Date" />
            <PillInput
              type="date"
              onChange={(e) => onDeliveryDateChange?.(e.target.value)}
              className="font-mono bg-white/[0.03]"
            />
          </div>
        </div>
      </div>

      {/* ฝั่งขวา: ข้อมูลเอกสารและภาษี (Document & Tax Info) - 5 คอลัมน์ (50%) */}
      <div className="col-span-12 xl:col-span-5 space-y-4 border-t xl:border-t-0 xl:border-l border-white/10 pt-4 xl:pt-0 xl:pl-5">
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <NexusLabel labelTh="เลขที่เอกสาร" labelEn="Document No." required />
            <PillInput
              value={docNo}
              onChange={(e) => onDocNoChange?.(e.target.value)}
              className="font-mono tracking-tight text-cyan-400 font-bold bg-white/[0.04]"
              placeholder="QT-2608-XXXX"
            />
          </div>
          <div>
            <NexusLabel labelTh="วันที่ออกเอกสาร" labelEn="Issue Date" required />
            <PillInput
              type="date"
              value={issueDate}
              onChange={(e) => onIssueDateChange?.(e.target.value)}
              className="font-mono bg-white/[0.03]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <NexusLabel labelTh="วันที่ครบกำหนด" labelEn="Due Date" />
            <PillInput
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange?.(e.target.value)}
              className="font-mono bg-white/[0.03]"
            />
          </div>
          
          {/* รูปแบบภาษี (Tax Display Mode: [ ไม่มี VAT ] -> [ ก่อน VAT ] -> [ รวม VAT ]) */}
          <div>
            <NexusLabel labelTh="รูปแบบภาษี" labelEn="Tax Mode" required />
            <div className="flex bg-white/[0.03] border border-white/10 rounded-full p-1 h-9 items-center">
              <button
                type="button"
                onClick={() => onTaxModeChange?.("NON_VAT")}
                className={`flex-1 h-7 rounded-full text-xs font-bold transition-all not-italic ${
                  taxMode === "NON_VAT"
                    ? "bg-cyan-500 text-slate-900 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                ไม่มี VAT
              </button>
              <button
                type="button"
                onClick={() => onTaxModeChange?.("VAT_EXCLUDED")}
                className={`flex-1 h-7 rounded-full text-xs font-bold transition-all not-italic ${
                  taxMode === "VAT_EXCLUDED"
                    ? "bg-cyan-500 text-slate-900 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                ก่อน VAT
              </button>
              <button
                type="button"
                onClick={() => onTaxModeChange?.("VAT_INCLUDED")}
                className={`flex-1 h-7 rounded-full text-xs font-bold transition-all not-italic ${
                  taxMode === "VAT_INCLUDED"
                    ? "bg-cyan-500 text-slate-900 shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                รวม VAT
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
