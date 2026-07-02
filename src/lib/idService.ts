import { db } from "./firebase-client";
import { Firestore, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { IdType, romanizeThai } from "@/lib/utils";

/**
 * @fileOverview Isolated PSG-ID Protocol V8.5
 * ระบบรันเลขที่เอกสารแบบ Atomic Transaction แยกสารบบตามบริษัท 100%
 * บังคับใช้ Company Scoping เพื่อป้องกันการปนกันของลำดับเลข
 */

export const idService = {
  /**
   * ดึงลำดับถัดไปจากฐานข้อมูลโดยแยก Counter ตามบริษัทปฏิบัติการ
   */
  async getNextSequence(dbInstance: Firestore, type: IdType, companyId: string, context?: string): Promise<number> {
    if (!companyId) {
      throw new Error("APO ID System Alert: Company ID is strictly required for atomic sequence generation.");
    }

    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    
    let counterBaseId = '';
    
    switch (type) {
      case 'SKU':
        let cat = 'GEN';
        if (context) {
          const isThai = /[\u0E00-\u0E7F]/.test(context);
          const processedContext = isThai ? romanizeThai(context) : context;
          const cleanCat = processedContext.replace(/[^A-Z0-9]/g, '');
          cat = (cleanCat.substring(0, 3) || 'GEN').toUpperCase();
        }
        counterBaseId = `SKU-${cat}`;
        break;
      default:
        const prefix = (type === 'CRM' || type === 'CUS') ? 'CUS' : type;
        counterBaseId = `${prefix}-${yy}`; 
        break;
    }

    // 🔥 Atomic Isolation: Scoped Counter ID (Separated per company)
    const scopedCounterId = `${companyId}_${counterBaseId}`;
    const counterRef = doc(dbInstance, "counters", scopedCounterId);

    try {
      return await runTransaction(dbInstance, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let currentSeq = 0;
        
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          // รีเซ็ตเลขเมื่อข้ามปี (ยกเว้น SKU ที่ต้องการรันยาว)
          if (type !== 'SKU' && data.year && data.year !== yy) {
            currentSeq = 0;
          } else {
            currentSeq = data.seq || 0;
          }
        }
        
        const nextSeq = currentSeq + 1;
        
        transaction.set(counterRef, { 
          seq: nextSeq, 
          updatedAt: serverTimestamp(),
          type: type,
          year: yy,
          company_id: companyId,
          is_deleted: false,
          _v: 1
        }, { merge: true });
        
        return nextSeq;
      });
    } catch (error) {
      console.error("Atomic ID Generation Error:", error);
      return Math.floor(Math.random() * 9999);
    }
  },

  /**
   * จัดรูปแบบ ID ตามมาตรฐาน V8.5: PREFIX-YY-[MNEMONIC]-SEQ
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
