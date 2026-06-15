"use client";

import React, { useRef } from "react";
import { Modal, PillButton, cn } from "@/components/ui/Base";
import { formatCurrency } from "@/lib/erp-logic";
import { Printer, Download, Share2, X } from "lucide-react";
import { useSystemDialog } from "@/context/DialogContext";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  type?: "quotation" | "invoice" | "po";
}

export function DocumentViewerModal({ isOpen, onClose, data, type = "quotation" }: DocumentViewerModalProps) {
  const { showAlert, showConfirm } = useSystemDialog();

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !data) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`ตัวอย่างเอกสาร - ${data.subject || "เอกสารใหม่"}`}
      maxWidth="max-w-[1200px]"
    >
      <div className="flex h-full flex-col bg-[#0D0D0D] overflow-hidden">
        
        {/* TOP TOOLBAR */}
        <div className="h-16 border-b border-white/10 bg-[#0F0F12] flex items-center justify-between px-8 flex-shrink-0 print:hidden">
          <div className="flex items-center gap-4">
             <div className="px-3 py-1 rounded bg-nexus-teal/10 text-nexus-teal border border-nexus-teal/20 text-[11px] font-black uppercase tracking-widest">
               PRINT PREVIEW
             </div>
             <p className="text-sm font-bold text-white/60">A4 Size (210 x 297 mm)</p>
          </div>
          <div className="flex items-center gap-4">
            <PillButton variant="glass" className="h-9 px-6" onClick={() => showAlert("ระบบส่งออก PDF กำลังพัฒนา")}>
              <Download size={14} className="mr-2" /> โหลด PDF
            </PillButton>
            <PillButton className="h-9 px-6 shadow-neon-teal" onClick={handlePrint}>
              <Printer size={16} className="mr-2" /> พิมพ์เอกสาร (Print)
            </PillButton>
          </div>
        </div>

        {/* PRINT CANVAS AREA */}
        <div className="flex-1 overflow-y-auto bg-black/50 p-8 custom-scrollbar print:p-0 print:bg-white print:overflow-visible">
          <div className="flex justify-center w-full min-h-full">
            
            {/* THE A4 DOCUMENT */}
            <div 
              ref={printRef}
              className="bg-white text-black shadow-2xl relative flex-shrink-0 print:shadow-none overflow-hidden print-document"
              style={{
                width: "794px",
                minHeight: "1123px",
                padding: "40px",
                fontFamily: "'Sarabun', 'Inter', sans-serif"
              }}
            >
              {/* Document Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-2xl font-black text-[#0d9488] leading-tight">บริษัท เน็กซัส อีอาร์พี โซลูชันส์ จำกัด</h1>
                  <h2 className="text-sm font-bold text-gray-700">NEXUS ERP SOLUTIONS CO., LTD.</h2>
                  <p className="text-xs text-gray-500 mt-2">เลขผู้เสียภาษี: 0105564000000 (สำนักงานใหญ่)<br/>1/1 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-gray-900 mb-2">ใบเสนอราคา<br/>QUOTATION</h2>
                  <div className="inline-block text-left bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs font-bold text-gray-600 mb-1">เลขที่เอกสาร: <span className="text-gray-900">QT-Auto</span></p>
                    <p className="text-xs font-bold text-gray-600 mb-1">วันที่ออก: <span className="text-gray-900">{data.date}</span></p>
                    <p className="text-xs font-bold text-gray-600">ยืนราคาถึง: <span className="text-gray-900">{data.validUntil}</span></p>
                  </div>
                </div>
              </div>

              <div className="w-full h-[2px] bg-[#0d9488] mb-6"></div>

              {/* Customer Info */}
              <div className="flex justify-between mb-8">
                <div className="w-1/2">
                  <h3 className="text-sm font-bold text-[#0d9488] mb-2 uppercase tracking-widest">ลูกค้า / Customer</h3>
                  <p className="text-sm font-bold text-gray-900">{data.customer || "ยังไม่ได้ระบุลูกค้า"}</p>
                  <p className="text-sm text-gray-700 mt-1">โครงการ: {data.subject || "-"}</p>
                  <p className="text-sm text-gray-700">เงื่อนไขการชำระเงิน: {data.paymentTerms}</p>
                </div>
                <div className="w-1/2 text-right">
                  <h3 className="text-sm font-bold text-[#0d9488] mb-2 uppercase tracking-widest">ผู้เสนอราคา / Sales</h3>
                  <p className="text-sm font-bold text-gray-900">{data.salesPerson}</p>
                  <p className="text-sm text-gray-700 mt-1">โทร: 080-123-4567</p>
                  <p className="text-sm text-gray-700">อีเมล: sales@nexus-erp.com</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full mb-8 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-y-2 border-gray-400">
                    <th className="py-2 px-3 text-left text-xs font-bold text-gray-700 uppercase">ลำดับ</th>
                    <th className="py-2 px-3 text-left text-xs font-bold text-gray-700 uppercase">รายการสินค้า / บริการ</th>
                    <th className="py-2 px-3 text-center text-xs font-bold text-gray-700 uppercase">จำนวน</th>
                    <th className="py-2 px-3 text-right text-xs font-bold text-gray-700 uppercase">ราคาหน่วยละ</th>
                    <th className="py-2 px-3 text-right text-xs font-bold text-gray-700 uppercase">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.items && data.items.map((item: any, idx: number) => (
                    <tr key={item.id || idx}>
                      <td className="py-3 px-3 text-sm text-gray-700">{idx + 1}</td>
                      <td className="py-3 px-3 text-sm font-bold text-gray-900">{item.name}</td>
                      <td className="py-3 px-3 text-sm text-gray-700 text-center">{item.qty} {item.unit || "ชิ้น"}</td>
                      <td className="py-3 px-3 text-sm text-gray-700 text-right">{formatCurrency(item.price)}</td>
                      <td className="py-3 px-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(item.qty * item.price)}</td>
                    </tr>
                  ))}
                  {(!data.items || data.items.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">ไม่มีรายการสินค้า</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Summary & Terms Layout */}
              <div className="flex justify-between items-start mt-8">
                {/* Terms and Notes */}
                <div className="w-[60%] pr-8">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">เงื่อนไขและหมายเหตุ (Terms & Conditions)</h3>
                  <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed border border-gray-200 rounded p-3 bg-gray-50 min-h-[120px]">
                    {data.terms || "-"}
                  </div>
                  
                  {data.financials?.netThaiText && (
                    <div className="mt-4 p-2 bg-gray-100 rounded text-center">
                      <p className="text-sm font-bold text-[#0d9488]">({data.financials.netThaiText})</p>
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="w-[40%]">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="py-2 px-3 text-right text-gray-600 font-bold">รวมเป็นเงิน (Subtotal)</td>
                        <td className="py-2 px-3 text-right font-bold text-gray-900">{formatCurrency(data.financials?.subtotal || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-right text-gray-600">
                          ภาษีมูลค่าเพิ่ม (VAT 7%)<br/>
                          <span className="text-[10px] text-gray-400 font-normal">ระบบภาษี: {data.taxMode}</span>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(data.financials?.vat || 0)}</td>
                      </tr>
                      <tr className="border-t-2 border-gray-900">
                        <td className="py-3 px-3 text-right text-base font-black text-gray-900">ยอดเงินสุทธิ (Net Total)</td>
                        <td className="py-3 px-3 text-right text-lg font-black text-[#0d9488]">{formatCurrency(data.financials?.total || data.financials?.net || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="absolute bottom-10 left-10 right-10 flex justify-between mt-16 pt-8">
                <div className="w-1/3 text-center">
                  <div className="w-[200px] border-b border-gray-400 mx-auto mb-2 h-16"></div>
                  <p className="text-sm text-gray-700">ผู้เสนอราคา / Authorized Signature</p>
                  <p className="text-xs text-gray-500 mt-1">วันที่: ..... / ..... / .....</p>
                </div>
                <div className="w-1/3 text-center">
                  <div className="w-[200px] border-b border-gray-400 mx-auto mb-2 h-16"></div>
                  <p className="text-sm text-gray-700">ผู้อนุมัติสั่งซื้อ / Accepted By</p>
                  <p className="text-xs text-gray-500 mt-1">วันที่: ..... / ..... / .....</p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}
