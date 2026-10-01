'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Save, Eye, EyeOff, Database, FileText, ChevronLeft, Printer } from 'lucide-react';
import { FormTemplate, FormElement } from '../../types/formBuilder';
import { Canvas } from './Canvas';
import { Ribbon } from './Ribbon';
import { PropertySheet } from './PropertySheet';
import { TemplateSelectionModal } from './TemplateSelectionModal';
import { FieldListPanel } from './FieldListPanel';
import { BindingVariable, getNeutralData } from '../../utils/dataBinding';
import { db } from '../../lib/firebase-client';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useSystemDialog } from "@/context/DialogContext";

export const BuilderLayout: React.FC = () => {
  const router = useRouter();
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || 'COMP-001';
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [showFieldPanel, setShowFieldPanel] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>>(getNeutralData());

  // ── ติดตาม auto-position เพื่อวาง element ไม่ซ้อนกัน ─────────────────────
  const nextAutoY = React.useRef(80);

  // ── Template selection ────────────────────────────────────────────────────
  const handleSelectTemplate = (selected: FormTemplate | null) => {
    if (selected) {
      const elements = selected.elements || [];
      setTemplate({
        ...selected,
        companyId: currentCompanyId,
        isDeleted: false,
        elements,
        id: uuidv4(), // Generate new ID always
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as FormTemplate);
      // คำนวณ nextY จาก template ที่เลือก
      const maxY = elements.reduce((m, el) =>
        Math.max(m, el.position.y + Number(el.size.height)), 80);
      nextAutoY.current = maxY + 20;
    }
    setIsModalOpen(false);
  };

  // ── เพิ่ม Element จาก Ribbon ─────────────────────────────────────────────
  const handleAddElement = (type: FormElement['type']) => {
    if (!template) return;
    const id = uuidv4();
    const newEl: FormElement = {
      id,
      type,
      position: { x: 50, y: nextAutoY.current },
      size: {
        width: type === 'line' ? 700 : type === 'image' || type === 'rectangle' ? 100 : 200,
        height: type === 'line' ? 2 : type === 'image' || type === 'rectangle' ? 100 : 28
      },
      content: type === 'label' ? '<p>Label Text</p>' : type === 'text' ? '<p>Text</p>' : '',
      style: {
        color: '#000000', fontSize: 12, fontFamily: 'sans-serif',
        borderWidth: type === 'textbox' || type === 'rectangle' ? 1 : 0,
        borderColor: '#000000', borderStyle: 'solid',
        backgroundColor: type === 'textbox' ? '#ffffff' : 'transparent',
        borderRadius: 0,
        padding: 0,
        objectFit: type === 'image' ? 'contain' : undefined
      },
      properties: {
        controlSource: '', visible: true,
        imageUrl: type === 'image' ? 'https://placehold.co/400x400/eeeeee/aaaaaa?text=Image' : undefined
      },
    };
    setTemplate(prev => prev ? { ...prev, elements: [...prev.elements, newEl] } : prev);
    setSelectedElementId(id);
    if (type !== 'line') nextAutoY.current += 36;
  };

  // ── เพิ่ม Label+DataBox คู่จาก Field List Panel ────────────────────────────
  const handleAddBoundField = (field: BindingVariable, pos?: { x: number; y: number }) => {
    if (!template) return;

    const y = pos?.y ?? nextAutoY.current;
    const x = pos?.x ?? 20;

    const labelId = uuidv4();
    const boxId = uuidv4();

    const labelEl: FormElement = {
      id: labelId,
      type: 'label',
      position: { x, y },
      size: { width: 120, height: 24 },
      content: `<p>${field.label}:</p>`,
      style: {
        color: '#374151', fontSize: 11, fontFamily: 'sans-serif',
        fontWeight: 'bold', borderWidth: 0, backgroundColor: 'transparent',
      },
      properties: { visible: true },
    };

    const boxEl: FormElement = {
      id: boxId,
      type: 'textbox',
      position: { x: x + 125, y },
      size: { width: 220, height: 24 },
      content: '',
      style: {
        color: '#111827', fontSize: 12, fontFamily: 'sans-serif',
        borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'solid',
        backgroundColor: '#f9fafb',
      },
      properties: { controlSource: field.key, visible: true },
    };

    setTemplate(prev => prev ? { ...prev, elements: [...prev.elements, labelEl, boxEl] } : prev);
    setSelectedElementId(boxId); // select the data box
    nextAutoY.current = y + 32;
  };

  // ── Update element ─────────────────────────────────────────────────────────
  const handleUpdateElement = (id: string, updates: Partial<FormElement>) => {
    setTemplate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        elements: prev.elements.map(el =>
          el.id === id
            ? { ...el, ...updates, style: { ...el.style, ...updates.style }, properties: { ...el.properties, ...updates.properties } }
            : el
        ),
      };
    });
  };

  // ── Delete element ─────────────────────────────────────────────────────────
  const handleDeleteElement = () => {
    if (!template || !selectedElementId) return;
    setTemplate(prev => prev
      ? { ...prev, elements: prev.elements.filter(el => el.id !== selectedElementId) }
      : prev
    );
    setSelectedElementId(null);
  };

  const handleSave = async () => {
    if (!template) return;
    try {
      setIsSaved(true);
      const docRef = doc(db, 'form_templates', template.id);
      
      // For compatibility with the current listing, we map name to templateName
      await setDoc(docRef, {
        ...template,
        templateName: template.name,
        targetModule: 'CUSTOM',
        companyId: currentCompanyId,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'SYSTEM',
        createdBy: user?.uid || 'SYSTEM',
      }, { merge: true });
      
      // เคลียร์ค่าที่พิมพ์ไว้และปิดหน้าต่าง (กลับไปหน้าการตั้งค่า)
      setTemplate(null);
      router.push('/settings?tab=templates');
    } catch (err) {
      console.error('Failed to save template:', err);
      setIsSaved(false);
      console.log('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const selectedElement = template?.elements.find(e => e.id === selectedElementId);

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col bg-surface-0 overflow-hidden font-sans">

      <TemplateSelectionModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!template) {
            // ยังไม่ได้เลือก template เลย → กลับไปแท็บต้นแบบเอกสาร
            router.push('/settings?tab=templates');
          } else {
            setIsModalOpen(false);
          }
        }}
        onSelectTemplate={handleSelectTemplate}
      />

      {template && (
        <>
          {/* ── Top Bar ─────────────────────────────────────────────── */}
          <div className="relative flex items-center justify-between px-4 py-3 bg-surface-0/60 backdrop-blur-2xl border-b border-white/5 flex-shrink-0 h-14 z-50">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-nexus-teal/5 via-transparent to-purple-500/5 pointer-events-none" />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors text-[11px] font-bold uppercase tracking-widest"
              >
                <ChevronLeft size={14} /> Templates
              </button>
              <span className="text-white/10">|</span>
              <div className="flex items-center gap-1.5 text-nexus-teal/80">
                <FileText size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-widest">{template.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isSaved && (
                <span className="px-3 py-1 bg-nexus-teal/10 border border-nexus-teal/20 text-nexus-teal text-[10px] font-semibold uppercase tracking-widest rounded-full">
                  ✓ บันทึกแล้ว
                </span>
              )}

              <button
                onClick={() => setShowFieldPanel(!showFieldPanel)}
                className={`group relative flex items-center gap-2 h-9 px-6 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 border overflow-hidden ${
                  showFieldPanel
                    ? 'bg-nexus-teal/10 border-nexus-teal/30 text-nexus-teal shadow-[0_0_15px_rgba(20,163,204,0.15)] hover:bg-nexus-teal/20'
                    : 'bg-white/[0.03] border-white/10 text-white/40 hover:text-white hover:bg-white/[0.08] hover:border-white/20 hover:shadow-lg'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Database size={13} className="relative z-10 transition-transform group-hover:scale-110" />
                <span className="relative z-10">{showFieldPanel ? 'ซ่อน Field List' : 'Field List'}</span>
              </button>

              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`group relative flex items-center gap-2 h-9 px-6 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 border overflow-hidden ${
                  showPreview
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:bg-blue-500/20'
                    : 'bg-white/[0.03] border-white/10 text-white/40 hover:text-white hover:bg-white/[0.08] hover:border-white/20 hover:shadow-lg'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {showPreview ? <EyeOff size={13} className="relative z-10 transition-transform group-hover:scale-110" /> : <Eye size={13} className="relative z-10 transition-transform group-hover:scale-110" />}
                <span className="relative z-10">{showPreview ? 'Design Mode' : 'Preview'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="group relative flex items-center gap-2 h-9 px-6 rounded-full bg-white/[0.03] border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.08] hover:border-white/20 hover:shadow-lg text-[11px] font-black uppercase tracking-widest transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Printer size={13} className="relative z-10 transition-transform group-hover:scale-110" />
                <span className="relative z-10">พิมพ์</span>
              </button>

              <button
                onClick={handleSave}
                className="group relative flex items-center gap-2 h-9 px-6 rounded-full bg-gradient-to-r from-nexus-teal to-teal-400 text-black text-[11px] font-black uppercase tracking-widest hover:brightness-125 transition-all duration-300 shadow-[0_0_20px_rgba(20,163,204,0.3)] hover:shadow-[0_0_30px_rgba(20,163,204,0.5)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Save size={13} className="relative z-10 transition-transform group-hover:-translate-y-0.5" />
                <span className="relative z-10">บันทึก</span>
              </button>
            </div>
          </div>

          {/* ── Ribbon ──────────────────────────────────────────────── */}
          <Ribbon onAddElement={handleAddElement} />

          {/* ── Main ────────────────────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden">

            {/* ── Field List Panel (ซ้าย) ─────────────────────────── */}
            {showFieldPanel && (
              <FieldListPanel
                template={template}
                previewData={previewData}
                onUpdateData={setPreviewData}
                onAddBoundField={handleAddBoundField}
                onToggleElementVisibility={(id, visible) =>
                  handleUpdateElement(id, {
                    properties: {
                      ...template.elements.find(e => e.id === id)?.properties,
                      visible,
                    },
                  })
                }
              />
            )}

            {/* ── Canvas Area ─────────────────────────────────────── */}
            <div className="flex-1 overflow-auto p-8 bg-surface-1 flex items-start justify-center">
              <Canvas
                elements={template.elements}
                onUpdateElement={handleUpdateElement}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                isPreviewMode={showPreview}
                previewData={previewData}
              />
            </div>

            {/* ── Property Sheet (ขวา) ─────────────────────────────── */}
            {!showPreview && (
              <PropertySheet
                selectedElement={selectedElement}
                onUpdate={updates => {
                  if (selectedElementId) handleUpdateElement(selectedElementId, updates);
                }}
                onDelete={handleDeleteElement}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};
