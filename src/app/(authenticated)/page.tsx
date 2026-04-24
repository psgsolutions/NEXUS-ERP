"use client";

import { GlassCard, PillButton } from "@/components/ui/Base";
import { 
  BrainCircuit,
  Cpu
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#09090b]/40 backdrop-blur-sm h-full">
      {/* Dashboard Content - L1 Real-time Metrics [Blueprint] */}
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white">แผงควบคุมอัจฉริยะ</h1>
          <p className="text-white/40 text-sm">ข้อมูลสรุปการปฏิบัติงานแบบ Real-time</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <GlassCard className="border-l-4 border-l-nexus-blue">
            <h3 className="text-white/50 text-sm mb-2">ยอดขายวันนี้</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold mono-numbers text-white">45,200</span>
              <span className="text-nexus-blue text-xs mb-1">บาท</span>
            </div>
          </GlassCard>

          <GlassCard className="border-l-4 border-l-nexus-teal">
            <h3 className="text-white/50 text-sm mb-2">อัตรากำไรโครงการ</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold mono-numbers text-white">32.5</span>
              <span className="text-nexus-teal text-xs mb-1">%</span>
            </div>
          </GlassCard>

          <GlassCard className="border-l-4 border-l-warning">
            <h3 className="text-white/50 text-sm mb-2">จุดสั่งซื้อ (Reorder)</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold mono-numbers text-white">12</span>
              <span className="text-warning text-xs mb-1">SKU</span>
            </div>
          </GlassCard>

          <GlassCard className="border-l-4 border-l-danger">
            <h3 className="text-white/50 text-sm mb-2">พัสดุใกล้หมด</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold mono-numbers text-white">5</span>
              <span className="text-danger text-xs mb-1">รายการ</span>
            </div>
          </GlassCard>
        </section>

        {/* AI Intelligence Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BrainCircuit className="text-nexus-teal" size={20} />
              NEXUS Brain: Intelligent Optimization
            </h2>
            <PillButton variant="glass" className="gap-2 border-nexus-teal/30 text-nexus-teal h-8 text-xs">
              <Cpu size={14} />
              วิเคราะห์สต็อกด้วย AI
            </PillButton>
          </div>

          <GlassCard className="bg-nexus-teal/5 border-nexus-teal/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-nexus-teal/5 blur-3xl -z-10" />
            <div className="space-y-4">
              <p className="text-nexus-teal font-bold text-sm">การพยากรณ์ความเสี่ยงและโอกาส</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-white/70 text-sm leading-relaxed">
                    "วิเคราะห์พบว่า Switch รุ่น <span className="text-nexus-blue">NEX-Core-G1</span> จะขาดตลาดภายใน 2 เดือนข้างหน้า แนะนำให้สำรองเพิ่ม 20% เพื่อรองรับโครงการโรงพยาบาลภูมิพลฯ"
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-white/70 text-sm leading-relaxed">
                    "ต้นทุนแรงงานในโปรเจกต์ติดตั้ง Network เดือนพฤษภาคม มีแนวโน้มสูงกว่าเป้าหมาย 5.2% แนะนำให้ปรับแผนการจัดสรรทรัพยากรใหม่"
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>
      </div>
    </div>
  );
}
