import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * อาโป: โครงสร้าง Query ข้อมูลรายงานสำหรับ NEXUS ERP
 * ยึดหลัก Multi-Tenancy: บังคับใส่ companyId เสมอ
 */
export const getReportData = async (
  collectionName: string,
  startDate: Date,
  endDate: Date,
  currentCompanyId: string
) => {
  const q = query(
    collection(db, collectionName),
    where('companyId', '==', currentCompanyId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate))
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
