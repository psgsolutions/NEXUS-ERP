import { adminDb } from "@/lib/firebase-admin";
import type { DocumentModel } from "./model";
import { DESIGNABLE_DOCS } from "./build";
import { applySigning, normalizeSigning, type SigningConfig } from "./esign";

/**
 * ตั้งค่าลายเซ็น/ตราประทับของบริษัท (อ่านด้วยสิทธิ์ server)
 * - companies/{id}/document_assets/signing: ตรา ขนาดตรา ช่องลงนาม และรายชื่อผู้ลงนาม (ไม่มีรูป)
 * - companies/{id}/document_assets/signer_{รหัสผู้ลงนาม}: รูปลายเซ็นของแต่ละคน (แยกเอกสาร — เอกสารเดียวเก็บได้ไม่เกิน 1 MB)
 * ลายเซ็นรุ่นเก่าที่เก็บรูปในเอกสารรวมยังใช้ได้ (ย้ายออกเมื่อแก้ครั้งถัดไป)
 */
export const signingRef = (companyId: string) => adminDb.doc(`companies/${companyId}/document_assets/signing`);
export const signerImageRef = (companyId: string, signerId: string) => adminDb.doc(`companies/${companyId}/document_assets/signer_${signerId}`);

export async function loadSigning(companyId: string): Promise<SigningConfig> {
  const raw = (await signingRef(companyId).get()).data() || {};
  const list: any[] = Array.isArray(raw.signers) ? raw.signers : [];
  const refs = list.filter((s) => s?.id && !s.image).map((s) => signerImageRef(companyId, String(s.id)));
  const snaps = refs.length ? await adminDb.getAll(...refs) : [];
  const images = new Map(snaps.filter((s) => s.exists).map((s) => [String(s.get("id")), String(s.get("image") || "")]));
  return normalizeSigning({ ...raw, signers: list.map((s) => (s?.image ? s : { ...s, image: images.get(String(s?.id)) || "" })) });
}

/** ใส่ลายเซ็น/ตราอิเล็กทรอนิกส์ให้เอกสารที่ออกจริง (ใช้กับ PDF · ลิงก์ลูกค้า · อีเมล) */
export async function withSigning(companyId: string, doc: DocumentModel): Promise<DocumentModel> {
  const cfg = await loadSigning(companyId);
  return applySigning(doc, cfg, DESIGNABLE_DOCS.find((d) => d.type === doc.type)?.signatures || []);
}
