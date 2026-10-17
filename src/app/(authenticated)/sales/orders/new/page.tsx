"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, Building2, Calendar, Percent, Plus, MapPin, Paperclip, AlertTriangle, ShieldCheck } from "lucide-react";
import { PillButton, PillSelect, cn, NexusDatePicker, GlassCard } from "@/components/ui/Base";
import { DocumentItemsTable } from "@/components/commerce/DocumentItemsTable";
import { formatCurrency } from "@/lib/erp-logic";
import NexusPageLayout from "@/components/layout/NexusPageLayout";
import { DocumentStepper } from "@/components/ui/DocumentStepper";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useCustomers } from "@/hooks/useCustomers";
import { apiFetch } from "@/lib/api-client";
import { db } from "@/lib/firebase-client";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type TaxType = "exclusive" | "inclusive" | "none";

const VAT_TYPE_LABEL: Record<TaxType, string> = {
  exclusive: "Exclude VAT",
  inclusive: "Include VAT",
  none: "Non-VAT",
};

const customerName = (c: any) => c?.name || c?.customerName || c?.companyName || "-";
const customerAddress = (c: any) => {
  if (!c) return "";
  if (typeof c.address === "string") return c.address;
  if (c.address?.billing) return c.address.billing;
  return [c.addressNo, c.soi, c.road, c.subDistrict, c.district, c.province, c.zipCode].filter(Boolean).join(" ");
};

export default function SalesOrderPage() {
  const router = useRouter();
  const { user, companyId } = useAuth();

  // ข้อมูลจริงของบริษัท
  const { data: customers, loading: customersLoading } = useCustomers<any>();
  const { data: projects } = useRealtimeCollection<any>(`companies/${companyId}/projects`);
  const { data: invoices } = useRealtimeCollection<any>(`companies/${companyId}/invoices`);

  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [taxType, setTaxType] = useState<TaxType>("exclusive");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
  const [isSameAsBilling, setIsSameAsBilling] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [projectId, setProjectId] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("30"); // days
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const customer = customers.find((c: any) => c.id === selectedCustomerId);
  const billingAddress = customerAddress(customer);

  // คำนวณยอดจากรายการ (ฟิลด์ qty / price / discountType / discountValue ของ DocumentItemsTable)
  const summary = useMemo(() => {
    const lines = items.filter((it) => it.itemType !== "GROUP_HEADER");
    const subtotal = lines.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const discount = lines.reduce((acc, it) => {
      const lineSub = (Number(it.qty) || 0) * (Number(it.price) || 0);
      const val = Number(it.discountValue) || 0;
      return acc + (it.discountType === "PERCENT" ? lineSub * (val / 100) : val);
    }, 0);
    const afterDiscount = Math.max(0, subtotal - discount);
    let vat = 0;
    let preVat = afterDiscount;
    let grandTotal = afterDiscount;
    if (taxType === "exclusive") {
      vat = afterDiscount * 0.07;
      grandTotal = afterDiscount + vat;
    } else if (taxType === "inclusive") {
      preVat = afterDiscount / 1.07;
      vat = afterDiscount - preVat;
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return { subtotal: round(subtotal), discount: round(discount), preVat: round(preVat), vat: round(vat), grandTotal: round(grandTotal) };
  }, [items, taxType]);

  // วงเงินเครดิต: วงเงินจากข้อมูลลูกค้า, ยอดค้าง = ใบแจ้งหนี้ที่ยังไม่ชำระของลูกค้ารายนี้
  const creditLimit = Number(customer?.creditLimit ?? customer?.credit_limit ?? 0);
  const hasCreditLimit = creditLimit > 0;
  const currentBalance = useMemo(() => {
    if (!customer) return 0;
    return invoices
      .filter((inv: any) => (inv.customerId === customer.id || inv.customerId === customer.customerId) && inv.paymentStatus !== "paid" && inv.status !== "Paid")
      .reduce((sum: number, inv: any) => sum + Number(inv.grandTotal || inv.totalAmount || 0), 0);
  }, [invoices, customer]);
  const creditRemaining = creditLimit - currentBalance;
  const isCreditExceeded = hasCreditLimit && summary.grandTotal > creditRemaining;

  const saveOrder = async (status: "Draft" | "Confirmed") => {
    setError("");
    if (!companyId) return setError("ไม่พบรหัสบริษัทของผู้ใช้");
    if (!customer) return setError("กรุณาเลือกลูกค้า");
    const lines = items.filter((it) => it.itemType !== "GROUP_HEADER" && (Number(it.qty) || 0) > 0);
    if (lines.length === 0) return setError("กรุณาเพิ่มรายการสินค้าหรือบริการอย่างน้อย 1 รายการ");
    if (status === "Confirmed" && isCreditExceeded) return setError("ยอดเกินวงเงินเครดิตคงเหลือ ไม่สามารถอนุมัติได้ (บันทึกเป็นร่างได้)");

    setSaving(true);
    try {
      // บันทึกที่ server: เลข SO ไม่ข้าม คำนวณยอดซ้ำ และตรวจวงเงินเครดิตจากยอดค้างจริง
      const res = await apiFetch("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, status, items: lines, header: { customerId: customer.id, docDate, projectId: projectId || "", paymentTermDays: Number(paymentTerm), vatType: VAT_TYPE_LABEL[taxType], billingAddress, deliveryAddress: isSameAsBilling ? billingAddress : deliveryAddress } }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      const soId = data.soId;
      router.push(`/sales/orders/${soId}`);
    } catch (err: any) {
      console.error("[SO_SAVE_ERROR]", err);
      setError(err?.message || "บันทึกใบสั่งขายไม่สำเร็จ");
      setSaving(false);
    }
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center">
          <ArrowLeft size={20} />
        </PillButton>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-tight">สร้างใบสั่งขายใหม่</h1>
            <span className="px-3 py-1 rounded-full bg-nexus-teal/10 border border-nexus-teal/30 text-nexus-teal text-sm font-mono font-bold select-none cursor-default pointer-events-none">
              ออกเลขเมื่อบันทึก
            </span>
          </div>
          <p className="text-sm text-white/60 font-medium mt-1">สร้างใบสั่งขาย ระบุรายการสินค้า บริการ และเงื่อนไขการส่งมอบ</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
        <DocumentStepper steps={["ร่าง", "อนุมัติแล้ว"]} currentStep={0} />
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/50" onClick={() => router.back()} disabled={saving}>
          ยกเลิก
        </PillButton>
        <PillButton variant="glass" className="h-8 px-4 text-xs font-bold text-white/80" onClick={() => saveOrder("Draft")} disabled={saving}>
          <Save size={14} className="mr-1.5" /> {saving ? "กำลังบันทึก..." : "บันทึกร่าง"}
        </PillButton>
        <PillButton variant="confirm" className="h-8 px-5 font-bold text-xs" onClick={() => saveOrder("Confirmed")} disabled={saving || isCreditExceeded}>
          <Send size={14} className="mr-1.5" /> บันทึกและอนุมัติ
        </PillButton>
      </div>
      {error && (
        <div className="w-full sm:basis-full p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[12px] text-red-400 font-bold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
    </div>
  );

  const leftContent = (
    <div className="space-y-6 pr-2 pb-10">

      <div className="flex flex-col gap-6">
        {/* Customer Column */}
        <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-teal hover:border-white/25">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
            <Building2 size={16} className="text-nexus-teal" /> ข้อมูลลูกค้า
          </h3>

          <div className="space-y-4 relative">
            <Field label="ชื่อลูกค้า *">
              <div className="relative w-full">
                <div
                  onClick={() => setIsCustomerSelectorOpen(!isCustomerSelectorOpen)}
                  className="w-full h-9 bg-white/[0.02] rounded-full px-6 flex items-center justify-between cursor-pointer hover:border-cyan-500/50 transition-all group"
                >
                  <span className={cn("text-[13px] font-bold", customer ? "text-white" : "text-white/30")}>
                    {customer ? customerName(customer) : customersLoading ? "กำลังโหลดรายชื่อลูกค้า..." : "เลือกลูกค้า"}
                  </span>
                  <Plus size={16} className="text-white/30 group-hover:text-cyan-400 transition-all" />
                </div>

                {isCustomerSelectorOpen && (
                  <div className="absolute top-11 left-0 w-full max-h-80 overflow-y-auto bg-surface-2 border border-white/10 rounded-xl shadow-2xl p-2 z-50">
                    {customers.length === 0 && !customersLoading && (
                      <p className="p-3 text-[12px] text-white/40">ยังไม่มีข้อมูลลูกค้าในบริษัทนี้</p>
                    )}
                    {customers.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setIsCustomerSelectorOpen(false);
                        }}
                        className="p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all"
                      >
                        <p className="text-[13px] font-bold text-white">{customerName(c)}</p>
                        <p className="text-[10px] text-white/30 mt-1 font-mono">{c.taxId || "-"} • <span className="font-sans">{customerAddress(c) || "-"}</span></p>
                      </div>
                    ))}
                    <div
                      onClick={() => router.push("/customers/new")}
                      className="p-3 mt-2 border-t border-white/5 hover:bg-cyan-500/10 rounded-lg cursor-pointer text-cyan-400 flex items-center gap-2"
                    >
                      <Plus size={14} /> <span className="text-[13px] font-bold">เพิ่มลูกค้าใหม่...</span>
                    </div>
                  </div>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <Field label="ที่อยู่สำหรับออกบิล (Billing Address)">
                  <div className="flex items-center gap-2 mb-2">
                     <MapPin size={14} className="text-white/40" />
                     {customer && (
                       <span className="text-[11px] text-white/40">สาขา {customer.branch || customer.branchCode || "00000"}</span>
                     )}
                  </div>
                  <p className="text-[13px] font-bold text-white/60 min-h-[40px] leading-relaxed">
                    {customer ? (billingAddress || "ไม่มีข้อมูลที่อยู่ของลูกค้ารายนี้") : "-"}
                  </p>
                </Field>
              </div>
              <div className="space-y-3 border-l border-white/5 pl-6">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <MapPin size={12} className="text-cyan-400" /> สถานที่ส่งมอบ / หน้างาน
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[10px] text-cyan-400/80 hover:text-cyan-400">
                    <input
                      type="checkbox"
                      checked={isSameAsBilling}
                      onChange={e => setIsSameAsBilling(e.target.checked)}
                      className="w-3 h-3 rounded-sm border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                    />
                    [ 📍 ใช้ที่อยู่เดียวกับที่อยู่ออกบิล ]
                  </label>
                </div>
                {!isSameAsBilling ? (
                  <textarea
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="ระบุสถานที่จัดส่งหรือไซต์งาน..."
                    className="w-full h-24 p-3 text-[13px] bg-white/[0.02] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                  />
                ) : (
                  <p className="text-[13px] font-bold text-white/30">
                    {billingAddress || "-"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dates & Tax & Terms Column */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-nexus-blue hover:border-white/25">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
              <Calendar size={16} className="text-nexus-blue" /> เงื่อนไขและโครงการ
            </h3>
            <div className="space-y-4">
              <Field label="วันที่ออก *">
                <NexusDatePicker value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="เงื่อนไขการชำระเงิน">
                  <PillSelect value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold">
                    <option value="0">เงินสด (Cash)</option>
                    <option value="15">เครดิต 15 วัน</option>
                    <option value="30">เครดิต 30 วัน</option>
                    <option value="45">เครดิต 45 วัน</option>
                    <option value="60">เครดิต 60 วัน</option>
                  </PillSelect>
                </Field>
                <Field label="โครงการ / Cost Center">
                  <PillSelect value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold">
                    <option value="">-- ไม่ระบุโครงการ --</option>
                    {projects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.projectId || p.id} - {p.title || p.name || p.projectName || "-"}</option>
                    ))}
                  </PillSelect>
                </Field>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-purple-500 hover:border-white/25">
            <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
              <Percent size={16} className="text-purple-400" /> ข้อมูลราคาและภาษี
            </h3>
            <div className="space-y-4">
              <Field label="ประเภทราคา *">
                <PillSelect value={taxType} onChange={(e) => setTaxType(e.target.value as TaxType)} className="w-full h-9 rounded-full px-6 bg-white/[0.02] text-[13px] font-bold">
                  <option value="exclusive">แยกภาษี (Exclusive)</option>
                  <option value="inclusive">รวมภาษี (Inclusive)</option>
                  <option value="none">ไม่มีภาษี</option>
                </PillSelect>
              </Field>
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">สกุลเงินเอกสาร</p>
                  <p className="text-[13px] text-white font-bold mt-1">THB - บาทไทย</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">อัตราแลกเปลี่ยน</p>
                  <p className="text-[13px] text-white font-mono mt-1">1.00000</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-emerald-500 hover:border-white/25">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
            รายการสินค้า / บริการ
          </h3>

          <DocumentItemsTable
            items={items}
            onChange={setItems}
          />
        </div>

        {/* Attachments: ยังไม่มี Firebase Storage จึงยังแนบไฟล์จริงไม่ได้ */}
        <div className="bg-neutral-900/90 border border-white/15 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 border-l-4 border-l-amber-500">
          <h3 className="text-[13px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2 border-b border-white/10 pb-4">
            <Paperclip size={16} className="text-amber-400" /> เอกสารแนบ (Attachments)
          </h3>
          <div className="w-full py-6 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-white/30 bg-black/30">
            <Paperclip size={20} className="mb-2 opacity-30" />
            <p className="text-[12px] font-bold">ยังไม่รองรับการแนบไฟล์ (รอตั้งค่าพื้นที่เก็บไฟล์ Firebase Storage)</p>
          </div>
        </div>

      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-4 h-fit pb-10">

      {/* Credit Limit Checking Card */}
      <GlassCard className={cn(
        "p-5 border-white/15 rounded-3xl shadow-2xl w-full flex flex-col gap-3 transition-colors border-t-4 border-t-nexus-teal",
        isCreditExceeded ? "bg-red-500/10 border-red-500/30" : "bg-neutral-900/90"
      )}>
        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/40">วงเงินเครดิต (Credit Limit)</span>
          {!customer ? null : isCreditExceeded ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">
              <AlertTriangle size={12} /> เกินวงเงิน
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
              <ShieldCheck size={12} /> อนุมัติได้
            </span>
          )}
        </div>
        {!customer ? (
          <p className="text-[12px] text-white/40">เลือกลูกค้าเพื่อตรวจสอบวงเงิน</p>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-white/60 font-bold">วงเงินที่ได้รับ:</span>
              <span className="text-white font-mono font-bold">{hasCreditLimit ? formatCurrency(creditLimit) : "ไม่ได้กำหนด"}</span>
            </div>
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-white/60 font-bold">ยอดใบแจ้งหนี้ค้างชำระ:</span>
              <span className="text-white font-mono font-bold">{formatCurrency(currentBalance)}</span>
            </div>
            {hasCreditLimit && (
              <div className="flex justify-between items-center text-[12px] pt-2 border-t border-white/5">
                <span className={cn("font-black uppercase tracking-widest", isCreditExceeded ? "text-red-400" : "text-emerald-400")}>วงเงินคงเหลือ:</span>
                <span className={cn("font-mono font-black", isCreditExceeded ? "text-red-400" : "text-emerald-400")}>
                  {formatCurrency(creditRemaining)}
                </span>
              </div>
            )}
          </div>
        )}
        {isCreditExceeded && (
          <div className="mt-2 p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-[11px] text-red-400 font-bold leading-relaxed">
            ยอดเงินคงเหลือไม่เพียงพอสำหรับการเปิดใบสั่งขายนี้ กรุณาติดต่อฝ่ายสินเชื่อเพื่อขออนุมัติวงเงินชั่วคราว
          </div>
        )}
      </GlassCard>

      {/* Summary Card */}
      <GlassCard className="p-6 border-white/5 rounded-3xl bg-surface-1 shadow-2xl space-y-4 w-full">
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">มูลค่ารวม (Subtotal)</span>
          <span className="text-white font-mono font-bold">{formatCurrency(summary.subtotal)} บาท</span>
        </div>
        {summary.discount > 0 && (
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-cyan-400/70 font-bold uppercase tracking-widest text-[11px]">ส่วนลดรวม (Total Discount)</span>
            <span className="text-cyan-400 font-mono font-bold">-{formatCurrency(summary.discount)} บาท</span>
          </div>
        )}
        {taxType !== "none" && (
          <div className="flex justify-between items-center text-[13px] border-t border-white/5 pt-4">
            <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">มูลค่าก่อนภาษี (Pre-VAT)</span>
            <span className="text-white font-mono font-bold">{formatCurrency(summary.preVat)} บาท</span>
          </div>
        )}
        {taxType !== "none" && (
          <div className="flex justify-between items-center text-[13px] pb-4 border-b border-white/5">
            <span className="text-white/40 font-bold uppercase tracking-widest text-[11px]">ภาษีมูลค่าเพิ่ม 7% (VAT)</span>
            <span className="text-white font-mono font-bold">{formatCurrency(summary.vat)} บาท</span>
          </div>
        )}
        <div className="flex justify-between items-end pt-4">
          <span className="text-[12px] font-semibold text-white/70 uppercase tracking-widest">จำนวนเงินทั้งสิ้น</span>
          <span className={cn(
            "text-3xl font-black font-mono tracking-tighter",
            isCreditExceeded ? "text-red-400" : "text-cyan-400"
          )}>
            {formatCurrency(summary.grandTotal)} <span className="text-[14px]">THB</span>
          </span>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebar}
    />
  );
}

function Field({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) {
  const cleanLabel = label.replace('*', '').trim();
  const hasAsterisk = required || label.includes('*');
  const parts = cleanLabel.split(' (');
  const thaiText = parts[0];
  const engText = parts.length > 1 ? '(' + parts[1] : '';

  return (
    <div className="space-y-2 w-full flex flex-col items-start justify-center">
      <label className="text-[12px] font-bold text-white/70 flex flex-wrap items-center gap-1 ml-1">
        <span className="flex items-center">
          {thaiText}
          {hasAsterisk && <span className="text-danger ml-1 font-bold">*</span>}
        </span>
        {engText && <span className="text-white/40 font-normal uppercase tracking-widest text-[10px]">{engText}</span>}
      </label>
      {children}
    </div>
  );
}
