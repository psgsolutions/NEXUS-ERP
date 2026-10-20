"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, BarChart3, History, Check, CreditCard, HelpCircle, Keyboard, Loader2, Minus, PauseCircle, PlayCircle, Plus, Printer, QrCode, ScanLine, Search, Settings, ShoppingCart, Trash2, User, X, ArrowRightLeft } from "lucide-react";
import { PillButton, PillInput, cn } from "@/components/ui/Base";
import { QrCode as QrSvg } from "@/components/ui/QrCode";
import { DailySummaryModal } from "@/components/pos/DailySummaryModal";
import { useAuth } from "@/context/AuthContext";
import { useSystemDialog } from "@/context/DialogContext";
import { useRealtimeCollection } from "@/hooks/useRealtimeCollection";
import { DocumentPdfModal } from "@/components/documents/DocumentPdfViewer";
import { branchLabel, formatTaxId } from "@/lib/documents/format";
import { limit, orderBy } from "firebase/firestore";
import { useProducts } from "@/hooks/useProducts";
import { useRealtimeDocument } from "@/hooks/useRealtimeDocument";
import { usePOSHardware } from "@/hooks/usePOSHardware";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/permissions";
import { findProductByScan } from "@/lib/warehouse-location";
import { normalizePromptPayId, promptPayPayload } from "@/lib/promptpay";

/**
 * ขายหน้าร้าน: สแกน/ค้นหาสินค้า → ตะกร้า → ชำระเงิน (เงินสด/พร้อมเพย์/โอน/บัตร) → พิมพ์ใบเสร็จ 80 มม.
 * ราคาและภาษีคำนวณซ้ำที่ server (/api/pos/checkout) ตัดสต็อกและลงบัญชีอัตโนมัติ
 */
type Method = "CASH" | "PROMPTPAY" | "TRANSFER" | "CARD";
interface CartLine { id: string; sku: string; name: string; unit: string; price: number; qty: number; stock: number }
const r2 = (n: number) => Math.round(n * 100) / 100;
const baht = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const priceOf = (p: any) => Number(p.pricing?.pricePOS ?? p.price ?? p.unitPrice ?? 0) || 0;
const stockOf = (p: any) => Number(p.stockStatus?.available ?? p.stockStatus?.onHand ?? p.currentStock ?? 0) || 0;
const METHODS: { id: Method; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "CASH", label: "เงินสด", icon: <Banknote size={18} />, hint: "รับเงิน แล้วระบบคำนวณเงินทอน" },
  { id: "PROMPTPAY", label: "พร้อมเพย์", icon: <QrCode size={18} />, hint: "ให้ลูกค้าสแกน QR ยอดตรง" },
  { id: "TRANSFER", label: "โอนเงิน", icon: <ArrowRightLeft size={18} />, hint: "ตรวจสลิปแล้วบันทึกเลขอ้างอิง" },
  { id: "CARD", label: "บัตร", icon: <CreditCard size={18} />, hint: "รูดบัตรที่เครื่อง EDC แล้วบันทึกเลขสลิป" },
];
const HOLD_KEY = "nexus_pos_held_bills";

export default function POSPage() {
  const { companyId, roles } = useAuth();
  const { showAlert, showConfirm } = useSystemDialog();
  const { data: products } = useProducts<any>();
  const { data: company } = useRealtimeDocument<any>(companyId ? `companies/${companyId}` : null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [discount, setDiscount] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; taxId: string; branch: string; address: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [held, setHeld] = useState<any[]>([]);
  const [showHeld, setShowHeld] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reprint, setReprint] = useState<any>(null);
  const [a4, setA4] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const canSell = can(roles, "sales:billing");

  useEffect(() => { try { setHeld(JSON.parse(localStorage.getItem(HOLD_KEY) || "[]")); } catch { setHeld([]); } }, []);
  const saveHeld = (list: any[]) => { setHeld(list); try { localStorage.setItem(HOLD_KEY, JSON.stringify(list)); } catch { /* ไม่มีพื้นที่เก็บในเครื่อง */ } };

  const sellable = useMemo(() => products.filter((p: any) => (p.itemType || "PRODUCT") === "PRODUCT" && p.isSample !== true && priceOf(p) > 0), [products]);
  const categories = useMemo(() => ["all", ...Array.from(new Set(sellable.map((p: any) => p.category).filter(Boolean))).sort()] as string[], [sellable]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return sellable.filter((p: any) => (category === "all" || p.category === category) && (!s || [p.name, p.sku, p.barcode].some((v: any) => String(v || "").toLowerCase().includes(s)))).slice(0, 120);
  }, [sellable, search, category]);

  const add = useCallback((p: any, qty = 1) => {
    const stock = stockOf(p);
    setCart((c) => {
      const ex = c.find((l) => l.id === p.id);
      const nextQty = (ex?.qty || 0) + qty;
      if (nextQty > stock) { setFlash(`${p.name}: สต็อกพร้อมขายเหลือ ${stock} ${p.unit || ""}`); return c; }
      setFlash(`เพิ่ม ${p.name}`);
      return ex ? c.map((l) => (l.id === p.id ? { ...l, qty: nextQty } : l)) : [...c, { id: p.id, sku: p.sku || "", name: p.name || p.sku, unit: p.unit || "ชิ้น", price: priceOf(p), qty, stock }];
    });
  }, []);
  const setQty = (id: string, qty: number) => setCart((c) => c.flatMap((l) => (l.id !== id ? [l] : qty <= 0 ? [] : [{ ...l, qty: Math.min(qty, l.stock) }])));

  // สแกนบาร์โค้ด / Enter ในช่องค้นหา
  const onScan = useCallback((code: string) => {
    const p = findProductByScan(sellable, code);
    if (p) { add(p); setSearch(""); } else setFlash(`ไม่พบสินค้ารหัส ${code}`);
  }, [sellable, add]);
  const totals = useMemo(() => {
    const subTotal = r2(cart.reduce((s, l) => s + l.price * l.qty, 0));
    const disc = r2(Math.max(0, Math.min(subTotal, Number(discount) || 0)));
    const net = r2(subTotal - disc);
    const vat = r2(net * 0.07);
    return { subTotal, discount: disc, net, vat, total: r2(net + vat), items: cart.reduce((s, l) => s + l.qty, 0) };
  }, [cart, discount]);

  const hold = () => {
    if (!cart.length) return;
    saveHeld([...held, { at: new Date().toISOString(), cart, discount, customer, total: totals.total }]);
    setCart([]); setDiscount(""); setCustomer(null); setShowDiscount(false); setFlash("พักบิลแล้ว");
  };
  const resume = (i: number) => {
    if (cart.length) return void showAlert("มีบิลค้างอยู่ในตะกร้า พักบิลปัจจุบันก่อนเรียกบิลอื่น");
    const b = held[i];
    setCart(b.cart); setDiscount(b.discount || ""); setCustomer(b.customer || null);
    saveHeld(held.filter((_, k) => k !== i)); setShowHeld(false);
  };
  const clear = async () => { if (cart.length && (await showConfirm("ล้างสินค้าทั้งหมดในบิลนี้?"))) { setCart([]); setDiscount(""); setCustomer(null); setShowDiscount(false); } };

  usePOSHardware({
    onBarcodeScan: onScan,
    onSearchFocus: () => searchRef.current?.focus(),
    onSuspendCart: hold,
    onTriggerCheckout: () => { if (cart.length && !payOpen && !receipt) setPayOpen(true); },
  });
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "F9") { e.preventDefault(); if (cart.length && !payOpen && !receipt) setPayOpen(true); }
      if (e.key === "Escape") { setPayOpen(false); setShowHeld(false); setShowHelp(false); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [cart.length, payOpen, receipt]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(""), 2200); return () => clearTimeout(t); }, [flash]);

  const checkout = async (method: Method, cashReceived: number, paymentRef: string) => {
    const res = await apiFetch("/api/pos/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, items: cart.map((l) => ({ id: l.id, qty: l.qty })), paymentMethod: method, cashReceived, paymentRef, discount: totals.discount, customer }),
    });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.error || "ชำระเงินไม่สำเร็จ");
    setPayOpen(false); setReceipt(d); setCart([]); setDiscount(""); setCustomer(null); setShowDiscount(false);
  };

  if (!canSell) return <div className="p-10 text-white/60 text-sm">ขายหน้าร้านได้เฉพาะตำแหน่งฝ่ายขาย</div>;

  return (
    <div className="flex flex-col xl:flex-row gap-5 px-4 py-3 h-[calc(100vh-72px)] max-w-[1900px] mx-auto">
      {/* สินค้า */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0 sm:min-w-[240px]">
            <PillInput ref={searchRef} autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && search.trim()) { e.preventDefault(); e.stopPropagation(); const exact = findProductByScan(sellable, search); if (exact) onScan(search); else if (shown.length === 1) { add(shown[0]); setSearch(""); } } }}
              placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อ/รหัสสินค้า แล้วกด Enter" className="w-full h-11 pl-11 text-[15px]" />
            {/* ไอคอนอยู่หลังช่องค้นหาใน DOM เพื่อไม่ให้ถูก backdrop-blur ของช่องทับจนเบลอ */}
            <ScanLine size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          </div>
          <IconBtn label="บิลย้อนหลัง / พิมพ์ซ้ำ" onClick={() => setHistoryOpen(true)}><History size={17} /></IconBtn>
          <IconBtn label="สรุปยอดวันนี้" onClick={() => setSummaryOpen(true)}><BarChart3 size={17} /></IconBtn>
          <IconBtn label="วิธีใช้" onClick={() => setShowHelp(true)}><HelpCircle size={17} /></IconBtn>
          {can(roles, "settings:manage") && <IconBtn label="ตั้งค่าหน้าร้าน" onClick={() => setSettingsOpen(true)}><Settings size={17} /></IconBtn>}
        </div>
        <div className="flex gap-1 overflow-x-auto flex-shrink-0">
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={cn("h-8 px-3.5 rounded-full text-[13px] whitespace-nowrap transition-colors", category === c ? "bg-white/10 text-white font-semibold" : "text-white/45 hover:text-white/80")}>{c === "all" ? "ทั้งหมด" : c}</button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2 content-start pr-1">
          {shown.length === 0 && <p className="col-span-full text-center text-[14px] text-white/40 py-16">{sellable.length === 0 ? "ยังไม่มีสินค้าที่ตั้งราคาขายหน้าร้าน" : "ไม่พบสินค้า"}</p>}
          {shown.map((p: any) => {
            const st = stockOf(p);
            const inCart = cart.find((l) => l.id === p.id)?.qty || 0;
            return (
              <button key={p.id} type="button" disabled={st <= 0} onClick={() => add(p)} title={p.sku}
                className={cn("relative text-left rounded-xl p-3 flex flex-col gap-2 min-h-[92px] transition-colors", st <= 0 ? "bg-white/[0.015] opacity-40" : "bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98]", inCart > 0 && "ring-1 ring-nexus-teal/50")}>
                {inCart > 0 && <span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-nexus-teal text-surface-0 text-[11px] font-bold flex items-center justify-center">{inCart}</span>}
                <span className="text-[14px] text-white/90 leading-snug line-clamp-2 pr-5">{p.name}</span>
                <span className="mt-auto flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold font-mono text-white">{baht(priceOf(p))}</span>
                  <span className={cn("text-[11px] whitespace-nowrap", st <= 0 ? "text-danger" : st <= 5 ? "text-warning" : "text-white/30")}>{st <= 0 ? "หมด" : `เหลือ ${st}`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* บิล */}
      <div className="w-full xl:w-[400px] flex-shrink-0 flex flex-col rounded-2xl bg-white/[0.03] min-h-0">
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06]">
          <span className="text-[15px] font-semibold text-white">บิลปัจจุบัน{totals.items > 0 && <span className="text-white/40 font-normal"> · {totals.items} ชิ้น</span>}</span>
          {held.length > 0 && <button type="button" onClick={() => setShowHeld(true)} className="text-[13px] text-white/60 hover:text-white flex items-center gap-1"><PlayCircle size={14} /> บิลที่พัก {held.length}</button>}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          {cart.length === 0 && (
            <div className="text-center py-14 space-y-2 text-white/30">
              <ShoppingCart size={28} className="mx-auto" />
              <p className="text-[14px]">สแกนหรือแตะสินค้าเพื่อเพิ่มลงบิล</p>
            </div>
          )}
          {cart.map((l) => (
            <div key={l.id} className="py-2.5 border-b border-white/[0.06] last:border-0">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[14px] text-white/90 leading-snug min-w-0">{l.name}</span>
                <span className="text-[14px] font-semibold font-mono text-white whitespace-nowrap">{baht(l.price * l.qty)}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setQty(l.id, l.qty - 1)} className="w-7 h-7 rounded-full bg-white/5 text-white/70 hover:bg-white/10 flex items-center justify-center" aria-label="ลด"><Minus size={13} /></button>
                  <input value={l.qty} onChange={(e) => setQty(l.id, Math.floor(Number(e.target.value) || 0))} className="w-10 h-7 bg-transparent text-center text-[14px] leading-[1.9] font-mono text-white outline-none" inputMode="numeric" aria-label="จำนวน" />
                  <button type="button" onClick={() => setQty(l.id, l.qty + 1)} disabled={l.qty >= l.stock} className="w-7 h-7 rounded-full bg-white/5 text-white/70 hover:bg-white/10 flex items-center justify-center disabled:opacity-30" aria-label="เพิ่ม"><Plus size={13} /></button>
                  <span className="text-[12px] text-white/35 ml-1.5">× {baht(l.price)}</span>
                </div>
                <button type="button" onClick={() => setQty(l.id, 0)} className="text-white/25 hover:text-danger" aria-label="ลบรายการ"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-2.5">
          <div className="flex items-center gap-4 text-[13px]">
            <button type="button" onClick={() => setShowDiscount((v) => !v)} className={cn("hover:text-white", showDiscount || totals.discount > 0 ? "text-white" : "text-white/50")}>+ ส่วนลด</button>
            <button type="button" onClick={() => setCustomer(customer ? null : { name: "", taxId: "", branch: "สำนักงานใหญ่", address: "" })} className={cn("flex items-center gap-1 hover:text-white", customer ? "text-white" : "text-white/50")}><User size={13} /> {customer ? "ยกเลิกใบกำกับเต็มรูป" : "+ ใบกำกับภาษีเต็มรูป"}</button>
          </div>
          {(showDiscount || totals.discount > 0) && (
            <div className="flex items-center gap-2">
              <label className="text-[13px] text-white/50 whitespace-nowrap">ส่วนลดท้ายบิล (บาท)</label>
              <PillInput value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="h-9 flex-1 text-right font-mono text-sm" placeholder="0.00" />
            </div>
          )}
          {customer && (
            <div className="grid grid-cols-2 gap-2">
              <PillInput value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="ชื่อลูกค้า/บริษัท" className="h-9 text-sm col-span-2" />
              <PillInput value={customer.taxId} onChange={(e) => setCustomer({ ...customer, taxId: e.target.value })} placeholder="เลขประจำตัวผู้เสียภาษี" className="h-9 text-sm font-mono" />
              <PillInput value={customer.branch} onChange={(e) => setCustomer({ ...customer, branch: e.target.value })} placeholder="สาขา" className="h-9 text-sm" />
              <PillInput value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="ที่อยู่" className="h-9 text-sm col-span-2" />
            </div>
          )}
          <div className="space-y-1 text-[13px] text-white/50">
            <div className="flex justify-between"><span>รวมเป็นเงิน</span><span className="font-mono">{baht(totals.subTotal)}</span></div>
            {totals.discount > 0 && <div className="flex justify-between"><span>ส่วนลด</span><span className="font-mono">−{baht(totals.discount)}</span></div>}
            <div className="flex justify-between"><span>VAT 7%</span><span className="font-mono">{baht(totals.vat)}</span></div>
          </div>
          <div className="flex justify-between items-baseline"><span className="text-[15px] text-white">ยอดชำระ</span><span className="text-[30px] font-bold font-mono text-white leading-none">฿{baht(totals.total)}</span></div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={hold} disabled={!cart.length} title="พักบิล (F10)" className="h-12 px-4 rounded-full bg-white/5 text-[13px] text-white/70 hover:bg-white/10 disabled:opacity-30 flex items-center gap-1.5"><PauseCircle size={15} /> พักบิล</button>
            <button type="button" onClick={clear} disabled={!cart.length} className="h-12 px-3 rounded-full text-[13px] text-white/40 hover:text-danger disabled:opacity-30">ล้าง</button>
            <button type="button" onClick={() => setPayOpen(true)} disabled={!cart.length} className="flex-1 h-12 rounded-full bg-nexus-teal text-surface-0 text-[16px] font-bold hover:brightness-110 active:scale-[0.98] disabled:bg-white/10 disabled:text-white/30 transition-colors">ชำระเงิน <span className="font-normal opacity-60 text-[13px]">F9</span></button>
          </div>
        </div>
      </div>

      {flash && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90000] px-5 py-2.5 rounded-full bg-surface-0 border border-white/15 text-[14px] text-white shadow-2xl">{flash}</div>}

      {payOpen && <PaymentModal total={totals.total} company={company} onClose={() => setPayOpen(false)} onPay={checkout} />}
      {receipt && <ReceiptModal receipt={receipt} company={company} onNext={() => { setReceipt(null); setTimeout(() => searchRef.current?.focus(), 50); }} />}
      {reprint && <ReceiptModal receipt={reprint} company={company} reprint onNext={() => setReprint(null)} />}
      {historyOpen && companyId && <SaleHistory companyId={companyId} onClose={() => setHistoryOpen(false)} onReprint={(t) => { setHistoryOpen(false); setReprint(t); }} onA4={(no) => { setHistoryOpen(false); setA4(no); }} />}
      <DocumentPdfModal open={!!a4} onClose={() => setA4("")} source={a4 ? { type: "pos", id: a4 } : undefined} title={`บิลขายหน้าร้าน ${a4}`} />
      {showHeld && (
        <Modal title={`บิลที่พักไว้ (${held.length})`} onClose={() => setShowHeld(false)}>
          {held.length === 0 ? <p className="text-[14px] text-white/50">ไม่มีบิลที่พักไว้</p> : held.map((b, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-white/5">
              <span className="text-[14px] text-white">{new Date(b.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} · {b.cart.length} รายการ · ฿{baht(b.total)}</span>
              <div className="flex gap-2">
                <PillButton variant="ghost" className="h-9 px-3 text-xs text-danger" onClick={() => saveHeld(held.filter((_, k) => k !== i))}>ลบ</PillButton>
                <PillButton variant="confirm" className="h-9 px-4 text-xs font-bold" onClick={() => resume(i)}>เรียกบิลนี้</PillButton>
              </div>
            </div>
          ))}
          <p className="text-[12px] text-white/40">บิลที่พักเก็บไว้ในเครื่องนี้เท่านั้น</p>
        </Modal>
      )}
      {showHelp && (
        <Modal title="วิธีใช้ขายหน้าร้าน" onClose={() => setShowHelp(false)}>
          <ol className="list-decimal pl-5 space-y-1.5 text-[14px] text-white/80">
            <li>สแกนบาร์โค้ดสินค้า หรือพิมพ์ชื่อ/รหัสแล้วกด Enter หรือแตะที่การ์ดสินค้า</li>
            <li>ปรับจำนวนในบิลด้วยปุ่ม + / − หรือพิมพ์จำนวน (เกินสต็อกพร้อมขายไม่ได้)</li>
            <li>ใส่ส่วนลดท้ายบิลถ้ามี และกรอกข้อมูลลูกค้าถ้าลูกค้าขอใบกำกับภาษีเต็มรูป</li>
            <li>กด &quot;ชำระเงิน&quot; เลือกวิธีชำระ แล้วยืนยัน ระบบตัดสต็อกและบันทึกบัญชีให้</li>
            <li>พิมพ์ใบเสร็จ 80 มม. แล้วกด &quot;ขายบิลถัดไป&quot;</li>
          </ol>
          <div className="grid grid-cols-2 gap-2 pt-2 text-[13px]">
            {[["F1", "ไปที่ช่องค้นหา"], ["F9 / Ctrl+Enter", "ชำระเงิน"], ["F10", "พักบิล"], ["Esc", "ปิดหน้าต่าง"]].map(([k, v]) => (
              <div key={k} className="flex items-center gap-2"><span className="px-2 py-0.5 rounded-md border border-white/20 font-mono text-[12px] text-white"><Keyboard size={11} className="inline mr-1" />{k}</span><span className="text-white/60">{v}</span></div>
            ))}
          </div>
          <p className="text-[12px] text-white/40 pt-2">ราคาสินค้าหน้าร้านยังไม่รวมภาษีมูลค่าเพิ่ม ระบบบวก VAT 7% ให้ตอนชำระเงิน</p>
        </Modal>
      )}
      {settingsOpen && <PosSettings company={company} companyId={companyId || ""} onClose={() => setSettingsOpen(false)} onSaved={() => { setSettingsOpen(false); showAlert("บันทึกการตั้งค่าหน้าร้านแล้ว"); }} />}
      <DailySummaryModal isOpen={summaryOpen} onClose={() => setSummaryOpen(false)} />
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className="w-11 h-11 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] flex-shrink-0 transition-colors">{children}</button>;
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className={cn("relative w-full max-h-[92vh] overflow-y-auto bg-surface-0 border border-white/10 rounded-3xl p-6 space-y-4", wide ? "max-w-[760px]" : "max-w-[520px]")}>
        <div className="flex items-center justify-between"><h3 className="text-[18px] font-bold text-white">{title}</h3><button type="button" onClick={onClose} className="text-white/50 hover:text-white" aria-label="ปิด"><X size={20} /></button></div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function PaymentModal({ total, company, onClose, onPay }: { total: number; company: any; onClose: () => void; onPay: (m: Method, cash: number, ref: string) => Promise<void> }) {
  const [method, setMethod] = useState<Method>("CASH");
  const [cash, setCash] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const received = Number(cash) || 0;
  const change = r2(received - total);
  const ppId = company?.promptPayId || company?.taxId || "";
  const ppOk = !!normalizePromptPayId(ppId);
  const quick = Array.from(new Set([total, Math.ceil(total / 20) * 20, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])).filter((v) => v >= total).slice(0, 5);
  const canConfirm = method === "CASH" ? received >= total : method === "PROMPTPAY" ? ppOk : true;
  const confirm = async () => {
    setBusy(true); setErr("");
    try { await onPay(method, method === "CASH" ? received : total, ref.trim()); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="ชำระเงิน" onClose={onClose} wide>
      <div className="flex items-end justify-between">
        <span className="text-[14px] text-white/60">ยอดที่ต้องชำระ</span>
        <span className="text-[36px] font-bold font-mono text-nexus-teal leading-none">฿{baht(total)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {METHODS.map((m) => (
          <button key={m.id} type="button" onClick={() => { setMethod(m.id); setErr(""); }} className={cn("rounded-2xl border px-3 py-3 text-left", method === m.id ? "bg-nexus-teal/15 border-nexus-teal/50" : "border-white/10 hover:bg-white/5")}>
            <span className={cn("flex items-center gap-2 text-[15px] font-semibold", method === m.id ? "text-nexus-teal" : "text-white")}>{m.icon} {m.label}</span>
            <span className="block text-[11px] text-white/40 mt-0.5 leading-snug">{m.hint}</span>
          </button>
        ))}
      </div>

      {method === "CASH" && (
        <div className="space-y-3">
          <PillInput autoFocus value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) confirm(); }} inputMode="decimal" placeholder="รับเงินมา (บาท)" className="w-full h-14 text-[24px] text-right font-mono" />
          <div className="flex gap-2 flex-wrap">
            {quick.map((v, i) => <button key={v} type="button" onClick={() => setCash(String(v))} className="h-11 px-4 rounded-xl border border-white/10 text-[15px] font-mono text-white hover:bg-white/5">{i === 0 ? "พอดี" : `฿${v.toLocaleString("th-TH")}`}</button>)}
          </div>
          <div className="flex items-end justify-between rounded-2xl border border-white/10 px-4 py-3">
            <span className="text-[15px] text-white/70">เงินทอน</span>
            <span className={cn("text-[30px] font-bold font-mono leading-none", change < 0 ? "text-danger" : "text-white")}>{received ? (change < 0 ? `ขาด ฿${baht(-change)}` : `฿${baht(change)}`) : "-"}</span>
          </div>
        </div>
      )}
      {method === "PROMPTPAY" && (
        ppOk ? (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-2xl bg-white p-3"><QrSvg value={promptPayPayload(ppId, total)} size={220} level="M" /></div>
            <p className="text-[14px] text-white">สแกนจ่าย ฿{baht(total)} · พร้อมเพย์ {String(ppId).replace(/\D/g, "").replace(/(\d{3})\d+(\d{4})/, "$1xxx$2")}</p>
            <p className="text-[12px] text-white/50">ตรวจยอดเงินเข้าในแอปธนาคารก่อนกดยืนยัน</p>
            <PillInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="เลขอ้างอิงจากสลิป (ถ้ามี)" className="w-full h-10 text-sm" />
          </div>
        ) : <p className="text-[14px] text-warning">ยังไม่ได้ตั้งรหัสพร้อมเพย์ของร้าน ให้ผู้ดูแลระบบกดปุ่มตั้งค่า (รูปฟันเฟือง) เพื่อใส่เบอร์มือถือหรือเลขประจำตัวผู้เสียภาษี</p>
      )}
      {(method === "TRANSFER" || method === "CARD") && (
        <PillInput autoFocus value={ref} onChange={(e) => setRef(e.target.value)} placeholder={method === "CARD" ? "เลขที่สลิปบัตร / 4 หลักท้ายบัตร" : "เลขอ้างอิงการโอนจากสลิป"} className="w-full h-12 text-[15px]" />
      )}
      {err && <p className="text-[13px] text-danger font-bold">{err}</p>}
      <PillButton variant="confirm" className="w-full h-14 text-[18px] font-bold" disabled={busy || !canConfirm} onClick={confirm}>
        {busy ? <Loader2 size={20} className="animate-spin mr-2" /> : <Check size={20} className="mr-2" />} {method === "CASH" ? "รับเงินและปิดบิล" : method === "PROMPTPAY" ? "ได้รับเงินแล้ว ปิดบิล" : "บันทึกการชำระ"}
      </PillButton>
    </Modal>
  );
}

/** บิลขายหน้าร้านล่าสุด 50 รายการ — พิมพ์ใบเสร็จ 80 มม. ซ้ำ หรือเปิดเป็นเอกสาร A4 */
function SaleHistory({ companyId, onClose, onReprint, onA4 }: { companyId: string; onClose: () => void; onReprint: (t: any) => void; onA4: (no: string) => void }) {
  const constraints = useMemo(() => [orderBy("createdAt", "desc"), limit(50)], []);
  const { data: sales, loading } = useRealtimeCollection<any>(`companies/${companyId}/sales_transactions`, constraints, false);
  const [q, setQ] = useState("");
  const shown = sales.filter((t: any) => !q.trim() || [t.transactionNo, t.customer?.name, t.paymentRef].some((v) => String(v || "").toLowerCase().includes(q.trim().toLowerCase())));
  const when = (v: any) => { const ms = v?.toMillis?.() ?? (v?.seconds ? v.seconds * 1000 : Date.parse(v)); return Number.isFinite(ms) ? new Date(ms).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-"; };
  return (
    <Modal title="บิลย้อนหลัง" onClose={onClose} wide>
      <PillInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขที่บิล ชื่อลูกค้า เลขอ้างอิง" className="w-full h-10 text-sm" />
      {loading ? <p className="text-[14px] text-white/50 py-6 text-center"><Loader2 size={16} className="inline animate-spin mr-2" />กำลังโหลด…</p> : shown.length === 0 ? <p className="text-[14px] text-white/50 py-6 text-center">ยังไม่มีบิล</p> : (
        <div className="divide-y divide-white/[0.06]">
          {shown.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[14px] text-white font-mono">{t.transactionNo || t.id}{t.customer ? <span className="ml-2 font-sans text-[12px] text-white/50">ใบกำกับเต็มรูป · {t.customer.name}</span> : null}</p>
                <p className="text-[12px] text-white/45">{when(t.createdAt)} · {METHODS.find((m) => m.id === t.paymentMethod)?.label || t.paymentMethod}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[15px] font-semibold font-mono text-white mr-2">{baht(t.grandTotal)}</span>
                <PillButton variant="ghost" className="h-9 px-3 text-xs" onClick={() => onReprint({ ...t, transactionNo: t.transactionNo || t.id, cashier: t.createdBy, createdAt: t.createdAt?.toMillis?.() ?? Date.now() })}><Printer size={14} /> 80 มม.</PillButton>
                <PillButton variant="ghost" className="h-9 px-3 text-xs" onClick={() => onA4(t.transactionNo || t.id)}>A4</PillButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ReceiptModal({ receipt: r, company, onNext, reprint }: { receipt: any; company: any; onNext: () => void; reprint?: boolean }) {
  const seller = r.sellerSnapshot || company || {};
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); onNext(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onNext]);
  const methodLabel = METHODS.find((m) => m.id === r.paymentMethod)?.label || r.paymentMethod;
  return (
    <Modal title={reprint ? `พิมพ์ใบเสร็จซ้ำ ${r.transactionNo}` : "ชำระเงินสำเร็จ"} onClose={onNext}>
      <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } body * { visibility: hidden; } .pos-receipt, .pos-receipt * { visibility: visible; } .pos-receipt { position: absolute; left: 0; top: 0; width: 74mm; } }`}</style>
      {!reprint && r.paymentMethod === "CASH" && r.change > 0 && (
        <div className="rounded-2xl border border-nexus-teal/40 bg-nexus-teal/10 px-4 py-3 flex items-end justify-between">
          <span className="text-[15px] text-white">เงินทอน</span><span className="text-[34px] font-bold font-mono text-nexus-teal leading-none">฿{baht(r.change)}</span>
        </div>
      )}
      <div className="flex justify-center">
        <div className="pos-receipt bg-white text-black w-[300px] px-4 py-4 font-mono text-[12px] leading-snug rounded-lg">
          <p className="text-center font-bold text-[14px]">{seller.name || "ร้านค้า"}</p>
          {seller.address && <p className="text-center text-[11px]">{seller.address}</p>}
          {seller.taxId && <p className="text-center text-[11px]">เลขประจำตัวผู้เสียภาษี {formatTaxId(seller.taxId)} {branchLabel(seller.branchCode, seller.branchName)}</p>}
          {reprint && <p className="text-center font-bold mt-1">*** สำเนา (พิมพ์ซ้ำ) ***</p>}
          <p className="text-center font-bold mt-2">{r.customer ? "ใบกำกับภาษี/ใบเสร็จรับเงิน" : "ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ"}</p>
          <p className="text-center">เลขที่ {r.transactionNo}</p>
          <p className="text-center">{new Date(r.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</p>
          {r.customer && <div className="mt-1 border-t border-dashed border-black/40 pt-1"><p>ลูกค้า: {r.customer.name}</p>{r.customer.taxId && <p>เลขผู้เสียภาษี {r.customer.taxId} {r.customer.branch}</p>}{r.customer.address && <p>{r.customer.address}</p>}</div>}
          <div className="border-t border-dashed border-black/40 my-2" />
          {r.items.map((l: any) => (
            <div key={l.productId}><p>{l.name}</p><p className="flex justify-between"><span>{l.qty} × {baht(l.price)}</span><span>{baht(l.amount)}</span></p></div>
          ))}
          <div className="border-t border-dashed border-black/40 my-2" />
          <p className="flex justify-between"><span>รวม</span><span>{baht(r.subTotal)}</span></p>
          {r.discount > 0 && <p className="flex justify-between"><span>ส่วนลด</span><span>-{baht(r.discount)}</span></p>}
          <p className="flex justify-between"><span>มูลค่าก่อนภาษี</span><span>{baht(r.netBeforeVat)}</span></p>
          <p className="flex justify-between"><span>VAT 7%</span><span>{baht(r.vatAmount)}</span></p>
          <p className="flex justify-between font-bold text-[14px]"><span>ยอดสุทธิ</span><span>{baht(r.grandTotal)}</span></p>
          <p className="flex justify-between"><span>ชำระโดย {methodLabel}</span><span>{baht(r.paymentMethod === "CASH" ? r.cashReceived : r.grandTotal)}</span></p>
          {r.paymentMethod === "CASH" && <p className="flex justify-between"><span>เงินทอน</span><span>{baht(r.change)}</span></p>}
          {r.paymentRef && <p>อ้างอิง {r.paymentRef}</p>}
          <p className="text-center mt-2">พนักงาน {String(r.cashier || "").split("@")[0]} · ขอบคุณที่ใช้บริการ</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PillButton variant="glass" className="h-12 text-[15px]" onClick={() => window.print()}><Printer size={18} className="mr-1.5" /> พิมพ์ใบเสร็จ</PillButton>
        <PillButton variant="confirm" className="h-12 text-[15px] font-bold" onClick={onNext}>{reprint ? "ปิด" : "ขายบิลถัดไป (Enter)"}</PillButton>
      </div>
    </Modal>
  );
}

function PosSettings({ company, companyId, onClose, onSaved }: { company: any; companyId: string; onClose: () => void; onSaved: () => void }) {
  const [pp, setPp] = useState(company?.promptPayId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = !pp || !!normalizePromptPayId(pp);
  const save = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/settings/company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, action: "promptPay", promptPayId: pp }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="ตั้งค่าหน้าร้าน" onClose={onClose}>
      <label className="block text-[13px] text-white/70">รหัสพร้อมเพย์ของร้าน (เบอร์มือถือ 10 หลัก หรือเลขประจำตัวผู้เสียภาษี 13 หลัก)</label>
      <PillInput value={pp} onChange={(e) => setPp(e.target.value)} placeholder={company?.taxId ? `เว้นว่าง = ใช้เลขผู้เสียภาษี ${company.taxId}` : "0812345678"} className={cn("w-full h-11 text-sm font-mono", !valid && "border-danger")} />
      {!valid && <p className="text-[12px] text-danger">รูปแบบไม่ถูกต้อง</p>}
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2"><PillButton variant="ghost" className="h-10 px-5 text-xs" onClick={onClose}>ยกเลิก</PillButton><PillButton variant="confirm" className="h-10 px-5 text-xs font-bold" disabled={busy || !valid} onClick={save}>บันทึก</PillButton></div>
    </Modal>
  );
}
