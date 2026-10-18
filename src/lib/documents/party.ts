/**
 * ข้อมูลคู่ค้า (ผู้ขาย/ผู้รับเหมา/พนักงาน) สำหรับเก็บไว้บนเอกสาร ณ วันที่ออก — ใช้ได้ทั้ง client และ server
 */

export interface PartySnapshot {
  name: string;
  taxId: string;
  branchCode: string;
  address: string;
  /** นิติบุคคล (ยื่น ภ.ง.ด.53) */
  corporate: boolean;
}

const str = (v: any) => String(v ?? "").trim();

/** ที่อยู่เป็นข้อความเดียว จากช่องที่อยู่แบบแยก (ฟอร์มผู้ขาย/ลูกค้า) หรือข้อความเดิม */
export function addressText(r: any): string {
  if (!r) return "";
  const parts = [
    r.address_detail || r.addressNo,
    r.building,
    r.soi && `ซอย ${r.soi}`,
    r.road && `ถนน ${r.road}`,
    r.subDistrict && `${/กรุงเทพ/.test(r.province || "") ? "แขวง" : "ตำบล"}${r.subDistrict}`,
    r.district && `${/กรุงเทพ/.test(r.province || "") ? "เขต" : "อำเภอ"}${r.district}`,
    r.province && (/กรุงเทพ/.test(r.province) ? r.province : `จังหวัด${r.province}`),
    r.zipCode,
  ].map(str).filter(Boolean);
  const composed = parts.join(" ");
  const plain = typeof r.address === "string" ? str(r.address) : "";
  return plain.length >= composed.length ? plain : composed;
}

/**
 * นิติบุคคล = เลขผู้เสียภาษีขึ้นต้นด้วย 0 (กรมสรรพากรออกให้นิติบุคคล) หรือระบุประเภทเป็นบริษัท
 * บุคคลธรรมดา (เลขบัตรประชาชน) ยื่น ภ.ง.ด.3
 */
export function isCorporate(taxId: any, kind?: any): boolean {
  const t = String(taxId ?? "").replace(/\D/g, "");
  if (t.length === 13) return t.startsWith("0");
  const k = String(kind ?? "").toUpperCase();
  return k === "CORPORATE" || k === "COMPANY";
}

export function partySnapshot(rec: any, fallback: { name?: string; taxId?: string } = {}): PartySnapshot {
  const r = rec || {};
  const taxId = str(r.taxId || r.tax_id || fallback.taxId).replace(/\D/g, "");
  return {
    name: str(r.legalName || r.name || r.supplierName || fallback.name),
    taxId,
    branchCode: str(r.branchCode || r.branch_code),
    address: addressText(r),
    corporate: isCorporate(taxId, r.vendorType || r.contractor_type || r.entity_category),
  };
}
