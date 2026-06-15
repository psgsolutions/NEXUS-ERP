import React, { useState } from 'react';
import { Database, Eye, EyeOff, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { FormTemplate, FormElement } from '../../types/formBuilder';
import { DB_TABLES, availableVariables, getNeutralData } from '../../utils/dataBinding';

interface DataPreviewPanelProps {
  template: FormTemplate;
  previewData: Record<string, string>;
  onUpdateData: (data: Record<string, string>) => void;
  onToggleElementVisibility: (id: string, visible: boolean) => void;
}

export const DataPreviewPanel: React.FC<DataPreviewPanelProps> = ({
  template,
  previewData,
  onUpdateData,
  onToggleElementVisibility,
}) => {
  const [activeTab, setActiveTab] = useState<'data' | 'elements'>('data');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({
    customers: true, quotations: true,
  });

  const toggleTable = (key: string) =>
    setExpandedTables(prev => ({ ...prev, [key]: !prev[key] }));

  // กรองเฉพาะ tables ที่มี field ถูกใช้งานบนหน้า
  const usedKeys = new Set(
    template.elements
      .filter(el => el.properties?.controlSource)
      .map(el => el.properties!.controlSource as string)
  );

  return (
    <div className="w-72 bg-[#0a0a0c] border-r border-white/5 flex flex-col h-full flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Database size={13} className="text-nexus-teal" />
          <span className="text-[11px] font-black text-white/70 uppercase tracking-widest">Data Preview</span>
        </div>
        <p className="text-[10px] text-white/25 leading-relaxed">
          แก้ไขค่าด้านล่างเพื่อดูหน้าตาเอกสารจริงก่อน Preview
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 flex-shrink-0">
        {([['data', 'ข้อมูล'], ['elements', 'Elements']] as const).map(([tab, lbl]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
              activeTab === tab
                ? 'text-nexus-teal border-b-2 border-nexus-teal bg-nexus-teal/5'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* ── Tab: Data Fields ─────────────────────────────────── */}
        {activeTab === 'data' && (
          <div className="p-3 space-y-2">
            <button
              onClick={() => onUpdateData(getNeutralData())}
              className="w-full flex items-center justify-center gap-1.5 h-7 rounded-lg bg-white/5 border border-white/5 text-white/40 hover:text-white/80 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <RefreshCw size={10} /> รีเซ็ตข้อมูล Preview
            </button>

            {Object.entries(DB_TABLES).map(([tableKey, table]) => {
              // แสดงทุก table แต่ highlight ที่ถูกใช้บนฟอร์ม
              const usedFieldsInTable = table.fields.filter(f => usedKeys.has(f.key));
              const isUsed = usedFieldsInTable.length > 0;

              return (
                <div key={tableKey} className={`rounded-xl border overflow-hidden ${isUsed ? 'border-nexus-teal/20' : 'border-white/5'}`}>
                  <button
                    onClick={() => toggleTable(tableKey)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-wider border-b border-white/5 ${
                      isUsed ? 'bg-nexus-teal/5 text-nexus-teal' : 'bg-white/[0.02] text-white/30'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {table.icon} {table.label}
                      {isUsed && <span className="px-1 py-0.5 bg-nexus-teal/20 rounded text-[8px]">{usedFieldsInTable.length} field</span>}
                    </span>
                    {expandedTables[tableKey] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>

                  {expandedTables[tableKey] && (
                    <div className="divide-y divide-white/[0.03]">
                      {table.fields.map(field => (
                        <div key={field.key} className={`grid grid-cols-5 hover:bg-white/[0.02] ${usedKeys.has(field.key) ? 'bg-nexus-teal/[0.02]' : ''}`}>
                          <div className="col-span-2 px-2 py-1.5 text-[9px] font-bold truncate flex items-center border-r border-white/5 gap-1"
                            title={field.label}>
                            {usedKeys.has(field.key) && <span className="w-1 h-1 rounded-full bg-nexus-teal flex-shrink-0" />}
                            <span className={usedKeys.has(field.key) ? 'text-nexus-teal/70' : 'text-white/30'}>
                              {field.label}
                            </span>
                          </div>
                          <div className="col-span-3 px-1 py-1 flex items-center">
                            <input
                              type="text"
                              value={previewData[field.key] ?? field.neutralValue}
                              onChange={e => onUpdateData({ ...previewData, [field.key]: e.target.value })}
                              className="w-full bg-transparent text-white/70 text-[10px] font-mono focus:outline-none focus:bg-white/5 px-1 rounded"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tab: Elements ────────────────────────────────────── */}
        {activeTab === 'elements' && (
          <div className="p-3 space-y-1.5">
            {template.elements.length === 0 && (
              <p className="text-center text-[10px] text-white/20 py-10 uppercase tracking-widest">ยังไม่มี Element บนหน้าเอกสาร</p>
            )}
            {template.elements.map((el, i) => {
              const isVisible = el.properties?.visible !== false;
              const controlSource = el.properties?.controlSource;
              const variable = controlSource ? availableVariables.find(v => v.key === controlSource) : null;
              const label = variable?.label || (el.content ? el.content.replace(/<[^>]+>/g, '').slice(0, 22) : `${el.type} ${i + 1}`);

              return (
                <div key={el.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    isVisible ? 'border-white/5 bg-white/[0.02]' : 'border-white/[0.03] opacity-40'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white/60 truncate">{label}</p>
                    <p className="text-[9px] font-mono text-white/20 mt-0.5 uppercase">
                      {el.type}{controlSource ? ` ← ${controlSource}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggleElementVisibility(el.id, !isVisible)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all flex-shrink-0 ${
                      isVisible ? 'bg-nexus-teal/10 border-nexus-teal/30 text-nexus-teal' : 'bg-white/5 border-white/5 text-white/20'
                    }`}
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
