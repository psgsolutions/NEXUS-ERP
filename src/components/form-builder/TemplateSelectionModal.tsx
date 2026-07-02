import React, { useState } from 'react';
import { X, FileText, Plus, Sparkles } from 'lucide-react';
import { FormTemplate } from '../../types/formBuilder';

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: FormTemplate | null) => void;
}

const TEMPLATES: Partial<FormTemplate>[] = [
  {
    id: 'blank',
    name: 'เริ่มต้นว่างเปล่า',
    description: 'สร้างเอกสารใหม่ตั้งแต่ต้น',
    paperSize: 'A4',
    orientation: 'portrait',
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    elements: [],
  },
  {
    id: 'invoice',
    name: 'ใบแจ้งหนี้',
    description: 'แม่แบบใบแจ้งหนี้มาตรฐาน พร้อม Label ผูกข้อมูลลูกค้า',
    paperSize: 'A4',
    orientation: 'portrait',
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    elements: [
      // หัวเอกสาร
      { id: 'e1', type: 'text', position: { x: 20, y: 20 }, size: { width: 300, height: 36 },
        content: '<p style="font-size:22px;font-weight:bold;color:#2563EB;">ใบแจ้งหนี้</p>',
        style: { fontSize: 22, fontWeight: 'bold', color: '#2563EB' }, properties: { visible: true } },
      // เส้นแบ่ง
      { id: 'e2', type: 'line', position: { x: 20, y: 60 }, size: { width: 750, height: 2 },
        style: { borderColor: '#2563EB', borderWidth: 2, borderStyle: 'solid' }, properties: { visible: true } },
      // Label: เรียน
      { id: 'e3', type: 'label', position: { x: 20, y: 80 }, size: { width: 60, height: 24 },
        content: '<p style="font-size:11px;font-weight:bold;color:#4B5563;">เรียน:</p>',
        style: { fontSize: 11, fontWeight: 'bold', color: '#4B5563' }, properties: { visible: true } },
      // Textbox: ชื่อลูกค้า
      { id: 'e4', type: 'textbox', position: { x: 85, y: 80 }, size: { width: 300, height: 24 },
        content: '',
        style: { fontSize: 12, fontWeight: 'bold', color: '#1F2937', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'customerName', visible: true } },
      // Label: ที่อยู่
      { id: 'e5', type: 'label', position: { x: 20, y: 108 }, size: { width: 60, height: 24 },
        content: '<p style="font-size:11px;color:#4B5563;">ที่อยู่:</p>',
        style: { fontSize: 11, color: '#4B5563' }, properties: { visible: true } },
      // Textbox: ที่อยู่ลูกค้า
      { id: 'e6', type: 'textbox', position: { x: 85, y: 108 }, size: { width: 400, height: 24 },
        content: '',
        style: { fontSize: 11, color: '#374151', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'customerAddress', visible: true } },
      // Label: โทร
      { id: 'e7', type: 'label', position: { x: 20, y: 136 }, size: { width: 60, height: 24 },
        content: '<p style="font-size:11px;color:#4B5563;">โทร:</p>',
        style: { fontSize: 11, color: '#4B5563' }, properties: { visible: true } },
      // Textbox: เบอร์โทร
      { id: 'e8', type: 'textbox', position: { x: 85, y: 136 }, size: { width: 150, height: 24 },
        content: '',
        style: { fontSize: 11, color: '#374151', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'customerPhone', visible: true } },
      // Label: เลขที่เอกสาร
      { id: 'e9', type: 'label', position: { x: 560, y: 80 }, size: { width: 80, height: 24 },
        content: '<p style="font-size:11px;color:#4B5563;">เลขที่:</p>',
        style: { fontSize: 11, color: '#4B5563' }, properties: { visible: true } },
      // Textbox: เลขที่เอกสาร
      { id: 'e10', type: 'textbox', position: { x: 645, y: 80 }, size: { width: 130, height: 24 },
        content: '',
        style: { fontSize: 11, fontWeight: 'bold', color: '#1F2937', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'documentNo', visible: true } },
      // Label: วันที่
      { id: 'e11', type: 'label', position: { x: 560, y: 108 }, size: { width: 80, height: 24 },
        content: '<p style="font-size:11px;color:#4B5563;">วันที่:</p>',
        style: { fontSize: 11, color: '#4B5563' }, properties: { visible: true } },
      // Textbox: วันที่เอกสาร
      { id: 'e12', type: 'textbox', position: { x: 645, y: 108 }, size: { width: 130, height: 24 },
        content: '',
        style: { fontSize: 11, color: '#374151', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'issueDate', visible: true } },
      // เส้นแบ่ง 2
      { id: 'e13', type: 'line', position: { x: 20, y: 172 }, size: { width: 750, height: 1 },
        style: { borderColor: '#E5E7EB', borderWidth: 1, borderStyle: 'solid' }, properties: { visible: true } },
      // ยอดรวม Label
      { id: 'e14', type: 'label', position: { x: 560, y: 190 }, size: { width: 80, height: 24 },
        content: '<p style="font-size:12px;font-weight:bold;color:#111827;">ยอดรวม:</p>',
        style: { fontSize: 12, fontWeight: 'bold', color: '#111827' }, properties: { visible: true } },
      // Textbox: ยอดรวม
      { id: 'e15', type: 'textbox', position: { x: 645, y: 190 }, size: { width: 130, height: 24 },
        content: '',
        style: { fontSize: 13, fontWeight: 'bold', color: '#2563EB', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'grandTotal', visible: true } },
    ],
  },
  {
    id: 'quotation',
    name: 'ใบเสนอราคา',
    description: 'แม่แบบใบเสนอราคา พร้อมข้อมูลบริษัทและลูกค้า',
    paperSize: 'A4',
    orientation: 'portrait',
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    elements: [
      { id: 'q1', type: 'text', position: { x: 20, y: 20 }, size: { width: 400, height: 36 },
        content: '<p style="font-size:20px;font-weight:bold;color:#1D4ED8;">ใบเสนอราคา</p>',
        style: { fontSize: 20, fontWeight: 'bold', color: '#1D4ED8' }, properties: { visible: true } },
      { id: 'q2', type: 'textbox', position: { x: 20, y: 64 }, size: { width: 350, height: 22 },
        content: '', style: { fontSize: 11, fontWeight: 'bold', color: '#111827', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'companyName', visible: true } },
      { id: 'q3', type: 'textbox', position: { x: 20, y: 88 }, size: { width: 350, height: 22 },
        content: '', style: { fontSize: 10, color: '#6B7280', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'companyAddress', visible: true } },
      { id: 'q4', type: 'line', position: { x: 20, y: 120 }, size: { width: 750, height: 2 },
        style: { borderColor: '#1D4ED8', borderWidth: 2, borderStyle: 'solid' }, properties: { visible: true } },
      { id: 'q5', type: 'label', position: { x: 20, y: 135 }, size: { width: 80, height: 22 },
        content: '<p style="font-size:10px;color:#6B7280;font-weight:bold;">เรียน:</p>',
        style: { fontSize: 10, color: '#6B7280', fontWeight: 'bold' }, properties: { visible: true } },
      { id: 'q6', type: 'textbox', position: { x: 100, y: 135 }, size: { width: 280, height: 22 },
        content: '', style: { fontSize: 11, fontWeight: 'bold', color: '#111827', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'customerName', visible: true } },
      { id: 'q7', type: 'label', position: { x: 20, y: 160 }, size: { width: 80, height: 22 },
        content: '<p style="font-size:10px;color:#6B7280;">ที่อยู่:</p>',
        style: { fontSize: 10, color: '#6B7280' }, properties: { visible: true } },
      { id: 'q8', type: 'textbox', position: { x: 100, y: 160 }, size: { width: 380, height: 22 },
        content: '', style: { fontSize: 10, color: '#374151', borderWidth: 0, backgroundColor: 'transparent' },
        properties: { controlSource: 'customerAddress', visible: true } },
    ],
  },
];

export const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({
  isOpen, onClose, onSelectTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-white uppercase tracking-widest">เลือกแม่แบบเอกสาร</h2>
              <p className="text-[10px] text-white/30 font-bold tracking-widest">SELECT A TEMPLATE TO BEGIN</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-white/30 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Grid of Templates */}
        <div className="p-6 grid grid-cols-3 gap-4 overflow-y-auto custom-scrollbar">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template as FormTemplate)}
              className="group text-left border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl p-4 hover:border-nexus-teal/30 transition-all duration-300"
            >
              {/* Preview thumbnail */}
              <div className="w-full h-36 bg-white rounded-lg mb-4 overflow-hidden relative border border-white/10 group-hover:border-nexus-teal/30 transition-colors">
                {template.id === 'blank' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                    <Plus size={28} className="text-gray-300" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Blank</span>
                  </div>
                ) : (
                  <div className="w-full h-full p-2 scale-[0.6] origin-top-left" style={{ width: '167%', height: '167%' }}>
                    {/* Mini preview */}
                    <div className="w-1/2 h-4 bg-blue-500 rounded mb-2 opacity-80" />
                    <div className="w-full h-0.5 bg-blue-200 mb-3" />
                    <div className="flex gap-1 mb-1"><div className="w-8 h-2 bg-gray-200 rounded" /><div className="w-24 h-2 bg-gray-400 rounded" /></div>
                    <div className="flex gap-1 mb-1"><div className="w-8 h-2 bg-gray-200 rounded" /><div className="w-32 h-2 bg-gray-300 rounded" /></div>
                    <div className="flex gap-1 mb-3"><div className="w-8 h-2 bg-gray-200 rounded" /><div className="w-20 h-2 bg-gray-300 rounded" /></div>
                    <div className="w-full h-0.5 bg-gray-100 mb-2" />
                    <div className="flex justify-end gap-1"><div className="w-12 h-2 bg-gray-200 rounded" /><div className="w-16 h-2 bg-blue-400 rounded" /></div>
                  </div>
                )}
              </div>
              <h3 className="font-black text-white/80 group-hover:text-nexus-teal transition-colors text-[13px] uppercase tracking-wide mb-1">
                {template.name}
              </h3>
              <p className="text-[10px] text-white/30 leading-relaxed">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
