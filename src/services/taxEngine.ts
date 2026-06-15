import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { JournalEntry } from "@/types/database";

export const TaxEngine = {
  /**
   * Generates VAT Register (Output VAT and Input VAT) for a specific period
   * (รายงานภาษีซื้อ - ภาษีขาย ภ.พ.30)
   */
  async generateVatRegister(companyId: string, startDate: Date, endDate: Date) {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const q = query(
      collection(db, "journal_entries"),
      where("companyId", "==", companyId),
      where("isOfficialTax", "==", true),
      where("date", ">=", startTimestamp),
      where("date", "<=", endTimestamp)
    );

    const snapshot = await getDocs(q);
    const inputVatTransactions = [];
    const outputVatTransactions = [];
    let totalInputVat = 0;
    let totalOutputVat = 0;

    snapshot.forEach((doc) => {
      const data = doc.data() as JournalEntry;
      if (data.status === 'posted') {
        const inputLine = data.lines?.find(l => l.accountId === '1151-00') || data.items?.find((i: any) => i.accountCode === '1151-00');
        if (inputLine && (inputLine.debit > 0)) {
          inputVatTransactions.push(data);
          totalInputVat += inputLine.debit;
        }

        const outputLine = data.lines?.find(l => l.accountId === '2121-00') || data.items?.find((i: any) => i.accountCode === '2121-00');
        if (outputLine && (outputLine.credit > 0)) {
          outputVatTransactions.push(data);
          totalOutputVat += outputLine.credit;
        }
      }
    });

    return {
      inputVatTransactions,
      outputVatTransactions,
      totalInputVat,
      totalOutputVat,
      netVatPayable: totalOutputVat - totalInputVat
    };
  },

  /**
   * Generates WHT Register for a specific period (ภ.ง.ด. 3/53)
   */
  async generateWhtRegister(companyId: string, startDate: Date, endDate: Date) {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const q = query(
      collection(db, "wht_certificates"),
      where("companyId", "==", companyId),
      where("createdAt", ">=", startTimestamp),
      where("createdAt", "<=", endTimestamp)
    );

    const snapshot = await getDocs(q);
    const certificates: any[] = [];
    let totalWhtAmount = 0;
    let totalBaseAmount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status === 'active') {
        certificates.push(data);
        totalWhtAmount += data.whtAmount || 0;
        totalBaseAmount += data.baseAmount || 0;
      }
    });

    return {
      certificates,
      totalWhtAmount,
      totalBaseAmount
    };
  }
};
