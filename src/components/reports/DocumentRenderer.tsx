import React from "react";
import { 
  DocumentTemplateV3, 
  DocumentBlockV3,
  parseTextToSegments,
  compileSegmentsToText,
  PAPER_DIMENSIONS
} from "./UltimateDocumentBuilder";

// Helper to render QR Code inline
const renderQRCodeSVG = (value: string, size = 100) => {
  return (
    <div className="w-full h-full bg-white flex items-center justify-center p-1 border border-black/10 relative">
      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(value)}`} alt="QR Code" className="w-full h-full object-contain" />
    </div>
  );
};

// Helper to render Barcode inline
const renderBarcodeSVG = (value: string, type = "CODE128") => {
  return (
    <div className="w-full h-full bg-white flex flex-col items-center justify-center px-4 py-2 border border-black/10">
      <div className="flex-1 w-full bg-[repeating-linear-gradient(90deg,#000,#000_2px,transparent_2px,transparent_4px,#000_4px,#000_5px,transparent_5px,transparent_8px)]" />
      <span className="text-[10px] mt-1 font-mono tracking-[0.2em]">{value}</span>
    </div>
  );
};

// Helper to resolve Icons 
import { Phone, Mail, Globe, MapPin, Shield, Calendar, Info, Heart, Award, FileSpreadsheet, Check } from "lucide-react";
const resolveIcon = (name: string, size = 18, className = "") => {
  switch (name) {
    case "Phone": return <Phone size={size} className={className} />;
    case "Mail": return <Mail size={size} className={className} />;
    case "Globe": return <Globe size={size} className={className} />;
    case "MapPin": return <MapPin size={size} className={className} />;
    case "Shield": return <Shield size={size} className={className} />;
    case "Calendar": return <Calendar size={size} className={className} />;
    case "Info": return <Info size={size} className={className} />;
    case "Heart": return <Heart size={size} className={className} />;
    case "Award": return <Award size={size} className={className} />;
    case "FileSpreadsheet": return <FileSpreadsheet size={size} className={className} />;
    default: return <Info size={size} className={className} />;
  }
};


interface DocumentRendererProps {
  template: DocumentTemplateV3;
  data: any;
  mode?: "print" | "preview";
}

import { calculateFinancials } from "@/lib/erp-logic";

export function DocumentRenderer({ template, data, mode = "print" }: DocumentRendererProps) {
  // Extract flat data mapping for variables replacement
  // Fallback calculations for older documents without 'financials' saved
  const normalizedItems = (data?.items || []).map((item: any) => ({
    ...item,
    qty: item.qty ?? item.quantity ?? 1,
    price: item.price ?? 0,
    cost: item.cost ?? 0
  }));
  const financials = data?.financials || calculateFinancials(normalizedItems, data?.taxMode || "Inclusive");

  const dataOverrides: Record<string, string> = {
    // Standard mapping based on common data structures in NEXUS-ERP
    "doc.number": data?.id || data?.docNumber || "-",
    "doc.date": data?.showDate === false ? "" : (data?.date || data?.issueDate || new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })),
    "customer.name": data?.customer || data?.customerNameRaw || data?.name || "-",
    "customer.address": data?.address || data?.customerAddress || "-",
    "customer.taxId": data?.taxId || data?.customerTaxId || "-",
    "amount.subtotal": financials?.net?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00",
    "amount.vat": financials?.vat?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00",
    "amount.net": financials?.total?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00",
    "amount.netThaiText": financials?.netThaiText || "-",
    "delivery.date": data?.deliveryDate || data?.validUntil || "-",
    "company.name": "บริษัท เน็กซัส อีอาร์พี โซลูชันส์ จำกัด",
    "company.taxId": "0105564000000",
    "supplier.name": data?.supplier || data?.supplierName || "-",
    "supplier.address": data?.supplierAddress || "-",
    "project.name": data?.subject || data?.projectName || "-",
    "lead.id": data?.id || "-",
    "lead.name": data?.name || data?.contactName || "-",
    "lead.phone": data?.phone || "-",
    "lead.email": data?.email || "-",
    "lead.company": data?.company || data?.customer || "-",
    "doc.validUntil": data?.validUntil || data?.expiryDate || "-",
    "doc.terms": data?.terms || data?.remarks || data?.notes || "-",
    "payment.terms": data?.paymentTerms || data?.credit_term || "ชำระเงินสด / โอนผ่านธนาคาร",
    "sales.name": data?.salesPerson || data?.createdBy || "พนักงานขาย",
    "cashier.name": data?.cashier || data?.createdBy || "พนักงานการเงิน"
  };

  const currentGlobalStyles = template.globalStyles || { pageSize: "A4", primaryColor: "#0d9488", secondaryColor: "#0f766e", fontFamily: "Sarabun", margin: "normal", watermark: "NONE" };
  const paper = PAPER_DIMENSIONS[currentGlobalStyles.pageSize as keyof typeof PAPER_DIMENSIONS] || PAPER_DIMENSIONS["A4"];

  const renderBlockContent = (block: DocumentBlockV3) => {
    const properties = block.properties || {};
    
    switch (block.type) {
      case "TEXT": {
        const segments = parseTextToSegments(block.content || "");
        const compiledText = compileSegmentsToText(segments, template.targetModule, false, dataOverrides);
        return <p className="whitespace-pre-line leading-relaxed m-0 text-inherit">{compiledText}</p>;
      }
      
      case "IMAGE":
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={block.src} 
            alt="Image" 
            className="w-full h-full object-contain pointer-events-none"
          />
        );
        
      case "SHAPE": {
        const shapeType = properties.shapeType || "rect";
        if (shapeType === "line") {
          return <div className="w-full h-full" style={{ backgroundColor: properties.backgroundColor || "#0d9488" }} />;
        }
        return null;
      }
      
      case "DYNAMIC_TABLE": {
        // Render actual items from data with fallback for old 'quantity' key
        const items = normalizedItems;
        
        return (
          <table className="w-full border-collapse text-[10px] sm:text-xs">
            <thead className="bg-black/5 border-b border-black/25">
              <tr>
                <th className="p-2 text-left uppercase text-black/60 font-semibold w-12">ลำดับ</th>
                <th className="p-2 text-left uppercase text-black/60 font-semibold">รายการสินค้า / บริการ</th>
                <th className="p-2 text-center uppercase text-black/60 font-semibold w-24">จำนวน</th>
                <th className="p-2 text-right uppercase text-black/60 font-semibold w-32">ราคา/หน่วย</th>
                <th className="p-2 text-right uppercase text-black/60 font-semibold w-36">ยอดเงินรวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => (
                <tr key={idx} className={`${idx === items.length - 1 ? 'border-b-[3px] border-double border-black/60' : 'border-b border-black/10'} ${properties.stripedRows && idx % 2 === 1 ? 'bg-black/[0.01]' : ''}`}>
                  <td className="p-2 text-black/80 text-center">{idx + 1}</td>
                  <td className="p-2 text-black/80">{item.name || item.description || item.title || "ไม่ระบุ"}</td>
                  <td className="p-2 text-center text-black/80 font-mono">{item.qty} {item.unit || ""}</td>
                  <td className="p-2 text-right text-black/80 font-mono">{Number(item.price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td className="p-2 text-right text-black/80 font-mono">{(Number(item.qty) * Number(item.price)).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-black/40">ไม่มีรายการสินค้า</td>
                </tr>
              )}
            </tbody>
          </table>
        );
      }
      
      case "QR_CODE": {
        const qrContent = compileSegmentsToText(parseTextToSegments(properties.qrValue || ""), template.targetModule, false, dataOverrides);
        return renderQRCodeSVG(qrContent);
      }
      
      case "BARCODE": {
        const barcodeContent = compileSegmentsToText(parseTextToSegments(block.content || ""), template.targetModule, false, dataOverrides);
        return renderBarcodeSVG(barcodeContent, properties.barcodeType);
      }
      
      case "ICON":
        return resolveIcon(properties.iconName || "Info", properties.fontSize || 24, "w-full h-full text-inherit");
        
      case "FORM_FIELD": {
        if (properties.formFieldType === "checkbox") {
          return (
            <div className="flex items-center gap-2 w-full h-full text-inherit">
              <div className={`w-3 h-3 flex-shrink-0 border ${properties.isChecked ? "bg-nexus-teal border-nexus-teal text-white" : "bg-white border-black/30"} flex items-center justify-center rounded-sm`}>
                {properties.isChecked && <Check size={10} strokeWidth={4} />}
              </div>
              <span className="truncate">{block.content}</span>
            </div>
          );
        } else if (properties.formFieldType === "radio") {
          return (
            <div className="flex items-center gap-2 w-full h-full text-inherit">
              <div className={`w-3 h-3 flex-shrink-0 rounded-full border ${properties.isChecked ? "border-nexus-teal" : "border-black/30"} bg-white flex items-center justify-center`}>
                {properties.isChecked && <div className="w-1.5 h-1.5 bg-nexus-teal rounded-full" />}
              </div>
              <span className="truncate">{block.content}</span>
            </div>
          );
        } else {
          return (
            <div className="w-full text-xs text-black/80 font-mono py-1 select-none whitespace-nowrap overflow-hidden text-inherit">
              {block.content}
            </div>
          );
        }
      }
      
      case "SIGNATURE":
        return (
          <div className="w-full h-full flex flex-col items-center justify-end border-b border-black/20 pb-1 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-[MySignatureFont,cursive] text-nexus-blue text-4xl opacity-50 rotate-[-10deg]">
              {/* Actual signature image or text could go here based on data */}
            </div>
            <div className="text-[10px] text-black/40 uppercase tracking-widest font-medium">
              {block.content || "Sign Here"}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div 
      className={`bg-white relative flex-shrink-0 print-document print:shadow-none print:border-none ${mode === "preview" ? "shadow-2xl border border-black/10 overflow-hidden" : ""}`}
      style={{ 
        width: paper.width, 
        height: paper.height,
        fontFamily: currentGlobalStyles.fontFamily,
      }}
    >
      {/* Watermark */}
      {currentGlobalStyles.watermark && currentGlobalStyles.watermark !== "NONE" && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
          <div className="text-[100px] font-semibold text-black/[0.03] uppercase tracking-widest rotate-[-45deg] select-none">
            {currentGlobalStyles.watermark}
          </div>
        </div>
      )}

      {/* Blocks */}
      {(() => {
        let tableY = 0;
        let tableOriginalH = 0;
        let tableActualH = 0;
        let tableOffset = 0;
        
        let renderedBlocks = template.blocks || [];

        // Legacy patch: If doc.terms is missing, inject it automatically!
        const hasDocTerms = renderedBlocks.some(b => b.content?.includes("{{doc.terms}}"));
        if (!hasDocTerms && template.targetModule === "QUOTATION") {
           const termOpt1 = renderedBlocks.find(b => b.id === "block-term-opt1");
           if (termOpt1) {
             renderedBlocks = [...renderedBlocks, {
                id: "block-terms-dynamic",
                type: "TEXT",
                position: { x: 40, y: termOpt1.position.y + 35, w: 714, h: 80 },
                properties: { fontSize: 10, textColor: "#4b5563", zIndex: 10, lineHeight: 1.5 },
                content: "{{doc.terms}}"
             } as any];
             
             // Shift signatures down to make room for the new terms block
             renderedBlocks = renderedBlocks.map(b => {
               if (b.id === "block-signature-lines" || b.id === "block-signature-date") {
                 return { ...b, position: { ...b.position, y: b.position.y + 40 } };
               }
               return b;
             });
           }
        }

        const tableBlock = renderedBlocks.find(b => b.type === "DYNAMIC_TABLE");
        if (tableBlock) {
          tableY = tableBlock.position.y;
          tableOriginalH = tableBlock.position.h || 40;
          const rowCount = Math.max(1, normalizedItems.length);
          
          const rowHeight = (template.globalStyles as any)?.tableRowHeight || 34;
          const gapBelow = (template.globalStyles as any)?.tableGapBelow ?? 5;
          
          // Header (36px) + Rows 
          tableActualH = 36 + (rowCount * rowHeight); 
          // The template originally has a 20px gap below the table.
          // By subtracting (20 - gapBelow) from the offset, the gap becomes exactly `gapBelow`.
          tableOffset = tableActualH - tableOriginalH - (20 - gapBelow);
        }

        return renderedBlocks.map(block => {
          let currentBlock = { ...block };

          const properties = currentBlock.properties || {};
          const finalH = currentBlock.position.h || 40;
          
          let adjustedY = currentBlock.position.y;
          // Shift elements below the table UP or DOWN based on actual table height
          if (currentBlock.id !== tableBlock?.id && currentBlock.position.y > tableY + (tableOriginalH / 2)) {
            adjustedY += tableOffset;
          }
          
          // Shape type specific styles
          const shapeType = properties.shapeType || "rect";
          let shapeStyles: React.CSSProperties = {};
          if (block.type === "SHAPE") {
            if (shapeType === "circle") {
              shapeStyles.borderRadius = "50%";
            } else if (shapeType === "rect") {
              shapeStyles.borderRadius = `${properties.borderRadius || 0}px`;
            }
          }

          return (
            <div
            key={currentBlock.id}
            className="absolute flex flex-col justify-start"
            style={{
              left: currentBlock.position.x,
              top: adjustedY,
              width: currentBlock.position.w,
              height: currentBlock.type === "DYNAMIC_TABLE" ? "auto" : finalH,
              transform: `rotate(${properties.rotation || 0}deg) scale(${properties.scaleX || 1}, ${properties.scaleY || 1})`,
              opacity: (properties.opacity ?? 100) / 100,
              zIndex: properties.zIndex || 1,
              backgroundColor: currentBlock.type === "SHAPE" ? (shapeType === "line" ? "transparent" : properties.backgroundColor) : (properties.backgroundColor || "transparent"),
              color: properties.textColor || "#1f2937",
              padding: `${properties.padding || 0}px`,
              border: currentBlock.type === "SHAPE" && shapeType === "line" ? "none" : `${properties.borderWidth || 0}px ${properties.borderStyle || "solid"} ${properties.borderColor || "transparent"}`,
              borderRadius: `${properties.borderRadius || 0}px`,
              textAlign: properties.textAlign || "left",
              fontFamily: properties.fontFamily || (currentGlobalStyles.fontFamily === "mono" ? "monospace" : "inherit"),
              fontSize: `${properties.fontSize || 12}px`,
              fontWeight: properties.fontWeight || "normal",
              fontStyle: properties.fontStyle || "normal",
              textDecoration: properties.textDecoration || "none",
              lineHeight: properties.lineHeight ? `${properties.lineHeight}em` : "normal",
              letterSpacing: properties.letterSpacing ? `${properties.letterSpacing}px` : "normal",
              ...shapeStyles
            }}
          >
            <div className={`w-full h-full relative ${currentBlock.type === "DYNAMIC_TABLE" ? "overflow-visible" : "overflow-hidden"}`}>
              {renderBlockContent(currentBlock)}
            </div>
          </div>
        );
        });
      })()}
    </div>
  );
}
