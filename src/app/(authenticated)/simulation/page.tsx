"use client";

import React, { useState } from "react";
import { PillButton, GlassCard } from "@/components/ui/Base";
import { generateNextId } from "@/lib/idService";
import { db } from "@/lib/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { postToGL, ACCOUNTS } from "@/lib/financeEngine";
import { Beaker, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function SimulationPage() {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [resultId, setResultId] = useState("");

  const addLog = (msg: string) => setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runSimulation = async () => {
    setStatus("running");
    setLog([]);
    const companyId = "nexus-global-node"; // Mock Company ID

    try {
      // 1. Generate Atomic ID
      addLog("กำลังรันเลข SKU อัตโนมัติผ่าน idService...");
      const nextSku = await generateNextId(companyId, "SKU");
      setResultId(nextSku);
      addLog(`ได้รับรหัสพัสดุ: ${nextSku}`);

      // 2. Prepare Product Data
      const productId = `prod_${Date.now()}`;
      const productData = {
        product_id: productId,
        sku: nextSku,
        name: "NEXUS Core Switch G1 (Simulation)",
        category_id: "Network",
        currentQty: 10,
        stock_status: {
          qty_on_hand: 10,
          qty_reserved: 0,
          qty_available: 10
        },
        pricing: {
          avg_cost: 15000,
          price_pos: 25000,
          price_project: 22000
        },
        company_id: companyId,
        createdAt: Timestamp.now()
      };

      // 3. Save to Firestore
      addLog("กำลังบันทึกข้อมูลพัสดุลงในคลังสินค้า...");
      await setDoc(doc(db, "products", productId), productData);
      addLog("บันทึกพัสดุสำเร็จ!");

      // 4. Automated Double-Entry GL Posting
      addLog("กำลังลงบัญชีคู่ (Double-Entry) อัตโนมัติ...");
      const totalCost = 10 * 15000;
      await postToGL(companyId, {
        description: `ยอดยกมาเริ่มต้น: ${productData.name}`,
        reference: nextSku,
        items: [
          { ...ACCOUNTS.INVENTORY, debit: totalCost, credit: 0 },
          { ...ACCOUNTS.CASH, debit: 0, credit: totalCost }
        ]
      });
      addLog("ลงบัญชีสมุดรายวันกลางสำเร็จ! (Debit Inventory, Credit Cash)");

      setStatus("success");
    } catch (error: any) {
      console.error(error);
      addLog(`ERROR: ${error.message}`);
      setStatus("error");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
      <header className="mb-10 text-center">
        <div className="w-16 h-16 bg-nexus-blue/10 rounded-3xl flex items-center justify-center text-nexus-blue mx-auto mb-4 border border-nexus-blue/20">
          <Beaker size={32} />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">NEXUS Simulation Lab</h1>
        <p className="text-white/40 mt-2">ทดสอบความเสถียรของระบบ ID Service, Inventory และ Finance Engine</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="md:col-span-1 flex flex-col items-center justify-center p-8 space-y-6">
          <p className="text-center text-sm text-white/60">กดปุ่มด้านล่างเพื่อเริ่มการจำลองการบันทึกข้อมูลพัสดุชิ้นแรก</p>
          <PillButton 
            onClick={runSimulation} 
            disabled={status === "running"}
            className="w-full h-12 text-lg shadow-nexus-glow"
          >
            {status === "running" ? <Loader2 className="animate-spin" /> : "Start Simulation"}
          </PillButton>
          
          {status === "success" && (
            <div className="flex flex-col items-center gap-2 text-nexus-teal animate-in zoom-in">
              <CheckCircle2 size={48} />
              <p className="font-bold">เสร็จสมบูรณ์</p>
              <p className="text-xs font-mono">{resultId}</p>
            </div>
          )}
        </GlassCard>

        <GlassCard className="md:col-span-2 bg-black/60 p-0 overflow-hidden flex flex-col h-[400px]">
          <div className="p-3 bg-white/5 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40 flex justify-between">
            <span>System Console Output</span>
            <span>NEXUS-OS v2.9</span>
          </div>
          <div className="flex-1 p-4 font-mono text-xs space-y-2 overflow-y-auto">
            {log.length === 0 && <p className="text-white/10 italic">Ready to simulate...</p>}
            {log.map((line, i) => (
              <p key={i} className={line.includes("ERROR") ? "text-danger" : "text-nexus-blue"}>
                {line}
              </p>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
