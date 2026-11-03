"use client";

import React, { useMemo } from "react";
import { SmartSelect } from "@/components/ui/SmartComponents";
import { mergeChoices } from "@/lib/choices";

/**
 * ช่องข้อความที่มีรายการให้เลือก และพิมพ์ค่าใหม่เองได้ (เช่น ชื่อธนาคาร ตำแหน่ง แผนก เงื่อนไขชำระ)
 * ค่าปัจจุบันที่ไม่อยู่ในรายการยังแสดงและเลือกได้เสมอ
 */
export function ChoiceInput({ value, onChange, options, placeholder = "เลือกหรือพิมพ์เพิ่มเอง", disabled, className }: {
  value: string;
  onChange: (value: string) => void;
  options: Array<string | undefined | null>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const list = useMemo(() => mergeChoices(options, [value]).map((v) => ({ value: v, label: v })), [options, value]);
  return <SmartSelect options={list} value={value || ""} onChange={onChange} allowCustom placeholder={placeholder} disabled={disabled} className={className} />;
}
