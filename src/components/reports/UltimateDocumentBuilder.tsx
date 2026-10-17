"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, Save, Eye, Send, Type, Image as ImageIcon, CheckCircle2,
  Table as TableIcon, Layout, Database, Sliders, Trash2, Plus, Move,
  Square, Circle, Minus, Copy, FileText, MousePointer2, Phone, Mail, 
  Globe, MapPin, Shield, Calendar, Info, Heart, Award, FileSpreadsheet,
  QrCode, Barcode, HelpCircle, Layers, Check, AlignLeft, AlignCenter, AlignRight, Play, EyeOff, Sparkles,
  Bold, Italic, Underline, Strikethrough, AlignJustify, FlipHorizontal, FlipVertical, RotateCw, RotateCcw,
  ArrowUp, ArrowDown, Maximize2
} from "lucide-react";
import { PillButton, GlassCard, PillInput, PillSelect, PillCheckbox } from "@/components/ui/Base";
import { db } from "@/lib/firebase-client";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";

// -------------------------------------------------------------
// SCHEMA V3.0 TYPES
// -------------------------------------------------------------
export interface DocumentBlockV3 {
  id: string;
  type: "TEXT" | "IMAGE" | "DYNAMIC_TABLE" | "SIGNATURE" | "SHAPE" | "QR_CODE" | "BARCODE" | "ICON" | "FORM_FIELD";
  position: { x: number; y: number; w: number; h?: number };
  content?: string;
  src?: string;
  userId?: string;
  properties?: {
    showBorders?: boolean;
    stripedRows?: boolean;
    textColor?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: "left" | "center" | "right" | "justify";
    opacity?: number;
    rotation?: number;
    shapeType?: "line" | "rect" | "circle";
    borderColor?: string;
    borderWidth?: number;
    borderStyle?: "solid" | "dashed" | "dotted";
    borderRadius?: number;
    padding?: number;
    zIndex?: number;
    qrValue?: string;
    barcodeType?: string;
    iconName?: string;
    formFieldType?: "checkbox" | "radio" | "text_line";
    isChecked?: boolean;
    fontFamily?: string;
    fontStyle?: "normal" | "italic";
    textDecoration?: "none" | "underline" | "line-through" | "underline line-through";
    lineHeight?: number;
    letterSpacing?: number;
    scaleX?: number;
    scaleY?: number;
  };
}

export interface DocumentTemplateV3 {
  templateName: string;
  targetModule: "PURCHASE_ORDER" | "PROJECT_INVOICE" | "QUOTATION" | "CRM";
  companyId?: string;
  isDeleted?: boolean;
  globalStyles: {
    fontFamily: string;
    primaryColor: string;
    secondaryColor: string;
    pageSize: "A4" | "A5" | "Letter" | "Legal";
    margin: "normal" | "narrow" | "wide";
    watermark?: "NONE" | "DRAFT" | "CONFIDENTIAL" | "ORIGINAL" | "PAID";
  };
  blocks: DocumentBlockV3[];
}

// -------------------------------------------------------------
// RESOLVE COMPACT SYSTEM ICONS
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// CONSTANTS & DIMENSIONS
// -------------------------------------------------------------
export const PAPER_DIMENSIONS = {
  A4: { width: 794, height: 1123, label: "A4 (210x297mm)" },
  A5: { width: 559, height: 794, label: "A5 (148x210mm)" },
  Letter: { width: 816, height: 1056, label: "Letter (8.5x11\")" },
  Legal: { width: 816, height: 1344, label: "Legal (8.5x14\")" }
};

const MODULE_VARIABLES = {
  QUOTATION: [
    { label: "เลขที่ใบเสนอราคา", value: "{{doc.number}}", mock: "QT-2026-0089" },
    { label: "วันที่ออกเอกสาร", value: "{{doc.date}}", mock: "28 พฤษภาคม 2026" },
    { label: "ชื่อลูกค้า", value: "{{customer.name}}", mock: "บริษัท นานอน โฮลดิ้งส์ จำกัด" },
    { label: "ที่อยู่ลูกค้า", value: "{{customer.address}}", mock: "999/99 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310" },
    { label: "เลขประจำตัวผู้เสียภาษีลูกค้า", value: "{{customer.taxId}}", mock: "0105562009876" },
    { label: "ยอดเงินรวม", value: "{{amount.subtotal}}", mock: "150,000.00" },
    { label: "ภาษีมูลค่าเพิ่ม (7%)", value: "{{amount.vat}}", mock: "10,500.00" },
    { label: "ยอดเงินสุทธิ", value: "{{amount.net}}", mock: "160,500.00" },
    { label: "ยอดเงินสุทธิ (ตัวอักษร)", value: "{{amount.netThaiText}}", mock: "หนึ่งแสนหกหมื่นห้าร้อยบาทถ้วน" },
    { label: "ชื่อบริษัทเรา", value: "{{company.name}}", mock: "บริษัท เน็กซัส อีอาร์พี โซลูชันส์ จำกัด" },
    { label: "เลขผู้เสียภาษีเรา", value: "{{company.taxId}}", mock: "0105559001234" }
  ],
  PURCHASE_ORDER: [
    { label: "เลขที่ใบสั่งซื้อ", value: "{{doc.number}}", mock: "PO-2026-0042" },
    { label: "วันที่ออกเอกสาร", value: "{{doc.date}}", mock: "28 พฤษภาคม 2026" },
    { label: "ชื่อผู้จัดจำหน่าย", value: "{{supplier.name}}", mock: "ห้างหุ้นส่วนจำกัด โตโย แพลนท์ แอนด์ แมชชีนเนอรี" },
    { label: "ที่อยู่ผู้จัดจำหน่าย", value: "{{supplier.address}}", mock: "45/1 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110" },
    { label: "ยอดเงินรวม", value: "{{amount.subtotal}}", mock: "85,000.00" },
    { label: "ภาษีมูลค่าเพิ่ม (7%)", value: "{{amount.vat}}", mock: "5,950.00" },
    { label: "ยอดเงินสุทธิ", value: "{{amount.net}}", mock: "90,950.00" },
    { label: "ยอดเงินสุทธิ (ตัวอักษร)", value: "{{amount.netThaiText}}", mock: "เก้าหมื่นเก้าร้อยห้าสิบบาทถ้วน" },
    { label: "ชื่อบริษัทเรา", value: "{{company.name}}", mock: "บริษัท เน็กซัส อีอาร์พี โซลูชันส์ จำกัด" },
    { label: "เลขผู้เสียภาษีเรา", value: "{{company.taxId}}", mock: "0105559001234" }
  ],
  PROJECT_INVOICE: [
    { label: "เลขที่ใบแจ้งหนี้", value: "{{doc.number}}", mock: "INV-2026-0211" },
    { label: "วันที่ออกเอกสาร", value: "{{doc.date}}", mock: "28 พฤษภาคม 2026" },
    { label: "ชื่อโครงการ", value: "{{project.name}}", mock: "โครงการติดตั้งระบบโครงสร้างพื้นฐานดิจิทัล เฟส 2" },
    { label: "ชื่อลูกค้า", value: "{{customer.name}}", mock: "บริษัท นานอน โฮลดิ้งส์ จำกัด" },
    { label: "ยอดเงินแจ้งหนี้", value: "{{amount.subtotal}}", mock: "450,000.00" },
    { label: "ภาษีมูลค่าเพิ่ม (7%)", value: "{{amount.vat}}", mock: "31,500.00" },
    { label: "ยอดเงินสุทธิ", value: "{{amount.net}}", mock: "481,500.00" },
    { label: "ยอดเงินสุทธิ (ตัวอักษร)", value: "{{amount.netThaiText}}", mock: "สี่แสนแปดหมื่นหนึ่งพันห้าร้อยบาทถ้วน" }
  ],
  CRM: [
    { label: "เลขที่ผู้ติดต่อ", value: "{{lead.id}}", mock: "LD-2026-0004" },
    { label: "ชื่อผู้ติดต่อ", value: "{{lead.name}}", mock: "คุณ สมยศ เจริญรุ่งเรือง" },
    { label: "เบอร์โทรศัพท์", value: "{{lead.phone}}", mock: "081-234-5678" },
    { label: "อีเมล", value: "{{lead.email}}", mock: "somyot@jroongreung.com" },
    { label: "ชื่อบริษัท", value: "{{lead.company}}", mock: "บริษัท เจริญรุ่งเรือง พลาซ่า จำกัด" }
  ]
};

// -------------------------------------------------------------
// TEXT SEGMENTATION HELPER
// -------------------------------------------------------------
interface TextSegment {
  type: "TEXT" | "VARIABLE";
  value: string;
}

export function parseTextToSegments(text: string): TextSegment[] {
  if (!text) return [];
  const segments: TextSegment[] = [];
  const regex = /(\{\{[^{}]+\}\})/g;
  const parts = text.split(regex);
  parts.forEach(part => {
    if (part.startsWith("{{") && part.endsWith("}}")) {
      segments.push({
        type: "VARIABLE",
        value: part.slice(2, -2).trim()
      });
    } else if (part) {
      segments.push({
        type: "TEXT",
        value: part
      });
    }
  });
  return segments;
}

export function compileSegmentsToText(segments: TextSegment[], module: keyof typeof MODULE_VARIABLES, isPreview: boolean = false, dataOverrides?: any): string {
  return segments.map(seg => {
    if (seg.type === "VARIABLE") {
      if (dataOverrides && dataOverrides[seg.value] !== undefined) {
        return String(dataOverrides[seg.value]);
      } else if (isPreview) {
        const variables = MODULE_VARIABLES[module] || [];
        const match = variables.find(v => v.value.includes(seg.value));
        return match ? match.mock : `{{${seg.value}}}`;
      } else {
        return `{{${seg.value}}}`;
      }
    }
    return seg.value;
  }).join("");
}

// -------------------------------------------------------------
// INITIAL SEED TEMPLATE GENERATOR
// -------------------------------------------------------------
export const getInitialTemplate = (name: string): DocumentTemplateV3 => {
  let targetModule: DocumentTemplateV3["targetModule"] = "QUOTATION";
  const lowerName = name.toLowerCase();
  if (lowerName.includes("quotation") || lowerName.includes("เสนอราคา")) targetModule = "QUOTATION";
  else if (lowerName.includes("purchase") || lowerName.includes("สั่งซื้อ")) targetModule = "PURCHASE_ORDER";
  else if (lowerName.includes("invoice") || lowerName.includes("กำกับภาษี") || lowerName.includes("แจ้งหนี้")) targetModule = "PROJECT_INVOICE";
  else targetModule = "CRM";

  let defaultBlocks: DocumentBlockV3[] = [];

  if (targetModule === "QUOTATION") {
    defaultBlocks = [
      {
        id: "block-header-title",
        type: "TEXT",
        position: { x: 40, y: 40, w: 420, h: 60 },
        content: "บริษัท เน็กซัส อีอาร์พี โซลูชันส์ จำกัด\nNEXUS ERP SOLUTIONS CO., LTD.\nเลขผู้เสียภาษี: 0105564000000 (สำนักงานใหญ่)",
        properties: {
          fontSize: 13,
          fontWeight: "bold",
          textColor: "#0d9488",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "block-header-meta",
        type: "TEXT",
        position: { x: 480, y: 40, w: 274, h: 80 },
        content: "ใบเสนอราคา / QUOTATION\nเลขที่เอกสาร: {{doc.number}}\nวันที่ออก: {{doc.date}}\nยืนราคาถึงวันที่: {{doc.validUntil}}",
        properties: {
          fontSize: 12,
          fontWeight: "bold",
          textColor: "#1f2937",
          textAlign: "right",
          zIndex: 10
        }
      },
      {
        id: "block-divider-1",
        type: "SHAPE",
        position: { x: 40, y: 130, w: 714, h: 2 },
        properties: {
          shapeType: "line",
          backgroundColor: "#0d9488",
          zIndex: 5
        }
      },
      {
        id: "block-customer-info",
        type: "TEXT",
        position: { x: 40, y: 150, w: 500, h: 80 },
        content: "ลูกค้า / Customer:\nชื่อผู้ติดต่อ: {{customer.name}}\nที่อยู่: {{customer.address}}\nเลขประจำตัวผู้เสียภาษี: {{customer.taxId}}",
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "block-qr",
        type: "QR_CODE",
        position: { x: 654, y: 150, w: 100, h: 100 },
        properties: {
          qrValue: "https://nexus-erp.com/quotation/{{doc.number}}",
          zIndex: 10
        }
      },
      {
        id: "block-data-table",
        type: "DYNAMIC_TABLE",
        position: { x: 40, y: 260, w: 714, h: 160 },
        properties: {
          showBorders: true,
          stripedRows: true,
          zIndex: 10
        }
      },
      {
        id: "block-amount-summary",
        type: "TEXT",
        position: { x: 420, y: 440, w: 334, h: 80 },
        content: "ยอดรวมก่อนภาษี: {{amount.subtotal}} บาท\nภาษีมูลค่าเพิ่ม (7%): {{amount.vat}} บาท\nยอดรวมสุทธิ: {{amount.net}} บาท",
        properties: {
          fontSize: 11,
          fontWeight: "bold",
          textColor: "#0f766e",
          textAlign: "right",
          zIndex: 10
        }
      },
      {
        id: "block-amount-thai",
        type: "TEXT",
        position: { x: 40, y: 440, w: 360, h: 30 },
        content: "จำนวนเงินตัวอักษร: ({{amount.netThaiText}})",
        properties: {
          fontSize: 11,
          textColor: "#4b5563",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "block-terms-header",
        type: "TEXT",
        position: { x: 40, y: 530, w: 714, h: 30 },
        content: "เงื่อนไขการชำระเงินและการส่งมอบบริการ / Terms & Conditions:",
        properties: {
          fontSize: 10,
          fontWeight: "bold",
          textColor: "#1f2937",
          zIndex: 10
        }
      },
      {
        id: "block-term-opt1",
        type: "FORM_FIELD",
        position: { x: 40, y: 560, w: 320, h: 30 },
        properties: {
          formFieldType: "checkbox",
          isChecked: true,
          zIndex: 10
        },
        content: "ชำระเงินมัดจำล่วงหน้า 30% เมื่ออนุมัติใบเสนอราคา"
      },
      {
        id: "block-term-opt2",
        type: "FORM_FIELD",
        position: { x: 380, y: 560, w: 320, h: 30 },
        properties: {
          formFieldType: "checkbox",
          isChecked: false,
          zIndex: 10
        },
        content: "เครดิตการชำระเงิน 30 วันนับจากวันส่งมอบงานสำเร็จ"
      },
      {
        id: "block-signature-lines",
        type: "TEXT",
        position: { x: 40, y: 640, w: 320, h: 100 },
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "center",
          zIndex: 10
        },
        content: "ลงชื่อ.................................................. ผู้เสนอราคา\n( {{sales.name}} )\nเจ้าหน้าที่พัฒนาธุรกิจ\nวันที่ ......./......./......."
      },
      {
        id: "block-signature-date",
        type: "TEXT",
        position: { x: 434, y: 640, w: 320, h: 100 },
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "center",
          zIndex: 10
        },
        content: "ลงชื่อ.................................................. ผู้รับบริการ (ลูกค้า)\n(..................................................)\nผู้อนุมัติสั่งซื้อและรับบริการ\nวันที่ ......./......./......."
      },
      {
        id: "block-contact-icon",
        type: "ICON",
        position: { x: 40, y: 780, w: 30, h: 30 },
        properties: {
          iconName: "Phone",
          textColor: "#0d9488",
          zIndex: 10
        }
      },
      {
        id: "block-contact-text",
        type: "TEXT",
        position: { x: 80, y: 785, w: 674, h: 30 },
        content: "ฝ่ายลูกค้าสัมพันธ์โทร: 02-123-4567 | อีเมล: support@nexus-erp.com | เว็บไซต์: www.nexus-erp.com",
        properties: {
          fontSize: 10,
          textColor: "#4b5563",
          zIndex: 10
        }
      }
    ];
  } else if (targetModule === "PURCHASE_ORDER") {
    defaultBlocks = [
      {
        id: "po-header-title",
        type: "TEXT",
        position: { x: 40, y: 40, w: 420, h: 60 },
        content: "บริษัท เน็กซัส อีอาร์พี โซลูชันส์ จำกัด\nNEXUS ERP SOLUTIONS CO., LTD.\nแผนกจัดซื้อและซัพพลายเชน / Procurement Dept.",
        properties: {
          fontSize: 13,
          fontWeight: "bold",
          textColor: "#1e3a8a",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "po-header-meta",
        type: "TEXT",
        position: { x: 480, y: 40, w: 274, h: 80 },
        content: "ใบสั่งซื้อ / PURCHASE ORDER\nเลขที่เอกสาร: {{doc.number}}\nวันที่สั่งซื้อ: {{doc.date}}\nกำหนดส่งมอบ: {{delivery.date}}",
        properties: {
          fontSize: 12,
          fontWeight: "bold",
          textColor: "#1f2937",
          textAlign: "right",
          zIndex: 10
        }
      },
      {
        id: "po-divider-1",
        type: "SHAPE",
        position: { x: 40, y: 130, w: 714, h: 2 },
        properties: {
          shapeType: "line",
          backgroundColor: "#1e3a8a",
          zIndex: 5
        }
      },
      {
        id: "po-vendor-info",
        type: "TEXT",
        position: { x: 40, y: 150, w: 340, h: 90 },
        content: "ผู้ขาย / Vendor:\nบริษัท: {{vendor.name}}\nที่อยู่: {{vendor.address}}\nผู้ติดต่อ: {{vendor.contact}}\nโทร: {{vendor.phone}}",
        properties: {
          fontSize: 10,
          textColor: "#1f2937",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "po-ship-info",
        type: "TEXT",
        position: { x: 400, y: 150, w: 354, h: 90 },
        content: "สถานที่จัดส่ง / Ship To:\nบริษัท: {{shipTo.name}}\nที่อยู่จัดส่ง: {{shipTo.address}}\nผู้รับพัสดุ: {{shipTo.contact}}\nโทรศัพท์: {{shipTo.phone}}",
        properties: {
          fontSize: 10,
          textColor: "#1f2937",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "po-data-table",
        type: "DYNAMIC_TABLE",
        position: { x: 40, y: 260, w: 714, h: 160 },
        properties: {
          showBorders: true,
          stripedRows: true,
          zIndex: 10
        }
      },
      {
        id: "po-amount-summary",
        type: "TEXT",
        position: { x: 420, y: 440, w: 334, h: 80 },
        content: "ยอดรวมทั้งสิ้นก่อนภาษี: {{amount.subtotal}} บาท\nภาษีมูลค่าเพิ่ม (7%): {{amount.vat}} บาท\nยอดรวมสุทธิ: {{amount.net}} บาท",
        properties: {
          fontSize: 11,
          fontWeight: "bold",
          textColor: "#1e3a8a",
          textAlign: "right",
          zIndex: 10
        }
      },
      {
        id: "po-amount-thai",
        type: "TEXT",
        position: { x: 40, y: 440, w: 360, h: 30 },
        content: "จำนวนเงินตัวอักษร: ({{amount.netThaiText}})",
        properties: {
          fontSize: 11,
          textColor: "#4b5563",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "po-barcode",
        type: "BARCODE",
        position: { x: 40, y: 520, w: 300, h: 50 },
        properties: {
          barcodeType: "CODE128",
          zIndex: 10
        },
        content: "PO-2605-0001"
      },
      {
        id: "po-terms-header",
        type: "TEXT",
        position: { x: 40, y: 590, w: 714, h: 40 },
        content: "เงื่อนไขการค้าและหมายเหตุ / Trading Terms & Notes:\n1. โปรดระบุเลขที่ใบสั่งซื้อนี้ในใบส่งของ/ใบกำกับภาษีทุกฉบับ\n2. เงื่อนไขการชำระเงิน: {{payment.terms}}",
        properties: {
          fontSize: 9,
          textColor: "#4b5563",
          zIndex: 10
        }
      },
      {
        id: "po-sig-left",
        type: "TEXT",
        position: { x: 40, y: 660, w: 320, h: 100 },
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "center",
          zIndex: 10
        },
        content: "ลงชื่อ.................................................. ผู้สั่งซื้อ\n( {{buyer.name}} )\nเจ้าหน้าที่ฝ่ายจัดซื้อ\nวันที่ ......./......./......."
      },
      {
        id: "po-sig-right",
        type: "TEXT",
        position: { x: 434, y: 660, w: 320, h: 100 },
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "center",
          zIndex: 10
        },
        content: "ลงชื่อ.................................................. ผู้อนุมัติสั่งซื้อ\n(..................................................)\nผู้จัดการฝ่ายจัดซื้อและซัพพลายเชน\nวันที่ ......./......./......."
      }
    ];
  } else if (targetModule === "PROJECT_INVOICE") {
    defaultBlocks = [
      {
        id: "inv-header-title",
        type: "TEXT",
        position: { x: 40, y: 40, w: 420, h: 80 },
        content: "บริษัท เน็กซัส อีอาร์พี โซลูชันส์ จำกัด\nNEXUS ERP SOLUTIONS CO., LTD.\nเลขประจำตัวผู้เสียภาษี: 0105564000000 | สำนักงานใหญ่\nเลขที่ 1/1 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900",
        properties: {
          fontSize: 11,
          fontWeight: "bold",
          textColor: "#334155",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "inv-header-meta",
        type: "TEXT",
        position: { x: 480, y: 40, w: 274, h: 90 },
        content: "ต้นฉบับ ใบกำกับภาษี / ใบแจ้งหนี้\nORIGINAL TAX INVOICE / INVOICE\nเลขที่เอกสาร: {{doc.number}}\nวันที่ออก: {{doc.date}}\nอ้างอิงใบสั่งซื้อ: {{ref.poNumber}}",
        properties: {
          fontSize: 11,
          fontWeight: "bold",
          textColor: "#1f2937",
          textAlign: "right",
          zIndex: 10
        }
      },
      {
        id: "inv-divider-1",
        type: "SHAPE",
        position: { x: 40, y: 140, w: 714, h: 2 },
        properties: {
          shapeType: "line",
          backgroundColor: "#334155",
          zIndex: 5
        }
      },
      {
        id: "inv-customer-info",
        type: "TEXT",
        position: { x: 40, y: 160, w: 420, h: 80 },
        content: "ลูกค้า / Customer:\nชื่อผู้ซื้อ: {{customer.name}}\nที่อยู่: {{customer.address}}\nเลขประจำตัวผู้เสียภาษี: {{customer.taxId}} ({{customer.branch}})",
        properties: {
          fontSize: 10,
          textColor: "#1f2937",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "inv-qr",
        type: "QR_CODE",
        position: { x: 654, y: 160, w: 100, h: 100 },
        properties: {
          qrValue: "https://nexus-erp.com/invoice/{{doc.number}}/etax",
          zIndex: 10
        }
      },
      {
        id: "inv-data-table",
        type: "DYNAMIC_TABLE",
        position: { x: 40, y: 280, w: 714, h: 160 },
        properties: {
          showBorders: true,
          stripedRows: true,
          zIndex: 10
        }
      },
      {
        id: "inv-amount-summary",
        type: "TEXT",
        position: { x: 420, y: 460, w: 334, h: 80 },
        content: "ยอดรวมก่อนภาษีมูลค่าเพิ่ม: {{amount.subtotal}} บาท\nภาษีมูลค่าเพิ่ม (7%): {{amount.vat}} บาท\nยอดรวมสุทธิทั้งสิ้น: {{amount.net}} บาท",
        properties: {
          fontSize: 11,
          fontWeight: "bold",
          textColor: "#0f172a",
          textAlign: "right",
          zIndex: 10
        }
      },
      {
        id: "inv-amount-thai",
        type: "TEXT",
        position: { x: 40, y: 460, w: 360, h: 30 },
        content: "จำนวนเงินตัวอักษร: ({{amount.netThaiText}})",
        properties: {
          fontSize: 11,
          textColor: "#4b5563",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "inv-barcode",
        type: "BARCODE",
        position: { x: 40, y: 540, w: 300, h: 50 },
        properties: {
          barcodeType: "CODE128",
          zIndex: 10
        },
        content: "INV-2605-0042"
      },
      {
        id: "inv-sig-left",
        type: "TEXT",
        position: { x: 40, y: 660, w: 320, h: 100 },
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "center",
          zIndex: 10
        },
        content: "ลงชื่อ.................................................. ผู้รับบริการ/สินค้า\n(..................................................)\nวันที่ ......./......./......."
      },
      {
        id: "inv-sig-right",
        type: "TEXT",
        position: { x: 434, y: 660, w: 320, h: 100 },
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "center",
          zIndex: 10
        },
        content: "ลงชื่อ.................................................. ผู้รับมอบอำนาจ\n(..................................................)\nผู้มีอำนาจลงนามและประทับตรา\nวันที่ ......./......./......."
      }
    ];
  } else {
    defaultBlocks = [
      {
        id: "rec-header-title",
        type: "TEXT",
        position: { x: 40, y: 40, w: 420, h: 60 },
        content: "บริษัท เน็กซัส อีอาร์พี โซลูชันส์ จำกัด\nNEXUS ERP SOLUTIONS CO., LTD.\nเลขประจำตัวผู้เสียภาษี: 0105564000000 | โทร: 02-123-4567",
        properties: {
          fontSize: 12,
          fontWeight: "bold",
          textColor: "#047857",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "rec-header-meta",
        type: "TEXT",
        position: { x: 480, y: 40, w: 274, h: 80 },
        content: "ใบเสร็จรับเงิน / RECEIPT\nเลขที่เอกสาร: {{doc.number}}\nวันที่ชำระเงิน: {{doc.date}}",
        properties: {
          fontSize: 12,
          fontWeight: "bold",
          textColor: "#1f2937",
          textAlign: "right",
          zIndex: 10
        }
      },
      {
        id: "rec-divider-1",
        type: "SHAPE",
        position: { x: 40, y: 130, w: 714, h: 2 },
        properties: {
          shapeType: "line",
          backgroundColor: "#047857",
          zIndex: 5
        }
      },
      {
        id: "rec-customer-info",
        type: "TEXT",
        position: { x: 40, y: 150, w: 500, h: 80 },
        content: "ได้รับเงินจาก / Received From:\nชื่อผู้ชำระ: {{customer.name}}\nที่อยู่: {{customer.address}}\nเลขประจำตัวผู้เสียภาษี: {{customer.taxId}}",
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "rec-qr",
        type: "QR_CODE",
        position: { x: 654, y: 150, w: 100, h: 100 },
        properties: {
          qrValue: "https://nexus-erp.com/receipt/{{doc.number}}/verify",
          zIndex: 10
        }
      },
      {
        id: "rec-data-table",
        type: "DYNAMIC_TABLE",
        position: { x: 40, y: 260, w: 714, h: 160 },
        properties: {
          showBorders: true,
          stripedRows: true,
          zIndex: 10
        }
      },
      {
        id: "rec-amount-summary",
        type: "TEXT",
        position: { x: 420, y: 440, w: 334, h: 80 },
        content: "ยอดรับชำระสุทธิทั้งสิ้น: {{amount.net}} บาท",
        properties: {
          fontSize: 12,
          fontWeight: "bold",
          textColor: "#047857",
          textAlign: "right",
          zIndex: 10
        }
      },
      {
        id: "rec-amount-thai",
        type: "TEXT",
        position: { x: 40, y: 440, w: 360, h: 30 },
        content: "จำนวนเงินตัวอักษร: ({{amount.netThaiText}})",
        properties: {
          fontSize: 11,
          textColor: "#4b5563",
          textAlign: "left",
          zIndex: 10
        }
      },
      {
        id: "rec-payment-header",
        type: "TEXT",
        position: { x: 40, y: 500, w: 714, h: 25 },
        content: "วิธีการชำระเงิน / Payment Method:",
        properties: {
          fontSize: 10,
          fontWeight: "bold",
          textColor: "#1f2937",
          zIndex: 10
        }
      },
      {
        id: "rec-pay-cash",
        type: "FORM_FIELD",
        position: { x: 40, y: 530, w: 180, h: 30 },
        properties: {
          formFieldType: "checkbox",
          isChecked: false,
          zIndex: 10
        },
        content: "เงินสด"
      },
      {
        id: "rec-pay-transfer",
        type: "FORM_FIELD",
        position: { x: 240, y: 530, w: 320, h: 30 },
        properties: {
          formFieldType: "checkbox",
          isChecked: true,
          zIndex: 10
        },
        content: "โอนผ่านบัญชีธนาคาร (กสิกรไทย 001-2-34567-8)"
      },
      {
        id: "rec-pay-cheque",
        type: "FORM_FIELD",
        position: { x: 580, y: 530, w: 174, h: 30 },
        properties: {
          formFieldType: "checkbox",
          isChecked: false,
          zIndex: 10
        },
        content: "เช็ค"
      },
      {
        id: "rec-sig-left",
        type: "TEXT",
        position: { x: 40, y: 660, w: 320, h: 100 },
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "center",
          zIndex: 10
        },
        content: "ลงชื่อ.................................................. ผู้จ่ายเงิน\n(..................................................)\nวันที่ ......./......./......."
      },
      {
        id: "rec-sig-right",
        type: "TEXT",
        position: { x: 434, y: 660, w: 320, h: 100 },
        properties: {
          fontSize: 11,
          textColor: "#1f2937",
          textAlign: "center",
          zIndex: 10
        },
        content: "ลงชื่อ.................................................. ผู้รับเงิน\n( {{cashier.name}} )\nเจ้าหน้าที่ฝ่ายการเงิน\nวันที่ ......./......./......."
      }
    ];
  }

  // Set page standard colors based on targetModule
  const primaryColor = targetModule === "QUOTATION" ? "#0d9488" :
                        targetModule === "PURCHASE_ORDER" ? "#1e3a8a" :
                        targetModule === "PROJECT_INVOICE" ? "#334155" : "#047857";

  const secondaryColor = targetModule === "QUOTATION" ? "#0f766e" :
                          targetModule === "PURCHASE_ORDER" ? "#172554" :
                          targetModule === "PROJECT_INVOICE" ? "#1e293b" : "#064e3b";

  return {
    templateName: name,
    targetModule,
    companyId: "", // ผู้เรียกใส่รหัสบริษัทจริงก่อนบันทึก
    isDeleted: false,
    globalStyles: {
      fontFamily: "Sarabun",
      primaryColor,
      secondaryColor,
      pageSize: "A4",
      margin: "normal",
      watermark: "NONE"
    },
    blocks: defaultBlocks
  };
};

interface UltimateDocumentBuilderProps {
  templateName: string;
  onClose: () => void;
}

export function UltimateDocumentBuilder({ templateName, onClose }: UltimateDocumentBuilderProps) {
  const { user, companyId } = useAuth();
  const currentCompanyId = companyId || "";

  const [template, setTemplate] = useState<DocumentTemplateV3>(() => getInitialTemplate(templateName));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load template from Firestore if it exists
  useEffect(() => {
    const loadTemplate = async () => {
      setIsLoading(true);
      try {
        // Query by companyId + templateName only - filter isDeleted client-side
        // Old documents may not have isDeleted field, Firestore strict equality
        // "isDeleted == false" would miss those documents entirely
        const q = query(
          collection(db, "form_templates"),
          where("companyId", "==", currentCompanyId),
          where("templateName", "==", templateName)
        );
        
        const querySnapshot = await getDocs(q);
        // Filter client-side: include if isDeleted is not true
        const activeDocs = querySnapshot.docs.filter(d => d.data().isDeleted !== true);
        if (activeDocs.length > 0) {
          const docSnap = activeDocs[0];
          setTemplate({ id: docSnap.id, ...docSnap.data() } as any);
        } else {
          // If not found, use default seed template
          const initial = getInitialTemplate(templateName);
          initial.companyId = currentCompanyId;
          setTemplate(initial);
        }
      } catch (err) {
        console.error("Failed to load template from Firestore:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadTemplate();
  }, [templateName, currentCompanyId]);

  // Handle Save to Firestore
  const handleSaveTemplate = async () => {
    try {
      const dataToSave = {
        templateName: template.templateName,
        targetModule: template.targetModule,
        companyId: currentCompanyId,
        isDeleted: false,
        globalStyles: template.globalStyles,
        blocks: template.blocks,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || "SYSTEM"
      };

      if ((template as any).id) {
        const docRef = doc(db, "form_templates", (template as any).id);
        await updateDoc(docRef, dataToSave);
      } else {
        // Double check by query to avoid duplicate creations
        // Filter isDeleted client-side to catch old documents without this field
        const q = query(
          collection(db, "form_templates"),
          where("companyId", "==", currentCompanyId),
          where("templateName", "==", template.templateName)
        );
        const querySnapshot = await getDocs(q);
        const activeDocs = querySnapshot.docs.filter(d => d.data().isDeleted !== true);
        if (activeDocs.length > 0) {
          const docSnap = activeDocs[0];
          const docRef = doc(db, "form_templates", docSnap.id);
          await updateDoc(docRef, dataToSave);
          setTemplate(prev => ({ ...prev, id: docSnap.id } as any));
        } else {
          const docAdded = await addDoc(collection(db, "form_templates"), {
            ...dataToSave,
            createdAt: serverTimestamp(),
            createdBy: user?.uid || "SYSTEM"
          });
          setTemplate(prev => ({ ...prev, id: docAdded.id } as any));
        }
      }
      showToast("บันทึกโครงสร้างต้นแบบรายงานเข้าสู่คลาวด์สำเร็จ", "success");
    } catch (err) {
      console.error("Failed to save template to Firestore:", err);
      showToast("เกิดข้อผิดพลาดในการบันทึกเทมเพลต", "error");
    }
  };

  // Design Toolbar States
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"properties" | "elements" | "page-setup">("properties");
  
  const [toast, setToast] = useState({ message: "", isVisible: false, type: "success" as "success" | "error" });

  // หน้าโหลด: สร้างไว้ก่อน แล้ว return หลัง hook ทั้งหมด (ลำดับ hook ต้องเท่ากันทุกรอบ render)
  const loadingView = isLoading ? (
      <div className="flex-1 bg-surface-0 flex flex-col items-center justify-center p-12 relative overflow-hidden h-full select-none">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="w-16 h-16 rounded-2xl bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shadow-[0_0_30px_rgba(0,255,209,0.2)] animate-pulse mb-6">
          <Database size={28} className="animate-spin text-nexus-teal [animation-duration:3s]" />
        </div>
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest leading-none">กำลังโหลดแม่แบบเอกสาร...</h3>
        <p className="text-[10px] text-white/30 uppercase mt-2.5 tracking-widest font-bold leading-none animate-pulse">Syncing layout with secure multi-tenant cloud storage</p>
      </div>
  ) : null;

  // Dragging states and refs to avoid listener churn
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const paper = PAPER_DIMENSIONS[template.globalStyles.pageSize];

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, isVisible: true, type });
  };

  // Keep state refs updated for global window event listener to prevent event listener re-binding churn
  const blocksRef = useRef(template.blocks);
  const dragOffsetRef = useRef(dragOffset);
  const snapToGridRef = useRef(snapToGrid);
  const paperRef = useRef(paper);
  const selectedBlockIdRef = useRef(selectedBlockId);

  useEffect(() => {
    blocksRef.current = template.blocks;
  }, [template.blocks]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  useEffect(() => {
    snapToGridRef.current = snapToGrid;
  }, [snapToGrid]);

  useEffect(() => {
    paperRef.current = paper;
  }, [paper]);

  useEffect(() => {
    selectedBlockIdRef.current = selectedBlockId;
  }, [selectedBlockId]);

  // -------------------------------------------------------------
  // GRID MATHEMATICAL SNAPPING LOGIC
  // -------------------------------------------------------------
  const snapX = (pixelX: number, canvasWidth: number) => {
    const percent = (pixelX / canvasWidth) * 100;
    const snappedPercent = Math.round(percent / 5) * 5;
    return Math.round((snappedPercent / 100) * canvasWidth);
  };

  const snapY = (pixelY: number) => {
    return Math.round(pixelY / 20) * 20;
  };

  // -------------------------------------------------------------
  // CANVAS BLOCK SELECTIONS & DRAG LOGIC
  // -------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent, blockId: string) => {
    // Critical: Stop bubble and prevent browser's default text/ghost-image drag behavior
    e.stopPropagation();
    e.preventDefault();
    
    setSelectedBlockId(blockId);
    setIsDragging(true);

    const block = template.blocks.find(b => b.id === blockId);
    if (!block || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const offsetX = e.clientX - canvasRect.left - block.position.x;
    const offsetY = e.clientY - canvasRect.top - block.position.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  // Global window listeners for drag movement & mouse up to prevent sticky blocks
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const canvasEl = canvasRef.current;
      const blockId = selectedBlockIdRef.current;
      if (!canvasEl || !blockId) return;

      const canvasRect = canvasEl.getBoundingClientRect();
      const currentDragOffset = dragOffsetRef.current;
      let newX = e.clientX - canvasRect.left - currentDragOffset.x;
      let newY = e.clientY - canvasRect.top - currentDragOffset.y;

      const currentBlocks = blocksRef.current;
      const block = currentBlocks.find(b => b.id === blockId);
      if (!block) return;

      const currentPaper = paperRef.current;
      const finalH = block.position.h || 40;
      newX = Math.max(0, Math.min(newX, currentPaper.width - block.position.w));
      newY = Math.max(0, Math.min(newY, currentPaper.height - finalH));

      if (snapToGridRef.current) {
        newX = snapX(newX, currentPaper.width);
        newY = snapY(newY);
      } else {
        newX = Math.round(newX);
        newY = Math.round(newY);
      }

      updateSelectedBlockPosition({ x: newX, y: newY });
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true });
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging]);

  const updateSelectedBlock = (propertiesUpdates: Partial<Exclude<DocumentBlockV3["properties"], undefined>> & { content?: string; src?: string }) => {
    if (!selectedBlockId) return;
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== selectedBlockId) return b;
        
        const content = propertiesUpdates.content !== undefined ? propertiesUpdates.content : b.content;
        const src = propertiesUpdates.src !== undefined ? propertiesUpdates.src : b.src;
        
        const props = { ...(b.properties || {}) };
        Object.keys(propertiesUpdates).forEach(key => {
          if (key !== "content" && key !== "src") {
            const propKey = key as keyof typeof propertiesUpdates;
            (props as any)[propKey] = propertiesUpdates[propKey];
          }
        });
        
        return {
          ...b,
          content,
          src,
          properties: props
        };
      })
    }));
  };

  const updateSelectedBlockPosition = (posUpdates: Partial<DocumentBlockV3["position"]>) => {
    if (!selectedBlockId) return;
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== selectedBlockId) return b;
        return {
          ...b,
          position: { ...b.position, ...posUpdates }
        };
      })
    }));
  };

  // -------------------------------------------------------------
  // LAYER & QUICK ALIGNMENT LOGIC
  // -------------------------------------------------------------
  const bringToFront = () => {
    if (!selectedBlockId) return;
    const maxZ = template.blocks.reduce((max, b) => Math.max(max, b.properties?.zIndex || 0), 0);
    updateSelectedBlock({ zIndex: maxZ + 1 });
    showToast("นำเลเยอร์ไปไว้หน้าสุด", "success");
  };

  const sendToBack = () => {
    if (!selectedBlockId) return;
    const minZ = template.blocks.reduce((min, b) => Math.min(min, b.properties?.zIndex || 0), 0);
    updateSelectedBlock({ zIndex: minZ - 1 });
    showToast("นำเลเยอร์ไปไว้หลังสุด", "success");
  };

  const moveLayerUp = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const currentZ = block.properties?.zIndex || 1;
    updateSelectedBlock({ zIndex: currentZ + 1 });
    showToast("ขยับเลเยอร์ขึ้นด้านบน", "success");
  };

  const moveLayerDown = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const currentZ = block.properties?.zIndex || 1;
    updateSelectedBlock({ zIndex: Math.max(1, currentZ - 1) });
    showToast("ขยับเลเยอร์ลงด้านล่าง", "success");
  };

  const alignBlock = (alignment: "left" | "center" | "right") => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    
    let newX = block.position.x;
    if (alignment === "left") {
      newX = 40;
    } else if (alignment === "center") {
      newX = Math.round((paper.width - block.position.w) / 2);
    } else if (alignment === "right") {
      newX = paper.width - block.position.w - 40;
    }

    if (snapToGrid) {
      newX = snapX(newX, paper.width);
    }

    updateSelectedBlockPosition({ x: newX });
    showToast(`จัดตำแหน่งบล็อก: ${alignment === "left" ? "ชิดซ้าย" : alignment === "center" ? "กึ่งกลางแนวนอน" : "ชิดขวา"}`, "success");
  };

  const alignVertically = (alignment: "top" | "middle" | "bottom") => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const finalH = block.position.h || 40;
    
    let newY = block.position.y;
    if (alignment === "top") {
      newY = 40;
    } else if (alignment === "middle") {
      newY = Math.round((paper.height - finalH) / 2);
    } else if (alignment === "bottom") {
      newY = paper.height - finalH - 40;
    }

    if (snapToGrid) {
      newY = snapY(newY);
    }

    updateSelectedBlockPosition({ y: newY });
    showToast(`จัดตำแหน่งบล็อก: ${alignment === "top" ? "ชิดขอบบน" : alignment === "middle" ? "กึ่งกลางแนวตั้ง" : "ชิดขอบล่าง"}`, "success");
  };

  const centerHorizontally = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    let newX = Math.round((paper.width - block.position.w) / 2);
    if (snapToGrid) newX = snapX(newX, paper.width);
    updateSelectedBlockPosition({ x: newX });
    showToast("จัดบล็อกกึ่งกลางแนวนอน", "success");
  };

  const centerVertically = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const finalH = block.position.h || 40;
    let newY = Math.round((paper.height - finalH) / 2);
    if (snapToGrid) newY = snapY(newY);
    updateSelectedBlockPosition({ y: newY });
    showToast("จัดบล็อกกึ่งกลางแนวตั้ง", "success");
  };

  const centerBoth = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const finalH = block.position.h || 40;
    let newX = Math.round((paper.width - block.position.w) / 2);
    let newY = Math.round((paper.height - finalH) / 2);
    if (snapToGrid) {
      newX = snapX(newX, paper.width);
      newY = snapY(newY);
    }
    updateSelectedBlockPosition({ x: newX, y: newY });
    showToast("จัดบล็อกกึ่งกลางหน้ากระดาษ", "success");
  };

  const rotateCw = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const currentRot = block.properties?.rotation || 0;
    updateSelectedBlock({ rotation: (currentRot + 90) % 360 });
    showToast("หมุนตามเข็มนาฬิกา 90°", "success");
  };

  const rotateCcw = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const currentRot = block.properties?.rotation || 0;
    updateSelectedBlock({ rotation: (currentRot - 90 + 360) % 360 });
    showToast("หมุนทวนเข็มนาฬิกา 90°", "success");
  };

  const flipHorizontal = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const currentScale = block.properties?.scaleX || 1;
    updateSelectedBlock({ scaleX: currentScale === 1 ? -1 : 1 });
    showToast("สะท้อนกลับด้านแนวนอน", "success");
  };

  const flipVertical = () => {
    if (!selectedBlockId) return;
    const block = template.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    const currentScale = block.properties?.scaleY || 1;
    updateSelectedBlock({ scaleY: currentScale === 1 ? -1 : 1 });
    showToast("สะท้อนกลับด้านแนวตั้ง", "success");
  };


  // -------------------------------------------------------------
  // ADD & DELETE BLOCKS TOOLBAR HANDLERS
  // -------------------------------------------------------------
  const addNewBlock = (type: DocumentBlockV3["type"]) => {
    const newId = `block-${Date.now()}`;
    let newBlock: DocumentBlockV3 = {
      id: newId,
      type,
      position: { x: 100, y: 100, w: 200, h: 50 },
      properties: {
        zIndex: template.blocks.length + 1,
        textColor: "#1f2937",
        backgroundColor: "transparent",
        fontSize: 12,
        opacity: 100,
        rotation: 0
      }
    };

    if (type === "TEXT") {
      newBlock.content = "กรอกข้อความใหม่ที่นี่...";
      newBlock.position.w = 300;
      newBlock.position.h = 60;
    } else if (type === "IMAGE") {
      newBlock.src = "https://placehold.co/400x300/png?text=Nexus+Image";
      newBlock.position.w = 150;
      newBlock.position.h = 150;
    } else if (type === "SHAPE") {
      newBlock.properties = {
        ...newBlock.properties,
        shapeType: "rect",
        backgroundColor: "#0d9488",
        borderColor: "transparent",
        borderWidth: 0
      };
      newBlock.position.w = 200;
      newBlock.position.h = 40;
    } else if (type === "DYNAMIC_TABLE") {
      newBlock.position.w = 714;
      newBlock.position.h = 140;
      newBlock.properties = {
        ...newBlock.properties,
        showBorders: true,
        stripedRows: true
      };
    } else if (type === "QR_CODE") {
      newBlock.position.w = 100;
      newBlock.position.h = 100;
      newBlock.properties = {
        ...newBlock.properties,
        qrValue: "https://nexus-erp.com/verify/{{doc.number}}"
      };
    } else if (type === "BARCODE") {
      newBlock.position.w = 300;
      newBlock.position.h = 60;
      newBlock.content = "123456789";
      newBlock.properties = {
        ...newBlock.properties,
        barcodeType: "CODE128"
      };
    } else if (type === "ICON") {
      newBlock.position.w = 32;
      newBlock.position.h = 32;
      newBlock.properties = {
        ...newBlock.properties,
        iconName: "Phone",
        textColor: "#0d9488"
      };
    } else if (type === "FORM_FIELD") {
      newBlock.position.w = 200;
      newBlock.position.h = 30;
      newBlock.content = "ตัวเลือกฟอร์มใหม่";
      newBlock.properties = {
        ...newBlock.properties,
        formFieldType: "checkbox",
        isChecked: false
      };
    } else if (type === "SIGNATURE") {
      newBlock.position.w = 250;
      newBlock.position.h = 80;
      newBlock.content = "ลงชื่อ..................................................";
    }

    setTemplate(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
    setSelectedBlockId(newId);
    setActiveTab("properties");
    showToast(`เพิ่มบล็อกประเภท ${type} สำเร็จ`, "success");
  };

  const deleteBlock = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== id)
    }));
    if (selectedBlockId === id) setSelectedBlockId(null);
    showToast("ลบบล็อกออกจากแบบร่างแล้ว", "success");
  };

  const duplicateBlock = (block: DocumentBlockV3, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = `block-${Date.now()}`;
    const duplicated: DocumentBlockV3 = {
      ...block,
      id: newId,
      position: {
        ...block.position,
        x: Math.min(block.position.x + 20, paper.width - block.position.w),
        y: Math.min(block.position.y + 20, paper.height - (block.position.h || 40))
      },
      properties: {
        ...(block.properties || {}),
        zIndex: template.blocks.length + 1
      }
    };
    setTemplate(prev => ({
      ...prev,
      blocks: [...prev.blocks, duplicated]
    }));
    setSelectedBlockId(newId);
    showToast("โคลนบล็อกต้นแบบสำเร็จ", "success");
  };

  // -------------------------------------------------------------
  // MOCK REAL-WORLD THAI ERP PREVIEW RENDERERS
  // -------------------------------------------------------------
  const renderQRCodeSVG = (val: string = "NEXUS-ERP") => {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full text-black" fill="currentColor">
        <rect x="0" y="0" width="30" height="30" rx="2" />
        <rect x="5" y="5" width="20" height="20" fill="white" rx="1" />
        <rect x="10" y="10" width="10" height="10" rx="1" />
        
        <rect x="70" y="0" width="30" height="30" rx="2" />
        <rect x="75" y="5" width="20" height="20" fill="white" rx="1" />
        <rect x="80" y="10" width="10" height="10" rx="1" />
        
        <rect x="0" y="70" width="30" height="30" rx="2" />
        <rect x="5" y="75" width="20" height="20" fill="white" rx="1" />
        <rect x="10" y="80" width="10" height="10" rx="1" />
        
        <rect x="70" y="70" width="10" height="10" rx="1" />
        <rect x="72" y="72" width="6" height="6" fill="white" rx="0.5" />
        <rect x="74" y="74" width="2" height="2" rx="0.5" />
        
        <rect x="35" y="5" width="5" height="5" />
        <rect x="45" y="0" width="10" height="5" />
        <rect x="40" y="10" width="5" height="10" />
        <rect x="55" y="15" width="5" height="5" />
        <rect x="35" y="25" width="10" height="5" />
        
        <rect x="5" y="35" width="5" height="5" />
        <rect x="15" y="40" width="10" height="5" />
        <rect x="25" y="35" width="5" height="10" />
        
        <rect x="80" y="35" width="5" height="15" />
        <rect x="90" y="45" width="10" height="5" />
        
        <rect x="35" y="40" width="15" height="5" />
        <rect x="55" y="35" width="5" height="15" />
        <rect x="45" y="50" width="10" height="5" />
        <rect x="65" y="45" width="10" height="10" />
        <rect x="35" y="60" width="5" height="15" />
        <rect x="45" y="65" width="10" height="5" />
        
        <rect x="35" y="80" width="10" height="5" />
        <rect x="40" y="90" width="15" height="5" />
        <rect x="55" y="85" width="5" height="10" />
        
        <rect x="85" y="85" width="10" height="5" />
        <rect x="90" y="75" width="5" height="10" />
        
        <rect x="0" y="40" width="5" height="5" />
        <rect x="10" y="45" width="5" height="5" />
      </svg>
    );
  };

  const renderBarcodeSVG = (val: string = "123456789") => {
    return (
      <div className="w-full h-full flex flex-col justify-between items-center bg-transparent p-1">
        <svg viewBox="0 0 100 35" className="w-full h-[75%] text-black" fill="currentColor" preserveAspectRatio="none">
          <rect x="0" y="0" width="2" height="35" />
          <rect x="4" y="0" width="1" height="35" />
          <rect x="7" y="0" width="3" height="35" />
          <rect x="12" y="0" width="1" height="35" />
          <rect x="15" y="0" width="2" height="35" />
          <rect x="19" y="0" width="4" height="35" />
          <rect x="25" y="0" width="1" height="35" />
          <rect x="28" y="0" width="2" height="35" />
          <rect x="32" y="0" width="1" height="35" />
          <rect x="35" y="0" width="3" height="35" />
          <rect x="40" y="0" width="2" height="35" />
          <rect x="44" y="0" width="1" height="35" />
          <rect x="47" y="0" width="4" height="35" />
          <rect x="53" y="0" width="2" height="35" />
          <rect x="57" y="0" width="1" height="35" />
          <rect x="60" y="0" width="3" height="35" />
          <rect x="65" y="0" width="1" height="35" />
          <rect x="68" y="0" width="2" height="35" />
          <rect x="72" y="0" width="4" height="35" />
          <rect x="78" y="0" width="1" height="35" />
          <rect x="81" y="0" width="2" height="35" />
          <rect x="85" y="0" width="1" height="35" />
          <rect x="88" y="0" width="3" height="35" />
          <rect x="93" y="0" width="2" height="35" />
          <rect x="97" y="0" width="3" height="35" />
        </svg>
        <span className="text-[8px] font-mono tracking-widest text-black/60 select-none leading-none mt-1">{val}</span>
      </div>
    );
  };

  const renderCheckbox = (isChecked: boolean, label: string) => {
    return (
      <div className="flex items-center gap-2 select-none py-1">
        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? "bg-black border-black text-white" : "border-black/35"}`}>
          {isChecked && <Check size={8} strokeWidth={4} />}
        </div>
        <span className="text-xs text-black/80 font-semibold">{label}</span>
      </div>
    );
  };

  const renderRadioButton = (isChecked: boolean, label: string) => {
    return (
      <div className="flex items-center gap-2 select-none py-1">
        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${isChecked ? "border-black" : "border-black/35"}`}>
          {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
        </div>
        <span className="text-xs text-black/80 font-semibold">{label}</span>
      </div>
    );
  };

  // -------------------------------------------------------------
  // CANVAS CORE BLOCK RENDERER
  // -------------------------------------------------------------
  const renderBlockContent = (block: DocumentBlockV3, isPreview: boolean = false) => {
    const properties = block.properties || {};
    
    switch (block.type) {
      case "TEXT": {
        const segments = parseTextToSegments(block.content || "");
        if (isPreview) {
          const compiledText = compileSegmentsToText(segments, template.targetModule, true);
          return <p className="whitespace-pre-line leading-relaxed m-0 text-inherit">{compiledText}</p>;
        }
        
        // Canvas Interactive variables capsules rendering
        return (
          <div className="whitespace-pre-line leading-relaxed m-0 text-inherit flex flex-wrap items-center">
            {segments.map((seg, i) => {
              if (seg.type === "VARIABLE") {
                const varObj = MODULE_VARIABLES[template.targetModule]?.find(v => v.value.includes(seg.value));
                return (
                  <span 
                    key={i} 
                    className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/30 select-none shadow-neon-teal/10"
                    title={`Linked: ${varObj?.label || seg.value}`}
                  >
                    <Database size={10} className="animate-pulse text-nexus-teal" />
                    {varObj?.label || seg.value}
                  </span>
                );
              }
              return <span key={i}>{seg.value}</span>;
            })}
          </div>
        );
      }
      
      case "IMAGE":
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={block.src} 
            alt="Custom upload mockup" 
            className="w-full h-full object-contain pointer-events-none"
          />
        );
        
      case "SHAPE": {
        const shapeType = properties.shapeType || "rect";
        if (shapeType === "line") {
          return <div className="w-full h-full" style={{ backgroundColor: properties.backgroundColor || "#0d9488" }} />;
        }
        return null; // The div wrapper handles the shapes border-radius and background perfectly!
      }
      
      case "DYNAMIC_TABLE": {
        // Standard high premium ERP invoice data table mockup
        return (
          <table className="w-full border-collapse text-[10px] sm:text-xs">
            <thead className="bg-black/5 border-b border-black/25">
              <tr>
                <th className="p-2 text-left uppercase text-black/60 font-semibold">รหัสพัสดุ</th>
                <th className="p-2 text-left uppercase text-black/60 font-semibold">รายละเอียดพัสดุ</th>
                <th className="p-2 text-right uppercase text-black/60 font-semibold">จำนวน</th>
                <th className="p-2 text-right uppercase text-black/60 font-semibold">ราคา/หน่วย</th>
                <th className="p-2 text-right uppercase text-black/60 font-semibold">ยอดเงินรวม</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black/10">
                <td className="p-2 text-black/80 font-mono">NX-9081</td>
                <td className="p-2 text-black/80">ระบบประมวลผลเซนเซอร์ Quantum Sensor Hub</td>
                <td className="p-2 text-right text-black/80 font-mono">2.00</td>
                <td className="p-2 text-right text-black/80 font-mono">25,000.00</td>
                <td className="p-2 text-right text-black/80 font-mono">50,000.00</td>
              </tr>
              <tr className="border-b border-black/10 bg-black/[0.01]">
                <td className="p-2 text-black/80 font-mono">NX-2011</td>
                <td className="p-2 text-black/80">บริการติดตั้งและเชื่อมต่อระบบควบคุมเครือข่ายความปลอดภัย Core Switch</td>
                <td className="p-2 text-right text-black/80 font-mono">1.00</td>
                <td className="p-2 text-right text-black/80 font-mono">100,000.00</td>
                <td className="p-2 text-right text-black/80 font-mono">100,000.00</td>
              </tr>
            </tbody>
          </table>
        );
      }
      
      case "QR_CODE": {
        const qrContent = isPreview 
          ? compileSegmentsToText(parseTextToSegments(properties.qrValue || ""), template.targetModule, true)
          : properties.qrValue;
        return renderQRCodeSVG(qrContent);
      }
      
      case "BARCODE": {
        const barcodeContent = isPreview 
          ? compileSegmentsToText(parseTextToSegments(block.content || ""), template.targetModule, true)
          : block.content;
        return renderBarcodeSVG(barcodeContent);
      }
      
      case "ICON":
        return (
          <div className="w-full h-full flex items-center justify-center">
            {resolveIcon(properties.iconName || "Phone", 24, "text-inherit")}
          </div>
        );
        
      case "FORM_FIELD": {
        const fieldType = properties.formFieldType || "checkbox";
        if (fieldType === "checkbox") {
          return renderCheckbox(properties.isChecked || false, block.content || "");
        } else if (fieldType === "radio") {
          return renderRadioButton(properties.isChecked || false, block.content || "");
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
          <div className="w-full h-full flex flex-col justify-end items-center text-center pb-2">
            <div className="w-full border-t border-black/40 pt-1 text-[11px] font-black text-black/75">
              {block.content || "ผู้ส่งมอบสินค้า"}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  const selectedBlock = template.blocks.find(b => b.id === selectedBlockId) || null;

  if (loadingView) return loadingView;

  return (
    <div className="flex flex-col h-full bg-surface-0 text-white overflow-hidden relative">
      {/* -------------------------------------------------------------
          NEON SUB-HEADER ACTION BAR
          ------------------------------------------------------------- */}
      <div className="h-16 border-b border-white/5 bg-surface-1 flex items-center justify-between px-6 z-40 flex-shrink-0">
        <div className="flex items-center gap-4">
          <PillButton variant="glass" className="h-9 w-9 p-0 rounded-full" onClick={onClose}>
            <ArrowLeft size={16} />
          </PillButton>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nexus-teal/10 flex items-center justify-center text-nexus-teal border border-nexus-teal/20 shadow-[0_0_15px_rgba(0,255,209,0.15)] animate-pulse">
              <Sparkles size={16} />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-nexus-teal tracking-widest block leading-none">ตัวแปรเทมเพลต: {template.targetModule}</span>
              <input 
                value={template.templateName} 
                onChange={(e) => setTemplate(prev => ({ ...prev, templateName: e.target.value }))}
                className="bg-transparent border-0 font-black text-md tracking-tight text-white focus:outline-none focus:ring-1 focus:ring-nexus-teal/40 px-2 py-0.5 rounded w-[350px] mt-0.5"
                placeholder="ชื่อต้นแบบเอกสารรายงาน..."
              />
            </div>
          </div>
        </div>
        
        {/* Floating Tools Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-full p-1 mr-2">
            <PillButton 
              variant="glass" 
              className={`h-7 px-3 text-[10px] rounded-full font-black uppercase tracking-wider ${showGrid ? "text-nexus-teal bg-nexus-teal/10 border-nexus-teal/20" : "text-white/40 border-transparent bg-transparent"}`}
              onClick={() => setShowGrid(!showGrid)}
            >
              Grid {showGrid ? "ON" : "OFF"}
            </PillButton>
            <PillButton 
              variant="glass" 
              className={`h-7 px-3 text-[10px] rounded-full font-black uppercase tracking-wider ${snapToGrid ? "text-nexus-teal bg-nexus-teal/10 border-nexus-teal/20" : "text-white/40 border-transparent bg-transparent"}`}
              onClick={() => setSnapToGrid(!snapToGrid)}
            >
              Snap {snapToGrid ? "ON" : "OFF"}
            </PillButton>
          </div>
          
          <PillButton 
            variant="glass" 
            className="h-9 px-5 hover:text-nexus-teal hover:border-nexus-teal/30 rounded-full"
            onClick={() => setShowPreview(true)}
          >
            <Eye size={14} /> ดูตัวอย่างจริง
          </PillButton>
          
          <PillButton 
            variant="primary" 
            className="h-9 px-6 text-black font-black tracking-wider rounded-full shadow-neon-teal border-0 bg-gradient-to-r from-nexus-teal to-teal-400"
            onClick={handleSaveTemplate}
          >
            <Save size={14} /> บันทึกเทมเพลต
          </PillButton>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* -------------------------------------------------------------
            LEFT TOOL PANEL (PROPERTIES, ELEMENTS, PAGE-SETUP)
            ------------------------------------------------------------- */}
        <aside className="w-[340px] border-r border-white/5 bg-surface-1/80 backdrop-blur-xl flex flex-col z-30 overflow-hidden flex-shrink-0">
          <div className="flex border-b border-white/5 p-2 bg-surface-0/40 gap-1.5 flex-shrink-0">
            <button 
              onClick={() => setActiveTab("properties")}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === "properties" ? "bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/30 shadow-[0_0_15px_rgba(0,255,209,0.08)]" : "text-white/30 hover:text-white/60 border border-transparent"}`}
            >
              <Sliders size={12} /> คุณสมบัติ
            </button>
            <button 
              onClick={() => setActiveTab("elements")}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === "elements" ? "bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/30 shadow-[0_0_15px_rgba(0,255,209,0.08)]" : "text-white/30 hover:text-white/60 border border-transparent"}`}
            >
              <Plus size={12} /> เครื่องมือ
            </button>
            <button 
              onClick={() => setActiveTab("page-setup")}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-all ${activeTab === "page-setup" ? "bg-nexus-teal/15 text-nexus-teal border border-nexus-teal/30 shadow-[0_0_15px_rgba(0,255,209,0.08)]" : "text-white/30 hover:text-white/60 border border-transparent"}`}
            >
              <Layout size={12} /> หน้ากระดาษ
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
            {/* ----------------- TAB: PROPERTIES ----------------- */}
            {activeTab === "properties" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {selectedBlock ? (
                  <div className="space-y-6">
                    {/* SECTION 1: COORDINATES & DIMENSIONS */}
                    <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-3">
                      <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">ตำแหน่ง & ขนาด</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-semibold text-white/40 uppercase block mb-1">แกน X (พิกเซล)</label>
                          <PillInput 
                            type="number" 
                            value={selectedBlock.position.x} 
                            onChange={e => updateSelectedBlockPosition({ x: Math.max(0, Math.min(Number(e.target.value), paper.width - selectedBlock.position.w)) })} 
                            className="w-full font-mono text-center h-8 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-semibold text-white/40 uppercase block mb-1">แกน Y (พิกเซล)</label>
                          <PillInput 
                            type="number" 
                            value={selectedBlock.position.y} 
                            onChange={e => updateSelectedBlockPosition({ y: Math.max(0, Math.min(Number(e.target.value), paper.height - (selectedBlock.position.h || 40))) })} 
                            className="w-full font-mono text-center h-8 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-semibold text-white/40 uppercase block mb-1">ความกว้าง W</label>
                          <PillInput 
                            type="number" 
                            value={selectedBlock.position.w} 
                            onChange={e => updateSelectedBlockPosition({ w: Math.max(20, Math.min(Number(e.target.value), paper.width)) })} 
                            className="w-full font-mono text-center h-8 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-semibold text-white/40 uppercase block mb-1">ความสูง H</label>
                          <PillInput 
                            type="number" 
                            value={selectedBlock.position.h || 0} 
                            onChange={e => updateSelectedBlockPosition({ h: Math.max(10, Number(e.target.value)) })} 
                            className="w-full font-mono text-center h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: TEXT STYLE PANEL (FOR TEXT-CONTAINING BLOCKS) */}
                    {(selectedBlock.type === "TEXT" || selectedBlock.type === "SIGNATURE" || selectedBlock.type === "FORM_FIELD" || selectedBlock.type === "BARCODE") && (
                      <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-4">
                        <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">รูปแบบข้อความ</h4>
                        
                        {/* Font Family Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-semibold text-white/50 block">แบบตัวอักษร</label>
                          <PillSelect
                            value={selectedBlock.properties?.fontFamily || "Sarabun"}
                            onChange={e => updateSelectedBlock({ fontFamily: e.target.value })}
                            className="w-full h-8 py-0 text-xs"
                          >
                            <option value="Sarabun">Sarabun (มาตรฐานไทย)</option>
                            <option value="Arial">Arial (สากล)</option>
                            <option value="Courier New">Courier New (พิมพ์ดีด)</option>
                            <option value="monospace">Monospace (โปรแกรมมิ่ง)</option>
                          </PillSelect>
                        </div>

                        {/* Font Size & Color */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-white/50 block">ขนาดอักษร</label>
                            <PillInput 
                              type="number" 
                              value={selectedBlock.properties?.fontSize || 12} 
                              onChange={e => updateSelectedBlock({ fontSize: Number(e.target.value) })}
                              className="w-full font-mono text-center h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-white/50 block">สีตัวอักษร</label>
                            <div className="flex gap-2">
                              <input 
                                type="color" 
                                value={selectedBlock.properties?.textColor || "#1f2937"} 
                                onChange={e => updateSelectedBlock({ textColor: e.target.value })}
                                className="w-10 h-8 rounded border border-white/10 bg-surface-2 p-1 cursor-pointer flex-shrink-0"
                              />
                              <PillInput 
                                type="text"
                                value={selectedBlock.properties?.textColor || "#1f2937"}
                                onChange={e => updateSelectedBlock({ textColor: e.target.value })}
                                className="w-full font-mono h-8 text-center text-[10px]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Typography Style Toggles (Bold, Italic, Underline, Strikethrough) */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-semibold text-white/50 block">ลักษณะตัวอักษร</label>
                          <div className="flex gap-1 bg-surface-0 border border-white/5 p-1 rounded-xl">
                            {/* Bold */}
                            <button
                              onClick={() => {
                                const current = selectedBlock.properties?.fontWeight;
                                updateSelectedBlock({ fontWeight: current === "bold" ? "normal" : "bold" });
                              }}
                              className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${selectedBlock.properties?.fontWeight === "bold" ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/30" : "text-white/40 hover:text-white"}`}
                              title="ตัวหนา"
                            >
                              <Bold size={14} />
                            </button>

                            {/* Italic */}
                            <button
                              onClick={() => {
                                const current = selectedBlock.properties?.fontStyle;
                                updateSelectedBlock({ fontStyle: current === "italic" ? "normal" : "italic" });
                              }}
                              className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${selectedBlock.properties?.fontStyle === "italic" ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/30" : "text-white/40 hover:text-white"}`}
                              title="ตัวเอียง"
                            >
                              <Italic size={14} />
                            </button>

                            {/* Underline */}
                            <button
                              onClick={() => {
                                const dec = selectedBlock.properties?.textDecoration || "none";
                                const hasUnderline = dec.includes("underline");
                                const hasStrike = dec.includes("line-through");
                                let next = "none";
                                if (hasUnderline) {
                                  next = hasStrike ? "line-through" : "none";
                                } else {
                                  next = hasStrike ? "underline line-through" : "underline";
                                }
                                updateSelectedBlock({ textDecoration: next as any });
                              }}
                              className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${(selectedBlock.properties?.textDecoration || "none").includes("underline") ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/30" : "text-white/40 hover:text-white"}`}
                              title="ขีดเส้นใต้"
                            >
                              <Underline size={14} />
                            </button>

                            {/* Strikethrough */}
                            <button
                              onClick={() => {
                                const dec = selectedBlock.properties?.textDecoration || "none";
                                const hasUnderline = dec.includes("underline");
                                const hasStrike = dec.includes("line-through");
                                let next = "none";
                                if (hasStrike) {
                                  next = hasUnderline ? "underline" : "none";
                                } else {
                                  next = hasUnderline ? "underline line-through" : "line-through";
                                }
                                updateSelectedBlock({ textDecoration: next as any });
                              }}
                              className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${(selectedBlock.properties?.textDecoration || "none").includes("line-through") ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/30" : "text-white/40 hover:text-white"}`}
                              title="ขีดฆ่า"
                            >
                              <Strikethrough size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Horizontal Alignments Toggle Row */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-semibold text-white/50 block">การจัดแนวข้อความ</label>
                          <div className="flex gap-1 bg-surface-0 border border-white/5 p-1 rounded-xl">
                            {["left", "center", "right", "justify"].map(align => {
                              const isAlignActive = (selectedBlock.properties?.textAlign || "left") === align;
                              return (
                                <button
                                  key={align}
                                  onClick={() => updateSelectedBlock({ textAlign: align as any })}
                                  className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${isAlignActive ? "bg-nexus-teal/20 text-nexus-teal border border-nexus-teal/30" : "text-white/40 hover:text-white"}`}
                                  title={`จัด${align === "left" ? "ชิดซ้าย" : align === "center" ? "กึ่งกลาง" : align === "right" ? "ชิดขวา" : "เต็มแนว"}`}
                                >
                                  {align === "left" && <AlignLeft size={14} />}
                                  {align === "center" && <AlignCenter size={14} />}
                                  {align === "right" && <AlignRight size={14} />}
                                  {align === "justify" && <AlignJustify size={14} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Line Height & Spacing sliders */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-white/50 block flex justify-between">
                              <span>ระยะห่างบรรทัด</span>
                              <span className="text-nexus-teal font-mono">{selectedBlock.properties?.lineHeight || 1.4}</span>
                            </label>
                            <input 
                              type="range" 
                              min="1.0" 
                              max="2.5" 
                              step="0.1" 
                              value={selectedBlock.properties?.lineHeight || 1.4} 
                              onChange={e => updateSelectedBlock({ lineHeight: Number(e.target.value) })}
                              className="w-full accent-nexus-teal cursor-pointer h-2 bg-black rounded-lg appearance-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-white/50 block flex justify-between">
                              <span>ระยะห่างตัวอักษร</span>
                              <span className="text-nexus-teal font-mono">{selectedBlock.properties?.letterSpacing || 0}px</span>
                            </label>
                            <input 
                              type="range" 
                              min="-2" 
                              max="10" 
                              step="0.5" 
                              value={selectedBlock.properties?.letterSpacing || 0} 
                              onChange={e => updateSelectedBlock({ letterSpacing: Number(e.target.value) })}
                              className="w-full accent-nexus-teal cursor-pointer h-2 bg-black rounded-lg appearance-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: SHAPE STYLE PANEL (FOR SHAPE BLOCK) */}
                    {selectedBlock.type === "SHAPE" && (
                      <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-4">
                        <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">รูปแบบรูปทรง</h4>
                        
                        {/* Shapetypes */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-semibold text-white/50 block">ชนิดรูปทรง:</label>
                          <PillSelect 
                            value={selectedBlock.properties?.shapeType || "rect"} 
                            onChange={e => updateSelectedBlock({ shapeType: e.target.value as any })}
                            className="w-full text-xs"
                          >
                            <option value="rect">Rectangle (สี่เหลี่ยม)</option>
                            <option value="circle">Circle (วงกลม)</option>
                            <option value="line">Line (เส้นนอนคั่น)</option>
                          </PillSelect>
                        </div>

                        {/* Presets Colors Row */}
                        {selectedBlock.properties?.shapeType !== "line" && (
                          <div className="space-y-2">
                            <label className="text-[9px] font-semibold text-white/50 block">จานสีด่วน</label>
                            <div className="flex gap-2 p-1.5 bg-surface-0 border border-white/5 rounded-xl justify-between">
                              {["#0d9488", "#3b82f6", "#22c55e", "#eab308", "#d97706", "#ffffff"].map(presetColor => (
                                <button
                                  key={presetColor}
                                  onClick={() => updateSelectedBlock({ backgroundColor: presetColor })}
                                  className={`w-6 h-6 rounded-full border border-white/10 hover:scale-115 transition-all shadow-[0_0_8px_rgba(0,0,0,0.4)] ${selectedBlock.properties?.backgroundColor === presetColor ? "ring-2 ring-nexus-teal ring-offset-2 ring-offset-black" : ""}`}
                                  style={{ backgroundColor: presetColor }}
                                  title={presetColor}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Background Custom Fill Picker */}
                        {selectedBlock.properties?.shapeType !== "line" && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-semibold text-white/50 block">สีพื้นหลังสไตล์กำหนดเอง</label>
                            <div className="flex gap-2">
                              <input 
                                type="color" 
                                value={selectedBlock.properties?.backgroundColor || "#0d9488"} 
                                onChange={e => updateSelectedBlock({ backgroundColor: e.target.value })}
                                className="w-10 h-8 rounded border border-white/10 bg-surface-2 p-1 cursor-pointer flex-shrink-0"
                              />
                              <PillInput 
                                type="text"
                                value={selectedBlock.properties?.backgroundColor || "#0d9488"}
                                onChange={e => updateSelectedBlock({ backgroundColor: e.target.value })}
                                className="w-full font-mono h-8 text-center text-[10px]"
                              />
                            </div>
                          </div>
                        )}

                        {/* Border Properties (Visible only for Rectangle & Circle) */}
                        {selectedBlock.properties?.shapeType !== "line" && (
                          <div className="space-y-3 bg-surface-0/40 border border-white/5 rounded-xl p-3">
                            <label className="text-[9px] font-semibold text-nexus-teal uppercase tracking-widest block mb-1">เส้นขอบรูปทรง</label>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[8px] font-semibold text-white/40 block">รูปแบบเส้นขอบ</label>
                                <PillSelect 
                                  value={selectedBlock.properties?.borderStyle || "solid"} 
                                  onChange={e => updateSelectedBlock({ borderStyle: e.target.value as any })}
                                  className="w-full h-8 py-0 text-[10px]"
                                >
                                  <option value="solid">Solid (เส้นทึบ)</option>
                                  <option value="dashed">Dashed (เส้นประยาว)</option>
                                  <option value="dotted">Dotted (เส้นประจุด)</option>
                                </PillSelect>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-semibold text-white/40 block">ความกว้างเส้น</label>
                                <PillInput 
                                  type="number"
                                  value={selectedBlock.properties?.borderWidth || 0}
                                  onChange={e => updateSelectedBlock({ borderWidth: Number(e.target.value) })}
                                  className="w-full font-mono text-center h-8 text-xs"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] font-semibold text-white/40 block">สีเส้นขอบ</label>
                              <div className="flex gap-2">
                                <input 
                                  type="color" 
                                  value={selectedBlock.properties?.borderColor || "transparent"} 
                                  onChange={e => updateSelectedBlock({ borderColor: e.target.value })}
                                  className="w-8 h-8 rounded border border-white/10 bg-surface-2 p-1 cursor-pointer flex-shrink-0"
                                />
                                <PillInput 
                                  type="text"
                                  value={selectedBlock.properties?.borderColor || "transparent"}
                                  onChange={e => updateSelectedBlock({ borderColor: e.target.value })}
                                  className="w-full font-mono h-8 text-center text-[10px]"
                                  placeholder="transparent"
                                />
                              </div>
                            </div>

                            {selectedBlock.properties?.shapeType === "rect" && (
                              <div className="space-y-1">
                                <label className="text-[8px] font-semibold text-white/40 block flex justify-between">
                                  <span>มุมโค้งมน</span>
                                  <span className="text-nexus-teal font-mono">{selectedBlock.properties?.borderRadius || 0}px</span>
                                </label>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="40" 
                                  value={selectedBlock.properties?.borderRadius || 0} 
                                  onChange={e => updateSelectedBlock({ borderRadius: Number(e.target.value) })}
                                  className="w-full accent-nexus-teal cursor-pointer h-1.5 bg-black rounded-lg appearance-none"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* If type is Line, just allow color and height */}
                        {selectedBlock.properties?.shapeType === "line" && (
                          <div className="space-y-3 bg-surface-0/40 border border-white/5 rounded-xl p-3">
                            <label className="text-[9px] font-semibold text-nexus-teal uppercase block">สีของเส้นนอน:</label>
                            <input 
                              type="color" 
                              value={selectedBlock.properties?.backgroundColor || "#0d9488"} 
                              onChange={e => updateSelectedBlock({ backgroundColor: e.target.value })}
                              className="w-full h-8 rounded border border-white/10 bg-surface-2 p-1 cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* SECTION 4: ARRANGE PANEL (ALIGNMENT, ROTATION, FLIP, LAYERING) */}
                    <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-4">
                      <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">การจัดเรียง & จัดตำแหน่ง</h4>
                      
                      {/* Align to Page Center */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-semibold text-white/50 block">จัดกึ่งกลางหน้ากระดาษ</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={centerHorizontally}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                            title="จัดแนวตั้งกึ่งกลางซ้ายขวา"
                          >
                            แนวนอน
                          </button>
                          <button
                            onClick={centerVertically}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                            title="จัดแนวนอนกึ่งกลางบนล่าง"
                          >
                            แนวตั้ง
                          </button>
                          <button
                            onClick={centerBoth}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                            title="จัดกึ่งกลางทั้งหมด"
                          >
                            <Maximize2 size={10} /> ตรงกลาง
                          </button>
                        </div>
                      </div>

                      {/* Alignments (Align Left, Center H, Align Right, Align Top, Align Middle, Align Bottom) */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-semibold text-white/50 block">จัดตำแหน่งชิดขอบกระดาษ</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button onClick={() => alignBlock("left")} className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/10 text-white/70 hover:text-nexus-teal border border-white/5 transition-all text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-0.5"><AlignLeft size={10} /> ซ้าย</button>
                          <button onClick={() => alignBlock("center")} className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/10 text-white/70 hover:text-nexus-teal border border-white/5 transition-all text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-0.5"><AlignCenter size={10} /> กลาง</button>
                          <button onClick={() => alignBlock("right")} className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/10 text-white/70 hover:text-nexus-teal border border-white/5 transition-all text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-0.5"><AlignRight size={10} /> ขวา</button>
                          
                          <button onClick={() => alignVertically("top")} className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/10 text-white/70 hover:text-nexus-teal border border-white/5 transition-all text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-0.5">ขอบบน</button>
                          <button onClick={() => alignVertically("middle")} className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/10 text-white/70 hover:text-nexus-teal border border-white/5 transition-all text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-0.5">กลาง</button>
                          <button onClick={() => alignVertically("bottom")} className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/10 text-white/70 hover:text-nexus-teal border border-white/5 transition-all text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-0.5">ขอบล่าง</button>
                        </div>
                      </div>

                      {/* Z-order Layers Ordering */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-semibold text-white/50 block flex justify-between">
                          <span>ความลึกเลเยอร์</span>
                          <span className="text-nexus-teal font-mono">Z:{selectedBlock.properties?.zIndex || 1}</span>
                        </label>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={bringToFront}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black uppercase tracking-wider flex items-center justify-center"
                            title="ไว้หน้าสุด"
                          >
                            หน้าสุด
                          </button>
                          <button
                            onClick={moveLayerUp}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black uppercase tracking-wider flex items-center justify-center"
                            title="ขยับขึ้น Z+1"
                          >
                            <ArrowUp size={10} />
                          </button>
                          <button
                            onClick={moveLayerDown}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black uppercase tracking-wider flex items-center justify-center"
                            title="ขยับลง Z-1"
                          >
                            <ArrowDown size={10} />
                          </button>
                          <button
                            onClick={sendToBack}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black uppercase tracking-wider flex items-center justify-center"
                            title="ไว้หลังสุด"
                          >
                            หลังสุด
                          </button>
                        </div>
                      </div>

                      {/* Rotation & Flip */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-semibold text-white/50 block">การหมุนและการสะท้อน (Rotate & Flip)</label>
                        <div className="grid grid-cols-4 gap-1 mb-2">
                          <button
                            onClick={rotateCw}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black flex items-center justify-center transition-all"
                            title="หมุนตามเข็ม 90 องศา"
                          >
                            <RotateCw size={12} />
                          </button>
                          <button
                            onClick={rotateCcw}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black flex items-center justify-center transition-all"
                            title="หมุนทวนเข็ม 90 องศา"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button
                            onClick={flipHorizontal}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black flex items-center justify-center transition-all"
                            title="สะท้อนกลับแนวนอน"
                          >
                            <FlipHorizontal size={12} />
                          </button>
                          <button
                            onClick={flipVertical}
                            className="h-8 rounded bg-surface-2 hover:bg-nexus-teal/15 hover:text-nexus-teal border border-white/5 text-[9px] font-black flex items-center justify-center transition-all"
                            title="สะท้อนกลับแนวตั้ง"
                          >
                            <FlipVertical size={12} />
                          </button>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[8px] font-semibold text-white/40 block flex justify-between">
                            <span>องศาหมุนละเอียด</span>
                            <span className="text-nexus-teal font-mono">{selectedBlock.properties?.rotation || 0}°</span>
                          </label>
                          <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            value={selectedBlock.properties?.rotation || 0} 
                            onChange={e => updateSelectedBlock({ rotation: Number(e.target.value) })}
                            className="w-full accent-nexus-teal cursor-pointer h-1.5 bg-black rounded-lg appearance-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 5: CUSTOM BLOCK UNIQUE SETTINGS (QR, BARCODE, FORMS etc.) */}
                    {/* QR Code Unique settings */}
                    {selectedBlock.type === "QR_CODE" && (
                      <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">ค่าข้อมูล QR Code</h4>
                        <PillInput 
                          value={selectedBlock.properties?.qrValue || ""} 
                          onChange={e => updateSelectedBlock({ qrValue: e.target.value })}
                          className="w-full font-mono text-xs"
                          placeholder="เช่น {{doc.number}} หรือลิงก์..."
                        />
                      </div>
                    )}

                    {/* Barcode Unique settings */}
                    {selectedBlock.type === "BARCODE" && (
                      <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">รหัสบาร์โค้ด</h4>
                        <PillInput 
                          value={selectedBlock.content || ""} 
                          onChange={e => updateSelectedBlock({ content: e.target.value })}
                          className="w-full font-mono text-xs text-center"
                          placeholder="e.g. 123456789"
                        />
                      </div>
                    )}

                    {/* Business Icon selection unique settings */}
                    {selectedBlock.type === "ICON" && (
                      <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">เลือกไอคอนมาตรฐาน</h4>
                        <PillSelect 
                          value={selectedBlock.properties?.iconName || "Phone"} 
                          onChange={e => updateSelectedBlock({ iconName: e.target.value })}
                          className="w-full text-xs"
                        >
                          <option value="Phone">Phone (โทรศัพท์)</option>
                          <option value="Mail">Mail (อีเมล)</option>
                          <option value="Globe">Globe (เว็บไซต์)</option>
                          <option value="MapPin">MapPin (ที่อยู่)</option>
                          <option value="Shield">Shield (ความปลอดภัย)</option>
                          <option value="Calendar">Calendar (ปฏิทิน)</option>
                          <option value="Info">Info (ข้อมูล)</option>
                          <option value="Heart">Heart (ชื่นชอบ)</option>
                          <option value="Award">Award (รางวัล)</option>
                          <option value="FileSpreadsheet">FileSpreadsheet (เอกสาร)</option>
                        </PillSelect>
                      </div>
                    )}

                    {/* Form Field Elements unique settings */}
                    {selectedBlock.type === "FORM_FIELD" && (
                      <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">เครื่องมือฟอร์ม</h4>
                        <div className="space-y-2">
                          <label className="text-[9px] font-semibold text-white/50 block">ประเภทกล่องข้อมูล:</label>
                          <PillSelect 
                            value={selectedBlock.properties?.formFieldType || "checkbox"} 
                            onChange={e => updateSelectedBlock({ formFieldType: e.target.value as any })}
                            className="w-full text-xs"
                          >
                            <option value="checkbox">Checkbox (กล่องติ๊กถูก)</option>
                            <option value="radio">Radio Button (วงกลมเลือก)</option>
                            <option value="text_line">Write-in Blank Line (เส้นเขียนลายมือ)</option>
                          </PillSelect>
                        </div>
                        {(selectedBlock.properties?.formFieldType === "checkbox" || selectedBlock.properties?.formFieldType === "radio") && (
                          <PillCheckbox 
                            label="เปิดใช้ติ๊กเลือกเริ่มต้น" 
                            checked={selectedBlock.properties?.isChecked || false}
                            onChange={e => updateSelectedBlock({ isChecked: e.target.checked })}
                          />
                        )}
                        <div className="space-y-1">
                          <label className="text-[9px] font-semibold text-white/50 block">ข้อความกำกับ:</label>
                          <PillInput 
                            value={selectedBlock.content || ""} 
                            onChange={e => updateSelectedBlock({ content: e.target.value })}
                            className="w-full text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Image block Unique settings */}
                    {selectedBlock.type === "IMAGE" && (
                      <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">ลิงก์รูปภาพ</h4>
                        <PillInput 
                          value={selectedBlock.src || ""} 
                          onChange={e => updateSelectedBlock({ src: e.target.value })}
                          className="w-full font-mono text-xs"
                          placeholder="https://..."
                        />
                      </div>
                    )}

                    {/* Signature block Unique settings */}
                    {selectedBlock.type === "SIGNATURE" && (
                      <div className="bg-surface-1/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">กล่องลายมือชื่อ</h4>
                        <PillInput 
                          value={selectedBlock.content || ""} 
                          onChange={e => updateSelectedBlock({ content: e.target.value })}
                          className="w-full text-xs text-center"
                          placeholder="เช่น พยาน / ผู้รับพัสดุ"
                        />
                      </div>
                    )}

                    {/* Action buttons (Clone / Delete) */}
                    <div className="pt-6 border-t border-white/5 flex gap-3">
                      <PillButton variant="glass" className="flex-1 text-[11px] h-9 hover:text-nexus-teal hover:border-nexus-teal/20" onClick={() => duplicateBlock(selectedBlock)}>
                        <Copy size={12} /> โคลนบล็อก
                      </PillButton>
                      <PillButton variant="glass" className="flex-1 text-[11px] h-9 hover:text-red-400 hover:border-red-400/25" onClick={(e) => deleteBlock(selectedBlock.id, e)}>
                        <Trash2 size={12} /> ลบบล็อกนี้
                      </PillButton>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center text-white/20 uppercase font-semibold text-[11px] tracking-widest bg-white/[0.01] my-8 leading-relaxed">
                    โปรดเลือกบล็อกบนหน้ากระดาษ<br/>เพื่อเริ่มกำหนดคุณสมบัติโครงสร้าง
                  </div>
                )}
              </div>
            )}

            {/* ----------------- TAB: ELEMENTS ----------------- */}
            {activeTab === "elements" && (
              <div className="space-y-4">
                <h4 className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">เครื่องมือวาดเอกสาร & ฟอร์ม</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => addNewBlock("TEXT")} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-nexus-teal/10 hover:border-nexus-teal/30 hover:text-nexus-teal flex flex-col items-center justify-center gap-2 text-white/60 transition-all font-black text-xs uppercase tracking-wider">
                    <Type size={20} />
                    <span>กล่องข้อความ</span>
                  </button>
                  <button onClick={() => addNewBlock("FORM_FIELD")} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-nexus-teal/10 hover:border-nexus-teal/30 hover:text-nexus-teal flex flex-col items-center justify-center gap-2 text-white/60 transition-all font-black text-xs uppercase tracking-wider">
                    <CheckCircle2 size={20} />
                    <span>ช่องเลือกฟอร์ม</span>
                  </button>
                  <button onClick={() => addNewBlock("QR_CODE")} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-nexus-teal/10 hover:border-nexus-teal/30 hover:text-nexus-teal flex flex-col items-center justify-center gap-2 text-white/60 transition-all font-black text-xs uppercase tracking-wider">
                    <QrCode size={20} />
                    <span>QR Code</span>
                  </button>
                  <button onClick={() => addNewBlock("BARCODE")} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-nexus-teal/10 hover:border-nexus-teal/30 hover:text-nexus-teal flex flex-col items-center justify-center gap-2 text-white/60 transition-all font-black text-xs uppercase tracking-wider">
                    <Barcode size={20} />
                    <span>Barcode</span>
                  </button>
                  <button onClick={() => addNewBlock("ICON")} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-nexus-teal/10 hover:border-nexus-teal/30 hover:text-nexus-teal flex flex-col items-center justify-center gap-2 text-white/60 transition-all font-black text-xs uppercase tracking-wider">
                    <Phone size={20} />
                    <span>ไอคอนระบบ</span>
                  </button>
                  <button onClick={() => addNewBlock("SHAPE")} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-nexus-teal/10 hover:border-nexus-teal/30 hover:text-nexus-teal flex flex-col items-center justify-center gap-2 text-white/60 transition-all font-black text-xs uppercase tracking-wider">
                    <Minus size={20} />
                    <span>เส้นและรูปทรง</span>
                  </button>
                  <button onClick={() => addNewBlock("DYNAMIC_TABLE")} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-nexus-teal/10 hover:border-nexus-teal/30 hover:text-nexus-teal flex flex-col items-center justify-center gap-2 text-white/60 transition-all font-black text-xs uppercase tracking-wider col-span-2">
                    <TableIcon size={20} />
                    <span>ตารางข้อมูลพัสดุ</span>
                  </button>
                  <button onClick={() => addNewBlock("SIGNATURE")} className="h-24 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-nexus-teal/10 hover:border-nexus-teal/30 hover:text-nexus-teal flex flex-col items-center justify-center gap-2 text-white/60 transition-all font-black text-xs uppercase tracking-wider col-span-2">
                    <FileText size={20} />
                    <span>กล่องลงลายมือชื่อพยาน / ผู้ส่ง</span>
                  </button>
                </div>
              </div>
            )}

            {/* ----------------- TAB: PAGE-SETUP ----------------- */}
            {activeTab === "page-setup" && (
              <div className="space-y-6">
                <h4 className="text-[11px] font-semibold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2">ตั้งค่าขนาดหน้ากระดาษ</h4>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-white/40 uppercase block">ขนาดกระดาษมาตรฐาน:</label>
                    <PillSelect 
                      value={template.globalStyles.pageSize} 
                      onChange={e => setTemplate(prev => ({
                        ...prev,
                        globalStyles: { ...prev.globalStyles, pageSize: e.target.value as any }
                      }))}
                      className="w-full"
                    >
                      <option value="A4">A4 (210x297mm)</option>
                      <option value="A5">A5 (148x210mm)</option>
                      <option value="Letter">Letter (8.5x11")</option>
                      <option value="Legal">Legal (8.5x14")</option>
                    </PillSelect>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-white/40 uppercase block">การเว้นระยะขอบกระดาษ:</label>
                    <PillSelect 
                      value={template.globalStyles.margin} 
                      onChange={e => setTemplate(prev => ({
                        ...prev,
                        globalStyles: { ...prev.globalStyles, margin: e.target.value as any }
                      }))}
                      className="w-full"
                    >
                      <option value="normal">Normal (ปกติ 40px)</option>
                      <option value="narrow">Narrow (แคบ 20px)</option>
                      <option value="wide">Wide (กว้าง 60px)</option>
                    </PillSelect>
                  </div>

                  {/* Watermark Diagonal text background page selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-white/40 uppercase block">ลายน้ำป้องกันกระดาษ:</label>
                    <PillSelect 
                      value={template.globalStyles.watermark || "NONE"} 
                      onChange={e => setTemplate(prev => ({
                        ...prev,
                        globalStyles: { ...prev.globalStyles, watermark: e.target.value as any }
                      }))}
                      className="w-full"
                    >
                      <option value="NONE">NONE (ไม่มีลายน้ำ)</option>
                      <option value="DRAFT">DRAFT (ฉบับร่าง)</option>
                      <option value="CONFIDENTIAL">CONFIDENTIAL (ลับเฉพาะ)</option>
                      <option value="PAID">PAID (ชำระเงินแล้ว)</option>
                      <option value="ORIGINAL">ORIGINAL (ต้นฉบับ)</option>
                    </PillSelect>
                  </div>
                </div>

                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 space-y-2">
                  <h5 className="text-[10px] font-semibold text-nexus-teal uppercase tracking-widest flex items-center gap-1.5">
                    <Info size={12} />
                    <span>คำแนะนำสัญวิทยา</span>
                  </h5>
                  <p className="text-[10px] text-white/40 leading-relaxed font-bold">
                    ลายน้ำที่เลือกจะถูกพิมพ์และแสดงผลในระดับแนวทแยงมุม 45 องศาใต้เลเยอร์บล็อกข้อมูล เพื่อรักษาความถูกต้องตามพิกัดโครงสร้างรายงานสากล
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* -------------------------------------------------------------
            CENTER ACTIVE CANVAS PAPER
            ------------------------------------------------------------- */}
        <main 
          className="flex-1 bg-surface-1 overflow-auto p-12 flex justify-center custom-scrollbar relative"
        >
          <div 
            ref={showPreview ? null : canvasRef}
            style={{ width: paper.width, height: paper.height }}
            className="bg-white shadow-2xl relative flex-shrink-0 cursor-crosshair border border-black/10 transition-all duration-300"
            onClick={() => setSelectedBlockId(null)}
          >
            {/* 1. Diagonal faint printed Page Watermark diagonal under layout elements */}
            {template.globalStyles.watermark && template.globalStyles.watermark !== "NONE" && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
                <div className="text-[100px] font-semibold text-black/[0.03] uppercase tracking-widest rotate-[-45deg] select-none">
                  {template.globalStyles.watermark}
                </div>
              </div>
            )}

            {/* 2. Canvas Dot grid alignments overlay */}
            {showGrid && (
              <div 
                className="absolute inset-0 pointer-events-none opacity-[0.06] z-[1]" 
                style={{ 
                  backgroundImage: "radial-gradient(#000 1.2px, transparent 1.2px)", 
                  backgroundSize: "20px 20px" 
                }} 
              />
            )}

            {/* 3. Render Canvas Positioned Custom Blocks */}
            {template.blocks.map(block => {
              const isSelected = selectedBlockId === block.id;
              const properties = block.properties || {};
              const finalH = block.position.h || 40;
              
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
                  key={block.id}
                  onMouseDown={(e) => handleMouseDown(e, block.id)}
                  className={`absolute group select-none transition-all duration-75 flex flex-col justify-start ${isSelected ? "ring-2 ring-nexus-teal ring-offset-2 shadow-[0_0_20px_rgba(0,255,209,0.2)]" : "hover:ring-1 hover:ring-black/20"}`}
                  style={{
                    left: block.position.x,
                    top: block.position.y,
                    width: block.position.w,
                    height: finalH,
                    transform: `rotate(${properties.rotation || 0}deg) scale(${properties.scaleX || 1}, ${properties.scaleY || 1})`,
                    opacity: (properties.opacity ?? 100) / 100,
                    zIndex: properties.zIndex || 1,
                    backgroundColor: block.type === "SHAPE" ? (shapeType === "line" ? "transparent" : properties.backgroundColor) : (properties.backgroundColor || "transparent"),
                    color: properties.textColor || "#1f2937",
                    padding: `${properties.padding || 0}px`,
                    border: block.type === "SHAPE" && shapeType === "line" ? "none" : `${properties.borderWidth || 0}px ${properties.borderStyle || "solid"} ${properties.borderColor || "transparent"}`,
                    borderRadius: `${properties.borderRadius || 0}px`,
                    textAlign: properties.textAlign || "left",
                    fontFamily: properties.fontFamily || (template.globalStyles.fontFamily === "mono" ? "monospace" : "inherit"),
                    fontSize: `${properties.fontSize || 12}px`,
                    fontWeight: properties.fontWeight || "normal",
                    fontStyle: properties.fontStyle || "normal",
                    textDecoration: properties.textDecoration || "none",
                    lineHeight: properties.lineHeight ? `${properties.lineHeight}em` : "normal",
                    letterSpacing: properties.letterSpacing ? `${properties.letterSpacing}px` : "normal",
                    cursor: "move",
                    overflow: "hidden",
                    ...shapeStyles
                  }}
                >
                  {/* Faint Grid Dots Alignment Indicator (rendered on Canvas when selected) */}
                  {isSelected && (
                    <div className="absolute -top-4 left-0 bg-surface-1 border border-nexus-teal/40 text-[9px] font-black text-nexus-teal px-2 py-0.5 rounded-full select-none pointer-events-none shadow-neon-teal leading-none">
                      X:{block.position.x} Y:{block.position.y}
                    </div>
                  )}

                  {/* Duplicate and Delete floating quick canvas buttons */}
                  <div 
                    className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button 
                      onClick={(e) => duplicateBlock(block, e)} 
                      className="w-5 h-5 rounded bg-black/80 hover:bg-nexus-teal hover:text-black border border-white/10 text-white flex items-center justify-center transition-all"
                      title="โคลนบล็อก"
                    >
                      <Copy size={10} />
                    </button>
                    <button 
                      onClick={(e) => deleteBlock(block.id, e)} 
                      className="w-5 h-5 rounded bg-black/80 hover:bg-red-500 border border-white/10 text-white flex items-center justify-center transition-all"
                      title="ลบบล็อก"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>

                  {/* Render Inner Block Elements */}
                  <div className="w-full h-full relative overflow-hidden">
                    {renderBlockContent(block, false)}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* -------------------------------------------------------------
          MODAL: REAL PREVIEW REALISTIC THAI MOCK MODAL
          ------------------------------------------------------------- */}
      {showPreview && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-full h-full max-w-[900px] flex flex-col bg-surface-1 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between flex-shrink-0 bg-surface-0">
              <div className="flex items-center gap-3">
                <Eye size={18} className="text-nexus-teal animate-pulse" />
                <div>
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">โหมดจำลองเอกสารจริง</h3>
                  <p className="text-[10px] text-white/30 uppercase mt-0.5 tracking-widest leading-none font-bold">Injecting real-world variable mock data</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <PillButton 
                  variant="primary" 
                  className="h-8 px-4 text-black text-[11px] font-black uppercase rounded-full shadow-neon-teal"
                  onClick={() => {
                    window.print();
                  }}
                >
                  <Send size={12} /> สั่งพิมพ์เอกสาร
                </PillButton>
                
                <PillButton 
                  variant="glass" 
                  className="h-8 px-4 text-[11px] font-black uppercase rounded-full"
                  onClick={() => setShowPreview(false)}
                >
                  ปิดหน้ารายงาน
                </PillButton>
              </div>
            </div>

            {/* Simulated Canvas A4 sheet area */}
            <div className="flex-1 overflow-y-auto p-12 flex justify-center bg-surface-1 custom-scrollbar">
              <div 
                ref={showPreview ? canvasRef : null}
                style={{ width: paper.width, height: paper.height }}
                className="bg-white shadow-2xl relative flex-shrink-0 border border-black/10 overflow-hidden select-none print:shadow-none print:border-none"
                onClick={() => setSelectedBlockId(null)}
              >
                {/* 1. Diagonal Watermark diagonal in preview */}
                {template.globalStyles.watermark && template.globalStyles.watermark !== "NONE" && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
                    <div className="text-[100px] font-semibold text-black/[0.03] uppercase tracking-widest rotate-[-45deg] select-none">
                      {template.globalStyles.watermark}
                    </div>
                  </div>
                )}

                {/* 2. Block Renders with dynamic replaced values */}
                {template.blocks.map(block => {
                  const isSelected = selectedBlockId === block.id;
                  const properties = block.properties || {};
                  const finalH = block.position.h || 40;
                  
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
                      key={block.id}
                      onMouseDown={(e) => handleMouseDown(e, block.id)}
                      className={`absolute group select-none transition-all duration-75 flex flex-col justify-start cursor-move border border-transparent ${isSelected ? "ring-2 ring-nexus-teal ring-offset-2 shadow-[0_0_20px_rgba(0,255,209,0.2)]" : "hover:ring-1 hover:ring-nexus-teal/30"}`}
                      style={{
                        left: block.position.x,
                        top: block.position.y,
                        width: block.position.w,
                        height: finalH,
                        transform: `rotate(${properties.rotation || 0}deg) scale(${properties.scaleX || 1}, ${properties.scaleY || 1})`,
                        opacity: (properties.opacity ?? 100) / 100,
                        zIndex: properties.zIndex || 1,
                        backgroundColor: block.type === "SHAPE" ? (shapeType === "line" ? "transparent" : properties.backgroundColor) : (properties.backgroundColor || "transparent"),
                        color: properties.textColor || "#1f2937",
                        padding: `${properties.padding || 0}px`,
                        border: block.type === "SHAPE" && shapeType === "line" ? "none" : `${properties.borderWidth || 0}px ${properties.borderStyle || "solid"} ${properties.borderColor || "transparent"}`,
                        borderRadius: `${properties.borderRadius || 0}px`,
                        textAlign: properties.textAlign || "left",
                        fontFamily: properties.fontFamily || (template.globalStyles.fontFamily === "mono" ? "monospace" : "inherit"),
                        fontSize: `${properties.fontSize || 12}px`,
                        fontWeight: properties.fontWeight || "normal",
                        fontStyle: properties.fontStyle || "normal",
                        textDecoration: properties.textDecoration || "none",
                        lineHeight: properties.lineHeight ? `${properties.lineHeight}em` : "normal",
                        letterSpacing: properties.letterSpacing ? `${properties.letterSpacing}px` : "normal",
                        ...shapeStyles
                      }}
                    >
                      <div className="w-full h-full relative overflow-hidden">
                        {renderBlockContent(block, true)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating System toast */}
      {toast.isVisible && (
        <div className="fixed bottom-6 right-6 z-[8000] animate-in slide-in-from-bottom duration-300">
          <div className={`px-6 py-3.5 rounded-full border shadow-2xl flex items-center gap-3 backdrop-blur-2xl ${toast.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-nexus-teal/10 border-nexus-teal/20 text-nexus-teal"}`}>
            <div className={`w-2 h-2 rounded-full ${toast.type === "error" ? "bg-red-400" : "bg-nexus-teal"} animate-ping`} />
            <span className="text-xs font-semibold uppercase tracking-widest">{toast.message}</span>
            <button className="text-[10px] uppercase font-semibold tracking-widest pl-3 border-l border-white/10 hover:text-white" onClick={() => setToast(prev => ({ ...prev, isVisible: false }))}>ปิด</button>
          </div>
        </div>
      )}
    </div>
  );
}
