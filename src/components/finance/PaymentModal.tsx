"use client";

import React, { useState, useEffect } from "react";
import { useSystemDialog } from "@/context/DialogContext";
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Wallet,
  Building,
  FileText,
  Search,
  CheckCircle2,
  X
} from "lucide-react";
import { PillButton, PillInput, PillSelect, Modal, PillTabs, NexusDataField, cn, NexusDatePicker } from "@/components/ui/Base";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
}

export function PaymentModal({ isOpen, onClose, onSave }: PaymentModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState("header");
  const [orders, setOrders] = useState<any[]>([]);
  const [header, setHeader] = useState({
    supplier: "",
    date: new Date().toISOString().split('T')[0],
    bankAccount: "KBank - XXX-XXXX-XXX",
    paymentMethod: "transfer",
    reference: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  const [summary, setSummary] = useState({
    subtotal: 0,
    wht: 0,
    total: 0
  });

  useEffect(() => {
    const sub = orders.reduce((acc, order) => acc + (order.amountToPay || 0), 0);
    const wht = orders.reduce((acc, order) => acc + (order.whtAmount || 0), 0);
    setSummary({ subtotal: sub, wht, total: sub - wht });
  }, [orders]);

  const loadSupplierOrders = () => {
    if (!header.supplier) return void showAlert("กรุณาเลือกชื่อเจ้าหนี้");
    setOrders([
      { id: 1, orderNo: "PO-2604-012", total: 125000, balance: 125000, amountToPay: 125000, whtRate: 0, whtAmount: 0 },
      { id: 2, orderNo: "PO-2604-088", total: 42000, balance: 42000, amountToPay: 42000, whtRate: 3, whtAmount: 1177 }
    ]);
  };

  const updateOrder = (id: number, field: string, value: any) => {
    setOrders(orders.map(order => {
      if (order.id === id) {
        const newOrder = { ...order, [field]: value };
        if (field === "whtRate") {
          newOrder.whtAmount = (newOrder.amountToPay / 1.07) * (parseFloat(value) / 100);
        }
        return newOrder;
      }
      return order;
    }));
  };

  const isDirty = orders.length > 0 || header.supplier !== "";

  const handleClose = async () => {
    if (isDirty) {
      if (await showConfirm("คุณมีการกรอกข้อมูลค้างไว้ ต้องการปิดโดยไม่บันทึกใช่หรือไม่?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (orders.length === 0) return void showAlert("กรุณาเลือกรายการที่ต้องการชำระเงิน", "System Notification", "warning");
    setIsSaving(true);
    try {
      await onSave({ header, orders, summary });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="บันทึกการจ่ายชำระเงิน"
      maxWidth="max-w-[1600px]"
    >
      <div className="flex h-full divide-x divide-white/5 bg-surface-0">
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div className="space-y-1">
                <p className="text-[12px] font-semibold text-nexus-blue uppercase tracking-[0.2em]">โหมดเจ้าหนี้ (AP_PAYMENT_V3.0)</p>
                <h4 className="text-xl font-semibold text-white uppercase tracking-tight">บันทึกจ่ายเงิน</h4>
              </div>
              <PillTabs 
                 tabs={[
                   { id: "header", label: "Header Data" },
                   { id: "orders", label: "Order Allocation" }
                 ]}
                 activeTab={activeTab}
                 onTabChange={setActiveTab}
              />
            </div>

            <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
              {activeTab === "header" && (
                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-8">
                    <Field label="เจ้าหนี้ / ผู้จำหน่าย *">
                       <div className="flex gap-2">
                          <PillSelect 
                            value={header.supplier}
                            onChange={(e) => setHeader({...header, supplier: e.target.value})}
                            className="flex-1 px-6"
                          >
                             <option value="">ค้นหาเจ้าหนี้...</option>
                             <option>CommScope Thailand</option>
                             <option>Aruba Networks</option>
                             <option>Cisco Systems</option>
                          </PillSelect>
                          <PillButton onClick={loadSupplierOrders} className="px-6 shadow-neon-blue">ดึงยอดค้าง</PillButton>
                       </div>
                    </Field>
                    <Field label="วันที่จ่ายชำระ">
                      <NexusDatePicker value={header.date}
                        onChange={(e) => setHeader({...header, date: e.target.value})}
                        className="w-full" 
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <Field label="จ่ายจากบัญชี">
                      <PillSelect 
                        value={header.bankAccount}
                        onChange={(e) => setHeader({...header, bankAccount: e.target.value})}
                        className="w-full px-6"
                      >
                         <option>KBank - 789-0-XXXXX-X (Main)</option>
                         <option>SCB - 123-4-XXXXX-X (Payroll)</option>
                         <option>เงินสด</option>
                      </PillSelect>
                    </Field>
                    <Field label="ช่องทางชำระเงิน">
                      <PillSelect 
                        value={header.paymentMethod}
                        onChange={(e) => setHeader({...header, paymentMethod: e.target.value})}
                        className="w-full px-6"
                      >
                         <option value="transfer">โอนเงิน</option>
                         <option value="cash">เงินสด</option>
                         <option value="cheque">เช็ค</option>
                      </PillSelect>
                    </Field>
                  </div>

                  <Field label="เลขที่อ้างอิง (เช่น เลขเช็ค / เลขสลิป)">
                    <PillInput 
                      value={header.reference}
                      onChange={(e) => setHeader({...header, reference: e.target.value})}
                      placeholder="ระบุเลขที่เอกสารการจ่าย..." 
                      className="w-full" 
                    />
                  </Field>
                </div>
              )}

              {activeTab === "orders" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[12px] font-semibold text-white/30 uppercase tracking-[0.2em]">รายการสั่งซื้อที่จ่ายชำระ</h4>
                    <span className="text-[11px] font-semibold text-nexus-blue uppercase tracking-widest">ตรวจสอบยอดค้างจ่ายและหัก ณ ที่จ่าย</span>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-4 px-6 text-[10px] font-semibold text-white/20 uppercase tracking-widest">
                       <div className="col-span-3">เลขที่ PO</div>
                       <div className="col-span-3 text-right">ยอดค้างจ่าย</div>
                       <div className="col-span-3 text-right">จ่ายชำระครั้งนี้</div>
                       <div className="col-span-2 text-right">WHT (%)</div>
                       <div className="col-span-1"></div>
                    </div>
                    {orders.length === 0 ? (
                       <div className="p-20 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                          <Building size={48} className="text-white/5" />
                          <p className="text-sm text-white/20 font-semibold uppercase tracking-widest">ยังไม่มีรายการค้างจ่าย (กรุณาดึงยอดค้าง)</p>
                       </div>
                    ) : (
                      orders.map((order) => (
                        <div key={order.id} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl group hover:border-white/10 transition-all">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-3 font-mono text-[11px] text-white/80">{order.orderNo}</div>
                            <div className="col-span-3 text-right font-mono text-[12px] text-white/40">฿{order.balance.toLocaleString()}</div>
                            <div className="col-span-3">
                               <PillInput 
                                 type="number"
                                 value={order.amountToPay}
                                 onChange={(e) => updateOrder(order.id, "amountToPay", parseFloat(e.target.value) || 0)}
                                 className="w-full text-right font-mono text-nexus-blue" 
                               />
                            </div>
                            <div className="col-span-2">
                               <PillSelect 
                                 value={order.whtRate}
                                 onChange={(e) => updateOrder(order.id, "whtRate", e.target.value)}
                                 className="w-full text-right px-4 h-10" 
                               >
                                  <option value="0">0%</option>
                                  <option value="1">1%</option>
                                  <option value="3">3%</option>
                                  <option value="5">5%</option>
                               </PillSelect>
                            </div>
                            <div className="col-span-1 flex justify-center">
                               <button onClick={() => setOrders(orders.filter(i => i.id !== order.id))} className="text-white/10 hover:text-danger transition-colors">
                                  <Trash2 size={16} />
                               </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[420px] flex flex-col bg-surface-1 p-12 flex-shrink-0">
          <div className="flex-1 space-y-10">
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-white/20 uppercase tracking-[0.2em]">สรุปยอดจ่ายชำระ</p>
              <h5 className="text-sm font-semibold text-white uppercase tracking-tight">Payment Allocation</h5>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
              <NexusDataField label="ยอดจ่ายรวม" value={`฿${summary.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`} />
              <NexusDataField label="หัก ณ ที่จ่าย" value={`฿${summary.wht.toLocaleString(undefined, {minimumFractionDigits: 2})}`} color="text-warning" />
              <div className="pt-6 border-t border-white/5">
                 <NexusDataField label="ยอดจ่ายจริง" value={`฿${summary.total.toLocaleString(undefined, {minimumFractionDigits: 2})}`} highlight color="text-nexus-blue" />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-nexus-blue/5 border border-nexus-blue/10 flex items-start gap-4">
               <CheckCircle2 className="text-nexus-blue flex-shrink-0" size={18} />
               <p className="text-[11px] text-nexus-blue/60 font-bold uppercase leading-relaxed tracking-widest">
                  การยืนยันจะตัดยอดเจ้าหนี้และบันทึกสมุดรายวันจ่าย อัตโนมัติ
               </p>
            </div>
          </div>

          <div className="space-y-4 pt-12 border-t border-white/5">
            <PillButton 
              className={cn("w-full shadow-neon-blue uppercase tracking-[0.2em]", isSaving && "opacity-50 pointer-events-none")} 
              onClick={handleSave}
              disabled={isSaving}
            >
              <ShieldCheck size={22} className={isSaving ? "animate-pulse" : ""} />
              {isSaving ? "กำลังบันทึก..." : "ยืนยันจ่ายชำระ"}
            </PillButton>
            <PillButton 
              variant="ghost" 
              className={cn("w-full text-white/20 hover:text-white uppercase tracking-widest", isSaving && "opacity-50 pointer-events-none")} 
              onClick={handleClose}
              disabled={isSaving}
            >
              ยกเลิก
            </PillButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <label className="text-[12px] font-semibold text-white/30 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
