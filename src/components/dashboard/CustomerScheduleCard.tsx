"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { GlassCard, NexusTable, NexusTableCell, NexusTableRow, cn } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { useCustomers } from "@/hooks/useCustomers";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { customerSchedule } from "@/lib/customer-doc-profile";

/**
 * รอบวางบิล / รับเงินของลูกค้า 30 วันข้างหน้า (ตามโปรไฟล์เอกสารลูกค้า) — สำหรับผู้ทำหน้าที่วางบิล/รับเงิน
 * แสดงเฉพาะลูกค้าที่ตั้งรอบไว้และมียอดค้าง
 */
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thaiShort = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

export function CustomerScheduleCard() {
  const router = useRouter();
  const { companyId } = useAuth();
  const { data: customers } = useCustomers();
  const { data: invoices } = useRealtimeCollection<any>(companyId ? `companies/${companyId}/invoices` : "");
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const events = useMemo(() => customerSchedule(customers as any[], invoices, today, 30), [customers, invoices, today]);
  const configured = (customers as any[]).some((c) => c.docProfile?.billingDay || c.docProfile?.paymentDay);

  return (
    <GlassCard accentColor="blue" className="p-4">
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-white mb-2"><CalendarClock size={17} className="text-nexus-blue" /> รอบวางบิล / รับเงิน 30 วันข้างหน้า</h3>
      {!events.length ? (
        <p className="text-[13px] text-white/55 py-2">
          {configured ? "ไม่มีนัดวางบิลหรือรับเงินที่มียอดค้างใน 30 วันนี้" : "ยังไม่มีลูกค้าที่ตั้งรอบวางบิล/รับเช็ค — ตั้งได้ที่ ข้อมูลลูกค้า › รูปแบบเอกสารของลูกค้ารายนี้"}
        </p>
      ) : (
        <NexusTable headers={["วันที่", "ลูกค้า", "นัด", "ยอดเงิน"]}>
          {events.slice(0, 12).map((e) => (
            <NexusTableRow key={`${e.kind}-${e.customerId}-${e.date}`} onClick={() => router.push(`/customers/${encodeURIComponent(e.customerId)}`)}>
              <NexusTableCell className={cn("font-mono", e.daysAway <= 2 ? "text-warning font-bold" : "text-white/70")}>{e.daysAway === 0 ? "วันนี้" : thaiShort(e.date)}</NexusTableCell>
              <NexusTableCell className="text-white/85" title={e.kind === "billing" && e.attachments.length ? `เอกสารแนบ: ${e.attachments.join(", ")}` : undefined}>{e.customerName}</NexusTableCell>
              <NexusTableCell><span className={cn("text-[12px] font-bold", e.kind === "billing" ? "text-nexus-blue" : "text-nexus-teal")}>{e.kind === "billing" ? `วางบิล ${e.invoiceCount} ใบ` : "รับเงิน/เช็ค"}</span></NexusTableCell>
              <NexusTableCell className="font-mono text-white">{money(e.kind === "billing" ? e.outstanding : e.dueTotal)}</NexusTableCell>
            </NexusTableRow>
          ))}
        </NexusTable>
      )}
    </GlassCard>
  );
}
