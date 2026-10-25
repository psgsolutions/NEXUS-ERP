import { adminDb } from "@/lib/firebase-admin";
import type { DocumentModel } from "./model";
import { DESIGNABLE_DOCS } from "./build";
import { applySigning, normalizeSigning, type SigningConfig } from "./esign";

/** ตั้งค่าลายเซ็น/ตราประทับของบริษัท (เอกสารเดียว อ่านด้วยสิทธิ์ server) */
export async function loadSigning(companyId: string): Promise<SigningConfig> {
  return normalizeSigning((await adminDb.doc(`companies/${companyId}/document_assets/signing`).get()).data());
}

/** ใส่ลายเซ็น/ตราอิเล็กทรอนิกส์ให้เอกสารที่ออกจริง (ใช้กับ PDF · ลิงก์ลูกค้า · อีเมล) */
export async function withSigning(companyId: string, doc: DocumentModel): Promise<DocumentModel> {
  const cfg = await loadSigning(companyId);
  return applySigning(doc, cfg, DESIGNABLE_DOCS.find((d) => d.type === doc.type)?.signatures || []);
}
