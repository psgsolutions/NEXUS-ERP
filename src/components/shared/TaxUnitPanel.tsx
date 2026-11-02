"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, Building2, ExternalLink, XCircle } from "lucide-react";
import { PillInput } from "@/components/ui/Base";
import { exactDuplicate, partyDocName, sameTaxIdRecords, taxIdProblem } from "@/lib/party-identity";

/**
 * ตรวจเลขผู้เสียภาษีขณะกรอก + หน่วยงานภายใต้เลขเดียวกัน (ใช้ในฟอร์มลูกค้า/ผู้ขาย)
 *  - เลขผิดสูตรตรวจ: เตือนทันที (บันทึกไม่ได้ที่ server)
 *  - เลขนี้มีอยู่แล้ว: แสดงทุกสาขา/หน่วยงานที่ใช้เลขนี้ ให้เปิดรายการเดิม หรือกรอกชื่อหน่วยงานถ้าเป็นหน่วยงานแยก
 *  - ชื่อบนใบกำกับภาษี: ตั้งได้ต่อหน่วยงาน (ว่าง = ชื่อ (หน่วยงาน))
 */
export function TaxUnitPanel({
  records, taxId, branchCode, unitName, taxInvoiceName, baseName, exceptId = "", hrefOf, disabled, onChange,
}: {
  records: Array<Record<string, any>>;
  taxId: string;
  branchCode: string;
  unitName: string;
  taxInvoiceName: string;
  baseName: string;
  exceptId?: string;
  hrefOf: (id: string) => string;
  disabled?: boolean;
  onChange: (v: { unitName: string; taxInvoiceName: string }) => void;
}) {
  const problem = taxIdProblem(taxId);
  const same = problem ? [] : sameTaxIdRecords(records, taxId, exceptId);
  const dup = exactDuplicate(same, branchCode, unitName);
  const preview = partyDocName({ name: baseName, unitName, taxInvoiceName });
  const branchLabel = (b: string) => (b === "00000" ? "สำนักงานใหญ่" : `สาขา ${b}`);

  return (
    <div className="space-y-3 w-full">
      {problem && (
        <p className="text-[12px] text-danger flex items-center gap-1.5"><XCircle size={13} /> {problem}</p>
      )}
      {same.length > 0 && (
        <div className={`rounded-xl border px-3 py-2.5 space-y-1.5 ${dup ? "border-danger/40 bg-danger/10" : "border-amber-500/30 bg-amber-500/10"}`}>
          <p className={`text-[12px] font-bold flex items-center gap-1.5 ${dup ? "text-danger" : "text-amber-300"}`}>
            <AlertTriangle size={13} />
            {dup ? "ซ้ำกับรายการที่มีอยู่ — ใช้รายการเดิม หรือถ้าเป็นหน่วยงานแยก ให้กรอกชื่อหน่วยงานด้านล่าง" : `เลขผู้เสียภาษีนี้ใช้อยู่แล้ว ${same.length} รายการ — ถ้าเป็นหน่วยงานเดียวกันให้ใช้รายการเดิม`}
          </p>
          {same.slice(0, 8).map((s) => (
            <Link key={s.id} href={hrefOf(s.id)} target="_blank" className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white rounded-lg px-1.5 py-0.5 hover:bg-white/5 min-w-0">
              <Building2 size={12} className="text-white/50 shrink-0" />
              <span className="truncate flex-1">{s.name}</span>
              <span className="text-[11px] text-white/60 shrink-0">{branchLabel(s.branchCode)}{s.unitName ? ` · ${s.unitName}` : " · หน่วยงานหลัก"}</span>
              <ExternalLink size={11} className="text-white/40 shrink-0" />
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1.5 block">
          <span className="block text-[12px] font-bold text-white/70">หน่วยงาน (ถ้ามี)</span>
          <PillInput value={unitName} disabled={disabled} onChange={(e) => onChange({ unitName: e.target.value, taxInvoiceName })} placeholder="เช่น สำนักงานเขตบางรัก · กองบิน 1 — ว่าง = หน่วยงานหลัก" className="w-full h-9" />
        </label>
        <label className="space-y-1.5 block">
          <span className="block text-[12px] font-bold text-white/70">ชื่อบนใบกำกับภาษี</span>
          <PillInput value={taxInvoiceName} disabled={disabled} onChange={(e) => onChange({ unitName, taxInvoiceName: e.target.value })} placeholder={preview || "ว่าง = ชื่อ (หน่วยงาน)"} className="w-full h-9" />
        </label>
      </div>
      {preview && <p className="text-[11px] text-white/60">พิมพ์บนเอกสารเป็น: <span className="text-white/85 font-semibold">{preview}</span></p>}
    </div>
  );
}
