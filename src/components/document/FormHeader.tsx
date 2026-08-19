"use client";

import { useDocumentForm } from "@/context/DocumentFormContext";
import { NexusLabel } from "@/components/ui/NexusLabel";
import { PillInput } from "@/components/ui/Base";

export function FormHeader() {
  const { header, setHeader } = useDocumentForm();

  return (
    <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md grid grid-cols-12 gap-4">
      <div className="col-span-6">
        <NexusLabel labelTh="ชื่อลูกค้า" labelEn="Customer Name" required />
        <PillInput
          value={header.customerName}
          onChange={(e) => setHeader({ ...header, customerName: e.target.value })}
          placeholder="เลือกหรือค้นหาลูกค้า..."
        />
      </div>
      <div className="col-span-6">
        <NexusLabel labelTh="เลขที่เอกสาร" labelEn="Document No." required />
        <PillInput
          value={header.docNo}
          onChange={(e) => setHeader({ ...header, docNo: e.target.value })}
          className="font-mono"
          placeholder="NXI-2026-XXXX"
        />
      </div>
    </div>
  );
}
