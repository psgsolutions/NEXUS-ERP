"use client";

import React, { useState } from 'react';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PillButton, NexusTable, NexusTableRow, NexusTableCell, NexusSearchInput, GlassCard, PillTabs } from '@/components/ui/Base';
import { Plus, Package, Box, Wrench, ShieldAlert } from 'lucide-react';
import { ProductForm } from './ProductForm';
import NexusPageLayout from '@/components/layout/NexusPageLayout';

export default function ProductsPage() {
  const { data: products, loading } = useRealtimeCollection('products');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("inventory");


  const handleCreateNew = () => {
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  // --------------------------------------------------------------------------------
  // SUMMARY CALCULATIONS
  // --------------------------------------------------------------------------------
  const total = products.length;
  const productCount = products.filter(p => p.type === 'PRODUCT').length;
  const laborCount = products.filter(p => p.type === 'LABOR').length;
  const whtCount = products.filter(p => p.whtRate && p.whtRate > 0).length;
  const totalStockValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || 0)), 0);

  // Filter logic
  const filteredProducts = products.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const displayCode = p.productCode || p.sku || '';
    const displayName = p.productName || p.name || '';
    return (
      displayCode.toLowerCase().includes(term) ||
      displayName.toLowerCase().includes(term)
    );
  });

  const tabs = [
    { id: "inventory", label: "คลังสินค้าหลัก", icon: <Package size={14} /> },
  ];

  const headerContent = (
    <>
      {/* Compact Module Header */}
      <header className="px-4 xl:p-6 py-3 min-h-[76px] border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-black/15 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-nexus-teal/15 flex items-center justify-center text-nexus-teal shadow-lg border border-nexus-teal/10">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none uppercase">คลังสินค้าและบริการ</h1>
            <p className="text-[11px] font-medium text-white/30 uppercase mt-1.5 tracking-widest leading-none">Product Master Data</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 bg-black/15 border border-white/5 rounded-2xl flex items-center gap-3 min-w-[130px] transition-all hover:border-nexus-teal/30 hover:bg-white/[0.03]">
             <div className="w-10 h-10 rounded-xl bg-nexus-teal/15 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shrink-0">
                <Box size={18} />
             </div>
             <div className="flex flex-col justify-center">
                <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none">มูลค่าต้นทุนรวม</span>
                <span className="text-[17px] font-bold text-nexus-teal mt-1 mono-numbers leading-none">฿{totalStockValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</span>
             </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <section className="px-6 py-2 bg-black/10 border-b border-white/5 shrink-0 flex flex-col lg:flex-row items-center justify-between gap-4">
        <PillTabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={(id: any) => setActiveTab(id)} 
        />
        <div className="flex gap-3 shrink-0">
          {!isFormOpen && (
            <PillButton 
              onClick={handleCreateNew}
              className="px-5 h-9 text-[12px]"
            >
              <Plus size={16} className="mr-2" /> สร้างรายการใหม่
            </PillButton>
          )}
        </div>
      </section>
    </>
  );

  const leftContent = (
      <div className="space-y-4">
        {isFormOpen ? (
          <GlassCard className="p-6">
            <ProductForm 
              initialData={selectedProduct} 
              onClose={() => setIsFormOpen(false)} 
            />
          </GlassCard>
        ) : (
          <>
            <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:w-96 relative">
                <NexusSearchInput 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหารหัสสินค้า, ชื่อรายการ..."
                />
              </div>
            </GlassCard>

            <GlassCard className="p-0 overflow-hidden flex-1 border-white/5">
              <NexusTable headers={["รหัสสินค้า", "ชื่อรายการ", "ประเภท", "ต้นทุน", "ราคาโครงการ", "ราคาหน้าร้าน", "จัดการ"]} minWidth="min-w-[900px]">
                {loading ? (
                  <NexusTableRow>
                    <NexusTableCell colSpan={7} className="text-center py-12 text-white/40">
                      <div className="animate-pulse flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-nexus-teal border-t-transparent rounded-full animate-spin"></div>
                        กำลังโหลดข้อมูล...
                      </div>
                    </NexusTableCell>
                  </NexusTableRow>
                ) : filteredProducts.length === 0 ? (
                  <NexusTableRow>
                    <NexusTableCell colSpan={7} className="text-center py-12 text-white/40">
                      <Package size={32} className="mx-auto mb-3 opacity-20" />
                      {searchTerm ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูลสินค้า/ค่าแรงในระบบ'}
                    </NexusTableCell>
                  </NexusTableRow>
                ) : (
                  filteredProducts.map((p) => {
                    const displayCode = p.productCode || p.sku || 'N/A';
                    const displayName = p.productName || p.name || 'Unnamed Product';
                    const displayCost = p.costPrice || p.pricing?.costWAC || 0;
                    const displayProjectPrice = p.projectPrice || p.pricing?.priceProject || 0;
                    const displayRetailPrice = p.retailPrice || p.pricing?.pricePOS || 0;
                    const isLabor = p.productType === 'Labor';

                  
                  return (
                      <NexusTableRow 
                        key={p.id} 
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedProduct(p);
                          setIsFormOpen(true);
                        }}
                      >
                        <NexusTableCell className="font-mono text-nexus-teal text-[11px] uppercase tracking-wider">
                          {displayCode}
                        </NexusTableCell>
                        
                        <NexusTableCell>
                          <div className="font-bold text-white text-[13px]">{displayName}</div>
                          {p.salesBom?.length > 0 && (
                            <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1 font-black uppercase tracking-wider">
                              <Box size={10} /> BOM: {p.salesBom.length} items
                            </div>
                          )}
                        </NexusTableCell>
                        
                        <NexusTableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest inline-flex items-center gap-1 ${
                              isLabor ? 'bg-transparent border border-warning/20 text-warning' : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                            }`}>
                              {isLabor ? <Wrench size={10} /> : <Box size={10} />}
                              {isLabor ? 'ค่าแรง' : 'สินค้า'}
                            </span>
                            {p.subjectToWHT && (
                              <span className="text-[9px] px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full font-black tracking-widest">
                                WHT
                              </span>
                            )}
                          </div>
                        </NexusTableCell>
                        
                        <NexusTableCell className="text-right font-mono text-[12px] text-red-400/70">
                          {Number(displayCost).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </NexusTableCell>
                        
                        <NexusTableCell className="text-right font-mono text-[12px] text-blue-400/70">
                          {Number(displayProjectPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </NexusTableCell>
                        
                        <NexusTableCell className="text-right font-mono text-[13px] font-bold text-nexus-teal">
                          {Number(displayRetailPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </NexusTableCell>

                        <NexusTableCell>
                          <PillButton 
                             
                            className="h-8 px-4 text-[10px] text-nexus-blue border-nexus-blue/20 hover:bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(p);
                              setIsFormOpen(true);
                            }}
                          >
                            ดู/แก้ไข
                          </PillButton>
                        </NexusTableCell>
                      </NexusTableRow>
                    );
                  })
                )}
              </NexusTable>
            </GlassCard>
          </>
        )}
      </div>
  );

  const rightSidebarContent = (
      <div className="space-y-4">
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-base font-black text-white/80 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4">
            <Box size={16} className="text-nexus-teal" /> ภาพรวมคลังสินค้า
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/15 rounded-2xl p-4 text-center border border-white/10">
              <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">รวมทุกรายการ</div>
              <div className="text-2xl font-mono text-white">{total}</div>
            </div>
            <div className="bg-transparent rounded-2xl p-4 text-center border border-nexus-teal/20">
              <div className="text-[10px] font-black text-nexus-teal/60 uppercase tracking-widest mb-1">
                มูลค่าต้นทุน
              </div>
              <div className="text-lg font-mono text-nexus-teal truncate" title={`฿${totalStockValue.toLocaleString('th-TH')}`}>
                ฿{totalStockValue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
              <span className="text-[11px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
                <Box size={14} className="text-blue-400" /> สินค้า (Product)
              </span>
              <span className="font-mono text-blue-400 text-sm">{productCount}</span>
            </div>
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-warning/10">
              <span className="text-[11px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
                <Wrench size={14} className="text-warning" /> เธเนเธฒเนเธฃเธ (Labor)
              </span>
              <span className="font-mono text-warning text-sm">{laborCount}</span>
            </div>
            <div className="flex justify-between items-center bg-red-500/5 p-3 rounded-xl border border-red-500/10">
              <span className="text-[11px] font-black text-red-400/80 uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert size={12} /> เธฃเธฒเธขเธเธฒเธฃเธ•เธดเธ” WHT
              </span>
              <span className="font-mono text-red-400 text-sm">{whtCount}</span>
            </div>
          </div>
        </GlassCard>
      </div>
  );

  return (
    <NexusPageLayout
      header={headerContent}
      leftContent={leftContent}
      rightSidebar={rightSidebarContent}
    />
  );
}


