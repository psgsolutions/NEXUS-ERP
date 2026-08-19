import { db } from "@/lib/firebase-client";
import { collection, getDocs, query, where, addDoc, doc, updateDoc } from "firebase/firestore";

export interface SubcontractorRate {
  id?: string;
  companyId: string;
  subcontractorId: string;
  subcontractorName: string;
  serviceType: string;         // เช่น "INSTALLATION_LAN", "CCTV_SETUP"
  ratePerUnit: number;         // เรตราคาต่อหน่วย
  unit: string;                // เช่น "จุด", "เครื่อง", "เมตร"
  isDeleted: boolean;
}

export const SubcontractorService = {
  async getRatesByCompany(companyId: string) {
    if (!companyId) throw new Error("[Tenant Isolation Violation] companyId is required!");
    
    const q = query(
      collection(db, `companies/${companyId}/subcontractor_rates`),
      where("companyId", "==", companyId),
      where("isDeleted", "==", false)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SubcontractorRate[];
  },
};
