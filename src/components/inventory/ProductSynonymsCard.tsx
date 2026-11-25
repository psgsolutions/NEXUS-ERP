"use client";

import React, { useEffect, useState } from "react";
import { BookA, Loader2, Save } from "lucide-react";
import { PillButton, PillTextarea } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { useSystemDialog } from "@/context/DialogContext";
import { useProductSynonyms } from "@/hooks/useProductSynonyms";
import { DEFAULT_SYNONYMS, normalizeSynonyms } from "@/lib/product-match";

/**
 * คำพ้องสินค้าของบริษัท — ชื่อที่ใช้เรียกของชิ้นเดียวกันต่างกัน (ใช้ตรวจสินค้าซ้ำตอนเพิ่ม/นำเข้า)
 * 1 บรรทัด = 1 กลุ่ม คั่นด้วยจุลภาค เช่น  wireway, รางวายเวย์, ไวร์เวย์
 */
export function ProductSynonymsCard() {
  const { roles } = useAuth();
  const canEdit = can(roles, "inventory:edit");
  const { showAlert } = useSystemDialog();
  const { synonyms, loaded, save } = useProductSynonyms();
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dirty) setText(synonyms.map((g) => g.join(", ")).join("\n")); }, [synonyms, dirty]);
  const groups = normalizeSynonyms(text.split(/\r?\n/));
  const onSave = async () => {
    setBusy(true);
    try { await save(groups); setDirty(false); showAlert(`บันทึกคำพ้อง ${groups.length} กลุ่มแล้ว — ใช้ตรวจสินค้าซ้ำทันที`, "บันทึกแล้ว", "info"); }
    catch (e: any) { showAlert(e.message, "บันทึกไม่สำเร็จ", "error"); } finally { setBusy(false); }
  };
  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3" data-product-synonyms>
      <summary className="cursor-pointer text-[14px] font-bold text-white flex items-center gap-2">
        <BookA size={14} className="text-nexus-teal" /> คำพ้องสินค้า (ใช้ตรวจสินค้าซ้ำ)
        <span className="font-normal text-[12px] text-white/50">ของบริษัท {loaded ? `${synonyms.length} กลุ่ม` : "…"} · มีให้แล้ว {DEFAULT_SYNONYMS.length} กลุ่ม</span>
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-[12px] text-white/60 leading-relaxed">
          ชื่อที่ใช้เรียกของชิ้นเดียวกันต่างกัน — 1 บรรทัด = 1 กลุ่ม คำแรกเป็นคำกลาง คั่นด้วยจุลภาค เช่น <span className="font-mono text-white/80">wireway, รางวายเวย์, ไวร์เวย์</span>
          · สเปกต่างกัน (CAT6/CAT5e, 12/24 core, ถุง 50/100 ตัว) ระบบไม่นับเป็นตัวเดียวกันเสมอ
        </p>
        <PillTextarea value={text} disabled={!canEdit} rows={Math.min(12, Math.max(3, text.split("\n").length + 1))} onChange={(e) => { setText(e.target.value); setDirty(true); }}
          placeholder={"wireway, รางวายเวย์, ไวร์เวย์\nเทปพันสาย, เทปดำ, เทปไฟฟ้า"} className="font-mono" />
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <PillButton variant="confirm" className="h-8 px-4 text-xs" onClick={onSave} disabled={busy || !dirty}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} บันทึกคำพ้อง ({groups.length} กลุ่ม)</PillButton>}
          <details className="text-[12px] text-white/55">
            <summary className="cursor-pointer">คำพ้องที่มีให้แล้ว</summary>
            <ul className="mt-1 space-y-0.5 font-mono">{DEFAULT_SYNONYMS.map((g) => <li key={g[0]}>{g.slice(1).join(", ")}</li>)}</ul>
          </details>
        </div>
      </div>
    </details>
  );
}
