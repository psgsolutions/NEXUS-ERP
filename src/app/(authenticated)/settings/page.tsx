"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Building2, Fingerprint, Palette, Save, Settings as SettingsIcon, Users } from "lucide-react";
import { PillButton, PillInput, PillTabs, Toast } from "@/components/ui/Base";
import { DocumentProfileSettings } from "@/components/settings/DocumentProfileSettings";
import { DocumentDesigner } from "@/components/settings/DocumentDesigner";
import { SpecLibraryManager } from "@/components/projects/SpecLibraryManager";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { resolveSequenceFormat } from "@/lib/sequence-engine";
import { doc, getDoc } from "firebase/firestore";
import { apiFetch } from "@/lib/api-client";
import UsersPage from "./users/page";

/**
 * ตั้งค่าระบบ: ข้อมูลนิติบุคคล/หัวเอกสาร, ผู้ใช้งาน, รูปแบบเลขที่เอกสาร, คลังสเปก TOR
 * (เอกสารทุกประเภทใช้เทมเพลตมาตรฐานเดียวกัน ปรับหัวเอกสาร โลโก้ สี ได้ที่แท็บข้อมูลนิติบุคคล)
 */

type SettingsTab = "company" | "design" | "users" | "sequence" | "specs";
const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "company", label: "ข้อมูลนิติบุคคล", icon: <Building2 size={14} /> },
  { id: "design", label: "ออกแบบเอกสาร", icon: <Palette size={14} /> },
  { id: "users", label: "จัดการผู้ใช้งาน", icon: <Users size={14} /> },
  { id: "sequence", label: "รูปแบบเลขที่", icon: <Fingerprint size={14} /> },
  { id: "specs", label: "คลังสเปก TOR", icon: <BookOpen size={14} /> },
];

/** เลขที่เอกสารที่ระบบออกจริง (ตรงกับ prefix ใน API) */
const SEQUENCE_GROUPS: { title: string; items: [prefix: string, label: string][] }[] = [
  { title: "ขาย / ภาษีขาย", items: [["QT", "ใบเสนอราคา"], ["SO", "ใบสั่งขาย"], ["DN", "ใบส่งของ"], ["IV", "ใบกำกับภาษี/ใบแจ้งหนี้"], ["PB", "ใบแจ้งหนี้งวดงานโครงการ"], ["BL", "ใบวางบิล"], ["RE", "ใบเสร็จรับเงิน"], ["CN", "ใบลดหนี้"], ["DBN", "ใบเพิ่มหนี้"], ["RF", "ใบคืนเงินลูกค้า"], ["POS", "ขายหน้าร้าน (POS)"]] },
  { title: "จัดซื้อ / จ่ายเงิน", items: [["PR", "ใบขอซื้อ"], ["PO", "ใบสั่งซื้อ"], ["GR", "ใบรับสินค้า"], ["EXP", "รายการค่าใช้จ่าย"], ["ADV", "เงินทดรองจ่าย"], ["PV", "ใบสำคัญจ่าย"], ["WHT", "หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)"]] },
  { title: "งาน / บัญชี / อื่น ๆ", items: [["PRJ", "โครงการ"], ["WO", "ใบสั่งงานบริการ"], ["JOB", "งานมอบหมาย"], ["TK", "ใบแจ้งซ่อม"], ["FIN", "ใบสำคัญบัญชี (บันทึกเอง)"], ["INV", "รายการเคลื่อนไหวสต็อก"], ["EMP", "รหัสพนักงาน"]] },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab") as SettingsTab;
  const [activeTab, setActiveTab] = useState<SettingsTab>(TABS.some((t) => t.id === requested) ? requested : "company");
  const [toast, setToast] = useState({ message: "", isVisible: false });
  const { companyId } = useAuth();
  const [formats, setFormats] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab !== "sequence" || !companyId) return;
    getDoc(doc(db, `companies/${companyId}/settings`, "sequence_formats"))
      .then((snap) => setFormats(snap.exists() ? (snap.data() as Record<string, string>) : {}))
      .catch((err) => console.error("Failed to load sequence formats:", err));
  }, [activeTab, companyId]);

  const showToast = (message: string) => setToast({ message, isVisible: true });

  const saveFormats = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(formats).filter(([k, v]) => typeof v === "string" && /^[A-Z]+$/.test(k)).map(([k, v]) => [k, v.trim()]));
      const res = await apiFetch("/api/settings/company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "sequenceFormats", formats: clean }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกรูปแบบเลขที่ไม่สำเร็จ");
      showToast("บันทึกรูปแบบเลขที่เอกสารแล้ว (มีผลกับเอกสารที่ออกหลังจากนี้)");
    } catch (err: any) {
      console.error("Failed to save sequence formats:", err);
      showToast(err.message || "บันทึกรูปแบบเลขที่ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
            <SettingsIcon size={22} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">การตั้งค่าระบบ</h1>
        </div>
        <div className="flex items-center justify-between gap-3">
          <PillTabs tabs={TABS} activeTab={activeTab} onTabChange={(id: any) => setActiveTab(id)} />
          {activeTab === "sequence" && (
            <PillButton className="px-8 shadow-neon-teal shrink-0" disabled={saving} onClick={saveFormats}>
              <Save size={18} /> บันทึกรูปแบบเลขที่
            </PillButton>
          )}
        </div>
      </div>

      {activeTab === "company" && <DocumentProfileSettings />}
      {activeTab === "design" && <DocumentDesigner />}

      {activeTab === "sequence" && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
          <div className="bg-nexus-teal/10 border border-nexus-teal/20 rounded-xl p-4 space-y-2">
            <h3 className="text-nexus-teal font-medium text-sm">ตัวแปรที่ใช้ได้</h3>
            <div className="flex flex-wrap gap-2 text-[12px] font-mono">
              {[["[PREFIX]", "คำนำหน้า"], ["[YYYY]", "ปี ค.ศ."], ["[YY]", "ปี ค.ศ. 2 หลัก"], ["[BBBB]", "ปี พ.ศ."], ["[BB]", "ปี พ.ศ. 2 หลัก"], ["[MM]", "เดือน"], ["[DD]", "วันที่"], ["[0000]", "ลำดับ (จำนวนหลักตามเลข 0)"]].map(([t, d]) => (
                <span key={t} className="bg-black/40 px-2 py-1 rounded text-white"><span className="text-nexus-teal">{t}</span> = {d}</span>
              ))}
            </div>
            <p className="text-[12px] text-white/60">ลำดับเริ่มใหม่เมื่อส่วนหน้าเลขลำดับเปลี่ยน เช่น ใช้ [BB][MM] จะเริ่ม 0001 ทุกเดือน · เปลี่ยนรูปแบบแล้วมีผลกับเอกสารที่ออกหลังบันทึกเท่านั้น</p>
          </div>
          {SEQUENCE_GROUPS.map((g) => (
            <section key={g.title} className="space-y-2">
              <h3 className="text-[13px] font-semibold text-white/70">{g.title}</h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {g.items.map(([prefix, label]) => (
                  <SequenceCard key={prefix} label={label} prefix={prefix} value={formats[prefix] || ""} onChange={(v) => setFormats({ ...formats, [prefix]: v })} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeTab === "users" && (
        <div className="animate-in slide-in-from-bottom duration-500 -mt-6 -ml-6">
          <UsersPage />
        </div>
      )}

      {activeTab === "specs" && (
        <div className="animate-in slide-in-from-bottom duration-500">
          <SpecLibraryManager />
        </div>
      )}

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={() => setToast((p) => ({ ...p, isVisible: false }))} />
    </div>
  );
}

/** รูปแบบเลขที่ 1 ประเภท: ว่าง = ใช้ค่าเริ่มต้น {PREFIX}-[YYMM]-[0000] — ตัวอย่างคำนวณด้วยตัวออกเลขจริง */
function SequenceCard({ label, prefix, value, onChange }: { label: string; prefix: string; value: string; onChange: (v: string) => void }) {
  const example = useMemo(() => {
    const r = resolveSequenceFormat(prefix, value.trim() || undefined);
    return `${r.prefixPart}${"1".padStart(r.padLength, "0")}${r.suffixPart}`;
  }, [prefix, value]);
  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex flex-col sm:flex-row items-center gap-4">
      <div className="flex items-center gap-3 w-full sm:w-[260px] shrink-0 min-w-0">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 text-[10px] font-mono font-bold">{prefix}</div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white truncate" title={label}>{label}</p>
          <p className="text-[12px] text-white/40 font-mono truncate">ตัวอย่าง: {example}</p>
        </div>
      </div>
      <PillInput
        className="flex-1 h-9 px-3 text-[13px] font-mono text-center bg-black/40 border-white/5 text-nexus-teal focus:border-nexus-teal/50"
        value={value}
        placeholder={`${prefix}-[YYMM]-[0000]`}
        onChange={(e) => onChange(e.target.value)}
        title={`รูปแบบเลขที่${label}`}
      />
    </div>
  );
}
