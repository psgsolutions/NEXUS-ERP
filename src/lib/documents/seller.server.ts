import { adminDb } from "@/lib/firebase-admin";
import { documentProfileOf } from "./profile";
import type { DocumentProfile } from "./model";

/**
 * ข้อมูลผู้ขาย ณ วันที่ออกเอกสารภาษี (ม.86/4: ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขา)
 * เก็บไว้บนเอกสาร เพื่อให้พิมพ์ซ้ำภายหลังได้ข้อมูลเดิมแม้บริษัทย้ายที่อยู่ — ไม่เก็บโลโก้ (ใช้ของปัจจุบัน)
 */
export async function sellerSnapshot(companyId: string): Promise<Omit<DocumentProfile, "logo">> {
  const { logo: _logo, ...p } = documentProfileOf((await adminDb.doc(`companies/${companyId}`).get()).data());
  void _logo;
  return p;
}

/** รวมข้อมูลผู้ขายที่บันทึกไว้บนเอกสารกับหน้าตาปัจจุบัน (โลโก้ สี ข้อความท้าย) */
export function mergeSeller(current: DocumentProfile, snapshot: any): DocumentProfile {
  if (!snapshot || typeof snapshot !== "object") return current;
  return {
    ...current,
    name: snapshot.name || current.name,
    nameEn: snapshot.nameEn || current.nameEn,
    address: snapshot.address || current.address,
    taxId: snapshot.taxId || current.taxId,
    branchCode: snapshot.branchCode || current.branchCode,
    branchName: snapshot.branchName ?? current.branchName,
    phone: snapshot.phone || current.phone,
    email: snapshot.email || current.email,
  };
}
