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
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { usePOSHardware } from "@/hooks/usePOSHardware";
import { CheckoutModal } from "@/components/pos/CheckoutModal";
import { processPOSBatchCheckout } from "@/services/posBatch.service";
import { useAuth } from "@/context/AuthContext";

export default function POSPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [successTxId, setSuccessTxId] = useState<string | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const { user, companyId } = useAuth();

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

  const { data: products } = useRealtimeCollection('products');

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.sku.toLowerCase() === barcode.toLowerCase() || p.id === barcode);
    if (product) {
      addToCart(product);
    }
  };

  usePOSHardware({
    onBarcodeScan: handleBarcodeScan,
    onSearchFocus: () => searchInputRef.current?.focus(),
    onSuspendCart: () => {
      // Future feature: Suspend cart to local storage
      console.log('Cart Suspended');
    },
    onTriggerCheckout: () => {
      if (cart.length > 0) setIsCheckoutOpen(true);
    }
  });

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

  const subtotal = cart.reduce((acc, item) => acc + ((item.pricing?.pricePOS || item.price || 0) * item.qty), 0);
  const tax = subtotal * 0.07;
  const total = subtotal + tax;

  const handlePaymentConfirm = async (cashReceived: number) => {
    if (!companyId) return;
    
    // Prepare items for batch checkout
    const checkoutItems = cart.map(item => ({
      id: item.id,
      qty: item.qty,
      costPrice: item.pricing?.costWAC || 0,
      projectPrice: item.pricing?.priceProject || 0,
      retailPrice: item.pricing?.pricePOS || item.price || 0
    }));

    const result = await processPOSBatchCheckout({
      companyId: companyId,
      userId: user?.uid || 'SYSTEM',
      items: checkoutItems,
      vatType: 'EXCLUSIVE', // Assuming EXCLUSIVE for now, can be configured
      cashAccountId: '1111-00' // Assuming Cash Account Code
    });

    if (result.success) {
      setIsCheckoutOpen(false);
      setSuccessTxId(result.transactionId);
    } else {
      alert("เกิดข้อผิดพลาดในการทำรายการ กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <div 
       
      className={cn(
        "flex bg-[#0D0D0D] overflow-hidden border-white/5 transition-all duration-300",
        isFullscreen ? "h-screen w-screen max-w-full fixed inset-0 z-[5000]" : "h-[calc(100vh-140px)] max-w-[1800px] mx-auto border rounded-2xl shadow-2xl"
      )}
    >
      {/* Main POS Interface */}
      <div className="flex-1 flex flex-col p-5 space-y-3 overflow-hidden">
        {/* Header Area */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white tracking-tight uppercase">จุดขายอัจฉริยะ</h1>
            <p className="text-[11px] font-medium text-nexus-teal uppercase tracking-[0.3em] drop-shadow-neon">Tactical Transaction Terminal</p>
          </div>
          <div className="flex gap-4">
             <div className="flex items-center gap-3 px-6 py-2 bg-white/[0.03] border border-white/10 rounded-2xl">
                <div className="w-2 h-2 rounded-full bg-nexus-teal animate-pulse" />
                <span className="text-[12px] font-medium text-white/40 uppercase tracking-widest hidden md:inline">ระบบพร้อมใช้งาน</span>
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
        <div className="flex items-center justify-between gap-5">
           <div className="flex-1 flex items-center gap-3">
              {categories.map(cat => (
                 <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                       "px-4 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-widest transition-all border",
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
                
                placeholder="พิมพ์เพื่อค้นหา..." 
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
                        <span className="text-[12px] font-medium uppercase tracking-widest">ไม่พบสินค้าที่ค้นหา</span>
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
                   <NexusTableCell className="text-sm font-bold text-white uppercase group-hover:text-nexus-teal transition-colors">
                      {product.name}
                   </NexusTableCell>
                   <NexusTableCell mono className="text-right">
                      ฿{(product.pricing?.pricePOS || product.price || 0).toLocaleString()}
                   </NexusTableCell>
                   <NexusTableCell className="text-center">
                      <span className={cn("text-sm font-medium mono-numbers px-2 py-1 rounded-md", (product.stockStatus?.onHand || product.stock || 0) < 10 ? "bg-danger/10 text-danger" : "bg-nexus-teal/10 text-nexus-teal")}>
                         {product.stockStatus?.onHand || product.stock || 0}
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
      <div className="w-[550px] flex flex-col bg-[#0F0F12] border-l border-white/5 overflow-hidden shrink-0">
         {/* Cart Header */}
         <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20">
                  <ShoppingCart size={20} />
               </div>
               <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">รถเข็นสินค้า</h3>
                  <p className="text-[11px] font-medium text-white/20 uppercase tracking-widest">{cart.length} รายการในรายการ</p>
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
                       <p className="text-[15px] font-medium text-white truncate uppercase group-hover:text-nexus-teal transition-colors" title={item.name}>
                         {item.name}
                       </p>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-black/40 rounded-xl p-0.5 border border-white/5 shrink-0">
                       <button 
                          onClick={(e) => { e.stopPropagation(); if (item.qty > 1) setCart(cart.map(i => i.id === item.id ? {...i, qty: i.qty - 1} : i)); else removeFromCart(item.id); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-all"
                       >
                          <Minus size={16} />
                       </button>
                       <span className="text-[15px] font-bold text-white w-8 text-center">{item.qty}</span>
                       <button 
                          onClick={(e) => { e.stopPropagation(); setCart(cart.map(i => i.id === item.id ? {...i, qty: i.qty + 1} : i)); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-all"
                       >
                          <Plus size={16} />
                       </button>
                    </div>

                    <p className="text-[15px] font-bold text-nexus-teal mono-numbers shrink-0 w-24 text-right">
                       ฿{((item.pricing?.pricePOS || item.price || 0) * item.qty).toLocaleString()}
                    </p>
                  </div>
               ))
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-20">
                  <ShoppingCart size={48} />
                  <p className="text-[13px] font-medium uppercase tracking-widest">ยังไม่มีรายการสินค้า</p>
               </div>
            )}
         </div>

         {/* Summary & Checkout */}
         <div className="p-5 bg-[#0a0a0c] border-t border-white/5 space-y-5">
            <div className="space-y-3">
               <div className="flex justify-between items-center text-[14px] font-medium text-white/40 uppercase tracking-widest">
                  <span>ราคาพัสดุรวม</span>
                  <span className="mono-numbers text-base font-bold text-white/80">฿{subtotal.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center text-[14px] font-medium text-white/40 uppercase tracking-widest">
                  <span>ภาษีมูลค่าเพิ่ม (7%)</span>
                  <span className="mono-numbers text-base font-bold text-white/80">฿{tax.toLocaleString()}</span>
               </div>
               <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                  <span className="text-base font-bold text-nexus-teal uppercase tracking-[0.2em]">ยอดรวมสุทธิ</span>
                  <span className="text-4xl font-bold text-white mono-numbers">฿{total.toLocaleString()}</span>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-nexus-blue/40 transition-all group">
                  <CreditCard size={20} className="text-white/20 group-hover:text-nexus-blue transition-colors" />
                  <span className="text-[11px] font-medium text-white/40 uppercase tracking-widest">บัตรเครดิต</span>
               </button>
               <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-nexus-teal/40 transition-all group">
                  <Banknote size={20} className="text-white/20 group-hover:text-nexus-teal transition-colors" />
                  <span className="text-[11px] font-medium text-white/40 uppercase tracking-widest">เงินสด</span>
               </button>
            </div>

            <PillButton 
               disabled={cart.length === 0}
               className="w-full h-14 shadow-neon-teal text-lg tracking-[0.3em] mt-2"
               onClick={() => setIsCheckoutOpen(true)}
            >
               ชำระเงิน
            </PillButton>
         </div>
      </div>

      {/* Checkout Success Simulation */}
      {successTxId && (
         <div className="fixed inset-0 z-[7000] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => { setCart([]); setSuccessTxId(null); }} />
            <div className="relative w-full max-w-md p-10 rounded-xl bg-[#0D0D0D] border border-nexus-teal/20 text-center space-y-3 animate-in zoom-in-95 duration-300">
               <div className="w-24 h-24 rounded-full bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 mx-auto shadow-neon-teal">
                  <Zap size={48} />
               </div>
               <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white uppercase tracking-tight">ชำระเงินสำเร็จ</h2>
                  <p className="text-[12px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
                     รายการขายเลขที่ {successTxId}<br />
                     บันทึกเข้าสู่ระบบบัญชีและตัดสต็อกเรียบร้อยแล้ว
                  </p>
               </div>
               <PillButton className="w-full" onClick={() => { setCart([]); setSuccessTxId(null); }}>
                  เปิดรายการขายใหม่
               </PillButton>
            </div>
         </div>
      )}

      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        grandTotal={total} 
        onConfirmPayment={handlePaymentConfirm} 
        onClose={() => setIsCheckoutOpen(false)} 
      />

      {/* Product Detail Modal */}
      {selectedProductDetail && (
         <div className="fixed inset-0 z-[6000] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProductDetail(null)} />
            <div className="relative w-full max-w-md p-5 rounded-2xl bg-[#0D0D0D] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
               <button 
                 onClick={() => setSelectedProductDetail(null)}
                 className="absolute top-5 right-6 text-white/40 hover:text-white transition-colors"
               >
                 <X size={20} />
               </button>
               
               <div className="flex gap-5 items-start mb-8">
                 {selectedProductDetail.imageUrl ? (
                    <img src={selectedProductDetail.imageUrl} alt={selectedProductDetail.name} className="w-20 h-20 rounded-2xl object-cover border border-white/10" />
                 ) : (
                    <div className="w-20 h-20 rounded-2xl bg-nexus-blue/10 flex items-center justify-center text-nexus-blue border border-nexus-blue/20 shrink-0">
                       <Package size={32} />
                    </div>
                 )}
                 <div className="pt-1">
                    <h2 className="text-lg font-bold text-white uppercase">{selectedProductDetail.name}</h2>
                    <p className="text-[12px] font-medium text-white/40 uppercase tracking-widest mt-1">SKU: {selectedProductDetail.sku}</p>
                    <span className="inline-block mt-3 px-3 py-1 rounded-full bg-nexus-teal/10 text-nexus-teal text-[10px] font-normal uppercase tracking-widest">
                      {categories.find(c => c.id === selectedProductDetail.category)?.label || selectedProductDetail.category}
                    </span>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                     <p className="text-[11px] font-medium text-white/40 uppercase tracking-widest mb-1">ราคาต่อหน่วย</p>
                     <p className="text-lg font-bold text-nexus-teal mono-numbers">฿{selectedProductDetail.price.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                     <p className="text-[11px] font-medium text-white/40 uppercase tracking-widest mb-1">สต็อกคงเหลือ</p>
                     <p className="text-lg font-bold text-white mono-numbers">{selectedProductDetail.stock} ชิ้น</p>
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
