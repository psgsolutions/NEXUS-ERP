"use client";

import React, { useState } from "react";
import { GlassCard, PillButton, PillInput } from "@/components/ui/Base";
import { Camera, FileText, CheckCircle2, Sparkles, MapPin, Receipt } from "lucide-react";
import { analyzeExpenseOCR } from "@/lib/genkit";

/**
 * [COMMERCIAL-INTEL-V1.0]
 * Expense Scanner with AI Auto-Mapping
 * Inspired by Paypers logic for NEXUS ERP.
 */
export function ExpenseScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const handleScan = async () => {
    setIsScanning(true);
    // Simulate Image Upload and AI Analysis
    setTimeout(async () => {
      const result = await analyzeExpenseOCR("temp_url", { gps: "13.7563, 100.5018" });
      setScanResult(result);
      setIsScanning(false);
    }, 2000);
  };

  return (
    <GlassCard className="border-nexus-blue/20 overflow-visible">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-nexus-blue/10 text-nexus-blue">
              <Receipt size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Expense Intelligence</h3>
              <p className="text-[10px] text-white/40 uppercase font-bold">AI OCR & Project Mapping</p>
            </div>
          </div>
          <Sparkles size={16} className="text-nexus-blue animate-pulse" />
        </div>

        {!scanResult ? (
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
            <Camera size={40} className="text-white/10 mb-4" />
            <p className="text-xs text-white/40 mb-4">ถ่ายรูปใบเสร็จเพื่อวิเคราะห์อัตโนมัติ</p>
            <PillButton 
              onClick={handleScan}
              disabled={isScanning}
              className="px-8 shadow-neon-blue"
            >
              {isScanning ? "กำลังวิเคราะห์..." : "สแกนใบเสร็จ"}
            </PillButton>
          </div>
        ) : (
          <div className="space-y-4 animate-in zoom-in-95 duration-300">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-black mb-1">ยอดเงิน</p>
                <p className="text-xl font-black text-nexus-blue">฿{scanResult.amount.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-black mb-1">ร้านค้า</p>
                <p className="text-lg font-bold text-white leading-none">{scanResult.merchant}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-nexus-teal/5 border border-nexus-teal/20 relative overflow-hidden group">
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-nexus-teal shrink-0" />
                <div className="space-y-1">
                  <p className="text-[10px] text-nexus-teal uppercase font-black">AI Prediction: Project Link</p>
                  <p className="text-sm font-bold text-white">Mapping to: {scanResult.predictedProjectId}</p>
                  <p className="text-[11px] text-white/60 leading-tight">
                    {scanResult.reasoning}
                  </p>
                </div>
              </div>
              <CheckCircle2 size={40} className="absolute -bottom-2 -right-2 text-nexus-teal/10 rotate-12" />
            </div>

            <div className="flex gap-2">
              <PillButton variant="glass" className="flex-1" onClick={() => setScanResult(null)}>
                ยกเลิก
              </PillButton>
              <PillButton className="flex-1 shadow-neon-teal">
                ยืนยันการบันทึก
              </PillButton>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
