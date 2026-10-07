'use client';
import React, { useState, useEffect } from 'react';
import { Banknote, Landmark, CreditCard } from 'lucide-react';
import { PillButton, cn } from '@/components/ui/Base';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD';

interface CheckoutModalProps {
  isOpen: boolean;
  grandTotal: number;
  onConfirmPayment: (method: PaymentMethod, cashReceived: number) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: 'CASH', label: 'เงินสด', icon: <Banknote size={16} /> },
  { id: 'TRANSFER', label: 'โอน / QR', icon: <Landmark size={16} /> },
  { id: 'CARD', label: 'บัตรเครดิต', icon: <CreditCard size={16} /> },
];

export function CheckoutModal({ isOpen, grandTotal, onConfirmPayment, onClose, isProcessing }: CheckoutModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const quickCashOptions = [100, 500, 1000];
  const isCash = method === 'CASH';
  const changeAmount = isCash ? cashReceived - grandTotal : 0;
  const canConfirm = !isProcessing && (!isCash || changeAmount >= 0);

  useEffect(() => {
    if (isOpen) {
      setCashReceived(0);
      setMethod('CASH');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-lg border border-nexus-teal/30 bg-surface-0 p-6 rounded-2xl shadow-[0_0_50px_rgba(16,187,168,0.15)] text-white animate-in zoom-in-95 duration-200">

        <div className="flex justify-between items-center border-b border-nexus-teal/20 pb-4 mb-4">
          <h2 className="text-xl font-bold tracking-wider text-nexus-teal">ชำระเงิน</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">✕</button>
        </div>

        {/* ยอดสุทธิรวมภาษี */}
        <div className="mb-4 bg-nexus-teal/10 border border-nexus-teal/20 p-4 rounded-xl text-center">
          <p className="text-sm text-nexus-teal/70 mb-1 font-medium tracking-widest">ยอดสุทธิรวมภาษี</p>
          <p className="text-4xl font-mono font-black text-white tracking-tight drop-shadow-neon">
            ฿ {grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* ช่องทางชำระเงิน */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={cn(
                'h-9 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 border transition-all',
                method === m.id ? 'bg-nexus-teal/20 border-nexus-teal/50 text-nexus-teal' : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white'
              )}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {isCash ? (
          <>
            {/* ช่องกรอกรับเงินสด */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/40 mb-2 tracking-widest">ระบุยอดเงินที่รับมา</label>
              <input
                type="number"
                autoFocus
                value={cashReceived === 0 ? '' : cashReceived}
                onChange={(e) => setCashReceived(Number(e.target.value))}
                className="w-full h-14 px-4 bg-black border border-nexus-teal/40 rounded-xl font-mono text-2xl font-bold text-nexus-teal focus:outline-none focus:border-nexus-teal text-center shadow-[inset_0_0_10px_rgba(16,187,168,0.1)] transition-all"
                placeholder="0.00"
              />
            </div>

            {/* ปุ่มคีย์ลัดธนบัตรด่วน */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <button
                onClick={() => setCashReceived(grandTotal)}
                className="h-10 text-xs font-bold tracking-widest rounded-xl border border-nexus-teal/30 bg-nexus-teal/10 text-nexus-teal hover:bg-nexus-teal hover:text-black hover:shadow-neon-teal transition-all"
              >
                พอดี
              </button>
              {quickCashOptions.map((cash) => (
                <button
                  key={cash}
                  onClick={() => setCashReceived((prev) => prev + cash)}
                  className="h-10 text-xs font-bold tracking-widest rounded-xl bg-white/[0.03] border border-white/10 text-white/70 hover:border-nexus-blue/50 hover:text-nexus-blue hover:bg-nexus-blue/10 transition-all"
                >
                  +{cash} บ.
                </button>
              ))}
            </div>

            {/* เงินทอน */}
            <div className="mb-6 bg-surface-0 p-4 rounded-xl border border-white/5">
              <p className="text-[11px] font-medium tracking-widest text-white/40 mb-1">เงินทอนลูกค้า</p>
              <p className={`text-3xl font-mono font-black tracking-tight ${changeAmount >= 0 ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'text-danger drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'}`}>
                {changeAmount >= 0
                  ? `฿ ${changeAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'ยอดเงินไม่เพียงพอ'}
              </p>
            </div>
          </>
        ) : (
          <p className="mb-6 text-[12px] text-white/50 text-center">
            ตรวจสอบยอด{method === 'TRANSFER' ? 'โอน / QR' : 'รูดบัตร'}ให้ครบ ฿{grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ก่อนกดยืนยัน
          </p>
        )}

        <PillButton
          disabled={!canConfirm}
          onClick={() => onConfirmPayment(method, isCash ? cashReceived : grandTotal)}
          className="w-full h-12 text-base mt-2"
          variant="confirm"
        >{isProcessing ? 'กำลังบันทึก...' : 'ยืนยันชำระเงิน'}</PillButton>
      </div>
    </div>
  );
}
