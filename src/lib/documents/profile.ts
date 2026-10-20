import type { DocumentProfile } from "./model";
import { normalizeDesign } from "./design";

/**
 * ข้อมูลหัวเอกสารของบริษัท: ฟิลด์หลักอยู่บน companies/{id} (name, address, taxId, branchCode ...)
 * ส่วนหน้าตา (โลโก้ สี ข้อความท้าย) อยู่ที่ companies/{id}.documentProfile
 * ไม่เติมค่าปลอม — ฟิลด์ที่ไม่มีจะเว้นว่าง และหน้าตั้งค่าจะเตือนให้กรอก
 */
export function documentProfileOf(company: Record<string, any> | null | undefined): DocumentProfile {
  const c = company || {};
  const p = c.documentProfile || {};
  const s = (v: any) => String(v ?? "").trim();
  const brandColor = /^#[0-9a-fA-F]{6}$/.test(s(p.brandColor)) ? s(p.brandColor) : "#1f6f5c";
  return {
    name: s(c.name || c.companyName),
    nameEn: s(p.nameEn || c.nameEn),
    address: s(c.address),
    taxId: s(c.taxId).replace(/\D/g, ""),
    branchCode: s(c.branchCode) || "00000",
    branchName: s(c.branchName),
    phone: s(c.phone),
    email: s(c.email),
    website: s(c.website),
    logo: /^data:image\/(png|jpeg);base64,/.test(s(p.logo)) ? s(p.logo) : "",
    brandColor,
    footerNote: s(p.footerNote),
    paymentInfo: s(p.paymentInfo),
    design: normalizeDesign(c.documentDesign, brandColor),
  };
}

/** ฟิลด์ที่ต้องมีบนเอกสารภาษี (ม.86/4) แต่ยังไม่ได้กรอก */
export function missingTaxFields(p: DocumentProfile): string[] {
  const miss: string[] = [];
  if (!p.name) miss.push("ชื่อบริษัท");
  if (!p.address) miss.push("ที่อยู่");
  if (p.taxId.length !== 13) miss.push("เลขประจำตัวผู้เสียภาษี 13 หลัก");
  return miss;
}
