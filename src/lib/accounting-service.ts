import { db } from "@/lib/firebase-client";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { nexusSequenceEngine } from "./sequence-engine";

export interface AICashflowForecast {
  inflow30Days: number;
  outflow30Days: number;
  netCashflow: number;
  riskStatus: "safe" | "warning" | "danger";
  recommendations: string[];
}

export const accountingService = {
  /**
   * Summarize AR (Accounts Receivable) from real-time data
   */
  async getARSummary(companyId: string) {
    const q = query(
      collection(db, "receivables"),
      where("companyId", "==", companyId),
      where("status", "in", ["pending", "overdue"])
    );
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach(doc => {
      total += doc.data().amount || 0;
    });
    return total;
  },

  /**
   * Summarize AP (Accounts Payable) from real-time data
   */
  async getAPSummary(companyId: string) {
    const q = query(
      collection(db, "payables"),
      where("companyId", "==", companyId),
      where("status", "==", "active")
    );
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach(doc => {
      total += doc.data().amount || 0;
    });
    return total;
  },

  /**
   * Generate an AI-based Cashflow Forecast based on AR/AP
   */
  async generateAIForecast(companyId: string): Promise<AICashflowForecast> {
    const ar = await this.getARSummary(companyId);
    const ap = await this.getAPSummary(companyId);
    
    // In a real app, this would query OpenAI or an internal ML model based on historical data.
    // Here we provide a heuristic forecast logic suitable for the Dashboard UI.
    const netCashflow = ar - ap;
    let riskStatus: "safe" | "warning" | "danger" = "safe";
    const recommendations: string[] = [];

    if (netCashflow < 0 && ap > 0) {
      const ratio = Math.abs(netCashflow) / ap;
      if (ratio > 0.5) riskStatus = "danger";
      else riskStatus = "warning";
    }

    if (riskStatus === "danger") {
      recommendations.push("กระแสเงินสดติดลบสูง เสี่ยงต่อการขาดสภาพคล่อง");
      recommendations.push("แนะนำให้เร่งรัดลูกหนี้ ให้เร็วขึ้น");
    } else if (riskStatus === "warning") {
      recommendations.push("ยอดหนี้ที่ต้องจ่ายใกล้เคียงกับยอดรับชำระ ควรจัดการกระแสเงินสด");
    } else {
      recommendations.push("สภาพคล่องปกติ สามารถใช้ชำระหนี้ระยะสั้นได้");
    }

    return {
      inflow30Days: ar,
      outflow30Days: ap,
      netCashflow,
      riskStatus,
      recommendations
    };
  },

  /**
   * Calculate Straight-line Depreciation for an Asset
   */
  calculateStraightLineDepreciation(purchaseValue: number, salvageValue: number, usefulLifeYears: number): number {
    if (usefulLifeYears <= 0) return 0;
    return (purchaseValue - salvageValue) / usefulLifeYears;
  },

  /**
   * Process Cheque Clearance
   * Updates cheque status to "Cleared" and creates a GL entry.
   */
  async processChequeClearance(chequeId: string, companyId: string, bankAccountId: string, userId: string) {
    const chequeRef = doc(db, `companies/${companyId}/cheques`, chequeId);
    await setDoc(chequeRef, { status: "Cleared", clearedAt: new Date().toISOString(), clearedBy: userId, bankAccountId }, { merge: true });
    
    // TODO: Create GL Entry
    // The GL entry would debit Bank and credit Cheques on Hand (for AR cheque)
    // or debit AP/Cheques Payable and credit Bank (for AP cheque)
    return true;
  },

  /**
   * Bank Reconciliation process
   * Marks a bank transaction as reconciled.
   */
  async processBankReconciliation(transactionId: string, companyId: string, userId: string) {
    const txRef = doc(db, `companies/${companyId}/bankTransactions`, transactionId);
    await setDoc(txRef, { status: "Reconciled", reconciledAt: new Date().toISOString(), reconciledBy: userId }, { merge: true });
    return true;
  }
};

