import React from "react";
import { cn } from "@/lib/utils";

interface NexusLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  labelTh: string;               // ข้อความภาษาไทย (เช่น "ชื่อลูกค้า")
  labelEn?: string;              // ข้อความภาษาอังกฤษ (เช่น "Customer Name")
  required?: boolean;            // บังคับกรอกหรือไม่
  className?: string;
}

export function NexusLabel({
  labelTh,
  labelEn,
  required = false,
  className,
  children,
  ...props
}: NexusLabelProps) {
  return (
    <label
      className={cn(
        "block text-[12px] font-bold text-white/70 mb-1.5 select-none not-italic",
        className
      )}
      {...props}
    >
      <span>{labelTh}</span>
      {required && <span className="text-red-400 font-bold ml-0.5">*</span>}
      {labelEn && (
        <span className="text-white/40 font-normal text-[11px] ml-1">
          ({labelEn})
        </span>
      )}
      {children}
    </label>
  );
}
