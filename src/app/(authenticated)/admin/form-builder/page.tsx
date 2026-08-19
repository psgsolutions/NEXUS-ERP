'use client';

import React, { useState } from 'react';
import { PillButton, PillInput, cn } from '@/components/ui/Base';
import { Save, Plus, Settings2, GripVertical, Trash2, LayoutTemplate, Type, FileImage, Table2, Calculator, PenTool, Eye } from 'lucide-react';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { PDFPreviewModal } from '@/components/commerce/PDFPreviewModal';

// Types of blocks available
type BlockType = 'HEADER' | 'CUSTOMER_INFO' | 'ITEMS_TABLE' | 'SUMMARY' | 'SIGNATURE' | 'TEXT';

interface FormBlock {
  id: string;
  type: BlockType;
  props: any;
}

const TOOLBOX_ITEMS = [
  { type: 'HEADER', label: 'ส่วนหัว (Header & Logo)', icon: FileImage },
  { type: 'CUSTOMER_INFO', label: 'ข้อมูลลูกค้า (Customer Info)', icon: Type },
  { type: 'ITEMS_TABLE', label: 'ตารางสินค้า (Items Table)', icon: Table2 },
  { type: 'SUMMARY', label: 'แผงสรุปยอด (Summary)', icon: Calculator },
  { type: 'SIGNATURE', label: 'ลายเซ็น (Signature)', icon: PenTool },
  { type: 'TEXT', label: 'ข้อความอิสระ (Custom Text)', icon: Type },
];

export default function FormBuilderPage() {
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || 'COMP-001';

  const [templateName, setTemplateName] = useState('Standard Quotation (แม่แบบมาตรฐาน)');
  const [documentType, setDocumentType] = useState('QUOTATION');
  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPDFPreviewOpen, setIsPDFPreviewOpen] = useState(false);

  const addBlock = (type: BlockType) => {
    const newBlock: FormBlock = {
      id: Date.now().toString(),
      type,
      props: getDefaultProps(type)
    };
    setBlocks([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const removeBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBlocks(blocks.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateBlockProps = (id: string, newProps: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, props: { ...b.props, ...newProps } } : b));
  };

  const moveBlock = (index: number, direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index + direction < 0 || index + direction >= blocks.length) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setBlocks(newBlocks);
  };

  const handleSave = async () => {
    if (!templateName) {
      alert("กรุณาระบุชื่อแม่แบบเอกสาร (Template Name)");
      return;
    }
    
    try {
      setLoading(true);
      await addDoc(collection(db, 'document_templates'), {
        templateName,
        documentType,
        blocks,
        companyId: currentCompanyId,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'SYSTEM',
        isDeleted: false
      });
      alert("บันทึกแม่แบบเอกสารสำเร็จ!");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
      {/* ── Top Bar ── */}
      <div className="h-20 shrink-0 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
            <LayoutTemplate size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-widest">Document Form Builder</h1>
            <p className="text-xs text-white/40 not-italic">Ultimate Dynamic Layout Designer</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <input 
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              className="h-10 px-4 rounded-full bg-white/15 border border-white/10 text-sm font-bold text-white w-64 focus:border-nexus-teal/50 outline-none"
              placeholder="Template Name"
            />
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value)}
              className="h-10 px-4 rounded-full bg-white/15 border border-white/10 text-sm font-bold text-nexus-teal focus:border-nexus-teal/50 outline-none appearance-none"
            >
              <option value="QUOTATION">ใบเสนอราคา (Quotation)</option>
              <option value="SALES_ORDER">ใบสั่งขาย (Sales Order)</option>
              <option value="INVOICE">ใบแจ้งหนี้ (Invoice)</option>
              <option value="RECEIPT">ใบเสร็จรับเงิน (Receipt)</option>
            </select>
            <div className="flex items-center gap-3">
              <PillButton  className="h-9 px-6 bg-white/15" onClick={() => setIsPDFPreviewOpen(true)}>
                <Eye size={16} className="mr-2" /> ดูตัวอย่าง PDF
              </PillButton>
              <PillButton  onClick={handleSave} disabled={loading} className="h-9 px-6">
                <Save size={16} className="mr-2" /> {loading ? "กำลังบันทึก..." : "บันทึกแม่แบบ"}
              </PillButton>
            </div>
          </div>
        </div>
      </div>

      {/* ── Workspace ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ── Left: Toolbox ── */}
        <div className="w-64 border-r border-white/5 bg-slate-900/30 p-4 flex flex-col gap-2 overflow-y-auto shrink-0">
          <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">
            Add Components (Stack Layout)
          </h3>
          {TOOLBOX_ITEMS.map(item => (
            <button
              key={item.type}
              onClick={() => addBlock(item.type as BlockType)}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-white/80 hover:bg-white/[0.05] hover:border-nexus-teal/50 hover:text-nexus-teal transition-all text-left active:scale-95"
            >
              <item.icon size={18} />
              <span className="text-xs font-bold">{item.label}</span>
              <Plus size={14} className="ml-auto opacity-40" />
            </button>
          ))}
        </div>

        {/* ── Center: Canvas (A4 Simulation) ── */}
        <div className="flex-1 bg-slate-950 overflow-y-auto p-8 flex justify-center">
          {/* A4 Paper Canvas */}
          <div className="w-[794px] min-h-[1123px] bg-white shadow-2xl relative flex flex-col group">
            {blocks.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                <LayoutTemplate size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-bold">ว่างเปล่า (Empty Canvas)</p>
                <p className="text-sm">คลิกเพิ่ม Component จากแถบเครื่องมือด้านซ้าย</p>
              </div>
            ) : (
              blocks.map((block, index) => (
                <div 
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={cn(
                    "relative border-2 border-dashed transition-all cursor-pointer group/block",
                    selectedBlockId === block.id 
                      ? "border-blue-500 bg-blue-50/10 z-10" 
                      : "border-transparent hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {/* Block Controls (Hover/Active) */}
                  <div className={cn(
                    "absolute -right-12 top-0 flex-col gap-1",
                    selectedBlockId === block.id ? "flex" : "hidden group-hover/block:flex"
                  )}>
                    <button onClick={(e) => moveBlock(index, -1, e)} className="w-8 h-8 bg-slate-800 text-white rounded flex items-center justify-center hover:bg-blue-600"><GripVertical size={14} /></button>
                    <button onClick={(e) => moveBlock(index, 1, e)} className="w-8 h-8 bg-slate-800 text-white rounded flex items-center justify-center hover:bg-blue-600"><GripVertical size={14} className="rotate-180" /></button>
                    <button onClick={(e) => removeBlock(block.id, e)} className="w-8 h-8 bg-red-500 text-white rounded flex items-center justify-center hover:bg-red-600"><Trash2 size={14} /></button>
                  </div>
                  
                  {/* Render Block Content */}
                  <div className="pointer-events-none">
                    <RenderBlockPreview block={block} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Properties ── */}
        <div className="w-72 border-l border-white/5 bg-slate-900/30 p-4 overflow-y-auto shrink-0 flex flex-col gap-6">
          <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
            <Settings2 size={14} /> Properties
          </h3>
          
          {!selectedBlockId ? (
            <div className="text-center text-white/40 text-xs mt-10">
              คลิกที่ Component บนหน้ากระดาษ<br/>เพื่อตั้งค่า (Select a block to edit)
            </div>
          ) : (
            <PropertiesPanel 
              block={blocks.find(b => b.id === selectedBlockId)!} 
              onChange={(newProps) => updateBlockProps(selectedBlockId, newProps)} 
            />
          )}
          {/* PDF PREVIEW MODAL */}
          <PDFPreviewModal 
            isOpen={isPDFPreviewOpen} 
            onClose={() => setIsPDFPreviewOpen(false)} 
            blocks={blocks} 
            data={{
              documentCode: "QT-2026-0001",
              documentDate: "31/07/2026",
              customerName: "บริษัท ลูกค้าจำลอง จำกัด",
              customerAddress: "999 ถ.พระราม 9 กรุงเทพมหานคร",
              customerTaxId: "0105555555555",
              items: [
                { name: "สินค้าตัวอย่าง 1", qty: 2, unit: "ชิ้น", price: 1500, total: 3000 },
                { name: "สินค้าตัวอย่าง 2", qty: 1, unit: "งาน", price: 2500, total: 2500 }
              ],
              subTotal: 5500,
              vatAmount: 385,
              whtAmount: 165,
              grandTotal: 5885
            }} 
          />
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW COMPONENTS (MOCKUP ON A4)
// ─────────────────────────────────────────────────────────────────────────────
function RenderBlockPreview({ block }: { block: FormBlock }) {
  const p = block.props;
  
  if (block.type === 'HEADER') {
    return (
      <div className={cn("flex justify-between items-start p-8", p.align === 'center' && "flex-col items-center text-center")}>
        <div className={cn("w-32 h-16 bg-slate-200 border border-slate-300 rounded flex items-center justify-center text-slate-400 font-bold", p.showLogo ? "block" : "hidden")}>
          LOGO
        </div>
        <div className={cn(p.align === 'center' ? "mt-4" : "text-right")}>
          <h1 className={cn("font-bold text-slate-800", `text-${p.titleSize || '2xl'}`)}>{p.titleText || 'DOCUMENT TITLE'}</h1>
          <p className="text-slate-500 mt-1">{p.companyName || 'Company Name Co., Ltd.'}</p>
          <p className="text-sm text-slate-400">{p.address || '123 Main St, City, Country'}</p>
          <p className="text-sm text-slate-400 mt-2 font-mono">DOC: {{documentCode}} | DATE: {{date}}</p>
        </div>
      </div>
    );
  }
  
  if (block.type === 'CUSTOMER_INFO') {
    return (
      <div className="px-8 py-4 flex flex-col gap-2 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-700">{p.sectionTitle || 'Customer Information'}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
          <div>
            <span className="font-bold">Name:</span> {`{{customerName}}`}
          </div>
          <div>
            <span className="font-bold">Tax ID:</span> {`{{customerTaxId}}`}
          </div>
          <div className="col-span-2">
            <span className="font-bold">Address:</span> {`{{customerAddress}}`}
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'ITEMS_TABLE') {
    return (
      <div className="px-8 py-4">
        <table className="w-full text-sm border-collapse border border-slate-300 text-slate-700">
          <thead className={cn(p.headerColor === 'dark' ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-800")}>
            <tr>
              <th className="border border-slate-300 p-2 text-center w-12">#</th>
              <th className="border border-slate-300 p-2 text-left">Description</th>
              <th className="border border-slate-300 p-2 text-right w-24">Qty</th>
              {p.showUnit && <th className="border border-slate-300 p-2 text-left w-20">Unit</th>}
              <th className="border border-slate-300 p-2 text-right w-32">Unit Price</th>
              <th className="border border-slate-300 p-2 text-right w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {[1,2,3].map(i => (
              <tr key={i}>
                <td className="border border-slate-300 p-2 text-center font-mono">{i}</td>
                <td className="border border-slate-300 p-2">{`{{item.name}}`}</td>
                <td className="border border-slate-300 p-2 text-right font-mono">{`{{item.qty}}`}</td>
                {p.showUnit && <td className="border border-slate-300 p-2">{`{{item.unit}}`}</td>}
                <td className="border border-slate-300 p-2 text-right font-mono">{`{{item.price}}`}</td>
                <td className="border border-slate-300 p-2 text-right font-mono font-bold">{`{{item.total}}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'SUMMARY') {
    return (
      <div className="px-8 py-4 flex justify-end">
        <div className="w-72 border border-slate-300 text-sm text-slate-700">
          <div className="flex justify-between p-2 border-b border-slate-200">
            <span>Sub Total</span>
            <span className="font-mono font-bold">{`{{subTotal}}`}</span>
          </div>
          {p.showVat && (
            <div className="flex justify-between p-2 border-b border-slate-200">
              <span>VAT 7%</span>
              <span className="font-mono">{`{{vatAmount}}`}</span>
            </div>
          )}
          {p.showWht && (
            <div className="flex justify-between p-2 border-b border-slate-200 text-red-600">
              <span>WHT Deduction</span>
              <span className="font-mono">-{`{{whtAmount}}`}</span>
            </div>
          )}
          <div className="flex justify-between p-2 bg-slate-100 font-bold text-base">
            <span>Grand Total</span>
            <span className="font-mono">{`{{grandTotal}}`}</span>
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'SIGNATURE') {
    return (
      <div className="px-8 py-12 flex justify-around mt-10">
        <div className="flex flex-col items-center">
          <div className="w-48 h-0 border-b border-dashed border-slate-400 mb-2"></div>
          <div className="text-sm text-slate-600">{p.leftLabel || 'Customer Signature'}</div>
          <div className="text-xs text-slate-400 mt-1">Date: ____/____/____</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-48 h-0 border-b border-dashed border-slate-400 mb-2"></div>
          <div className="text-sm text-slate-600">{p.rightLabel || 'Authorized Signature'}</div>
          <div className="text-xs text-slate-400 mt-1">Date: ____/____/____</div>
        </div>
      </div>
    );
  }

  if (block.type === 'TEXT') {
    return (
      <div className="px-8 py-4 text-slate-700">
        <p className={cn(`text-${p.align || 'left'}`, `text-${p.size || 'sm'}`, p.bold && 'font-bold')}>
          {p.content || 'Enter custom text here...'}
        </p>
      </div>
    );
  }

  return <div>Unknown Block</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTIES PANEL
// ─────────────────────────────────────────────────────────────────────────────
function PropertiesPanel({ block, onChange }: { block: FormBlock, onChange: (props: any) => void }) {
  const p = block.props;

  if (block.type === 'HEADER') {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-white mb-1 block">Title Text</label>
          <PillInput type="text" value={p.titleText} onChange={e => onChange({ titleText: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-bold text-white mb-1 block">Title Size</label>
          <select value={p.titleSize} onChange={e => onChange({ titleSize: e.target.value })} className="w-full h-9 bg-white/15 rounded-full px-3 text-white text-xs">
            <option value="xl">XL (Small)</option>
            <option value="2xl">2XL (Normal)</option>
            <option value="4xl">4XL (Large)</option>
          </select>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input type="checkbox" checked={p.showLogo} onChange={e => onChange({ showLogo: e.target.checked })} />
          <span className="text-sm text-white">Show Logo</span>
        </div>
        <div>
          <label className="text-xs font-bold text-white mb-1 mt-4 block">Alignment</label>
          <div className="flex bg-white/15 rounded-full p-1">
            <button className={cn("flex-1 text-xs py-1 rounded-full", p.align === 'split' ? "bg-nexus-teal text-black" : "text-white")} onClick={() => onChange({ align: 'split'})}>Split L/R</button>
            <button className={cn("flex-1 text-xs py-1 rounded-full", p.align === 'center' ? "bg-nexus-teal text-black" : "text-white")} onClick={() => onChange({ align: 'center'})}>Center</button>
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'ITEMS_TABLE') {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-white mb-1 block">Header Color</label>
          <div className="flex bg-white/15 rounded-full p-1">
            <button className={cn("flex-1 text-xs py-1 rounded-full", p.headerColor === 'light' ? "bg-nexus-teal text-black" : "text-white")} onClick={() => onChange({ headerColor: 'light'})}>Light</button>
            <button className={cn("flex-1 text-xs py-1 rounded-full", p.headerColor === 'dark' ? "bg-nexus-teal text-black" : "text-white")} onClick={() => onChange({ headerColor: 'dark'})}>Dark</button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input type="checkbox" checked={p.showUnit} onChange={e => onChange({ showUnit: e.target.checked })} />
          <span className="text-sm text-white">Show Unit Column</span>
        </div>
      </div>
    );
  }

  if (block.type === 'SUMMARY') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={p.showVat} onChange={e => onChange({ showVat: e.target.checked })} />
            <span className="text-sm text-white">Show VAT (7%)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={p.showWht} onChange={e => onChange({ showWht: e.target.checked })} />
            <span className="text-sm text-white">Show WHT (Deduction)</span>
          </label>
        </div>
      </div>
    );
  }

  if (block.type === 'SIGNATURE') {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-white mb-1 block">Left Label</label>
          <PillInput type="text" value={p.leftLabel} onChange={e => onChange({ leftLabel: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-bold text-white mb-1 block">Right Label</label>
          <PillInput type="text" value={p.rightLabel} onChange={e => onChange({ rightLabel: e.target.value })} />
        </div>
      </div>
    );
  }

  if (block.type === 'TEXT') {
  
  // [Master Blueprint V3.1] Global Layout Lock
  React.useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.style.overflowY = "hidden";
    return () => {
      if (mainEl) mainEl.style.overflowY = "auto";
    };
  }, []);
  return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-white mb-1 block">Content</label>
          <textarea 
            value={p.content} 
            onChange={e => onChange({ content: e.target.value })}
            className="w-full h-24 bg-white/15 rounded-xl p-2 text-white text-xs border border-transparent focus:border-nexus-teal/50 outline-none resize-none"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input type="checkbox" checked={p.bold} onChange={e => onChange({ bold: e.target.checked })} />
          <span className="text-sm text-white">Bold Text</span>
        </div>
        <div>
          <label className="text-xs font-bold text-white mb-1 mt-4 block">Alignment</label>
          <div className="flex bg-white/15 rounded-full p-1">
            <button className={cn("flex-1 text-xs py-1 rounded-full", p.align === 'left' ? "bg-nexus-teal text-black" : "text-white")} onClick={() => onChange({ align: 'left'})}>Left</button>
            <button className={cn("flex-1 text-xs py-1 rounded-full", p.align === 'center' ? "bg-nexus-teal text-black" : "text-white")} onClick={() => onChange({ align: 'center'})}>Center</button>
            <button className={cn("flex-1 text-xs py-1 rounded-full", p.align === 'right' ? "bg-nexus-teal text-black" : "text-white")} onClick={() => onChange({ align: 'right'})}>Right</button>
          </div>
        </div>
      </div>
    );
  }

  return <div className="text-white/40 text-xs">No specific properties for this block.</div>;
}

// Helper to provide default props based on type
function getDefaultProps(type: BlockType) {
  switch(type) {
    case 'HEADER': return { titleText: 'QUOTATION', titleSize: '2xl', showLogo: true, align: 'split' };
    case 'CUSTOMER_INFO': return { sectionTitle: 'Bill To:' };
    case 'ITEMS_TABLE': return { headerColor: 'dark', showUnit: true };
    case 'SUMMARY': return { showVat: true, showWht: false };
    case 'SIGNATURE': return { leftLabel: 'Customer Signature', rightLabel: 'Authorized Signature' };
    case 'TEXT': return { content: 'Please make payment within 30 days.', align: 'left', size: 'sm', bold: false };
    default: return {};
  }
}
