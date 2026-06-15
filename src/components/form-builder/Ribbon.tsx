import React from 'react';
import { Type, Square, Minus, Database, Image, Table } from 'lucide-react';
import { FormElement } from '../../types/formBuilder';

interface RibbonProps {
  onAddElement: (type: FormElement['type']) => void;
}

const CONTROLS: { type: FormElement['type']; icon: React.ReactNode; label: string; sub: string; color: string }[] = [
  { type: 'label',     icon: <Type size={20} />,     label: 'Label',    sub: 'ข้อความคงที่',    color: 'amber' },
  { type: 'textbox',   icon: <Database size={20} />,  label: 'Data Box', sub: 'ผูกข้อมูล DB',    color: 'teal' },
  { type: 'rectangle', icon: <Square size={20} />,    label: 'กรอบ',     sub: 'วาดสี่เหลี่ยม',  color: 'blue' },
  { type: 'line',      icon: <Minus size={20} />,     label: 'เส้นตรง',  sub: 'เส้นแบ่งส่วน',   color: 'slate' },
  { type: 'image',     icon: <Image size={20} />,     label: 'รูปภาพ',   sub: 'Logo / ภาพ',      color: 'purple' },
];

const COLOR_MAP: Record<string, string> = {
  amber:  'hover:border-amber-400/40  hover:text-amber-300  group-hover:bg-amber-400/10  group-hover:border-amber-400/20  group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  teal:   'hover:border-nexus-teal/40 hover:text-nexus-teal group-hover:bg-nexus-teal/10 group-hover:border-nexus-teal/20 group-hover:drop-shadow-[0_0_8px_rgba(20,163,204,0.8)]',
  blue:   'hover:border-blue-400/40   hover:text-blue-300   group-hover:bg-blue-400/10   group-hover:border-blue-400/20   group-hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]',
  slate:  'hover:border-slate-400/40  hover:text-slate-300  group-hover:bg-slate-400/10  group-hover:border-slate-400/20  group-hover:drop-shadow-[0_0_8px_rgba(148,163,184,0.6)]',
  purple: 'hover:border-purple-400/40 hover:text-purple-300 group-hover:bg-purple-400/10 group-hover:border-purple-400/20 group-hover:drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]',
};

export const Ribbon: React.FC<RibbonProps> = ({ onAddElement }) => {
  return (
    <div className="relative w-full bg-[#050505]/60 backdrop-blur-2xl border-b border-white/5 flex items-center px-4 h-20 flex-shrink-0 gap-2 overflow-x-auto z-40">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none" />

      {/* Section Label */}
      <div className="flex flex-col items-center border-r border-white/5 pr-4 mr-2 h-full justify-center flex-shrink-0">
        <span className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-black whitespace-nowrap">Controls</span>
      </div>

      {/* Control Buttons */}
      {CONTROLS.map(ctrl => {
        const [hoverBorder, hoverText, iconBg, iconBorder, iconGlow] = COLOR_MAP[ctrl.color].split(' ');
        return (
          <button
            key={ctrl.type}
            onClick={() => onAddElement(ctrl.type)}
            className={`group flex items-center gap-2.5 h-9 px-6 rounded-full border border-white/[0.06] bg-white/[0.02] text-white/50 transition-all duration-200 flex-shrink-0 ${hoverBorder} ${hoverText}`}
            title={ctrl.sub}
          >
            <div className={`w-9 h-9 rounded-lg bg-white/5 border border-white/[0.06] flex items-center justify-center transition-all ${iconBg} ${iconBorder}`}>
              <span className={`transition-all ${iconGlow}`}>{ctrl.icon}</span>
            </div>
            <div className="text-left">
              <div className="text-[11px] font-black uppercase tracking-widest text-white group-hover:text-inherit transition-colors">{ctrl.label}</div>
              <div className="text-[9px] font-bold text-white/25 mt-0.5">{ctrl.sub}</div>
            </div>
          </button>
        );
      })}

      {/* Divider */}
      <div className="border-l border-white/5 h-12 mx-2 flex-shrink-0" />

      {/* Helper tip */}
      <div className="flex flex-col justify-center flex-shrink-0">
        <p className="text-[9px] font-black text-white/15 uppercase tracking-widest">วิธีใช้</p>
        <p className="text-[9px] text-white/20 mt-0.5 leading-relaxed">
          คลิกปุ่มเพื่อเพิ่ม Element<br />
          ลาก Element เพื่อย้ายตำแหน่ง<br />
          คลิก Element → Property Sheet
        </p>
      </div>
    </div>
  );
};
