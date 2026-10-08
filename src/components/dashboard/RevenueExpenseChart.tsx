"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/Base";
import { compactBaht, fullBaht, type MonthlyPL } from "@/lib/dashboard-metrics";

// สีชุดข้อมูล (ผ่านการตรวจสีบนพื้นมืด #0F0F12: ความต่างสำหรับผู้ตาบอดสี/ความคมชัด)
const SERIES = [
  { key: "revenue", label: "รายได้", color: "#199e70" },
  { key: "expense", label: "ต้นทุนและค่าใช้จ่าย", color: "#d95926" },
] as const;

const HEIGHT = 240;
const PAD = { top: 16, right: 8, bottom: 28, left: 56 };

// แกน y เป็นตัวเลขกลม ๆ (0 / 5,000 / 10,000 ...) ประมาณ 4-5 ช่อง
function niceScale(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 1000, step: 250 };
  const raw = v / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
  return { max: Math.ceil(v / step) * step, step };
}

// แท่งหัวมน 4px ฐานเหลี่ยม
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function RevenueExpenseChart({ data }: { data: MonthlyPL[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasData = data.some((d) => d.revenue !== 0 || d.expense !== 0);
  const { max, step } = niceScale(Math.max(...data.flatMap((d) => [d.revenue, d.expense]), 0));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(24, (band - 16) / 2);
  const y = (v: number) => PAD.top + plotH - (Math.max(0, v) / max) * plotH;

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="space-y-3">
      {/* Legend + table toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-2 text-[12px] text-white/60">
              <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="text-[12px] font-bold text-white/50 hover:text-white underline-offset-2 hover:underline"
        >
          {showTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-white/50 border-b border-white/10">
              <th className="text-left font-medium py-2">เดือน</th>
              <th className="text-right font-medium py-2">รายได้</th>
              <th className="text-right font-medium py-2">ต้นทุนและค่าใช้จ่าย</th>
              <th className="text-right font-medium py-2">กำไร (ขาดทุน)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-b border-white/5">
                <td className="py-2 text-white/80">{d.label}</td>
                <td className="py-2 text-right font-mono text-white/80">{fullBaht(d.revenue)}</td>
                <td className="py-2 text-right font-mono text-white/80">{fullBaht(d.expense)}</td>
                <td className={cn("py-2 text-right font-mono", d.revenue - d.expense < 0 ? "text-danger" : "text-white")}>{fullBaht(d.revenue - d.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={boxRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
          {!hasData && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-white/40 z-10 pointer-events-none">
              ยังไม่มีรายการบัญชีรายได้หรือค่าใช้จ่ายใน 6 เดือนล่าสุด
            </div>
          )}
          <svg width={width} height={HEIGHT} role="img" aria-label="กราฟรายได้และค่าใช้จ่ายรายเดือน" className="block">
            {/* gridlines + y ticks */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.45)">
                  {compactBaht(t)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const isHover = hover === i;
              return (
                <g
                  key={d.key}
                  tabIndex={0}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                >
                  {/* พื้นที่ hover ทั้งช่องเดือน */}
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill={isHover ? "rgba(255,255,255,0.04)" : "transparent"} />
                  {SERIES.map((s, si) => {
                    const v = d[s.key];
                    const bx = cx - barW - 1 + si * (barW + 2);
                    const by = y(v);
                    return <path key={s.key} d={barPath(bx, by, barW, PAD.top + plotH - by)} fill={s.color} opacity={hover === null || isHover ? 1 : 0.55} />;
                  })}
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={isHover ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)"}>
                    {d.label}
                  </text>
                </g>
              );
            })}
            <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          </svg>

          {/* Tooltip */}
          {hovered && hover !== null && (
            <div
              className="absolute top-2 z-20 pointer-events-none bg-surface-1/95 border border-white/10 rounded-xl px-3 py-2 shadow-2xl min-w-[180px]"
              style={{
                left: Math.min(Math.max(0, PAD.left + band * hover + band / 2 - 90), width - 190),
              }}
            >
              <p className="text-[12px] text-white/50 mb-1">{hovered.label}</p>
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-[12px] text-white/60">
                    <span className="w-3 h-[2px] rounded" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="text-[13px] font-bold font-mono text-white">{fullBaht(hovered[s.key])}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-t border-white/10 mt-1 pt-1">
                <span className="text-[12px] text-white/60">กำไร (ขาดทุน)</span>
                <span className={cn("text-[13px] font-bold font-mono", hovered.revenue - hovered.expense < 0 ? "text-danger" : "text-white")}>
                  {fullBaht(hovered.revenue - hovered.expense)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
