"use client";

import React from "react";
import Link from "next/link";
import { PillInput, PillSelect } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";

/** บัญชีธนาคาร + ข้อมูลเช็คของเอกสารรับ/จ่ายเงิน (ใช้ในใบเสร็จ ใบสำคัญจ่าย และคืนเงินลูกค้า) */
export interface BankValue { bankAccountId: string; bankAccount: string; chequeNo: string; chequeDate: string; chequeBank: string }
export const emptyBank = (): BankValue => ({ bankAccountId: "", bankAccount: "", chequeNo: "", chequeDate: "", chequeBank: "" });

/** ตรวจก่อนส่ง: คืนข้อความผิดพลาด หรือ "" ถ้าครบ */
export function bankError(method: string, v: BankValue, purpose: string): string {
  if (method === "CASH") return "";
  if (!v.bankAccountId && !v.bankAccount.trim()) return `กรุณาเลือกบัญชีธนาคารที่${purpose}`;
  if (method === "CHEQUE" && !v.chequeNo.trim()) return "กรุณาระบุเลขที่เช็ค";
  if (method === "CHEQUE" && !v.chequeDate) return "กรุณาระบุวันที่หน้าเช็ค";
  return "";
}

export function bankPayload(method: string, v: BankValue) {
  if (method === "CASH") return {};
  return {
    bankAccountId: v.bankAccountId, bankAccount: v.bankAccount,
    ...(method === "CHEQUE" ? { chequeNo: v.chequeNo.trim(), chequeDate: v.chequeDate, chequeBank: v.chequeBank.trim() } : {}),
  };
}

const Label = ({ children }: { children: React.ReactNode }) => <label className="text-[12px] font-bold text-white/70 ml-1">{children}</label>;

export function BankPaymentFields({ method, value, onChange, purpose, chequeIncoming }: {
  method: string; value: BankValue; onChange: (v: BankValue) => void;
  /** เช่น "รับเงิน" / "จ่ายเงิน" / "คืนเงิน" */
  purpose: string;
  /** เช็ครับจากลูกค้า: ระบุธนาคารผู้ออกเช็ค */
  chequeIncoming?: boolean;
}) {
  const { companyId } = useAuth();
  const { data: accounts } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/bank_accounts` : "");
  if (method === "CASH") return null;
  const active = accounts.filter((a: any) => a.active !== false).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), "th"));
  const set = (patch: Partial<BankValue>) => onChange({ ...value, ...patch });

  return (
    <>
      <div className="space-y-1">
        <Label>บัญชีธนาคารที่{purpose} <span className="text-danger">*</span></Label>
        {active.length > 0 ? (
          <PillSelect value={value.bankAccountId} onChange={(e) => set({ bankAccountId: e.target.value, bankAccount: "" })} className="w-full h-9 text-sm">
            <option value="">เลือกบัญชีธนาคาร...</option>
            {active.map((a: any) => <option key={a.id} value={a.id}>{a.name} {a.accountNo}</option>)}
          </PillSelect>
        ) : (
          <>
            <PillInput value={value.bankAccount} onChange={(e) => set({ bankAccount: e.target.value, bankAccountId: "" })} placeholder="เช่น กสิกรไทย 123-4-56789-0" className="w-full h-9 text-sm" />
            <p className="text-[11px] text-white/40 ml-1">ยังไม่มีทะเบียนบัญชีธนาคาร · <Link href="/finance/subledgers?tab=bank" className="text-nexus-teal hover:underline">เพิ่มบัญชีธนาคาร</Link> เพื่อให้สมุดเงินฝากแยกตามบัญชีได้</p>
          </>
        )}
      </div>
      {method === "CHEQUE" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:col-span-2">
          <div className="space-y-1">
            <Label>เลขที่เช็ค <span className="text-danger">*</span></Label>
            <PillInput value={value.chequeNo} onChange={(e) => set({ chequeNo: e.target.value })} className="w-full h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label>วันที่หน้าเช็ค <span className="text-danger">*</span></Label>
            <PillInput type="date" value={value.chequeDate} onChange={(e) => set({ chequeDate: e.target.value })} className="w-full h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label>{chequeIncoming ? "ธนาคารผู้ออกเช็ค" : "ธนาคาร/สาขาของเช็ค"}</Label>
            <PillInput value={value.chequeBank} onChange={(e) => set({ chequeBank: e.target.value })} placeholder={chequeIncoming ? "เช่น ไทยพาณิชย์ สาขาสีลม" : "ถ้ามี"} className="w-full h-9 text-sm" />
          </div>
        </div>
      )}
    </>
  );
}
