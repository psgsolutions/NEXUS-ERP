"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, Save, Eye, Send, Type, Bold, AlignLeft, AlignCenter, 
  AlignRight, Database, Coins, Grid, Settings, Sliders, Trash2, 
  Plus, HelpCircle, EyeOff, Sparkles, FileText, Image as ImageIcon, Minus,
  LayoutTemplate
} from "lucide-react";
import { PillButton, GlassCard, PillInput, PillSelect, PillCheckbox } from "@/components/ui/Base";
import Link from "next/link";

type PaperSize = "A4" | "A5" | "Letter" | "Legal";

const PAPER_DIMENSIONS = {
  "A4": { width: 794, height: 1123 },
  "A5": { width: 559, height: 794 },
  "Letter": { width: 816, height: 1056 },
  "Legal": { width: 816, height: 1344 },
};

interface DocumentBlock {
  id: string;
  type: "text" | "table" | "signature" | "grid" | "image" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  color?: string;
  backgroundColor?: string;
  zIndex: number;
  
  content: string;
  fontFamily: "sarabun" | "mono";
  fontSize: "sm" | "base" | "lg" | "xl";
  fontWeight: "normal" | "bold";
  textAlign: "left" | "center" | "right";
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  padding: number;
  
  imageUrl?: string;
  tableColumns?: string[];
}

export default function DocumentBuilderPage() {
  const [templateName, setTemplateName] = useState("Ultimate Document Form Builder");
  const [lastSaved, setLastSaved] = useState("12:00:00 (ล่าสุด)");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  
  const [blocks, setBlocks] = useState<DocumentBlock[]>([
    {
      id: "block-init-1", type: "text", x: 40, y: 40, width: 300, height: 100,
      rotation: 0, opacity: 100, zIndex: 1, content: "NEXUS ERP SOLUTION\nCompany Registration: {{company.taxId}}",
      fontFamily: "mono", fontSize: "sm", fontWeight: "bold", textAlign: "left",
      borderWidth: 0, borderColor: "transparent", borderRadius: 0, padding: 0
    }
  ]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const paper = PAPER_DIMENSIONS[paperSize];

  // Keep state refs updated for global window event listener to prevent event listener re-binding churn
  const blocksRef = useRef(blocks);
  const dragOffsetRef = useRef(dragOffset);
  const paperRef = useRef(paper);
  const selectedBlockIdRef = useRef(selectedBlockId);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  useEffect(() => {
    paperRef.current = paper;
  }, [paper]);

  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId;
  }, [selectedBlockId]);

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent, blockId: string) => {
    // Critical: Stop bubble and prevent browser's default text/ghost-image drag behavior
    e.stopPropagation();
    e.preventDefault();
    
    setSelectedBlockId(blockId);
    setIsDragging(true);

    const block = blocks.find(b => b.id === blockId);
    if (!block || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const offsetX = e.clientX - canvasRect.left - block.x;
    const offsetY = e.clientY - canvasRect.top - block.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  // Global window listeners for drag movement & mouse up to prevent sticky blocks
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const canvasEl = canvasRef.current;
      const blockId = selectedBlockIdRef.current;
      if (!canvasEl || !blockId) return;

      const canvasRect = canvasEl.getBoundingClientRect();
      const currentDragOffset = dragOffsetRef.current;
      let newX = e.clientX - canvasRect.left - currentDragOffset.x;
      let newY = e.clientY - canvasRect.top - currentDragOffset.y;

      // Simple snap to grid 10px
      newX = Math.round(newX / 10) * 10;
      newY = Math.round(newY / 10) * 10;

      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, x: newX, y: newY } : b));
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true });
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging]);

  const updateSelectedBlock = (updates: Partial<DocumentBlock>) => {
    if (!selectedBlockId) return;
    setBlocks(prev => prev.map(b => b.id === selectedBlockId ? { ...b, ...updates } : b));
  };

  const addNewBlock = (type: DocumentBlock["type"]) => {
    const newId = `block-${Date.now()}`;
    const newBlock: DocumentBlock = {
      id: newId, type,
      x: 100, y: 100,
      width: type === "line" ? 400 : (type === "image" ? 150 : 300),
      height: type === "line" ? 2 : (type === "image" ? 150 : 100),
      rotation: 0, opacity: 100, zIndex: blocks.length + 1,
      content: type === "text" ? "Double click to edit text" : "",
      fontFamily: "sarabun", fontSize: "sm", fontWeight: "normal", textAlign: "left",
      borderWidth: type === "text" || type === "table" ? 1 : 0,
      borderColor: "rgba(0,0,0,0.2)", borderRadius: 4, padding: 8,
      backgroundColor: type === "line" ? "#000000" : "transparent",
      color: "#000000",
      imageUrl: type === "image" ? "https://placehold.co/400x400/png" : undefined,
      tableColumns: type === "table" ? ["itemCode", "description", "quantity", "unitPrice"] : undefined
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newId);
  };

  const deleteBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0A0A0C] text-white overflow-hidden relative">
      {/* ACTION BAR */}
      <div className="h-16 border-b border-white/5 bg-[#0F0F12] flex items-center justify-between px-6 z-40 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/reports/templates">
            <PillButton variant="glass" className="h-9 w-9 p-0 rounded-full"><ArrowLeft size={16} /></PillButton>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
              <LayoutTemplate size={16} />
            </div>
            <div>
              <input 
                value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                className="bg-transparent border-0 font-black text-sm tracking-tight text-white focus:outline-none focus:ring-1 focus:ring-nexus-teal/40 px-2 py-0.5 rounded w-[300px]"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
            <span className="text-[10px] font-black uppercase text-white/40">Paper Size:</span>
            <PillSelect value={paperSize} onChange={(e) => setPaperSize(e.target.value as PaperSize)} className="h-8 py-0">
              <option value="A4">A4 (210x297mm)</option>
              <option value="A5">A5 (148x210mm)</option>
              <option value="Letter">Letter (8.5x11")</option>
              <option value="Legal">Legal (8.5x14")</option>
            </PillSelect>
          </div>
          <PillButton variant="primary" className="h-9 px-6 text-black rounded-full">
            <Save size={14} /> SAVE TEMPLATE
          </PillButton>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR: PROPERTIES */}
        <aside className="w-[320px] border-r border-white/5 bg-[#0F0F12]/80 backdrop-blur-xl flex flex-col z-30 overflow-y-auto custom-scrollbar">
          <div className="p-5 border-b border-white/5">
            <h3 className="text-xs font-black text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2"><Sliders size={14} className="text-nexus-teal"/> PROPERTIES</h3>
            {selectedBlock ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">X (px)</label>
                    <PillInput type="number" value={selectedBlock.x} onChange={e => updateSelectedBlock({ x: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Y (px)</label>
                    <PillInput type="number" value={selectedBlock.y} onChange={e => updateSelectedBlock({ y: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Width</label>
                    <PillInput type="number" value={selectedBlock.width} onChange={e => updateSelectedBlock({ width: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Height</label>
                    <PillInput type="number" value={selectedBlock.height} onChange={e => updateSelectedBlock({ height: Number(e.target.value) })} className="w-full" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Rotation (°)</label>
                    <input type="range" min="0" max="360" value={selectedBlock.rotation} onChange={e => updateSelectedBlock({ rotation: Number(e.target.value) })} className="w-full accent-nexus-teal" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Opacity (%)</label>
                    <input type="range" min="0" max="100" value={selectedBlock.opacity} onChange={e => updateSelectedBlock({ opacity: Number(e.target.value) })} className="w-full accent-nexus-teal" />
                  </div>
                </div>

                {/* Specific Type Controls */}
                {selectedBlock.type === "text" && (
                  <>
                    <div>
                      <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Content</label>
                      <textarea 
                        value={selectedBlock.content} 
                        onChange={e => updateSelectedBlock({ content: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm focus:outline-none focus:border-nexus-teal text-white min-h-[80px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                         <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Font Size</label>
                         <PillSelect value={selectedBlock.fontSize} onChange={e => updateSelectedBlock({ fontSize: e.target.value as any })}>
                           <option value="sm">Small</option><option value="base">Base</option><option value="lg">Large</option><option value="xl">X-Large</option>
                         </PillSelect>
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Align</label>
                         <PillSelect value={selectedBlock.textAlign} onChange={e => updateSelectedBlock({ textAlign: e.target.value as any })}>
                           <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                         </PillSelect>
                      </div>
                    </div>
                  </>
                )}

                {selectedBlock.type === "image" && (
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Image URL</label>
                    <PillInput value={selectedBlock.imageUrl || ""} onChange={e => updateSelectedBlock({ imageUrl: e.target.value })} className="w-full" placeholder="https://..." />
                  </div>
                )}

                {selectedBlock.type === "line" && (
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Line Color</label>
                    <input type="color" value={selectedBlock.backgroundColor || "#000000"} onChange={e => updateSelectedBlock({ backgroundColor: e.target.value })} className="w-full h-8 rounded cursor-pointer" />
                  </div>
                )}

                {selectedBlock.type === "table" && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/60 uppercase block mb-1">Data Binding Columns</label>
                    {["itemCode", "description", "quantity", "unitPrice", "discount", "totalAmount"].map(col => (
                      <PillCheckbox 
                        key={col} 
                        label={col} 
                        checked={selectedBlock.tableColumns?.includes(col)}
                        onChange={(e) => {
                          const cols = selectedBlock.tableColumns || [];
                          const newCols = e.target.checked ? [...cols, col] : cols.filter(c => c !== col);
                          updateSelectedBlock({ tableColumns: newCols });
                        }}
                      />
                    ))}
                  </div>
                )}

              </div>
            ) : (
              <p className="text-xs text-white/30 text-center py-10 font-bold uppercase">Select a block to edit properties</p>
            )}
          </div>
        </aside>

        {/* CENTER CANVAS AREA */}
        <main 
          className="flex-1 bg-[#121216] overflow-auto p-12 flex justify-center custom-scrollbar relative"
        >
          {/* Paper element */}
          <div 
            ref={canvasRef}
            style={{ width: paper.width, height: paper.height }}
            className="bg-white shadow-2xl relative overflow-hidden flex-shrink-0 cursor-crosshair border border-black/10"
            onClick={() => setSelectedBlockId(null)}
          >
            {/* Grid background for alignment */}
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

            {/* Render Blocks */}
            {blocks.map(block => (
              <div
                key={block.id}
                onMouseDown={(e) => handleMouseDown(e, block.id)}
                className={`absolute cursor-move group select-none ${selectedBlockId === block.id ? "ring-2 ring-nexus-blue ring-offset-2" : "hover:ring-1 hover:ring-black/20"}`}
                style={{
                  left: block.x, top: block.y,
                  width: block.width, height: block.height,
                  transform: `rotate(${block.rotation}deg)`,
                  opacity: block.opacity / 100,
                  zIndex: block.zIndex,
                  backgroundColor: block.type === "line" ? block.backgroundColor : (block.backgroundColor || "transparent"),
                  color: block.color || "#000",
                  padding: block.padding,
                  border: `${block.borderWidth}px solid ${block.borderColor}`,
                  borderRadius: block.borderRadius,
                  textAlign: block.textAlign as any,
                  fontFamily: block.fontFamily === "mono" ? "monospace" : "inherit",
                  fontSize: block.fontSize === "sm" ? "12px" : block.fontSize === "lg" ? "18px" : block.fontSize === "xl" ? "24px" : "14px",
                  fontWeight: block.fontWeight === "bold" ? "bold" : "normal",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: block.type === "line" ? "center" : "flex-start",
                }}
              >
                {/* Delete Button */}
                <button 
                  onClick={(e) => deleteBlock(block.id, e)} 
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute -top-3 -right-3 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-50"
                >
                  <Trash2 size={10} />
                </button>

                {/* Content Rendering based on type */}
                {block.type === "text" && <p className="whitespace-pre-line leading-relaxed m-0">{block.content}</p>}
                
                {block.type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.imageUrl} alt="Document graphic" className="w-full h-full object-contain pointer-events-none" />
                )}

                {block.type === "table" && (
                  <table className="w-full border-collapse text-[10px] sm:text-xs">
                    <thead className="bg-black/5 border-b border-black/20">
                      <tr>
                        {block.tableColumns?.map(col => (
                          <th key={col} className="p-2 text-left uppercase text-black/60">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-black/10">
                        {block.tableColumns?.map(col => (
                          <td key={col} className="p-2 text-black/80">{col === "totalAmount" ? "1,500.00" : `Sample ${col}`}</td>
                        ))}
                      </tr>
                      <tr className="border-b border-black/10">
                        {block.tableColumns?.map(col => (
                          <td key={col} className="p-2 text-black/80">{col === "totalAmount" ? "2,000.00" : `Sample ${col}`}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                )}

                {block.type === "signature" && (
                  <div className="mt-auto border-t border-black/50 pt-2 text-center text-xs">
                    {block.content || "Signature Line"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>

        {/* RIGHT SIDEBAR: TOOLBOX */}
        <aside className="w-[80px] border-l border-white/5 bg-[#0F0F12]/80 backdrop-blur-xl flex flex-col items-center py-6 gap-4 z-30">
          <button onClick={() => addNewBlock("text")} title="Add Text" className="w-12 h-12 rounded-xl bg-white/5 hover:bg-nexus-teal/20 text-white/60 hover:text-nexus-teal flex items-center justify-center transition-all"><Type size={18} /></button>
          <button onClick={() => addNewBlock("image")} title="Add Image" className="w-12 h-12 rounded-xl bg-white/5 hover:bg-nexus-teal/20 text-white/60 hover:text-nexus-teal flex items-center justify-center transition-all"><ImageIcon size={18} /></button>
          <button onClick={() => addNewBlock("line")} title="Add Line" className="w-12 h-12 rounded-xl bg-white/5 hover:bg-nexus-teal/20 text-white/60 hover:text-nexus-teal flex items-center justify-center transition-all"><Minus size={18} /></button>
          <button onClick={() => addNewBlock("table")} title="Add Data Table" className="w-12 h-12 rounded-xl bg-white/5 hover:bg-nexus-teal/20 text-white/60 hover:text-nexus-teal flex items-center justify-center transition-all"><Grid size={18} /></button>
          <button onClick={() => addNewBlock("signature")} title="Add Signature" className="w-12 h-12 rounded-xl bg-white/5 hover:bg-nexus-teal/20 text-white/60 hover:text-nexus-teal flex items-center justify-center transition-all"><FileText size={18} /></button>
        </aside>

      </div>
    </div>
  );
}
