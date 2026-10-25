"use client";

import React from "react";
import { Database, Lock } from "lucide-react";
import { PillCheckbox } from "@/components/ui/Base";
import type { DataGroup } from "@/lib/documents/design-data";

/** รายการติ๊ก "ข้อมูลที่แสดงในเอกสาร" (ใช้ทั้งแบบง่ายและแบบลากวาง) — 🔒 = กฎหมายกำหนด แสดงเสมอ */
export function DataChecklist({ groups, onToggle, canEdit, compact }: { groups: DataGroup[]; onToggle: (key: string, on: boolean) => void; canEdit: boolean; compact?: boolean }) {
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.id} className="rounded-xl border border-white/10 p-2.5 space-y-1.5">
          {!compact && (
            <div>
              <p className="text-[12px] font-bold text-white/80">{g.title}</p>
              <p className="text-[10.5px] text-sky-300/70 flex items-center gap-1"><Database size={10} /> {g.source}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {g.items.map((i) => i.locked && i.on ? (
              <p key={i.key} className="text-[12px] text-white/45 flex items-center gap-1.5 min-h-[28px]"><Lock size={11} /> {i.label}</p>
            ) : (
              <PillCheckbox key={i.key} label={i.label} checked={i.on} disabled={!canEdit || i.locked} onChange={(e) => onToggle(i.key, e.target.checked)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
