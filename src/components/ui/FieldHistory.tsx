"use client";

import React, { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { FloatingLayer } from "@/components/ui/FloatingLayer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, SAVED_EVENT } from "@/lib/api-client";
import { cleanValue, matchHistory } from "@/lib/field-history";

/**
 * ข้อมูลเก่าที่เคยบันทึกของช่องกรอก (ทุกคนในบริษัท) — คลิกช่องแล้วแสดงรายการให้เลือก เลือกแล้วแก้ต่อได้
 * ใช้ครอบช่องกรอกเดิม (PillInput / textarea / อื่น ๆ):  <FieldHistory k="quotation.remark" value={remark} onPick={setRemark}>…</FieldHistory>
 * จำค่าเมื่อหน้านั้น "บันทึกสำเร็จ" (apiFetch ส่งสัญญาณ SAVED_EVENT) — ไม่จำค่าที่พิมพ์แต่ไม่ได้บันทึก
 */

const READ_ACTION = /^(get|context|list|search|lookup|preview|history|check|find|count|match|suggest)/i;
const cache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[]>>();
type Reg = { companyId: string; key: string; get: () => string; last: string };
const registry = new Map<number, Reg>();
let seq = 0;
let listening = false;

async function load(companyId: string, key: string): Promise<string[]> {
  const ck = `${companyId}|${key}`;
  if (cache.has(ck)) return cache.get(ck)!;
  if (!inflight.has(ck)) {
    inflight.set(ck, apiFetch("/api/field-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "get", keys: [key] }) })
      .then((r) => r.json()).then((d) => { const v: string[] = d?.values?.[key] || []; cache.set(ck, v); return v; })
      .catch(() => [] as string[]).finally(() => inflight.delete(ck)));
  }
  return inflight.get(ck)!;
}

async function flush() {
  const byCompany = new Map<string, { key: string; value: string }[]>();
  for (const r of registry.values()) {
    const value = cleanValue(r.get());
    if (value.length < 2 || value === r.last) continue;
    r.last = value;
    byCompany.set(r.companyId, [...(byCompany.get(r.companyId) || []), { key: r.key, value }]);
    const ck = `${r.companyId}|${r.key}`;
    if (cache.has(ck)) cache.set(ck, [value, ...cache.get(ck)!.filter((x) => x !== value)]);
  }
  for (const [companyId, entries] of byCompany) {
    apiFetch("/api/field-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "record", entries }) }).catch(() => undefined);
  }
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(SAVED_EVENT, (e) => {
    const action = String((e as CustomEvent).detail?.action || "");
    if (READ_ACTION.test(action)) return;
    setTimeout(flush, 0);
  });
}

export function FieldHistory({ k, value, onPick, children, className }: {
  /** ชื่อช่อง เช่น "quotation.remark" (ช่องเดียวกันในหลายหน้าใช้ชื่อเดียวกัน) */
  k: string; value: string; onPick: (v: string) => void; children: React.ReactNode; className?: string;
}) {
  const { companyId } = useAuth();
  const wrap = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    if (!companyId) return;
    listen();
    const id = ++seq;
    registry.set(id, { companyId, key: k, get: () => valueRef.current || "", last: "" });
    return () => { registry.delete(id); };
  }, [companyId, k]);

  const onFocus = () => {
    if (!companyId) return;
    setOpen(true);
    load(companyId, k).then(setList);
  };
  const onBlur = (e: React.FocusEvent) => {
    if (layer.current?.contains(e.relatedTarget as Node)) return;
    setTimeout(() => setOpen(false), 120);
  };
  const items = open ? matchHistory(list, value || "") : [];

  return (
    <div ref={wrap} className={className} onFocusCapture={onFocus} onBlurCapture={onBlur} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} data-field-history={k}>
      {children}
      <FloatingLayer ref={layer} anchorRef={wrap} open={open && items.length > 0} fit maxHeight={280} className="rounded-xl border border-white/10 bg-surface-1 shadow-2xl overflow-y-auto">
        <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[11px] text-white/45"><History size={11} /> เคยบันทึก — เลือกแล้วแก้ต่อได้</div>
        {items.map((v) => (
          <button key={v} type="button" tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); onPick(v); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/[0.06] whitespace-pre-line line-clamp-3" data-history-item>
            {v}
          </button>
        ))}
      </FloatingLayer>
    </div>
  );
}

/** สำหรับ ChoiceInput: รายการที่เคยบันทึก + จำค่าเมื่อบันทึก */
export function useFieldHistory(k: string | undefined, value: string): string[] {
  const { companyId } = useAuth();
  const valueRef = useRef(value);
  valueRef.current = value;
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    if (!companyId || !k) return;
    listen();
    load(companyId, k).then(setList);
    const id = ++seq;
    registry.set(id, { companyId, key: k, get: () => valueRef.current || "", last: "" });
    return () => { registry.delete(id); };
  }, [companyId, k]);
  return list;
}
