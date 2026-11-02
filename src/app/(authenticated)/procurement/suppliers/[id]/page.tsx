"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Save } from "lucide-react";
import { GlassCard, PillButton, PillInput, PillSelect, cn } from "@/components/ui/Base";
import { InfoTip } from "@/components/guide/Guidance";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { TaxUnitPanel } from "@/components/shared/TaxUnitPanel";
import { SpellHint } from "@/components/shared/SpellHint";
import { useSuppliers } from "@/hooks/useCustomers";
import { partyDocName, taxIdProblem } from "@/lib/party-identity";

/**
 * ข้อมูลผู้ขาย/ผู้รับเหมา: ดูและแก้ไข (ฝ่ายจัดซื้อ procurement:edit)
 * ผู้ขายที่สร้างจากฟอร์มหรือนำเข้า Excel ใช้หน้านี้เหมือนกัน · ผู้รับเหมารหัสเดียวกันถูกแก้ตามไปด้วย
 */

const FIELDS = ["name", "taxId", "branchCode", "unitName", "taxInvoiceName", "category", "addressNo", "subDistrict", "district", "province", "zipCode",
  "phone", "email", "contactPerson", "bankName", "bankAccount", "bankAccountName", "creditTermDays", "status"] as const;
type Form = Record<(typeof FIELDS)[number], string>;

const CATEGORY: Record<string, string> = { COMPANY: "บริษัท", STORE: "ห้าง/ร้าน", TEAM: "ทีมช่าง" };

const Field = ({ label, tip, children, className }: { label: string; tip?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1", className)}>
    <label className="text-[12px] font-bold text-white/70 ml-1 flex items-center">{label}{tip && <InfoTip text={tip} />}</label>
    {children}
  </div>
);

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id || ""));
  const router = useRouter();
  const { companyId, roles } = useAuth();
  const canEdit = can(roles, "procurement:edit");
  const { data: allSuppliers } = useSuppliers<any>({ includeGroupOnly: true });
  const [record, setRecord] = useState<any>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const post = useCallback(async (body: Record<string, any>) => {
    const res = await apiFetch("/api/master-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error(d.error || "ไม่สำเร็จ");
    return d;
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId || !id) return;
    try {
      const r = (await post({ action: "get", entity: "suppliers", id })).record;
      setRecord(r);
      const cat = String(r.entity_category || r.contractor_type || "COMPANY").toUpperCase();
      setForm({
        name: r.name || r.supplierName || "", taxId: r.taxId || r.tax_id || "", branchCode: r.branchCode || r.branch_code || "00000",
        unitName: r.unitName || "", taxInvoiceName: r.taxInvoiceName || "", category: CATEGORY[cat] ? cat : "COMPANY",
        addressNo: r.address_detail || r.addressNo || r.address || "", subDistrict: r.subDistrict || "", district: r.district || "", province: r.province || "", zipCode: r.zipCode || "",
        phone: r.phone || "", email: r.email || "", contactPerson: r.contact_person || r.contactName || r.contactPerson || "",
        bankName: r.bankName || r.bank_name || "", bankAccount: r.bankAccount || r.account_number || "", bankAccountName: r.bankAccountName || r.account_name || "",
        creditTermDays: String(r.creditTermDays ?? (parseInt(String(r.payment_term || ""), 10) || "")), status: r.isActive === false || r.status === "inactive" ? "inactive" : "active",
      });
    } catch (err: any) {
      setMsg({ text: err.message, error: true });
    }
  }, [companyId, id, post]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) return setMsg({ text: "กรุณาระบุชื่อผู้ขาย", error: true });
    if (form.taxId && taxIdProblem(form.taxId)) return setMsg({ text: taxIdProblem(form.taxId), error: true });
    setSaving(true);
    setMsg(null);
    try {
      const days = Number(form.creditTermDays) || 0;
      const address = [form.addressNo, form.subDistrict, form.district, form.province, form.zipCode].filter(Boolean).join(" ");
      const changes = {
        name: form.name.trim(), supplierName: form.name.trim(), taxId: form.taxId, tax_id: form.taxId, branchCode: form.branchCode, unitName: form.unitName, taxInvoiceName: form.taxInvoiceName,
        entity_category: form.category, contractor_type: form.category, category: CATEGORY[form.category],
        address_detail: form.addressNo, addressNo: form.addressNo, subDistrict: form.subDistrict, district: form.district, province: form.province, zipCode: form.zipCode, address,
        phone: form.phone, email: form.email, contact_person: form.contactPerson, contactName: form.contactPerson,
        bankName: form.bankName, bank_name: form.bankName, bankAccount: form.bankAccount, account_number: form.bankAccount, bankAccountName: form.bankAccountName, account_name: form.bankAccountName,
        creditTermDays: days, payment_term: `${days} Days`, status: form.status, isActive: form.status === "active",
      };
      await post({ action: "update", entity: "suppliers", id, scope: "group", changes });
      // ผู้รับเหมารหัสเดียวกัน (สร้างคู่กันตอนลงทะเบียน) — ไม่มีก็ข้าม
      await post({ action: "update", entity: "contractors", id, scope: "group", changes }).catch(() => undefined);
      setMsg({ text: "บันทึกข้อมูลผู้ขายแล้ว" });
      await load();
    } catch (err: any) {
      setMsg({ text: err.message, error: true });
    } finally {
      setSaving(false);
    }
  };

  if (!record || !form) return <div className="p-10 text-white/60">{msg?.error ? msg.text : "กำลังโหลด..."}</div>;
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const input = (k: keyof Form, extra = "") => <PillInput value={form[k]} disabled={!canEdit} onChange={(e) => set({ [k]: e.target.value } as Partial<Form>)} className={cn("w-full h-9 text-sm", extra)} />;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      <header className="px-6 py-2.5 min-h-[60px] border-b border-white/5 flex items-center justify-between gap-3 bg-black/20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <PillButton variant="glass" onClick={() => router.push("/procurement")} className="w-9 h-9 p-0 flex items-center justify-center" aria-label="กลับ"><ArrowLeft size={18} /></PillButton>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight leading-none truncate">{partyDocName({ name: form.name, unitName: form.unitName, taxInvoiceName: form.taxInvoiceName }) || "ผู้ขาย"}</h1>
            <p className="text-xs font-semibold text-white/60 mt-1 leading-none truncate font-mono">{record.supplierCode || id} · {CATEGORY[form.category]}</p>
          </div>
        </div>
        {canEdit && <PillButton variant="save" onClick={save} disabled={saving} className="h-9 px-5 text-xs"><Save size={14} className="mr-1.5" /> {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</PillButton>}
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 max-w-[1400px] mx-auto space-y-4">
          {msg && <div className={cn("p-3 rounded-xl text-xs font-bold border", msg.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal")}>{msg.text}</div>}

          <GlassCard className="p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-white"><Building2 size={17} className="text-nexus-teal" /> ข้อมูลผู้ขาย</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
              <Field label="ชื่อผู้ขาย / นิติบุคคล" className="md:col-span-2">
                {input("name")}
                <SpellHint value={form.name} onFix={(v) => set({ name: v })} />
              </Field>
              <Field label="เลขประจำตัวผู้เสียภาษี">{input("taxId", "font-mono")}</Field>
              <Field label="รหัสสาขา" tip="สำนักงานใหญ่ = 00000 · ใช้บนหนังสือรับรองหัก ณ ที่จ่าย">{input("branchCode", "font-mono")}</Field>
              <div className="md:col-span-2 xl:col-span-4">
                <TaxUnitPanel records={allSuppliers || []} taxId={form.taxId} branchCode={form.branchCode} unitName={form.unitName} taxInvoiceName={form.taxInvoiceName} baseName={form.name} exceptId={id} hrefOf={(sid) => `/procurement/suppliers/${sid}`} disabled={!canEdit} onChange={(v) => set(v)} />
              </div>
              <Field label="ประเภท">
                <PillSelect value={form.category} disabled={!canEdit} onChange={(e) => set({ category: e.target.value })} className="w-full h-9 text-sm">
                  {Object.entries(CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </PillSelect>
              </Field>
              <Field label="สถานะ">
                <PillSelect value={form.status} disabled={!canEdit} onChange={(e) => set({ status: e.target.value })} className="w-full h-9 text-sm">
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ระงับ</option>
                </PillSelect>
              </Field>
              <Field label="เครดิต (วัน)">{input("creditTermDays", "text-right font-mono")}</Field>
              <Field label="ผู้ติดต่อ">{input("contactPerson")}</Field>
              <Field label="ที่อยู่ (เลขที่ อาคาร ถนน)" className="md:col-span-2">{input("addressNo")}</Field>
              <Field label="ตำบล/แขวง">{input("subDistrict")}</Field>
              <Field label="อำเภอ/เขต">{input("district")}</Field>
              <Field label="จังหวัด">{input("province")}</Field>
              <Field label="รหัสไปรษณีย์">{input("zipCode", "font-mono")}</Field>
              <Field label="โทรศัพท์">{input("phone")}</Field>
              <Field label="อีเมล">{input("email")}</Field>
              <Field label="ธนาคาร">{input("bankName")}</Field>
              <Field label="เลขที่บัญชี">{input("bankAccount", "font-mono")}</Field>
              <Field label="ชื่อบัญชี" className="md:col-span-2">{input("bankAccountName")}</Field>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
