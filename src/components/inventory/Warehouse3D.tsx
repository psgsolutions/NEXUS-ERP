"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { useWarehouses } from "@/hooks/useWarehouses";
import { apiFetch } from "@/lib/api-client";
import { useProducts } from "@/hooks/useProducts";
import { cn, PillButton, PillInput, PillSelect } from "@/components/ui/Base";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  Box, 
  Layers, 
  MapPin, 
  Search, 
  Plus, 
  Settings, 
  Eye, 
  Edit3, 
  Trash2, 
  Save, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Maximize2,
  Grid,
  Info,
  CheckCircle,
  HelpCircle
} from "lucide-react";

interface Rack {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  occupancy: number;
  items: string[];
  capacity?: number; // จำนวนหน่วยสูงสุดของชั้นวาง (ใช้คำนวณ % ความจุ)
}

interface Warehouse {
  id: string;     // รหัสคลัง (เช่น WH-01) ใช้เป็นตำแหน่ง WH-01-A1
  docId: string;  // ID เอกสารใน collection warehouses
  shared?: boolean; // คลังของเครือ (แก้ผังที่หน้าผังคลัง)
  name: string;
  gridCols: number;
  gridRows: number;
  racks: Rack[];
}

export function Warehouse3D({ 
  pickerMode = false, 
  initialWarehouseId,
  onSelectLocation,
  locatorQuery: externalLocatorQuery,
  setLocatorQuery: externalSetLocatorQuery
}: { 
  pickerMode?: boolean; 
  initialWarehouseId?: string;
  onSelectLocation?: (locationBarcode: string, warehouseId: string) => void;
  locatorQuery?: string;
  setLocatorQuery?: (query: string) => void;
} = {}) {
  const { companyId } = useAuth();
  const { showAlert } = useSystemDialog();

  // ข้อมูลจริง: ผังคลัง (warehouses) + ยอดคงเหลือตามตำแหน่ง (inventory_balance) + ชื่อสินค้า
  const { warehouses: dbWarehouses, loading: warehousesLoading } = useWarehouses();
  const { data: balances } = useRealtimeCollection<any>(`companies/${companyId}/inventory_balance`);
  const { data: products } = useProducts<any>();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWhId, setActiveWhId] = useState<string>(initialWarehouseId || "");

  useEffect(() => {
    const productName = new Map<string, string>(products.map((p: any) => [p.id, p.name || p.productName || p.sku || p.id]));
    setWarehouses(dbWarehouses.map((w: any) => {
      const code = w.code || w.warehouseCode || w.id;
      return {
        id: code,
        docId: w.id,
        shared: w.source === "group",
        name: w.name || w.warehouseName || code,
        gridCols: Number(w.gridCols) || 12,
        gridRows: Number(w.gridRows) || 8,
        racks: (w.racks || []).map((r: any) => {
          const loc = `${code}-${r.id}`;
          const rows = balances.filter((b: any) => Number(b.quantity) > 0 && (b.location === loc || String(b.location || "").startsWith(`${loc}-`)));
          const qty = rows.reduce((sum: number, b: any) => sum + Number(b.quantity), 0);
          const capacity = Number(r.capacity) || 0;
          return {
            id: r.id, x: r.x, y: r.y, width: r.width, height: r.height, level: r.level, capacity,
            occupancy: capacity > 0 ? Math.min(100, Math.round((qty / capacity) * 100)) : 0,
            items: rows.map((b: any) => `${productName.get(b.productId) || b.productId} (${Number(b.quantity).toLocaleString()})`),
          };
        }),
      };
    }));
  }, [dbWarehouses, balances, products]);

  // บันทึกผังคลัง (เก็บเฉพาะโครงสร้าง ไม่เก็บรายการสินค้า/ความจุที่คำนวณจากสต็อก)
  const persistWarehouse = async (wh: Warehouse) => {
    // คลังของเครือ (ใช้ร่วมกัน) แก้ผังได้ที่หน้า "ผังคลังและชั้นวาง" เท่านั้น
    if (wh.shared) return void showAlert("คลังนี้เป็นคลังของเครือ แก้ผังได้ที่หน้า ผังคลังและชั้นวาง");
    try {
      // บันทึกผ่าน server (ตรวจสิทธิ์ inventory:edit และบริษัทเจ้าของคลัง)
      const res = await apiFetch("/api/inventory/warehouses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, action: "save3d", docId: wh.docId, code: wh.id, name: wh.name, gridCols: wh.gridCols, gridRows: wh.gridRows,
          racks: wh.racks.map(({ id, x, y, width, height, level, capacity }) => ({ id, x, y, width, height, level, capacity: capacity || 0 })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
    } catch (err: any) {
      console.error("[WAREHOUSE_SAVE_ERROR]", err);
      showAlert(`บันทึกผังคลังไม่สำเร็จ: ${err.message}`);
    }
  };
  const applyWarehouses = (next: Warehouse[]) => {
    setWarehouses(next);
    const changed = next.find((w) => w.id === activeWh?.id);
    if (changed) persistWarehouse(changed);
  };
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [viewAngle, setViewAngle] = useState<"isometric" | "blueprint">("isometric");
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);
  
  const [internalLocatorQuery, setInternalLocatorQuery] = useState("");
  const locatorQuery = externalLocatorQuery !== undefined ? externalLocatorQuery : internalLocatorQuery;
  const setLocatorQuery = externalSetLocatorQuery !== undefined ? externalSetLocatorQuery : setInternalLocatorQuery;

  // Edit Mode Builder States
  const [showNewWhForm, setShowNewWhForm] = useState(false);
  const [newWhName, setNewWhName] = useState("");
  const [selectedGridCell, setSelectedGridCell] = useState<{ x: number; y: number } | null>(null);
  const [editingRack, setEditingRack] = useState<Partial<Rack> | null>(null);

  const activeWh = warehouses.find(w => w.id === activeWhId) || warehouses[0];
  const selectedRack = activeWh?.racks.find(r => r.id === selectedRackId);

  // Search filter matching
  const doesRackMatchLocator = (rack: Rack) => {
    if (!locatorQuery.trim()) return true;
    const query = locatorQuery.toLowerCase();
    return (
      rack.id.toLowerCase().includes(query) ||
      rack.items.some(item => item.toLowerCase().includes(query))
    );
  };

  const handleAddWarehouse = async () => {
    if (!newWhName.trim() || !companyId) return;
    // รหัสคลังถัดไป WH-01, WH-02, ...
    const nextNo = warehouses.reduce((max, w) => Math.max(max, Number(String(w.id).match(/(\d+)$/)?.[1] || 0)), 0) + 1;
    const code = `WH-${String(nextNo).padStart(2, "0")}`;
    // สร้างผ่าน API (รหัสคลังห้ามซ้ำในเครือ)
    const res = await apiFetch("/api/inventory/warehouses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "create", code, name: newWhName.trim() }) });
    const created = await res.json();
    if (!res.ok || !created.success) return void showAlert(created.error || "เพิ่มคลังไม่สำเร็จ");
    setActiveWhId(code);
    setShowNewWhForm(false);
    setNewWhName("");
  };

  const handleUpdateWarehouseGrid = (cols: number, rows: number) => {
    const safeCols = Math.max(4, Math.min(24, cols));
    const safeRows = Math.max(4, Math.min(20, rows));
    applyWarehouses(warehouses.map(w => w.id === activeWh?.id ? { ...w, gridCols: safeCols, gridRows: safeRows } : w));
  };

  const handleSelectGridCell = (x: number, y: number) => {
    if (mode !== "edit" || !activeWh) return;
    
    // Check if cell has an existing rack
    const clickedRack = activeWh.racks.find(r => 
      x >= r.x && x < r.x + r.width && 
      y >= r.y && y < r.y + r.height
    );

    if (clickedRack) {
      setEditingRack(clickedRack);
      setSelectedGridCell(null);
    } else {
      setSelectedGridCell({ x, y });
      // Create new rack draft at this cell
      setEditingRack({
        id: `RACK-${Date.now().toString().slice(-3)}`,
        x,
        y,
        width: 1,
        height: 1,
        level: 4,
        occupancy: 0,
        items: []
      });
    }
  };

  const handleSaveRack = () => {
    if (!editingRack || !editingRack.id || !activeWh) return;
    
    // Validate bounds
    const rackId = editingRack.id.trim().toUpperCase();
    const x = editingRack.x || 1;
    const y = editingRack.y || 1;
    const w = editingRack.width || 1;
    const h = editingRack.height || 1;
    const lvl = editingRack.level || 1;

    if (x + w - 1 > activeWh.gridCols || y + h - 1 > activeWh.gridRows) {
      console.log("ชั้นวางเกินขอบเขตแผนผังคลังสินค้า!");
      return;
    }

    const updatedWarehouses = warehouses.map(wh => {
      if (wh.id !== activeWh.id) return wh;
      
      const newRacks = [...wh.racks];
      const existingIdx = newRacks.findIndex(r => r.id === editingRack.id || (r.x === x && r.y === y && r.id !== editingRack.id));
      
      const completeRack: Rack = {
        id: rackId,
        x,
        y,
        width: w,
        height: h,
        level: lvl,
        occupancy: editingRack.occupancy || 0,
        items: editingRack.items || [],
        capacity: editingRack.capacity || 0
      };

      if (existingIdx >= 0 && newRacks[existingIdx].id === rackId) {
        newRacks[existingIdx] = completeRack;
      } else {
        newRacks.push(completeRack);
      }
      
      return { ...wh, racks: newRacks };
    });
    
    applyWarehouses(updatedWarehouses);
    setEditingRack(null);
    setSelectedGridCell(null);
  };

  const handleDeleteRack = (rackId: string) => {
    const updated = warehouses.map(wh => {
      if (wh.id !== activeWh?.id) return wh;
      return { ...wh, racks: wh.racks.filter(r => r.id !== rackId) };
    });
    applyWarehouses(updated);
    setEditingRack(null);
    setSelectedGridCell(null);
    if (selectedRackId === rackId) setSelectedRackId(null);
  };

  // Visual adjustment helpers in edit mode
  const adjustRackPos = (dx: number, dy: number) => {
    if (!editingRack || !activeWh) return;
    const newX = Math.max(1, Math.min(activeWh.gridCols - (editingRack.width || 1) + 1, (editingRack.x || 1) + dx));
    const newY = Math.max(1, Math.min(activeWh.gridRows - (editingRack.height || 1) + 1, (editingRack.y || 1) + dy));
    setEditingRack({ ...editingRack, x: newX, y: newY });
  };

  const adjustRackSize = (dw: number, dh: number) => {
    if (!editingRack || !activeWh) return;
    const newW = Math.max(1, Math.min(activeWh.gridCols - (editingRack.x || 1) + 1, (editingRack.width || 1) + dw));
    const newH = Math.max(1, Math.min(activeWh.gridRows - (editingRack.y || 1) + 1, (editingRack.height || 1) + dh));
    setEditingRack({ ...editingRack, width: newW, height: newH });
  };

  const adjustLevels = (dl: number) => {
    if (!editingRack) return;
    const newL = Math.max(1, Math.min(8, (editingRack.level || 1) + dl));
    setEditingRack({ ...editingRack, level: newL });
  };

  if (!activeWh) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 rounded-2xl bg-black/30 border border-white/5 text-center">
        <Layers className="text-nexus-teal" size={28} />
        <p className="text-sm text-white/60">
          {warehousesLoading ? "กำลังโหลดผังคลังสินค้า..." : "ยังไม่มีข้อมูลคลังสินค้าของบริษัท"}
        </p>
        {!warehousesLoading && !pickerMode && (
          <div className="flex items-center gap-2">
            <PillInput value={newWhName} onChange={e => setNewWhName(e.target.value)} placeholder="ชื่อคลังสินค้า..." className="w-56 h-10 text-xs" />
            <PillButton onClick={handleAddWarehouse} className="h-10 px-4 text-xs" variant="save">สร้างคลัง</PillButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      
      {/* Visual Top Control Panel */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-black/40 border border-white/5 p-4 rounded-2xl backdrop-blur-md relative z-40">
         <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            <Layers className="text-nexus-teal shrink-0" size={22} />
            <div className="flex items-center gap-2">
               {showNewWhForm ? (
                  <div className="flex items-center gap-2">
                     <PillInput 
                       value={newWhName} 
                       onChange={e => setNewWhName(e.target.value)} 
                       placeholder="ชื่อคลังสินค้าใหม่..." 
                       className="w-56 h-10 text-xs" 
                     />
                     <PillButton onClick={handleAddWarehouse} className="h-10 px-4 text-xs shadow-neon-teal" variant="save">บันทึก</PillButton>
                     <PillButton variant="ghost" onClick={() => setShowNewWhForm(false)} className="h-10 px-3 text-xs text-white/50 hover:text-white">ยกเลิก</PillButton>
                  </div>
               ) : (
                  <>
                     <PillSelect 
                       value={activeWhId} 
                       onChange={(e) => { setActiveWhId(e.target.value); setSelectedRackId(null); setEditingRack(null); setSelectedGridCell(null); }} 
                       className="w-56 h-10 text-xs font-black"
                     >
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                     </PillSelect>
                     {pickerMode ? null : (
                        <button 
                          onClick={() => setShowNewWhForm(true)} 
                          className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-nexus-teal/20 text-white/40 hover:text-nexus-teal transition-all border border-white/5" 
                          title="เพิ่มคลังสินค้าใหม่"
                        >
                           <Plus size={16} />
                        </button>
                     )}
                  </>
               )}
            </div>

            {/* Smart Locator Search bar */}
            {externalLocatorQuery === undefined && (
              <div className="relative w-72">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-white/30" />
                </span>
                <input 
                  type="text"
                  placeholder="พิมพ์เพื่อค้นหา..."
                  value={locatorQuery}
                  onChange={e => setLocatorQuery(e.target.value)}
                  className="w-full pl-9 pr-8 h-10 rounded-full bg-black/40 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-nexus-teal transition-colors"
                />
                {locatorQuery && (
                  <button 
                    onClick={() => setLocatorQuery("")} 
                    className="absolute inset-y-0 right-3 flex items-center text-white/40 hover:text-white text-[10px] font-bold"
                  >
                    ล้าง
                  </button>
                )}
              </div>
            )}
         </div>

         {/* Mode Controls */}
         <div className="flex items-center gap-3 shrink-0 w-full xl:w-auto justify-end">
            <div className="flex bg-black/50 rounded-full p-1 border border-white/5 text-xs">
               <button 
                  onClick={() => setViewAngle("isometric")}
                  className={cn("px-4 py-1.5 rounded-full font-bold transition-all", viewAngle === "isometric" ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
               >
                  3D ISOMETRIC
               </button>
               <button 
                  onClick={() => setViewAngle("blueprint")}
                  className={cn("px-4 py-1.5 rounded-full font-bold transition-all", viewAngle === "blueprint" ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
               >
                  2D BLUEPRINT
               </button>
            </div>

            {pickerMode ? null : (
            <div className="flex bg-black/50 rounded-full p-1 border border-white/5 text-xs">
               <button 
                  onClick={() => { setMode("view"); setEditingRack(null); setSelectedGridCell(null); }}
                  className={cn("flex items-center gap-1.5 px-5 py-1.5 rounded-full font-black transition-all", mode === "view" ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md shadow-neon-teal" : "text-white/40 hover:text-white")}
               >
                  <Eye size={12} /> LIVE MAP
               </button>
               <button 
                  onClick={() => { setMode("edit"); setSelectedRackId(null); }}
                  className={cn("flex items-center gap-1.5 px-5 py-1.5 rounded-full font-black transition-all", mode === "edit" ? "bg-white/20 text-white border border-white/40 backdrop-blur-md shadow-neon-white" : "text-white/40 hover:text-white")}
               >
                  <Edit3 size={12} /> BUILDER
               </button>
            </div>
            )}
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
         
         {/* Main Simulation Board */}
         <div className="flex-1 w-full bg-black/40 border border-white/5 rounded-3xl relative min-h-[640px] flex flex-col justify-between overflow-hidden shadow-2xl backdrop-blur-md">
            
            {/* Visual Indicators */}
            <div className="p-6 pb-2 flex justify-between items-start z-10 pointer-events-none w-full">
               <div className="space-y-1">
                  <h4 className="text-lg font-semibold text-white uppercase tracking-tight">
                    {mode === "view" ? "ระบบจำลองคลังสินค้าคู่นวัตกรรม" : "เครื่องมือวางผังพิกัดคลัง"}
                  </h4>
                  <p className="text-[10px] font-bold text-nexus-teal uppercase tracking-[0.25em] drop-shadow-neon-teal">
                    {activeWh.name} • {activeWh.gridCols} x {activeWh.gridRows} แผนผังพิกัด
                  </p>
               </div>
               
               {/* Quick Info Badges */}
               <div className="flex gap-2 pointer-events-auto">
                 <div className="px-3 py-1.5 rounded-full bg-black/50 border border-white/5 flex items-center gap-2 text-[10px] font-semibold text-white/50">
                    <span className="w-2.5 h-2.5 rounded-full bg-nexus-teal animate-pulse" /> ว่าง / พิกัดว่าง
                 </div>
                 <div className="px-3 py-1.5 rounded-full bg-black/50 border border-white/5 flex items-center gap-2 text-[10px] font-semibold text-white/50">
                    <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse" /> มีการจัดเก็บ
                 </div>
                 {locatorQuery && (
                   <div className="px-3 py-1.5 rounded-full bg-nexus-teal/20 border border-nexus-teal/30 flex items-center gap-1.5 text-[10px] font-black text-nexus-teal">
                      สแกนพิกัดพบ...
                   </div>
                 )}
               </div>
            </div>

            {/* Simulated Grid Area */}
            <div className="flex-1 flex items-center justify-center p-8 min-h-[480px]">
               <div 
                  className={cn(
                     "relative w-full max-w-3xl aspect-[1.5] transition-all duration-700 select-none",
                     viewAngle === "isometric" && mode === "view" 
                       ? "perspective-[1500px] [transform:rotateX(40deg)_rotateZ(-25deg)]" 
                       : ""
                  )}
                  style={{ transformStyle: 'preserve-3d' }}
               >
                  {/* Outer Frame Wall Bounds */}
                  <div className="absolute -inset-2 border-2 border-dashed border-white/5 rounded-3xl pointer-events-none transition-all duration-500" />
                  
                  {/* Holographic Floor Base Grid */}
                  <div 
                     className={cn(
                        "absolute inset-0 border border-white/10 rounded-2xl transition-all duration-500",
                        viewAngle === "isometric" && mode === "view" 
                          ? "bg-white/[0.01] border-nexus-teal/20 shadow-[inset_0_0_40px_rgba(0,255,209,0.05)]" 
                          : "bg-black/20 border-white/5"
                     )} 
                  />

                  {/* Interactive Positioning Board */}
                  <div 
                     className="absolute inset-0 grid p-3 gap-1.5 rounded-2xl"
                     style={{
                        gridTemplateColumns: `repeat(${activeWh.gridCols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${activeWh.gridRows}, minmax(0, 1fr))`,
                        transformStyle: 'preserve-3d'
                     }}
                  >
                     {/* Draw Grid Cells Helper in Edit Mode */}
                     {Array.from({ length: activeWh.gridCols * activeWh.gridRows }).map((_, idx) => {
                        const x = (idx % activeWh.gridCols) + 1;
                        const y = Math.floor(idx / activeWh.gridCols) + 1;
                        const isCellSelected = selectedGridCell?.x === x && selectedGridCell?.y === y;
                        
                        // Check if a rack exists in this cell
                        const hasRack = activeWh.racks.some(r => 
                          x >= r.x && x < r.x + r.width && 
                          y >= r.y && y < r.y + r.height
                        );

                        return (
                          <div 
                             key={idx}
                             onClick={() => handleSelectGridCell(x, y)}
                             className={cn(
                                "border transition-all duration-200 flex items-center justify-center text-[8px] font-mono font-bold rounded",
                                mode === "edit" 
                                  ? "cursor-crosshair border-white/[0.03] hover:border-nexus-teal/30 hover:bg-nexus-teal/5 text-white/5" 
                                  : "border-transparent pointer-events-none text-transparent",
                                isCellSelected ? "border-nexus-teal bg-nexus-teal/10 text-nexus-teal" : "",
                                hasRack && mode === "edit" ? "bg-nexus-blue/5 border-dashed border-nexus-blue/10" : ""
                             )}
                          >
                             {mode === "edit" && !hasRack && `${x},${y}`}
                          </div>
                        );
                     })}

                     {/* Render Racks Volumetrically */}
                     {activeWh.racks.map((rack) => {
                        const isSelected = selectedRackId === rack.id;
                        const isEditing = editingRack?.id === rack.id;
                        const matchesSearch = doesRackMatchLocator(rack);
                        
                        // Define color palette based on occupancy state
                        let rackColor = "nexus-teal";
                        if (rack.occupancy >= 95) rackColor = "danger";
                        else if (rack.occupancy > 50) rackColor = "warning";

                        return (
                           <div 
                              key={rack.id}
                              onClick={(e) => {
                                 e.stopPropagation();
                                 if (mode === "view") {
                                    setSelectedRackId(isSelected ? null : rack.id);
                                 } else {
                                    setEditingRack(rack);
                                    setSelectedGridCell(null);
                                 }
                              }}
                              className={cn(
                                 "relative transition-all duration-500 cursor-pointer group flex flex-col justify-end rounded-xl border z-20",
                                 matchesSearch ? "" : "opacity-25 pointer-events-none scale-95",
                                 isSelected 
                                   ? "bg-nexus-teal/10 border-nexus-teal shadow-[0_15px_35px_rgba(0,255,209,0.25)] -translate-y-2" 
                                   : isEditing
                                     ? "border-2 border-solid border-white bg-white/10 shadow-neon-white"
                                     : `bg-white/[0.02] border-white/10 hover:border-nexus-teal/40 hover:-translate-y-1`
                              )}
                              style={{
                                 gridColumn: `${rack.x} / span ${rack.width}`,
                                 gridRow: `${rack.y} / span ${rack.height}`,
                                 transformStyle: 'preserve-3d'
                              }}
                           >
                              {/* 3D Wireframe Scaffold (Only in 3D Mode & Matches Locator Search) */}
                              {viewAngle === "isometric" && mode === "view" && matchesSearch && (
                                 <div 
                                    className={cn(
                                      "absolute inset-x-0 bottom-0 top-0 pointer-events-none transition-all duration-500 rounded-lg flex flex-col justify-between origin-bottom border border-dashed",
                                      isSelected ? "border-nexus-teal/50 bg-nexus-teal/5" : "border-white/5"
                                    )}
                                    style={{
                                       transform: `translateZ(${rack.level * 16}px)`,
                                    }}
                                 >
                                    {/* Scan laser sweeping animation */}
                                    {isSelected && (
                                      <div className="absolute left-0 right-0 h-[2px] bg-nexus-teal shadow-neon-teal animate-scan opacity-80" />
                                    )}
                                 </div>
                              )}

                              {/* Stacked Interactive Glass Shelves Inside Rack */}
                              <div className="absolute inset-1.5 flex flex-col-reverse justify-start gap-[3px] z-10">
                                 {Array.from({ length: rack.level }).map((_, shelfIdx) => {
                                    const lvlNum = shelfIdx + 1;
                                    const hasItem = rack.items[shelfIdx] !== undefined;

                                    return (
                                       <div 
                                          key={shelfIdx} 
                                          className={cn(
                                             "flex-1 min-h-[14px] rounded border transition-all flex items-center justify-between px-2 text-[9px] font-bold select-none",
                                             hasItem 
                                               ? isSelected 
                                                 ? "bg-nexus-teal/20 border-nexus-teal/40 text-nexus-teal"
                                                 : "bg-warning/10 border-warning/20 text-warning"
                                               : "bg-white/[0.01] border-white/5 text-white/20 hover:bg-white/5",
                                             isEditing ? "border-white/20" : ""
                                          )}
                                       >
                                          {/* Shelf Indicator Level */}
                                          <span>L{lvlNum}</span>
                                          {hasItem && (
                                             <span className="w-1.5 h-1.5 rounded-full bg-current shadow" />
                                          )}
                                       </div>
                                    );
                                 })}
                              </div>

                              {/* Rack Metadata Badge Label */}
                              <div className="absolute top-2 left-2 text-[11px] font-semibold text-white/40 group-hover:text-white transition-colors z-20 flex items-center gap-1.5">
                                 <span>{rack.id}</span>
                                 <span className={cn("text-[8px] px-1 rounded-full uppercase", 
                                   rackColor === "danger" ? "bg-danger/20 text-danger" : 
                                   rackColor === "warning" ? "bg-warning/20 text-warning" : "bg-nexus-teal/20 text-nexus-teal"
                                 )}>
                                   {rack.occupancy}%
                                 </span>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>

            {/* Bottom Builder Coordinate Info Banner */}
            {mode === "edit" && (
               <div className="p-4 bg-white/[0.02] border-t border-white/5 text-center text-xs font-bold text-white/40 flex items-center justify-center gap-3">
                  <Grid size={14} className="text-nexus-teal" />
                  <span>โหมดแก้ไข: คลิกเลือกตารางว่างด้านบนเพื่อวางชั้นวาง หรือคลิกชั้นวางที่มีอยู่เพื่อปรับขนาดพิกัดได้ทันที</span>
               </div>
            )}
         </div>

         {/* Sidebar Inspector Panel */}
         <div className="w-full lg:w-[400px] shrink-0 space-y-6">
            
            {/* View Mode Inspector */}
            {mode === "view" && selectedRack && (
               <div className="p-6 rounded-3xl bg-black/40 border border-nexus-teal/20 shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300 backdrop-blur-md">
                  <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-nexus-teal/5 via-transparent to-transparent rotate-45 pointer-events-none" />

                  <div className="relative z-10 space-y-6">
                     <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                           <p className="text-[10px] font-semibold text-nexus-teal uppercase tracking-[0.2em] animate-pulse">Live Telemetry</p>
                           <h3 className="text-3xl font-semibold text-white tracking-tight uppercase">พิกัด RACK-{selectedRack.id}</h3>
                        </div>
                        <button 
                           onClick={() => setSelectedRackId(null)}
                           className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        >
                           <Maximize2 size={12} className="rotate-45" />
                        </button>
                     </div>

                     {/* Progress Space Utility Indicators */}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-nexus-teal/10 border border-nexus-teal/20 flex flex-col justify-between h-24">
                           <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest">ความหนาแน่น</p>
                           <p className={cn("text-3xl font-black", selectedRack.occupancy > 90 ? "text-danger animate-pulse" : "text-nexus-teal")}>
                             {selectedRack.occupancy}<span className="text-sm ml-0.5 font-bold">%</span>
                           </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between h-24">
                           <p className="text-[9px] font-semibold text-white/40 uppercase tracking-widest">ชั้นจัดเก็บ</p>
                           <p className="text-3xl font-black text-white">
                             {selectedRack.level}<span className="text-xs text-white/40 ml-1 font-bold">LEVELS</span>
                           </p>
                        </div>
                     </div>

                     {/* Vertical Stack List representation */}
                     <div className="space-y-3">
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">ตารางการจัดเก็บพัสดุรายชั้น</p>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                           {Array.from({ length: selectedRack.level }).map((_, idx) => {
                              const levelNum = selectedRack.level - idx; // Display top level first
                              const locationBarcode = `${activeWh.id}-${selectedRack.id}-L${levelNum}`;
                              const itemForThisLevel = selectedRack.items[levelNum - 1];

                              return (
                                 <div key={levelNum} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 hover:border-nexus-teal/20 transition-all">
                                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                       <div className="flex items-center gap-2">
                                          <div className="w-5 h-5 rounded bg-nexus-teal/20 text-nexus-teal flex items-center justify-center text-[10px] font-black">
                                             L{levelNum}
                                          </div>
                                          <span className="text-[10px] font-mono font-bold text-white/50 tracking-wider">
                                             {locationBarcode}
                                          </span>
                                       </div>
                                       {pickerMode ? (
                                          <PillButton onClick={() => onSelectLocation?.(locationBarcode, activeWh.id)} className="h-6 px-3 text-[9px] font-black shadow-neon-blue">
                                             📍 เลือกพิกัดนี้
                                          </PillButton>
                                       ) : (
                                          <button className="text-[9px] font-bold text-nexus-teal/70 hover:text-nexus-teal transition-colors">
                                             พิมพ์บาร์โค้ด
                                          </button>
                                       )}
                                    </div>
                                    
                                    {itemForThisLevel ? (
                                       <div className="flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-2 text-white">
                                             <Box size={12} className="text-nexus-teal shrink-0" />
                                             <span className="font-bold">{itemForThisLevel}</span>
                                          </div>
                                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-nexus-teal/10 text-nexus-teal uppercase tracking-wider shrink-0">
                                            มีพัสดุ
                                          </span>
                                       </div>
                                    ) : (
                                       <div className="flex items-center gap-2 text-xs text-white/20 italic">
                                          <Box size={12} className="text-white/10 shrink-0" />
                                          <span>ว่าง (พิกัดว่างพร้อมรับเข้า)</span>
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* Empty view select prompt */}
            {mode === "view" && !selectedRack && (
               <div className="p-8 py-16 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01] backdrop-blur-md w-full">
                  <MapPin className="text-white/15 animate-bounce" size={40} />
                  <div className="space-y-1">
                     <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Digital Twin Telemetry</p>
                     <p className="text-[10.5px] font-bold text-white/30 uppercase leading-relaxed">
                        คลิกเลือกชั้นวางบนแบบจำลอง 3D เพื่อสแกนบาร์โค้ด<br/>ตรวจสอบปริมาณความหนาแน่น และรายการสินค้า
                     </p>
                  </div>
               </div>
            )}

            {/* Edit Mode Builder Configuration Tools */}
            {mode === "edit" && (
               <div className="space-y-6 animate-in slide-in-from-right duration-300">
                  
                  {/* Grid Size controls */}
                  <div className="p-6 rounded-3xl bg-black/40 border border-white/5 space-y-4 backdrop-blur-md">
                     <div className="flex items-center gap-2 text-white">
                        <Settings size={16} className="text-nexus-teal" />
                        <h5 className="text-xs font-semibold uppercase tracking-widest">ตั้งค่าขนาดคลังสินค้า</h5>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <label className="text-[9px] font-semibold text-white/40 uppercase">กว้าง</label>
                           <div className="flex items-center">
                              <button 
                                onClick={() => handleUpdateWarehouseGrid(activeWh.gridCols - 1, activeWh.gridRows)}
                                className="h-10 w-10 bg-white/5 hover:bg-white/10 text-white rounded-l-lg border border-white/5 font-bold"
                              >-</button>
                              <div className="flex-1 h-10 border-y border-white/5 bg-black/30 flex items-center justify-center font-black text-xs text-nexus-teal">{activeWh.gridCols}</div>
                              <button 
                                onClick={() => handleUpdateWarehouseGrid(activeWh.gridCols + 1, activeWh.gridRows)}
                                className="h-10 w-10 bg-white/5 hover:bg-white/10 text-white rounded-r-lg border border-white/5 font-bold"
                              >+</button>
                           </div>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[9px] font-semibold text-white/40 uppercase">ลึก</label>
                           <div className="flex items-center">
                              <button 
                                onClick={() => handleUpdateWarehouseGrid(activeWh.gridCols, activeWh.gridRows - 1)}
                                className="h-10 w-10 bg-white/5 hover:bg-white/10 text-white rounded-l-lg border border-white/5 font-bold"
                              >-</button>
                              <div className="flex-1 h-10 border-y border-white/5 bg-black/30 flex items-center justify-center font-black text-xs text-nexus-teal">{activeWh.gridRows}</div>
                              <button 
                                onClick={() => handleUpdateWarehouseGrid(activeWh.gridCols, activeWh.gridRows + 1)}
                                className="h-10 w-10 bg-white/5 hover:bg-white/10 text-white rounded-r-lg border border-white/5 font-bold"
                              >+</button>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Active Rack Builder Coordinates Panel */}
                  <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-5 backdrop-blur-md">
                     <div className="flex justify-between items-center">
                        <h5 className="text-xs font-semibold uppercase tracking-widest text-white">เครื่องมือจัดการชั้นพิกัด</h5>
                        {!editingRack && (
                           <button 
                             onClick={() => setEditingRack({ id: `RACK-${Date.now().toString().slice(-3)}`, x: 1, y: 1, width: 1, height: 1, level: 4, occupancy: 0, items: [] })} 
                             className="flex items-center gap-1 text-[10px] font-black text-nexus-teal bg-nexus-teal/10 px-3 py-1.5 rounded-full hover:bg-nexus-teal/20 transition-colors border border-nexus-teal/20"
                           >
                              <Plus size={12} /> เพิ่มพิกัดใหม่
                           </button>
                        )}
                     </div>

                     {editingRack ? (
                        <div className="space-y-5 animate-in zoom-in-95 duration-200">
                           <div className="space-y-1.5">
                              <label className="text-[9px] font-semibold text-white/40 uppercase">รหัสตำแหน่งชั้นวาง</label>
                              <input 
                                 type="text" 
                                 value={editingRack.id || ""} 
                                 onChange={e => setEditingRack({...editingRack, id: e.target.value})} 
                                 className="w-full h-10 rounded-xl bg-black/50 border border-white/10 text-xs px-3 text-white uppercase focus:outline-none focus:border-nexus-teal font-black"
                              />
                           </div>

                           {/* Interactive visual location slider guides */}
                           <div className="p-4 rounded-2xl bg-black/60 border border-white/5 space-y-4">
                              
                              {/* Slide Position Controls */}
                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-semibold text-white/40 uppercase block text-center">เลื่อนพิกัดบนตาราง</label>
                                 <div className="flex justify-center items-center gap-2">
                                    <button onClick={() => adjustRackPos(-1, 0)} className="h-8 w-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"><ChevronLeft size={16} /></button>
                                    <div className="flex flex-col gap-1">
                                       <button onClick={() => adjustRackPos(0, -1)} className="h-8 w-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"><ChevronUp size={16} /></button>
                                       <button onClick={() => adjustRackPos(0, 1)} className="h-8 w-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"><ChevronDown size={16} /></button>
                                    </div>
                                    <button onClick={() => adjustRackPos(1, 0)} className="h-8 w-8 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"><ChevronRight size={16} /></button>
                                 </div>
                                 <div className="text-[10px] text-center text-white/30 font-bold font-mono">
                                   พิกัดเริ่มต้น (X: {editingRack.x}, Y: {editingRack.y})
                                 </div>
                              </div>

                              <hr className="border-white/5" />

                              {/* Visual Sizing Buttons */}
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                 <div className="space-y-1">
                                    <label className="text-[9px] font-semibold text-white/30 uppercase text-center block">ความกว้าง</label>
                                    <div className="flex items-center justify-center bg-black/40 rounded border border-white/5">
                                       <button onClick={() => adjustRackSize(-1, 0)} className="w-8 h-8 font-bold text-white hover:bg-white/5 rounded-l">-</button>
                                       <span className="flex-1 text-center font-black text-nexus-teal">{editingRack.width}</span>
                                       <button onClick={() => adjustRackSize(1, 0)} className="w-8 h-8 font-bold text-white hover:bg-white/5 rounded-r">+</button>
                                    </div>
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[9px] font-semibold text-white/30 uppercase text-center block">ความลึก</label>
                                    <div className="flex items-center justify-center bg-black/40 rounded border border-white/5">
                                       <button onClick={() => adjustRackSize(0, -1)} className="w-8 h-8 font-bold text-white hover:bg-white/5 rounded-l">-</button>
                                       <span className="flex-1 text-center font-black text-nexus-teal">{editingRack.height}</span>
                                       <button onClick={() => adjustRackSize(0, 1)} className="w-8 h-8 font-bold text-white hover:bg-white/5 rounded-r">+</button>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* Level modifier */}
                           <div className="space-y-1.5">
                              <label className="text-[9px] font-semibold text-white/40 uppercase">จำนวนชั้นย่อยจัดเก็บ</label>
                              <div className="flex items-center bg-black/50 border border-white/10 rounded-xl overflow-hidden">
                                 <button onClick={() => adjustLevels(-1)} className="h-10 w-12 hover:bg-white/5 text-white font-bold">-</button>
                                 <div className="flex-1 text-center font-black text-white text-xs">{editingRack.level} ชั้น</div>
                                 <button onClick={() => adjustLevels(1)} className="h-10 w-12 hover:bg-white/5 text-white font-bold">+</button>
                              </div>
                           </div>

                           {/* Capacity: ใช้คำนวณ % ความจุจากยอดสต็อกจริงในตำแหน่งนี้ */}
                           <div className="space-y-1.5">
                              <label className="text-[9px] font-semibold text-white/40 uppercase">ความจุ (หน่วยสินค้าสูงสุด, 0 = ไม่กำหนด)</label>
                              <PillInput
                                 type="number"
                                 min={0}
                                 value={editingRack.capacity ?? 0}
                                 onChange={e => setEditingRack({ ...editingRack, capacity: Math.max(0, Number(e.target.value) || 0) })}
                                 className="w-full h-10 text-xs font-mono"
                              />
                           </div>

                           {/* Action Buttons */}
                           <div className="flex gap-3 pt-3 border-t border-white/5">
                              <button 
                                 onClick={handleSaveRack} 
                                 className="flex-1 h-10 rounded-full bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/40 backdrop-blur-md font-black text-xs hover:bg-nexus-teal/35 hover:text-white shadow-neon-teal transition-all flex items-center justify-center gap-1.5"
                              >
                                 <Save size={14} /> บันทึกพิกัด
                              </button>
                              {activeWh.racks.some(r => r.id === editingRack.id) && (
                                 <button 
                                    onClick={() => handleDeleteRack(editingRack.id!)} 
                                    className="px-3 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
                                 >
                                    <Trash2 size={14} />
                                 </button>
                              )}
                              <button 
                                 onClick={() => { setEditingRack(null); setSelectedGridCell(null); }} 
                                 className="px-3 rounded-xl border border-white/10 text-white/40 hover:text-white transition-colors text-xs"
                              >
                                 ยกเลิก
                              </button>
                           </div>
                        </div>
                     ) : (
                        <div className="p-8 border border-dashed border-white/15 rounded-2xl text-center text-white/30 text-[10.5px] font-bold uppercase leading-relaxed">
                           คลิกเลือกพิกัดเซลล์ว่างบนตารางแผนผัง<br/>หรือกด "เพิ่มพิกัดใหม่" เพื่อปรับแต่งคลังสินค้า
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
