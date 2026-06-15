"use client";

import React, { useState } from "react";
import { 
  Calculator, 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  Zap,
  CreditCard,
  Banknote,
  Globe,
  Package,
  History,
  TrendingUp,
  X,
  Maximize,
  Minimize
} from "lucide-react";
import { 
  PillButton, 
  PillInput, 
  GlassCard, 
  cn, 
  PillTabs, 
  StatusBadge, 
  Toast,
  MasterMetricCard,
  NexusTable,
  NexusTableRow,
  NexusTableCell
} from "@/components/ui/Base";

export default function POSPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const products = [
    { id: "1", sku: "DIS-LED-001", name: "LED Wall P2.5", price: 42500, category: "display", stock: 12, imageUrl: "" },
    { id: "2", sku: "NET-ARB-505", name: "Aruba AP-505", price: 12800, category: "network", stock: 45, imageUrl: "" },
    { id: "3", sku: "NET-CSC-920", name: "Cisco C9200-24T", price: 85000, category: "network", stock: 8, imageUrl: "" },
    { id: "4", sku: "CAB-CAT-001", name: "Cat6 Cable 305m", price: 4500, category: "cable", stock: 120, imageUrl: "" },
    { id: "5", sku: "RCK-MNT-42U", name: "Rack Mount 42U", price: 15000, category: "rack", stock: 5, imageUrl: "" },
    { id: "6", sku: "DIS-SMC-002", name: "Smart Controller", price: 22000, category: "display", stock: 15, imageUrl: "" },
  ];

  const categories = [
    { id: "all", label: "ทั้งหมด" },
    { id: "display", label: "Display" },
    { id: "network", label: "Network" },
    { id: "cable", label: "Cables" },
    { id: "rack", label: "Racks" },
  ];

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.07;
  const total = subtotal + tax;

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "flex bg-[#0D0D0D] overflow-hidden border-white/5 transition-all duration-300",
        isFullscreen ? "h-screen w-screen max-w-full fixed inset-0 z-[5000]" : "h-[calc(100vh-140px)] max-w-[1800px] mx-auto border rounded-2xl shadow-2xl"
      )}
    >
      {/* Main POS Interface */}
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
        {/* Header Area */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">จุดขายอัจฉริยะ (POS INTELLIGENCE)</h1>
            <p className="text-[10px] font-black text-nexus-teal uppercase tracking-[0.3em] drop-shadow-neon">Tactical Transaction Terminal</p>
          </div>
          <div className="flex gap-4">
             <div className="flex items-center gap-3 px-6 py-2 bg-white/[0.03] border border-white/10 rounded-2xl">
                <div className="w-2 h-2 rounded-full bg-nexus-teal animate-pulse" />
                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest hidden md:inline">ระบบพร้อมใช้งาน (ONLINE)</span>
             </div>
             <button 
                onClick={toggleFullscreen}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
             >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
             </button>
          </div>
        </div>

        {/* Categories & Search */}
        <div className="flex items-center justify-between gap-6">
           <div className="flex-1 flex items-center gap-3">
              {categories.map(cat => (
                 <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                       "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                       activeCategory === cat.id 
                          ? "bg-nexus-teal/10 text-nexus-teal border-nexus-teal shadow-[0_0_10px_rgba(16,187,168,0.2)]" 
                          : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05] hover:text-white hover:border-white/10"
                    )}
                 >
                    {cat.label}
                 </button>
              ))}
           </div>
           <div className="w-80 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <PillInput 
                placeholder="ค้นหาสินค้า / SKU..." 
                className="w-full pl-12 h-11 bg-white/[0.02] border-white/5"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
           </div>
        </div>

        {/* Product Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <NexusTable 
            headers={["รูปภาพ", "รหัสสินค้า", "ชื่อสินค้า", "ราคา", "สต็อก", "จัดการ"]}
            minWidth="min-w-[600px]"
          >
            {(() => {
              const filtered = products
                .filter(p => activeCategory === "all" || p.category === activeCategory)
                .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
              
              if (filtered.length === 0) {
                return (
                  <NexusTableRow>
                    <NexusTableCell colSpan={6} className="p-12 text-center text-white/30">
                      <div className="flex flex-col items-center gap-3 justify-center">
                        <Search size={32} className="opacity-20 animate-pulse" />
                        <span className="text-[11px] font-black uppercase tracking-widest">ไม่พบสินค้าที่ค้นหา</span>
                      </div>
                    </NexusTableCell>
                  </NexusTableRow>
                );
              }

              return filtered.map(product => (
                <NexusTableRow 
                   key={product.id} 
                   onClick={() => addToCart(product)}
                >
                   <NexusTableCell className="text-center">
                      <div className="flex justify-center">
                        {product.imageUrl ? (
                           <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                        ) : (
                           <div className="w-10 h-10 rounded-xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20">
                              <Package size={20} />
                           </div>
                        )}
                      </div>
                   </NexusTableCell>
                   <NexusTableCell mono>
                      {product.sku}
                   </NexusTableCell>
                   <NexusTableCell className="text-sm font-black text-white uppercase group-hover:text-nexus-teal transition-colors">
                      {product.name}
                   </NexusTableCell>
                   <NexusTableCell mono className="text-right">
                      ฿{product.price.toLocaleString()}
                   </NexusTableCell>
                   <NexusTableCell className="text-center">
                      <span className={cn("text-xs font-black mono-numbers px-2 py-1 rounded-md", product.stock < 10 ? "bg-danger/10 text-danger" : "bg-nexus-teal/10 text-nexus-teal")}>
                         {product.stock}
                      </span>
                   </NexusTableCell>
                   <NexusTableCell className="text-center">
                      <button 
                         onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                         className="w-8 h-8 rounded-lg bg-white/5 hover:bg-nexus-teal hover:text-black hover:shadow-neon-teal border border-white/10 flex items-center justify-center transition-all mx-auto"
                      >
                         <Plus size={16} />
                      </button>
                   </NexusTableCell>
                </NexusTableRow>
              ));
            })()}
          </NexusTable>
        </div>
      </div>

      {/* Right Sidebar - Checkout & Summary */}
      <div className="w-[450px] flex flex-col bg-[#0F0F12] border-l border-white/5 overflow-hidden shrink-0">
         {/* Cart Header */}
         <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                  <ShoppingCart size={20} />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">รถเข็นสินค้า</h3>
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{cart.length} รายการในรายการ</p>
               </div>
            </div>
            <button onClick={() => setCart([])} className="text-white/20 hover:text-danger transition-colors">
               <Trash2 size={18} />
            </button>
         </div>

         {/* Cart Items */}
         <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
            {cart.length > 0 ? (
               cart.map(item => (
                  <div 
                    key={item.id} 
                    className="px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3 group hover:bg-white/[0.05] transition-all cursor-pointer animate-in slide-in-from-right-4"
                    onClick={() => setSelectedProductDetail(item)}
                  >
                    <div className="flex-1 min-w-0">
                       <p className="text-[12px] font-black text-white truncate uppercase group-hover:text-nexus-teal transition-colors" title={item.name}>
                         {item.name}
                       </p>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-black/40 rounded-xl p-0.5 border border-white/5 shrink-0">
                       <button 
                          onClick={(e) => { e.stopPropagation(); if (item.qty > 1) setCart(cart.map(i => i.id === item.id ? {...i, qty: i.qty - 1} : i)); else removeFromCart(item.id); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-all"
                       >
                          <Minus size={14} />
                       </button>
                       <span className="text-[12px] font-black text-white w-6 text-center">{item.qty}</span>
                       <button 
                          onClick={(e) => { e.stopPropagation(); setCart(cart.map(i => i.id === item.id ? {...i, qty: i.qty + 1} : i)); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-all"
                       >
                          <Plus size={14} />
                       </button>
                    </div>

                    <p className="text-[13px] font-black text-nexus-teal mono-numbers shrink-0 w-20 text-right">
                       ฿{(item.price * item.qty).toLocaleString()}
                    </p>
                  </div>
               ))
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                  <ShoppingCart size={48} />
                  <p className="text-[12px] font-black uppercase tracking-widest">ยังไม่มีรายการสินค้า</p>
               </div>
            )}
         </div>

         {/* Summary & Checkout */}
         <div className="p-6 bg-[#0a0a0c] border-t border-white/5 space-y-4">
            <div className="space-y-2.5">
               <div className="flex justify-between items-center text-[12px] font-black text-white/40 uppercase tracking-widest">
                  <span>ราคาพัสดุรวม</span>
                  <span className="mono-numbers text-white/80">฿{subtotal.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center text-[12px] font-black text-white/40 uppercase tracking-widest">
                  <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                  <span className="mono-numbers text-white/80">฿{tax.toLocaleString()}</span>
               </div>
               <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                  <span className="text-sm font-black text-nexus-teal uppercase tracking-[0.2em]">ยอดรวมสุทธิ</span>
                  <span className="text-3xl font-black text-white mono-numbers">฿{total.toLocaleString()}</span>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-nexus-blue/40 transition-all group">
                  <CreditCard size={20} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">บัตรเครดิต</span>
               </button>
               <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-nexus-teal/40 transition-all group">
                  <Banknote size={20} className="text-white/20 group-hover:text-nexus-teal transition-colors" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">เงินสด</span>
               </button>
            </div>

            <PillButton 
               disabled={cart.length === 0}
               className="w-full h-14 shadow-neon-teal text-lg tracking-[0.3em] mt-2"
               onClick={() => setIsCheckoutOpen(true)}
            >
               ชำระเงิน (PAY NOW)
            </PillButton>
         </div>
      </div>

      {/* Checkout Success Simulation */}
      {isCheckoutOpen && (
         <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsCheckoutOpen(false)} />
            <div className="relative w-full max-w-md p-10 rounded-xl bg-[#0D0D0D] border border-nexus-teal/20 text-center space-y-8 animate-in zoom-in-95 duration-300">
               <div className="w-24 h-24 rounded-full bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 mx-auto shadow-neon-teal">
                  <Zap size={48} />
               </div>
               <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">ชำระเงินสำเร็จ</h2>
                  <p className="text-[12px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
                     รายการขายเลขที่ TXN-2605-0042<br />
                     บันทึกเข้าสู่ระบบบัญชีและตัดสต็อกเรียบร้อยแล้ว
                  </p>
               </div>
               <PillButton className="w-full" onClick={() => { setCart([]); setIsCheckoutOpen(false); }}>
                  เปิดรายการขายใหม่
               </PillButton>
            </div>
         </div>
      )}

      {/* Product Detail Modal */}
      {selectedProductDetail && (
         <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProductDetail(null)} />
            <div className="relative w-full max-w-md p-8 rounded-2xl bg-[#0D0D0D] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
               <button 
                 onClick={() => setSelectedProductDetail(null)}
                 className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
               >
                 <X size={20} />
               </button>
               
               <div className="flex gap-6 items-start mb-8">
                 {selectedProductDetail.imageUrl ? (
                    <img src={selectedProductDetail.imageUrl} alt={selectedProductDetail.name} className="w-20 h-20 rounded-2xl object-cover border border-white/10" />
                 ) : (
                    <div className="w-20 h-20 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
                       <Package size={32} />
                    </div>
                 )}
                 <div className="pt-1">
                    <h2 className="text-lg font-black text-white uppercase">{selectedProductDetail.name}</h2>
                    <p className="text-[11px] font-black text-white/40 uppercase tracking-widest mt-1">SKU: {selectedProductDetail.sku}</p>
                    <span className="inline-block mt-3 px-3 py-1 rounded-full bg-nexus-teal/10 text-nexus-teal text-[9px] font-black uppercase tracking-widest">
                      {categories.find(c => c.id === selectedProductDetail.category)?.label || selectedProductDetail.category}
                    </span>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">ราคาต่อหน่วย</p>
                     <p className="text-lg font-black text-nexus-teal mono-numbers">฿{selectedProductDetail.price.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">สต็อกคงเหลือ</p>
                     <p className="text-lg font-black text-white mono-numbers">{selectedProductDetail.stock} ชิ้น</p>
                  </div>
               </div>

               <PillButton className="w-full h-12 shadow-nexus-glow" onClick={() => setSelectedProductDetail(null)}>
                  ปิดหน้าต่าง
               </PillButton>
            </div>
         </div>
      )}
    </div>
  );
}
