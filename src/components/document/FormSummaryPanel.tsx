"use client";

import { useDocumentForm } from "@/context/DocumentFormContext";
import { NexusLabel } from "@/components/ui/NexusLabel";

export function FormSummaryPanel() {
  const { summary } = useDocumentForm();

  return (
    <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl sticky top-[96px]">
      <NexusLabel labelTh="สรุปยอดทางการเงิน" labelEn="Summary" />
      <div className="space-y-2 mt-3 text-[13px]">
        <div className="flex justify-between">
          <span className="text-white/60">รวมเป็นเงิน:</span>
          <span className="font-mono text-white text-right">
            ฿ {summary.subTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">ภาษีมูลค่าเพิ่ม (7%):</span>
          <span className="font-mono text-white text-right">
            ฿ {summary.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-nexus-teal text-[15px]">
          <span>ยอดชำระสุทธิ:</span>
          <span className="font-mono text-right">
            ฿ {summary.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
