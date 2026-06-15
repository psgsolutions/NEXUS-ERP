'use client';

import React, { useState, useRef } from 'react';
import {
  Database, ChevronDown, ChevronRight, Plus,
  Eye, EyeOff, RefreshCw, MousePointerClick, GripVertical
} from 'lucide-react';
import { FormTemplate, FormElement } from '../../types/formBuilder';
import { DB_TABLES, BindingVariable, availableVariables, getNeutralData } from '../../utils/dataBinding';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FieldListPanelProps {
  template: FormTemplate;
  previewData: Record<string, string>;
  onUpdateData: (data: Record<string, string>) => void;
  onAddBoundField: (field: BindingVariable, position?: { x: number; y: number }) => void;
  onToggleElementVisibility: (id: string, visible: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const FieldListPanel: React.FC<FieldListPanelProps> = ({
  template,
  previewData,
  onUpdateData,
  onAddBoundField,
  onToggleElementVisibility,
}) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'preview' | 'elements'>('fields');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({ customers: true, quotations: true });
  const [searchQuery, setSearchQuery] = useState('');

  const toggleTable = (key: string) =>
    setExpandedTables(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Filter fields by search ──────────────────────────────────────────────
  const filteredTables = Object.entries(DB_TABLES)
    .map(([key, table]) => ({
      key,
      table,
      fields: searchQuery
        ? table.fields.filter(f =>
            f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.key.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : table.fields,
    }))
    .filter(t => t.fields.length > 0);

  // ── Track which keys are already used on canvas ───────────────────────────
  const usedKeys = new Set(
    template.elements
      .filter(el => el.properties?.controlSource)
      .map(el => el.properties!.controlSource as string)
  );

  return (
    <div className="w-72 bg-[#050505]/60 backdrop-blur-2xl border-r border-white/5 flex flex-col h-full flex-shrink-0 overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-40 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-nexus-teal/5 via-transparent to-transparent pointer-events-none" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="relative px-3 py-2.5 bg-white/[0.02] border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Database size={13} className="text-nexus-teal" />
          <span className="text-[11px] font-black text-white/70 uppercase tracking-widest">Field List</span>
          <span className="ml-auto text-[9px] font-black text-white/20 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded">
            {template.elements.filter(e => e.properties?.controlSource).length} bound
          </span>
        </div>
        <p className="text-[9px] text-white/25 leading-relaxed">
          กด <span className="text-nexus-teal font-black">+</span> เพื่อเพิ่ม Label+Data Box ลงฟอร์มทันที
        </p>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/5 flex-shrink-0 bg-white/[0.01]">
        {([
          ['fields',   'Field List'],
          ['preview',  'Preview Data'],
          ['elements', 'Elements'],
        ] as const).map(([tab, lbl]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
              activeTab === tab
                ? 'text-nexus-teal bg-nexus-teal/[0.08] shadow-[inset_0_-2px_0_0_rgba(20,163,204,1)]'
                : 'text-white/25 hover:text-white/60 hover:bg-white/[0.02]'
            }`}
          >
            {activeTab === tab && <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-nexus-teal/50 to-transparent" />}
            {lbl}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* ══════════════════════════════════════════════════════
            TAB 1: FIELD LIST — หัวใจหลัก
            กด + เพิ่ม Label+Textbox คู่ลง Canvas
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'fields' && (
          <div className="flex flex-col h-full">
            {/* Search */}
            <div className="p-2 border-b border-white/5 flex-shrink-0">
              <input
                type="text"
                placeholder="ค้นหา field..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-white/70 placeholder:text-white/20 focus:outline-none focus:border-nexus-teal/30"
              />
            </div>

            {/* ── Instruction banner ─────────────────────────── */}
            <div className="mx-2 mt-2 mb-1 px-3 py-2 rounded-lg bg-nexus-teal/5 border border-nexus-teal/15 flex items-start gap-2">
              <MousePointerClick size={13} className="text-nexus-teal flex-shrink-0 mt-0.5" />
              <p className="text-[9px] text-nexus-teal/70 leading-relaxed">
                กดปุ่ม <span className="font-black text-nexus-teal">+</span> ข้างชื่อ Field เพื่อเพิ่ม Label + Data Box ลงบนฟอร์มอัตโนมัติ
              </p>
            </div>

            {/* ── Table Groups ───────────────────────────────── */}
            <div className="p-2 space-y-1">
              {filteredTables.map(({ key: tableKey, table, fields }) => {
                const usedCount = fields.filter(f => usedKeys.has(f.key)).length;

                return (
                  <div key={tableKey} className="rounded-xl border border-white/[0.06] overflow-hidden">
                    {/* Table header */}
                    <button
                      onClick={() => toggleTable(tableKey)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-300 ${
                        usedCount > 0
                          ? 'bg-gradient-to-r from-nexus-teal/[0.08] to-transparent hover:from-nexus-teal/[0.12]'
                          : 'bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="text-base leading-none drop-shadow-md">{table.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-black uppercase tracking-wider truncate ${
                          usedCount > 0 ? 'text-nexus-teal drop-shadow-[0_0_8px_rgba(20,163,204,0.5)]' : 'text-white/40'
                        }`}>
                          {table.label.split(' (')[0]}
                        </p>
                      </div>
                      {usedCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-nexus-teal/20 text-nexus-teal text-[8px] font-black rounded-full">
                          {usedCount}
                        </span>
                      )}
                      {expandedTables[tableKey]
                        ? <ChevronDown size={11} className="text-white/20 flex-shrink-0" />
                        : <ChevronRight size={11} className="text-white/20 flex-shrink-0" />
                      }
                    </button>

                    {/* Fields */}
                    {expandedTables[tableKey] && (
                      <div className="divide-y divide-white/[0.03] border-t border-white/[0.04]">
                        {fields.map(field => {
                          const isUsed = usedKeys.has(field.key);
                          return (
                            <FieldRow
                              key={field.key}
                              field={field}
                              isUsed={isUsed}
                              onAdd={() => onAddBoundField(field)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2: PREVIEW DATA — แก้ไขค่า Preview
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'preview' && (
          <div className="p-2 space-y-2">
            <button
              onClick={() => onUpdateData(getNeutralData())}
              className="w-full flex items-center justify-center gap-1.5 h-7 rounded-lg bg-white/5 border border-white/5 text-white/40 hover:text-white/80 text-[9px] font-black uppercase tracking-widest transition-all"
            >
              <RefreshCw size={10} /> รีเซ็ตค่า Preview
            </button>

            <p className="text-[9px] text-white/20 text-center px-2 leading-relaxed">
              แก้ไขค่าด้านล่างเพื่อจำลองข้อมูลจริงบนหน้า Preview
            </p>

            {/* แสดงเฉพาะ fields ที่ถูกใช้บน canvas */}
            {usedKeys.size === 0 ? (
              <div className="text-center py-8">
                <p className="text-[10px] text-white/20">ยังไม่มี Data Box บนฟอร์ม</p>
                <p className="text-[9px] text-white/15 mt-1">ไปที่ Tab "Field List" เพื่อเพิ่ม Field</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <div className="px-3 py-1.5 bg-white/[0.02] text-[9px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
                  Fields ที่ใช้บนฟอร์ม ({usedKeys.size})
                </div>
                {Array.from(usedKeys).map(key => {
                  const variable = availableVariables.find(v => v.key === key);
                  if (!variable) return null;
                  return (
                    <div key={key} className="grid grid-cols-5 border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <div className="col-span-2 px-2 py-1.5 text-[9px] font-bold text-nexus-teal/60 truncate flex items-center border-r border-white/5 gap-1">
                        <span className="w-1 h-1 rounded-full bg-nexus-teal flex-shrink-0" />
                        {variable.label}
                      </div>
                      <div className="col-span-3 px-1 py-1 flex items-center">
                        <input
                          type="text"
                          value={previewData[key] ?? variable.neutralValue}
                          onChange={e => onUpdateData({ ...previewData, [key]: e.target.value })}
                          className="w-full bg-transparent text-white/70 text-[10px] font-mono focus:outline-none focus:bg-white/5 px-1 rounded"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3: ELEMENTS — ซ่อน/แสดง
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'elements' && (
          <div className="p-2 space-y-1.5">
            {template.elements.length === 0 && (
              <div className="text-center py-10">
                <p className="text-[10px] text-white/20">ยังไม่มี Element บนฟอร์ม</p>
                <p className="text-[9px] text-white/15 mt-1">เพิ่ม Field จาก Tab "Field List"</p>
              </div>
            )}
            {template.elements.map((el, i) => {
              const isVisible = el.properties?.visible !== false;
              const controlSource = el.properties?.controlSource;
              const variable = controlSource ? availableVariables.find(v => v.key === controlSource) : null;
              const label = variable?.label
                || (el.content ? el.content.replace(/<[^>]+>/g, '').slice(0, 24).trim() : '')
                || `${el.type} ${i + 1}`;

              return (
                <div key={el.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    isVisible ? 'border-white/[0.06] bg-white/[0.02]' : 'border-white/[0.03] opacity-40'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white/60 truncate">{label}</p>
                    <p className="text-[9px] font-mono text-white/20 mt-0.5">
                      {el.type}{controlSource ? ` ← ${controlSource.split('.').pop()}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggleElementVisibility(el.id, !isVisible)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all flex-shrink-0 ${
                      isVisible
                        ? 'bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal'
                        : 'bg-white/5 border-white/5 text-white/20'
                    }`}
                    title={isVisible ? 'ซ่อน' : 'แสดง'}
                  >
                    {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── FieldRow: แต่ละ field ในรายการ ──────────────────────────────────────────
interface FieldRowProps {
  field: BindingVariable;
  isUsed: boolean;
  onAdd: () => void;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, isUsed, onAdd }) => {
  const fieldTypeIcon: Record<string, string> = {
    text: 'T', number: '#', date: '📅', currency: '฿',
  };

  return (
    <div className={`relative flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/[0.05] group transition-all duration-300 ${
      isUsed ? 'bg-gradient-to-r from-nexus-teal/[0.05] to-transparent' : ''
    }`}>
      {isUsed && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-nexus-teal shadow-[0_0_8px_rgba(20,163,204,0.8)]" />}
      {/* Field type badge */}
      <span className={`w-4 h-4 flex items-center justify-center text-[8px] font-black rounded flex-shrink-0 ${
        field.fieldType === 'currency' ? 'bg-green-500/10 text-green-400'
        : field.fieldType === 'date'   ? 'bg-blue-500/10  text-blue-400'
        : field.fieldType === 'number' ? 'bg-amber-500/10 text-amber-400'
        : 'bg-white/5 text-white/30'
      }`}>
        {fieldTypeIcon[field.fieldType] || 'T'}
      </span>

      {/* Field name */}
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold truncate ${isUsed ? 'text-nexus-teal/80' : 'text-white/50'}`}>
          {field.label}
        </p>
        <p className="text-[8px] font-mono text-white/20 truncate">{field.key}</p>
      </div>

      {/* Used indicator */}
      {isUsed && (
        <span className="text-[8px] text-nexus-teal/50 font-black flex-shrink-0">✓</span>
      )}

      {/* ADD button — ปุ่มหลัก */}
      <button
        onClick={onAdd}
        className="w-6 h-6 flex items-center justify-center rounded-lg bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal opacity-0 group-hover:opacity-100 hover:bg-nexus-teal hover:text-black transition-all flex-shrink-0"
        title={`เพิ่ม "${field.label}" ลงฟอร์ม`}
      >
        <Plus size={12} />
      </button>
    </div>
  );
};
