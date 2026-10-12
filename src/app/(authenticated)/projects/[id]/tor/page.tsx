"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { PillButton } from "@/components/ui/Base";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase-client";
import { docSectionsFor, thaiDate, type Sector } from "@/lib/project-templates";

/** พิมพ์ร่างขอบเขตของงาน (TOR) / รายละเอียดโครงการ จากข้อความที่บันทึกไว้ในโครงการ */
export default function ProjectTorPrintPage() {
  const params = useParams();
  const router = useRouter();
  const { companyId } = useAuth();
  const docId = decodeURIComponent(String(params?.id || ""));
  const [p, setP] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId || !docId) return;
    getDoc(doc(db, `companies/${companyId}/projects`, docId))
      .then((s) => (s.exists() ? setP(s.data()) : setError("ไม่พบโครงการ")))
      .catch(() => setError("โหลดข้อมูลโครงการไม่สำเร็จ"));
  }, [companyId, docId]);

  const sector: Sector = p?.sectorType === "Private" ? "Private" : "Government";
  const sections = p ? docSectionsFor(sector).map((d, i) => ({ ...d, n: i + 1, text: String(p.docSections?.[d.key] || "").trim() })) : [];
  const hasText = sections.some((s) => s.text);
  const gov = sector === "Government";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 18mm 20mm 22mm; }
          body * { visibility: hidden; }
          .tor-print, .tor-print * { visibility: visible; }
          .tor-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: 0 !important; }
          .tor-section { break-inside: avoid-page; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-3xl print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <PillButton variant="glass" onClick={() => router.back()} className="w-10 h-10 p-0 flex items-center justify-center shrink-0"><ArrowLeft size={20} /></PillButton>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white truncate">{gov ? "ร่างขอบเขตของงาน (TOR)" : "รายละเอียดโครงการ"}</h1>
            <p className="text-sm text-white/50 truncate">{p ? `${p.projectId || docId} · ${p.projectName || ""}` : "กำลังโหลด..."}</p>
          </div>
        </div>
        <PillButton variant="confirm" onClick={() => window.print()} disabled={!hasText} className="h-9 px-5 text-xs font-bold">
          <Printer size={14} className="mr-1.5" /> พิมพ์ / บันทึก PDF
        </PillButton>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}
      {p && !hasText && (
        <p className="text-white/50 text-sm">โครงการนี้ยังไม่มีรายละเอียดโครงการ — แก้ไขโครงการที่ขั้น &ldquo;รายละเอียดโครงการ&rdquo; แล้วบันทึกก่อน</p>
      )}

      {p && hasText && (
        <div className="tor-print mx-auto w-full max-w-[210mm] bg-white text-black rounded-sm shadow-2xl px-[18mm] py-[16mm] text-[15px] leading-[1.75]">
          <div className="text-center mb-6 space-y-1">
            <p className="font-bold text-[18px]">{gov ? "ร่างขอบเขตของงาน (Terms of Reference : TOR)" : "รายละเอียดโครงการ"}</p>
            <p className="font-bold">{p.projectName}</p>
            {p.customerName && <p>{p.customerName}</p>}
          </div>

          {sections.filter((s) => s.text).map((s) => (
            <div key={s.key} className="tor-section mb-4">
              <p className="font-bold">{s.n}. {s.title}</p>
              <div className="whitespace-pre-wrap pl-6">{s.text}</div>
            </div>
          ))}

          {gov ? (
            <div className="tor-section mt-12 grid grid-cols-3 gap-6 text-center text-[14px]">
              {["ประธานกรรมการ", "กรรมการ", "กรรมการและเลขานุการ"].map((r) => (
                <div key={r} className="space-y-1">
                  <p>ลงชื่อ ..................................</p>
                  <p>(..................................)</p>
                  <p>{r}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-10 text-right text-[13px]">จัดทำเมื่อ {thaiDate(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))}</p>
          )}
        </div>
      )}
    </div>
  );
}
