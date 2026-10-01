import React, { useState } from 'react';
import { FormElement } from '../../types/formBuilder';
import { DB_TABLES, availableVariables } from '../../utils/dataBinding';
import { Eye, EyeOff, Trash2, ChevronDown, ChevronRight, AlignLeft, AlignCenter, AlignRight, Bold, Type, Minus, MoreHorizontal } from 'lucide-react';

interface PropertySheetProps {
  selectedElement: FormElement | undefined;
  onUpdate: (updates: Partial<FormElement>) => void;
  onDelete: () => void;
}

export const PropertySheet: React.FC<PropertySheetProps> = ({ selectedElement, onUpdate, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'Format' | 'Data' | 'All'>('Format');
  const [expandedTable, setExpandedTable] = useState<string | null>('customers');

  if (!selectedElement) {
    return (
      <div className="w-72 bg-surface-0/60 backdrop-blur-2xl border-l border-white/5 flex flex-col h-full flex-shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.5)] z-40 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-nexus-teal/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative px-4 py-3 bg-white/[0.02] text-[11px] font-semibold uppercase tracking-widest text-white/40 border-b border-white/5">
          Property Sheet
        </div>
        <div className="relative p-8 text-[10px] text-white/20 text-center leading-loose">
          คลิกเลือก Element บนหน้าเอกสาร<br />เพื่อดู Properties
        </div>
      </div>
    );
  }

  const isBoundControl = selectedElement.type === 'textbox';
  const isVisible = selectedElement.properties?.visible !== false;
  const controlSource = selectedElement.properties?.controlSource || '';
  const boundVariable = availableVariables.find(v => v.key === controlSource);

  return (
    <div className="w-72 bg-surface-0/60 backdrop-blur-2xl border-l border-white/5 flex flex-col h-full flex-shrink-0 overflow-hidden shadow-[-4px_0_24px_rgba(0,0,0,0.5)] z-40 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-nexus-teal/5 via-transparent to-transparent pointer-events-none" />
      {/* Header */}
      <div className="relative px-3 py-2.5 bg-white/[0.02] border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Property Sheet</span>
          <span className="px-2 py-0.5 bg-nexus-teal/10 border border-nexus-teal/20 rounded text-[9px] text-nexus-teal uppercase tracking-widest font-semibold shadow-[0_0_10px_rgba(20,163,204,0.2)]">
            {selectedElement.type}
          </span>
        </div>
        <div className="flex bg-white/5 border border-white/5 rounded p-0.5 relative">
          {(['Format', 'Data', 'All'] as const).map((tab) => {
            const tabLabel = tab === 'Format' ? 'รูปแบบ' : tab === 'Data' ? 'ข้อมูล' : 'ทั้งหมด';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative flex-1 text-[9px] py-1.5 rounded text-center transition-all duration-300 font-black uppercase tracking-widest ${
                  activeTab === tab ? 'bg-gradient-to-r from-nexus-teal to-teal-400 text-black shadow-[0_0_10px_rgba(20,163,204,0.3)]' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.02]'
                }`}
              >
                {tabLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/[0.03]">

        {/* ── DATA TAB ─────────────────────────────────────────── */}
        {(activeTab === 'Data' || activeTab === 'All') && (
          <div>
            <SectionHeader label="ข้อมูล" />

            {/* Visibility */}
            <PropRow label="การมองเห็น">
              <button
                onClick={() => onUpdate({ properties: { ...selectedElement.properties, visible: !isVisible } })}
                className={`flex items-center gap-1.5 h-6 px-2 rounded border text-[9px] font-black uppercase tracking-widest transition-all ${
                  isVisible ? 'bg-nexus-teal/10 border-nexus-teal/30 text-nexus-teal' : 'bg-white/5 border-white/10 text-white/30'
                }`}
              >
                {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
                {isVisible ? 'แสดง' : 'ซ่อน'}
              </button>
            </PropRow>

            {/* Control Source — textbox เท่านั้น */}
            {isBoundControl ? (
              <>
                {/* ค่าปัจจุบัน */}
                {controlSource && (
                  <div className="px-3 py-2 bg-nexus-teal/5 border-b border-nexus-teal/10">
                    <p className="text-[9px] font-semibold text-nexus-teal/50 uppercase tracking-widest mb-0.5">ผูกกับ:</p>
                    <p className="text-[11px] font-mono text-nexus-teal font-bold">{controlSource}</p>
                    {boundVariable && (
                      <p className="text-[10px] text-nexus-teal/60 mt-0.5">→ {boundVariable.neutralValue}</p>
                    )}
                    <button
                      onClick={() => onUpdate({ properties: { ...selectedElement.properties, controlSource: '' } })}
                      className="mt-1.5 text-[9px] font-black text-white/20 hover:text-danger transition-colors uppercase tracking-widest"
                    >
                      ✕ ยกเลิกการผูก
                    </button>
                  </div>
                )}

                {/* ── เลือกตาราง/Field ─────────────────────────────── */}
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest mb-2">เลือก Control Source จากฐานข้อมูล:</p>

                  {Object.entries(DB_TABLES).map(([tableKey, table]) => (
                    <div key={tableKey} className="mb-1 border border-white/5 rounded-lg overflow-hidden">
                      {/* Table Header */}
                      <button
                        onClick={() => setExpandedTable(expandedTable === tableKey ? null : tableKey)}
                        className="w-full flex items-center justify-between px-2.5 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                          <span>{table.icon}</span>
                          {table.label}
                        </span>
                        {expandedTable === tableKey
                          ? <ChevronDown size={11} className="text-white/30" />
                          : <ChevronRight size={11} className="text-white/30" />
                        }
                      </button>

                      {/* Fields */}
                      {expandedTable === tableKey && (
                        <div className="bg-white/[0.01]">
                          {table.fields.map(field => (
                            <button
                              key={field.key}
                              onClick={() => onUpdate({ properties: { ...selectedElement.properties, controlSource: field.key } })}
                              className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.04] transition-colors border-t border-white/[0.03] ${
                                controlSource === field.key ? 'bg-nexus-teal/5' : ''
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {controlSource === field.key && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-nexus-teal flex-shrink-0" />
                                )}
                                <span className={`text-[10px] font-bold truncate ${
                                  controlSource === field.key ? 'text-nexus-teal' : 'text-white/50'
                                }`}>
                                  {field.label}
                                </span>
                              </div>
                              <span className="text-[8px] font-mono text-white/20 ml-1 flex-shrink-0">
                                {field.fieldType}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-3 py-3 text-[10px] text-white/20 italic">
                เฉพาะ <span className="text-nexus-teal not-italic font-bold">Textbox (Data)</span> เท่านั้นที่รองรับการผูกข้อมูล
              </div>
            )}
          </div>
        )}

        {/* ── FORMAT TAB ─────────────────────────────────────────── */}
        {(activeTab === 'Format' || activeTab === 'All') && (
          <div>
            <SectionHeader label="รูปแบบ" />

            {/* Image Properties */}
            {selectedElement.type === 'image' && (
              <>
                <PropRow label="รูปลิงก์ URL">
                  <input type="text"
                    placeholder="https://... หรือ Base64"
                    value={selectedElement.properties?.imageUrl || ''}
                    onChange={e => onUpdate({ properties: { ...selectedElement.properties, imageUrl: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-nexus-teal/50 text-[9px] font-mono" />
                </PropRow>
                <div className="px-3 py-1.5 border-b border-white/[0.04]">
                  <label className="flex items-center justify-between w-full cursor-pointer bg-nexus-teal/10 hover:bg-nexus-teal/20 border border-nexus-teal/20 rounded px-2 py-1.5 transition-colors">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-nexus-teal">อัปโหลดรูปภาพ</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          onUpdate({ properties: { ...selectedElement.properties, imageUrl: reader.result as string } });
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                </div>
                <PropRow label="จัดวางภาพ">
                  <select value={selectedElement.style?.objectFit || 'contain'}
                    onChange={e => onUpdate({ style: { ...selectedElement.style, objectFit: e.target.value as any } })}
                    className="w-full bg-transparent text-white/80 focus:outline-none text-[10px]">
                    <option value="contain" className="bg-surface-1">Contain (พอดี)</option>
                    <option value="cover" className="bg-surface-1">Cover (เต็มกรอบ)</option>
                    <option value="fill" className="bg-surface-1">Fill (ยืด)</option>
                    <option value="none" className="bg-surface-1">None (ไม่ปรับ)</option>
                  </select>
                </PropRow>
              </>
            )}

            {/* Position & Size */}
            <div className="grid grid-cols-2 border-b border-white/5">
              <MiniRow label="X (px)" value={String(Math.round(selectedElement.position.x))}
                onChange={val => onUpdate({ position: { ...selectedElement.position, x: Number(val) || 0 } })} />
              <MiniRow label="Y (px)" value={String(Math.round(selectedElement.position.y))}
                onChange={val => onUpdate({ position: { ...selectedElement.position, y: Number(val) || 0 } })} />
            </div>
            <div className="grid grid-cols-2 border-b border-white/5">
              <MiniRow label="W (px)" value={String(Math.round(Number(selectedElement.size.width)))}
                onChange={val => onUpdate({ size: { ...selectedElement.size, width: Number(val) || 100 } })} />
              <MiniRow label="H (px)" value={String(Math.round(Number(selectedElement.size.height)))}
                onChange={val => onUpdate({ size: { ...selectedElement.size, height: Number(val) || 20 } })} />
            </div>

            {/* Text Formatting */}
            {['label', 'textbox', 'text'].includes(selectedElement.type) && (
              <>
                <PropRow label="ขนาดฟอนต์">
                  <input type="number" min="6" max="72"
                    value={selectedElement.style?.fontSize || 12}
                    onChange={e => onUpdate({ style: { ...selectedElement.style, fontSize: Number(e.target.value) } })}
                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white/90 focus:outline-none focus:border-nexus-teal/50 text-[11px] font-mono" />
                </PropRow>
                <PropRow label="รูปแบบฟอนต์">
                  <select value={selectedElement.style?.fontFamily || 'sans-serif'}
                    onChange={e => onUpdate({ style: { ...selectedElement.style, fontFamily: e.target.value } })}
                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white/90 focus:outline-none focus:border-nexus-teal/50 text-[10px]">
                    {['sans-serif','serif','monospace','Sarabun','Kanit','Prompt'].map(f =>
                      <option key={f} value={f} className="bg-surface-1">{f}</option>
                    )}
                  </select>
                </PropRow>
                <PropRow label="ความหนา">
                  <div className="flex bg-black/20 border border-white/10 rounded p-0.5 w-full">
                    <button
                      onClick={() => onUpdate({ style: { ...selectedElement.style, fontWeight: 'normal' } })}
                      className={`flex-1 flex justify-center py-1 rounded transition-colors ${selectedElement.style?.fontWeight === 'normal' || !selectedElement.style?.fontWeight ? 'bg-nexus-teal/20 text-nexus-teal' : 'text-white/40 hover:text-white/80'}`}
                    >
                      <Type size={12} />
                    </button>
                    <button
                      onClick={() => onUpdate({ style: { ...selectedElement.style, fontWeight: 'bold' } })}
                      className={`flex-1 flex justify-center py-1 rounded transition-colors ${selectedElement.style?.fontWeight === 'bold' ? 'bg-nexus-teal/20 text-nexus-teal' : 'text-white/40 hover:text-white/80'}`}
                    >
                      <Bold size={12} />
                    </button>
                  </div>
                </PropRow>
                <PropRow label="การจัดวาง">
                  <div className="flex bg-black/20 border border-white/10 rounded p-0.5 w-full">
                    <button
                      onClick={() => onUpdate({ style: { ...selectedElement.style, textAlign: 'left' } })}
                      className={`flex-1 flex justify-center py-1 rounded transition-colors ${selectedElement.style?.textAlign === 'left' || !selectedElement.style?.textAlign ? 'bg-nexus-teal/20 text-nexus-teal' : 'text-white/40 hover:text-white/80'}`}
                    >
                      <AlignLeft size={12} />
                    </button>
                    <button
                      onClick={() => onUpdate({ style: { ...selectedElement.style, textAlign: 'center' } })}
                      className={`flex-1 flex justify-center py-1 rounded transition-colors ${selectedElement.style?.textAlign === 'center' ? 'bg-nexus-teal/20 text-nexus-teal' : 'text-white/40 hover:text-white/80'}`}
                    >
                      <AlignCenter size={12} />
                    </button>
                    <button
                      onClick={() => onUpdate({ style: { ...selectedElement.style, textAlign: 'right' } })}
                      className={`flex-1 flex justify-center py-1 rounded transition-colors ${selectedElement.style?.textAlign === 'right' ? 'bg-nexus-teal/20 text-nexus-teal' : 'text-white/40 hover:text-white/80'}`}
                    >
                      <AlignRight size={12} />
                    </button>
                  </div>
                </PropRow>
                <PropRow label="สีข้อความ">
                  <ColorInput value={selectedElement.style?.color || '#000000'}
                    onChange={val => onUpdate({ style: { ...selectedElement.style, color: val } })} />
                </PropRow>
              </>
            )}

            <PropRow label="สีพื้นหลัง">
              <ColorInput value={selectedElement.style?.backgroundColor || '#ffffff'}
                onChange={val => onUpdate({ style: { ...selectedElement.style, backgroundColor: val } })} />
            </PropRow>
            <PropRow label="สีเส้นขอบ">
              <ColorInput value={selectedElement.style?.borderColor || '#000000'}
                onChange={val => onUpdate({ style: { ...selectedElement.style, borderColor: val } })} />
            </PropRow>
            <PropRow label="หนาเส้น">
              <input type="number" min="0" max="10"
                value={selectedElement.style?.borderWidth || 0}
                onChange={e => onUpdate({ style: { ...selectedElement.style, borderWidth: Number(e.target.value) } })}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white/90 focus:outline-none focus:border-nexus-teal/50 text-[11px] font-mono" />
            </PropRow>
            <PropRow label="รูปแบบเส้น">
              <div className="flex bg-black/20 border border-white/10 rounded p-0.5 w-full">
                {(['solid', 'dashed', 'dotted'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => onUpdate({ style: { ...selectedElement.style, borderStyle: s } })}
                    className={`flex-1 flex justify-center items-center py-1 rounded transition-colors ${
                      (selectedElement.style?.borderStyle || 'solid') === s ? 'bg-nexus-teal/20 text-nexus-teal' : 'text-white/40 hover:text-white/80'
                    }`}
                    title={s}
                  >
                    {s === 'solid' ? <Minus size={12} /> : s === 'dashed' ? <MoreHorizontal size={12} className="opacity-70" /> : <MoreHorizontal size={12} />}
                  </button>
                ))}
              </div>
            </PropRow>
            
            {/* Advanced Shapes & Spacing */}
            <PropRow label="ความโค้ง">
              <div className="flex items-center gap-1 w-full">
                <input type="number" min="0" max="999"
                  value={typeof selectedElement.style?.borderRadius === 'number' ? selectedElement.style.borderRadius : (parseInt(String(selectedElement.style?.borderRadius || 0)) || 0)}
                  onChange={e => onUpdate({ style: { ...selectedElement.style, borderRadius: Number(e.target.value) } })}
                  className="flex-1 min-w-0 bg-black/20 border border-white/10 rounded px-2 py-1 text-white/90 focus:outline-none focus:border-nexus-teal/50 text-[11px] font-mono" />
                <button
                  onClick={() => onUpdate({ style: { ...selectedElement.style, borderRadius: '50%' } })}
                  className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] hover:bg-nexus-teal/20 hover:text-nexus-teal hover:border-nexus-teal/30 text-white/50 transition-all font-bold uppercase"
                  title="ทำเป็นวงกลม"
                >
                  Circle
                </button>
              </div>
            </PropRow>
            <PropRow label="ระยะขอบ">
              <input type="number" min="0" max="100"
                value={selectedElement.style?.padding || 0}
                onChange={e => onUpdate({ style: { ...selectedElement.style, padding: Number(e.target.value) } })}
                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white/90 focus:outline-none focus:border-nexus-teal/50 text-[11px] font-mono" />
            </PropRow>
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="p-3 border-t border-white/5 flex-shrink-0">
        <button
          onClick={onDelete}
          className="w-full h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
        >
          <Trash2 size={12} /> Delete Element
        </button>
      </div>
    </div>
  );
};

// ── Helper Components ─────────────────────────────────────────────────────────

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.25em] border-b border-white/5 bg-white/[0.02] text-white/30">
    {label}
  </div>
);

const PropRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-5 border-b border-white/[0.04] hover:bg-white/[0.015]">
    <div className="col-span-2 px-3 py-1.5 text-white/30 border-r border-white/5 text-[10px] font-bold uppercase tracking-wider flex items-center truncate" title={label}>
      {label}
    </div>
    <div className="col-span-3 px-2 py-1 flex items-center">
      {children}
    </div>
  </div>
);

const MiniRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="px-2 py-1.5 border-r border-b border-white/[0.04] bg-white/[0.01]">
    <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest mb-1">{label}</p>
    <input type="number" value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white/90 focus:outline-none focus:border-nexus-teal/50 text-[11px] font-mono" />
  </div>
);

const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center gap-2 w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus-within:border-nexus-teal/50">
    <div className="w-3 h-3 rounded-sm border border-white/20 overflow-hidden flex-shrink-0 relative">
      <input type="color" value={value === 'transparent' ? '#ffffff' : value}
        onChange={e => onChange(e.target.value)}
        className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer" />
    </div>
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-transparent text-white/90 focus:outline-none font-mono text-[11px]" />
  </div>
);
