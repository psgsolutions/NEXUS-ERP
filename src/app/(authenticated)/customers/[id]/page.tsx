"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileCog, Lock, Save, UserRound } from "lucide-react";
import { GlassCard, PillButton, PillCheckbox, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { InfoTip } from "@/components/guide/Guidance";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import {
  BILLING_LABELS, COMMON_ATTACHMENTS, ORG_DEFAULTS, ORG_LABELS, UNDATED_LABELS, docProfileSummary, effectiveDocProfile,
  type BillingMethod, type DocProfile, type OrgType, type UndatedDoc,
} from "@/lib/customer-doc-profile";

/**
 * ข้อมูลลูกค้า + โปรไฟล์เอกสาร (รูปแบบเอกสาร/การวางบิล/รับเงิน ของลูกค้ารายนี้)
 * - ข้อมูลทั่วไป: ฝ่ายขาย/วิศวกร (sales:edit)
 * - โปรไฟล์เอกสาร: ฝ่ายขาย/วิศวกร หรือแอดมินการเงิน (finance:edit) — บันทึกแยก เฉพาะของบริษัทนี้
 */

const BASIC_FIELDS = ["name", "taxId", "branchCode", "addressNo", "subDistrict", "district", "province", "zipCode", "phone", "email", "contactPerson"] as const;
type Basic = Record<(typeof BASIC_FIELDS)[number], string> & { creditLimit: string; creditTermDays: string };

const Field = ({ label, tip, children, className }: { label: string; tip?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1", className)}>
    <label className="text-[12px] font-bold text-white/70 ml-1 flex items-center">{label}{tip && <InfoTip text={tip} />}</label>
    {children}
  </div>
);

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id || ""));
  const router = useRouter();
  const { companyId, roles } = useAuth();
  const canEditBasic = can(roles, "sales:edit");
  const canEditProfile = canEditBasic || can(roles, "finance:edit");

  const [record, setRecord] = useState<any>(null);
  const [basic, setBasic] = useState<Basic | null>(null);
  const [profile, setProfile] = useState<DocProfile>({ orgType: "PRIVATE" });
  const [customAttachment, setCustomAttachment] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState<"" | "basic" | "profile">("");

  const load = useCallback(async () => {
    if (!companyId || !id) return;
    try {
      const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get", entity: "customers", id }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "ไม่พบลูกค้า");
      const r = d.record;
      setRecord(r);
      setBasic({
        name: r.name || r.customerName || "", taxId: r.taxId || r.tax_id || "", branchCode: r.branchCode || "00000",
        addressNo: r.addressNo || r.address_detail || r.address || "", subDistrict: r.subDistrict || "", district: r.district || "", province: r.province || "", zipCode: r.zipCode || "",
        phone: r.phone || r.phoneNumber || "", email: r.email || "", contactPerson: r.contactPerson || r.contactName || "",
        creditLimit: String(r.creditLimit ?? ""), creditTermDays: String(r.creditTermDays ?? r.credit_term_days ?? ""),
      });
      setProfile(r.docProfile && typeof r.docProfile === "object" ? r.docProfile : { orgType: r.grade === "Government" ? "GOV" : "PRIVATE" });
    } catch (err: any) {
      setMsg({ text: err.message, error: true });
    }
  }, [companyId, id]);
  useEffect(() => { load(); }, [load]);

  const effective = useMemo(() => effectiveDocProfile(profile), [profile]);
  const defaults = ORG_DEFAULTS[effective.orgType];
  const setP = (patch: Partial<DocProfile>) => setProfile((p) => ({ ...p, ...patch }));

  const update = async (changes: Record<string, any>, scope: "group" | "company") => {
    const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "update", entity: "customers", id, scope, changes }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
  };

  const saveBasic = async () => {
    if (!basic) return;
    if (!basic.name.trim()) return setMsg({ text: "กรุณาระบุชื่อลูกค้า", error: true });
    if (basic.taxId && basic.taxId.replace(/\D/g, "").length !== 13) return setMsg({ text: "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก", error: true });
    setSaving("basic");
    setMsg(null);
    try {
      const address = [basic.addressNo, basic.subDistrict, basic.district, basic.province, basic.zipCode].filter(Boolean).join(" ");
      await update({
        ...basic, customerName: basic.name, phoneNumber: basic.phone, contactName: basic.contactPerson, address,
        creditLimit: Number(basic.creditLimit) || 0, creditTermDays: Number(basic.creditTermDays) || 0,
      }, "group");
      setMsg({ text: "บันทึกข้อมูลลูกค้าแล้ว" });
      await load();
    } catch (err: any) {
      setMsg({ text: err.message, error: true });
    } finally {
      setSaving("");
    }
  };

  const saveProfile = async () => {
    setSaving("profile");
    setMsg(null);
    try {
      await update({ docProfile: profile }, "company");
      setMsg({ text: "บันทึกรูปแบบเอกสารของลูกค้ารายนี้แล้ว — ใช้กับเอกสารที่ออกหลังจากนี้" });
      await load();
    } catch (err: any) {
      setMsg({ text: err.message, error: true });
    } finally {
      setSaving("");
    }
  };

  const toggle = <T extends string>(list: T[] | undefined, value: T, on: boolean, fallback: T[]) => {
    const cur = new Set(list ?? fallback);
    if (on) cur.add(value); else cur.delete(value);
    return Array.from(cur);
  };

  if (!record || !basic) {
    return <div className="p-10 text-white/60">{msg?.error ? msg.text : "กำลังโหลด..."}</div>;
  }

  const attachments = profile.attachments ?? defaults.attachments ?? [];
  const extraAttachments = attachments.filter((a) => !COMMON_ATTACHMENTS.includes(a));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <PillButton variant="glass" onClick={() => router.push("/customers")} className="w-9 h-9 p-0 flex items-center justify-center" aria-label="กลับ"><ArrowLeft size={18} /></PillButton>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight leading-none truncate">{basic.name || "ลูกค้า"}</h1>
            <p className="text-xs font-semibold text-white/60 mt-1 leading-none truncate">{docProfileSummary(profile).join(" · ")}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1400px] mx-auto space-y-4">
          {msg && <div className={cn("p-3 rounded-xl text-xs font-bold border", msg.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{msg.text}</div>}

          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-white"><UserRound size={17} className="text-nexus-teal" /> ข้อมูลลูกค้า</h2>
              {canEditBasic && <PillButton variant="save" onClick={saveBasic} disabled={!!saving} className="h-9 px-5 text-xs"><Save size={14} className="mr-1.5" /> {saving === "basic" ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</PillButton>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
              <Field label="ชื่อลูกค้า / หน่วยงาน" className="md:col-span-2"><PillInput value={basic.name} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, name: e.target.value })} className="w-full h-9 text-sm" /></Field>
              <Field label="เลขประจำตัวผู้เสียภาษี"><PillInput value={basic.taxId} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, taxId: e.target.value })} className="w-full h-9 text-sm font-mono" /></Field>
              <Field label="รหัสสาขา" tip="สำนักงานใหญ่ = 00000 · ต้องตรงกับที่ลูกค้าแจ้ง เพราะพิมพ์บนใบกำกับภาษี"><PillInput value={basic.branchCode} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, branchCode: e.target.value })} className="w-full h-9 text-sm font-mono" /></Field>
              <Field label="ที่อยู่ (เลขที่ อาคาร ถนน)" className="md:col-span-2"><PillInput value={basic.addressNo} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, addressNo: e.target.value })} className="w-full h-9 text-sm" /></Field>
              <Field label="ตำบล/แขวง"><PillInput value={basic.subDistrict} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, subDistrict: e.target.value })} className="w-full h-9 text-sm" /></Field>
              <Field label="อำเภอ/เขต"><PillInput value={basic.district} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, district: e.target.value })} className="w-full h-9 text-sm" /></Field>
              <Field label="จังหวัด"><PillInput value={basic.province} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, province: e.target.value })} className="w-full h-9 text-sm" /></Field>
              <Field label="รหัสไปรษณีย์"><PillInput value={basic.zipCode} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, zipCode: e.target.value })} className="w-full h-9 text-sm font-mono" /></Field>
              <Field label="โทรศัพท์"><PillInput value={basic.phone} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, phone: e.target.value })} className="w-full h-9 text-sm" /></Field>
              <Field label="อีเมล"><PillInput value={basic.email} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, email: e.target.value })} className="w-full h-9 text-sm" /></Field>
              <Field label="ผู้ติดต่อหลัก"><PillInput value={basic.contactPerson} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, contactPerson: e.target.value })} className="w-full h-9 text-sm" /></Field>
              <Field label="วงเงินเครดิต (บาท)" tip="ใช้ตรวจตอนอนุมัติใบสั่งขาย · 0 = ไม่จำกัด"><PillInput inputMode="decimal" value={basic.creditLimit} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, creditLimit: e.target.value.replace(/[^\d.]/g, "") })} className="w-full h-9 text-sm text-right font-mono" /></Field>
              <Field label="เครดิต (วัน)"><PillInput inputMode="numeric" value={basic.creditTermDays} disabled={!canEditBasic} onChange={(e) => setBasic({ ...basic, creditTermDays: e.target.value.replace(/\D/g, "") })} className="w-full h-9 text-sm text-right font-mono" /></Field>
            </div>
          </GlassCard>

          <GlassCard accentColor="blue" className="p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-bold text-white"><FileCog size={17} className="text-nexus-blue" /> รูปแบบเอกสารของลูกค้ารายนี้</h2>
                <p className="text-[13px] text-white/55 mt-1">เลือกลูกค้ารายนี้ในใบเสนอราคา ใบวางบิล ใบเสร็จ แล้วระบบใช้ค่าเหล่านี้ให้เอง · ช่องที่ไม่ได้ตั้ง ใช้ค่าตั้งต้นตามประเภทองค์กร{profile.updatedBy ? ` · แก้ล่าสุดโดย ${profile.updatedBy}` : ""}</p>
              </div>
              {canEditProfile && <PillButton variant="confirm" onClick={saveProfile} disabled={!!saving} className="h-9 px-5 text-xs shrink-0"><Save size={14} className="mr-1.5" /> {saving === "profile" ? "กำลังบันทึก..." : "บันทึกรูปแบบเอกสาร"}</PillButton>}
            </div>

            <fieldset disabled={!canEditProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                <Field label="ประเภทองค์กร" tip="ตั้งค่าตั้งต้นของเอกสารทั้งหมดให้เหมาะกับองค์กรประเภทนี้ (แก้รายช่องได้)">
                  <PillSelect value={effective.orgType} onChange={(e) => setP({ orgType: e.target.value as OrgType })} className="w-full h-9 text-sm">
                    {(Object.keys(ORG_LABELS) as OrgType[]).map((o) => <option key={o} value={o}>{ORG_LABELS[o]}</option>)}
                  </PillSelect>
                </Field>
                <Field label="แสดงราคาในใบเสนอราคา">
                  <PillSelect value={profile.priceDisplay || ""} onChange={(e) => setP({ priceDisplay: (e.target.value || undefined) as any })} className="w-full h-9 text-sm">
                    <option value="">ตามประเภทองค์กร ({defaults.priceDisplay === "INCLUSIVE" ? "รวม VAT" : "ก่อน VAT"})</option>
                    <option value="EXCLUSIVE">ราคาก่อน VAT (บวก VAT ท้ายเอกสาร)</option>
                    <option value="INCLUSIVE">ราคารวม VAT แล้ว</option>
                  </PillSelect>
                </Field>
                <Field label="วิธีวางบิล / รับเงิน">
                  <PillSelect value={profile.billingMethod || ""} onChange={(e) => setP({ billingMethod: (e.target.value || undefined) as BillingMethod })} className="w-full h-9 text-sm">
                    <option value="">ตามประเภทองค์กร ({BILLING_LABELS[defaults.billingMethod || "BILL_THEN_TRANSFER"]})</option>
                    {(Object.keys(BILLING_LABELS) as BillingMethod[]).map((b) => <option key={b} value={b}>{BILLING_LABELS[b]}</option>)}
                  </PillSelect>
                </Field>
                <Field label="ลูกค้ามักหัก ณ ที่จ่าย" tip="ส่วนราชการหักภาษี ณ ที่จ่าย 1% · เอกชนจ่ายค่าบริการมัก 3% · ใช้เป็นค่าเริ่มต้นตอนรับชำระ">
                  <PillSelect value={profile.whtRate === undefined || profile.whtRate === null ? "" : String(profile.whtRate)} onChange={(e) => setP({ whtRate: e.target.value === "" ? undefined : Number(e.target.value) })} className="w-full h-9 text-sm">
                    <option value="">ตามประเภทองค์กร ({defaults.whtRate ? `${defaults.whtRate}%` : "ไม่หัก"})</option>
                    {[0, 1, 2, 3, 5].map((r) => <option key={r} value={r}>{r === 0 ? "ไม่หัก" : `${r}%`}</option>)}
                  </PillSelect>
                </Field>
                <Field label="รับวางบิลทุกวันที่" tip="ระบบแจ้งเตือนก่อนถึงรอบวางบิลของลูกค้า · ว่าง = ไม่มีรอบ">
                  <PillInput inputMode="numeric" placeholder="เช่น 25" value={profile.billingDay ?? ""} onChange={(e) => setP({ billingDay: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} className="w-full h-9 text-sm text-right font-mono" />
                </Field>
                <Field label="จ่ายเงิน / รับเช็คทุกวันที่" tip="วันที่ลูกค้าจ่ายเงินหรือนัดรับเช็ค ระบบแจ้งเตือนให้ไปรับ/ตรวจยอด">
                  <PillInput inputMode="numeric" placeholder="เช่น 5" value={profile.paymentDay ?? ""} onChange={(e) => setP({ paymentDay: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} className="w-full h-9 text-sm text-right font-mono" />
                </Field>
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-bold text-white/70 ml-1 flex items-center">พิมพ์แบบเว้นวันที่ (ให้ลูกค้าลงวันที่เอง)<InfoTip text="หลายหน่วยงานให้เว้นวันที่บนใบวางบิล/ใบเสร็จ แล้วลงวันที่เองตอนจ่ายเงิน · ระบบยังเก็บวันที่จริงไว้ · ใบกำกับภาษี (รวมใบเสร็จที่เป็นใบกำกับภาษี) พิมพ์วันที่เสมอตามกฎหมาย" /></p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 ml-1">
                  {(Object.keys(UNDATED_LABELS) as UndatedDoc[]).map((d) => (
                    <PillCheckbox key={d} label={UNDATED_LABELS[d]} checked={effective.undated.includes(d)} onChange={(e) => setP({ undated: toggle(profile.undated, d, e.target.checked, defaults.undated || []) })} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-bold text-white/70 ml-1">เอกสารที่ต้องแนบตอนวางบิล</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 ml-1">
                  {[...COMMON_ATTACHMENTS, ...extraAttachments].map((a) => (
                    <PillCheckbox key={a} label={a} checked={attachments.includes(a)} onChange={(e) => setP({ attachments: toggle(profile.attachments, a, e.target.checked, defaults.attachments || []) })} />
                  ))}
                </div>
                <div className="flex items-center gap-2 max-w-md">
                  <PillInput placeholder="เพิ่มเอกสารอื่น เช่น สำเนาบัตรผู้รับมอบอำนาจ" value={customAttachment} onChange={(e) => setCustomAttachment(e.target.value)} className="flex-1 h-9 text-sm" />
                  <PillButton variant="glass" className="h-9 px-4 text-xs" onClick={() => { const v = customAttachment.trim(); if (v) { setP({ attachments: toggle(profile.attachments, v, true, defaults.attachments || []) }); setCustomAttachment(""); } }}>เพิ่ม</PillButton>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {([["quotation", "ข้อความในใบเสนอราคา"], ["billingNote", "ข้อความในใบวางบิล"], ["invoice", "ข้อความในใบกำกับภาษี/ใบแจ้งหนี้"], ["receipt", "ข้อความในใบเสร็จรับเงิน"]] as const).map(([k, label]) => (
                  <Field key={k} label={label} tip="เช่น อ้างอิงเลขที่ใบสั่ง/สัญญา ชื่อผู้รับ เงื่อนไขที่หน่วยงานกำหนด — พิมพ์ในหมายเหตุของเอกสาร">
                    <PillInput value={profile.notes?.[k] ?? ""} placeholder={defaults.notes?.[k] || "ไม่มี"} onChange={(e) => setP({ notes: { ...(profile.notes || {}), [k]: e.target.value } })} className="w-full h-9 text-sm" />
                  </Field>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {([["procurement", "ผู้ติดต่อฝ่ายพัสดุ/จัดซื้อ"], ["finance", "ผู้ติดต่อฝ่ายการเงิน"], ["inspector", "ผู้ตรวจรับงาน"]] as const).map(([k, label]) => (
                  <Field key={k} label={label}>
                    <PillInput value={profile.contacts?.[k] ?? ""} placeholder="ชื่อ / เบอร์โทร" onChange={(e) => setP({ contacts: { ...(profile.contacts || {}), [k]: e.target.value } })} className="w-full h-9 text-sm" />
                  </Field>
                ))}
              </div>

              <PillCheckbox label="ล็อกรูปแบบนี้ (ระบบจะไม่ปรับให้เองจากเอกสารที่ออก)" checked={!!profile.locked} onChange={(e) => setP({ locked: e.target.checked })} />
              {profile.locked && <p className="flex items-center gap-1.5 text-[12px] text-white/50 ml-1"><Lock size={12} /> ล็อกอยู่ — ผู้มีสิทธิ์ยังแก้ได้ที่หน้านี้ และระบบบันทึกผู้แก้ล่าสุดไว้</p>}
            </fieldset>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
