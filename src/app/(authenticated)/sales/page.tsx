"use client";

import React, { useState, useEffect } from "react";
import { PillButton, PillInput, GlassCard } from "@/components/ui/Base";
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  User, 
  ArrowRight,
  Package
} from "lucide-react";
import { cn } from "@/components/ui/Base";

// Mock Items for POS Demo
const MOCK_ITEMS = [
  { id: "p1", sku: "SKU-24-001", name: "Cisco Catalyst 9200L", price: 125000, stock: 15 },
  { id: "p2", sku: "SKU-24-002", name: "Ubiquiti UniFi 6 Pro", price: 5800, stock: 42 },
  { id: "p3", sku: "SKU-24-003", name: "MikroTik CCR2004", price: 18500, stock: 5 },
  { id: "p4", sku: "SKU-24-004", name: "Fiber Optic Patch Cord", price: 150, stock: 120 },
];

interface CartItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  qty: number;
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const vat = subtotal * 0.07;
  const total = subtotal + vat;

  return (
    <div className="flex h-full overflow-hidden bg-transparent">
      {/* Product Selection Area */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="text-nexus-blue" />
              NEXUS POS Terminal
            </h1>
            <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Commerce Hub v2.9</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <PillInput 
              placeholder="ค้นหาพัสดุ / SKU..." 
              className="w-full pl-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
          {MOCK_ITEMS.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.includes(search)).map((item) => (
            <GlassCard 
              key={item.id} 
              className="p-4 flex flex-col justify-between hover:border-nexus-blue/50 cursor-pointer transition-all active:scale-95 group"
              onClick={() => addToCart(item)}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono text-nexus-blue bg-nexus-blue/10 px-2 py-0.5 rounded-full border border-nexus-blue/20">
                    {item.sku}
                  </span>
                  <span className="text-[10px] text-white/30 uppercase font-bold">Stock: {item.stock}</span>
                </div>
                <h3 className="text-white font-medium group-hover:text-nexus-blue transition-colors leading-tight mb-4">{item.name}</h3>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold mono-numbers text-white">{item.price.toLocaleString()}</span>
                <div className="w-8 h-8 rounded-full bg-nexus-blue/10 flex items-center justify-center text-nexus-blue group-hover:bg-nexus-blue group-hover:text-black transition-all">
                  <Plus size={18} />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Cart / Checkout Sidebar */}
      <aside className="w-96 border-l border-white/5 bg-black/40 backdrop-blur-xl flex flex-col">
        <header className="p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white uppercase tracking-widest text-sm">รายการสั่งซื้อ</h2>
            <PillButton variant="ghost" className="h-7 px-3 text-[10px]" onClick={() => setCart([])}>ล้างตะกร้า</PillButton>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
            <User className="text-white/30" size={18} />
            <div className="flex-1">
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">ลูกค้า</p>
              <p className="text-sm text-white">เงินสดหน้าร้าน (Walk-in)</p>
            </div>
            <ArrowRight className="text-white/20" size={16} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/10 space-y-4">
              <ShoppingCart size={48} strokeWidth={1} />
              <p className="text-sm">ไม่มีรายการในตะกร้า</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="p-3 bg-white/5 rounded-2xl border border-white/5 flex gap-3">
                <div className="flex-1">
                  <p className="text-xs text-white font-medium line-clamp-1">{item.name}</p>
                  <p className="text-[10px] mono-numbers text-white/40 mt-1">{item.price.toLocaleString()} x {item.qty}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => removeFromCart(item.id)} className="text-white/20 hover:text-danger transition-colors">
                    <Trash2 size={14} />
                  </button>
                  <div className="flex items-center gap-2 bg-black/40 rounded-full border border-white/10 p-0.5">
                    <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60"><Minus size={10} /></button>
                    <span className="text-[10px] font-bold text-white w-4 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60"><Plus size={10} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="p-6 bg-zinc-900/60 border-t border-white/10 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/40 font-bold uppercase tracking-widest">
              <span>รวมเงิน</span>
              <span className="mono-numbers">{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-white/40 font-bold uppercase tracking-widest">
              <span>ภาษี (VAT 7%)</span>
              <span className="mono-numbers">{vat.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-white/5">
              <span>ยอดสุทธิ</span>
              <span className="text-nexus-blue mono-numbers">{total.toLocaleString()}</span>
            </div>
          </div>

          <PillButton 
            disabled={cart.length === 0}
            className="w-full h-12 text-lg gap-3 shadow-nexus-glow bg-nexus-blue"
          >
            <CreditCard size={20} />
            ชำระเงินและตัดสต็อก
          </PillButton>
          
          <p className="text-[10px] text-center text-white/20 uppercase font-bold tracking-widest">
            Automatic GL Posting Enabled
          </p>
        </footer>
      </aside>
    </div>
  );
}
