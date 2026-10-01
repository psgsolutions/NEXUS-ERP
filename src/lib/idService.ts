import { auth } from "./firebase-client";
import { IdType, romanizeThai } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

/**
 * @fileOverview Configurable Numbering Engine Client Bridge V9.0
 * ระบบสนับสนุนการรันเลขที่เอกสารผ่าน Configurable Numbering Engine
 */

export const idService = {
  /**
   * เรียก API Server Route สำหรับออกเลขเอกสารที่เป็น Atomic Transaction
   */
  async generateDocumentNumber(type: string, companyId: string, contextOpts?: { mnemonic?: string; brandCode?: string; categoryCode?: string }): Promise<{ documentNumber: string; counterId: string }> {
    if (!companyId) {
      throw new Error("Company ID is required for generating document numbers.");
    }

    try {
      const res = await apiFetch(`/api/documents/${type}/generate-number`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, contextOpts }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate number (status ${res.status})`);
      }

      const data = await res.json();
      return {
        documentNumber: data.documentNumber,
        counterId: data.counterId,
      };
    } catch (err) {
      // ห้ามสุ่มเลขแทน: เลขเอกสารต้องไม่ซ้ำและตรวจสอบย้อนหลังได้ ให้ผู้เรียกแจ้งผู้ใช้แล้วลองใหม่
      console.error(`Error calling generateDocumentNumber API for ${type}:`, err);
      throw err;
    }
  },

  /**
   * Counter document ID (คงรูปแบบเดิม `${companyId}_${counterBaseId}` เพื่อให้ต่อเลขจาก counter ที่มีอยู่แล้ว)
   * SKU แยกตามหมวดและไม่รีเซ็ตรายปี, เอกสารอื่นแยกตามปี
   */
  counterId(type: IdType, companyId: string, context?: string): string {
    const yy = new Date().getFullYear().toString().slice(-2);

    if (type === 'SKU') {
      let cat = 'GEN';
      if (context) {
        const isThai = /[\u0E00-\u0E7F]/.test(context);
        const processedContext = isThai ? romanizeThai(context) : context;
        const cleanCat = processedContext.replace(/[^A-Z0-9]/g, '');
        cat = (cleanCat.substring(0, 3) || 'GEN').toUpperCase();
      }
      return `${companyId}_SKU-${cat}`;
    }

    const prefix = (type === 'CRM' || type === 'CUS') ? 'CUS' : type;
    return `${companyId}_${prefix}-${yy}`;
  },

  /**
   * ขอลำดับถัดไปจาก server (POST /api/sequence/next)
   * collection `counters` ถูกล็อกไม่ให้ client เขียน ฝั่ง server ให้ใช้ nextCounterSequence() จาก sequence-server.ts
   */
  async getNextSequence(type: IdType, companyId: string, context?: string): Promise<number> {
    if (!companyId) {
      throw new Error("APO ID System Alert: Company ID is strictly required for atomic sequence generation.");
    }

    const res = await apiFetch("/api/sequence/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, type, context }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.sequence !== "number") {
      // ห้ามสุ่มเลขแทน: เลขที่ไม่ได้บันทึกใน counter จะชนกับเลขจริงในภายหลัง
      throw new Error(data.error || `ออกเลขเอกสารไม่สำเร็จ (status ${res.status})`);
    }
    return data.sequence;
  },

  /**
   * จัดรูปแบบ ID ตามมาตรฐาน V9.0
   */
  formatId(type: IdType, sequence: number, context?: string): string {
    const yy = new Date().getFullYear().toString().slice(-2);
    
    const getMnemonic = (val: string) => {
      const isThai = /[\u0E00-\u0E7F]/.test(val);
      const processed = isThai ? romanizeThai(val) : val;
      const clean = processed.replace(/[^A-Z0-9]/g, '');
      return (clean.substring(0, 3) || 'GEN').toUpperCase();
    };

    switch (type) {
      case 'PRJ':
        const prjMnemonic = context ? getMnemonic(context) : 'GEN';
        return `PRJ-${yy}-${prjMnemonic}-${sequence.toString().padStart(4, '0')}`;

      case 'SKU':
        const catMnemonic = context ? getMnemonic(context) : 'GEN';
        return `SKU-${catMnemonic}-${sequence.toString().padStart(5, '0')}`;

      case 'COMP':
        return `COMP-${yy}-${sequence.toString().padStart(4, '0')}`;

      case 'CUS': case 'CRM': case 'SUP': case 'SUB': case 'WHS':
        const prefix = type === 'CRM' ? 'CUS' : type;
        return `${prefix}-${yy}-${sequence.toString().padStart(4, '0')}`;

      default:
        return `${type}-${yy}-${sequence.toString().padStart(4, '0')}`;
    }
  }
};
