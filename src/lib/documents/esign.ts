/**
 * ลายเซ็นและตราประทับอิเล็กทรอนิกส์ (ฟังก์ชันล้วน ใช้ทั้ง server และหน้าตั้งค่า)
 * เก็บที่ companies/{id}/document_assets/signing — อ่าน/เขียนผ่าน /api/settings/document-signing เท่านั้น (รูปลายเซ็นไม่เปิดให้อ่านจาก client)
 *  - signers: ผู้ลงนามที่ได้รับความยินยอมให้ใช้ลายเซ็น (ชื่อ ตำแหน่ง รูปลายเซ็น)
 *  - assign[ชนิดเอกสาร][ชื่อช่องลงนาม] = { signer: id ผู้ลงนาม, stamp: ประทับตราทับช่องนี้ }
 * ใส่ให้เฉพาะเอกสารที่ออกจริง (ไม่ใช่ฉบับร่าง/รออนุมัติ/ยกเลิก — คือเอกสารที่ไม่มีลายน้ำ) และไม่ทับลายเซ็นจริงที่มีอยู่แล้ว
 */
import type { DocumentModel } from "./model";
import { resolveDesign } from "./design";

export interface Signer { id: string; name: string; position: string; image: string; consentAt?: string; consentBy?: string }
export interface SlotRule { signer?: string; stamp?: boolean }
export interface SigningConfig {
  /** ตราประทับบริษัท (PNG พื้นโปร่งใส) */
  stamp: string;
  /** ขนาดตราบนเอกสาร (pt) */
  stampSize: number;
  signers: Signer[];
  assign: Record<string, Record<string, SlotRule>>;
}

export const STAMP_MAX = 300_000;
export const SIGN_MAX = 150_000;
export const MAX_SIGNERS = 8;
export const EMPTY_SIGNING: SigningConfig = { stamp: "", stampSize: 72, signers: [], assign: {} };

const str = (v: any, max = 120) => String(v ?? "").trim().slice(0, max);
const IMG = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const img = (v: any, max: number) => { const s = String(v ?? ""); return s.length <= max && IMG.test(s) ? s : ""; };

export function normalizeSigning(raw: any): SigningConfig {
  const r = raw && typeof raw === "object" ? raw : {};
  const signers: Signer[] = (Array.isArray(r.signers) ? r.signers : []).slice(0, MAX_SIGNERS)
    .map((x: any) => ({
      id: /^[a-z0-9-]{1,40}$/.test(String(x?.id)) ? String(x.id) : "",
      name: str(x?.name, 80), position: str(x?.position, 80), image: img(x?.image, SIGN_MAX),
      ...(x?.consentAt ? { consentAt: str(x.consentAt, 40) } : {}), ...(x?.consentBy ? { consentBy: str(x.consentBy, 80) } : {}),
    }))
    .filter((x: Signer) => x.id && x.name && x.image);
  const ids = new Set(signers.map((x) => x.id));
  const assign: SigningConfig["assign"] = {};
  for (const [type, slots] of Object.entries(r.assign && typeof r.assign === "object" ? r.assign : {})) {
    if (!/^[a-z_]{1,30}$/.test(type) || !slots || typeof slots !== "object") continue;
    const out: Record<string, SlotRule> = {};
    for (const [label, rule] of Object.entries(slots as Record<string, any>).slice(0, 6)) {
      const l = str(label, 60);
      const signer = ids.has(String(rule?.signer)) ? String(rule.signer) : undefined;
      if (l && (signer || rule?.stamp === true)) out[l] = { ...(signer ? { signer } : {}), ...(rule?.stamp === true ? { stamp: true } : {}) };
    }
    if (Object.keys(out).length) assign[type] = out;
  }
  const size = Number(r.stampSize);
  return { stamp: img(r.stamp, STAMP_MAX), stampSize: Number.isFinite(size) ? Math.min(140, Math.max(40, Math.round(size))) : 72, signers, assign };
}

/**
 * ใส่ลายเซ็น/ตราตามที่ตั้งไว้ให้เอกสารชนิดนี้
 * labels = ชื่อช่องลงนามที่ตั้งในหน้าตั้งค่า (ตามแบบของเอกสาร) — ถ้าเอกสารจริงใช้ชื่อช่องต่างไป ใช้ช่องลำดับเดียวกัน
 */
export function applySigning(doc: DocumentModel, cfg: SigningConfig, labels: string[] = []): DocumentModel {
  if (doc.watermark || doc.letter || doc.wht50) return doc;
  // เอกสารฉบับนี้เลือกไม่ใส่ลายเซ็น/ตรา (ตัวเลือกตอนสร้างเอกสาร)
  if (doc.noSign && doc.noStamp) return doc;
  if (doc.noStamp) cfg = { ...cfg, stamp: "" };
  const rules = doc.noSign ? Object.fromEntries(Object.entries(cfg.assign[doc.type] || {}).filter(([, r]) => r.stamp).map(([l]) => [l, { stamp: true }])) as Record<string, SlotRule> : cfg.assign[doc.type] || {};
  // วางกล่องตราประทับเองในหน้าออกแบบ = ต้องการประทับตราบนเอกสารชนิดนี้
  const r = resolveDesign(doc.seller.design, doc.type, doc.seller.brandColor);
  const placed = [...(r.letterhead?.blocks || []), ...(r.doc.free?.enabled ? r.doc.free.blocks : [])];
  const stampBlock = placed.some((b) => b.kind === "stamp");
  // กล่องลายเซ็นที่ระบุผู้ลงนาม: ใส่ลายเซ็นของคนนั้น (คีย์ @id)
  const fixed = doc.noSign ? [] : [...new Set(placed.filter((b) => b.kind === "sign" && b.signer).map((b) => b.signer!))].map((id) => cfg.signers.find((s) => s.id === id)).filter((s): s is Signer => !!s?.image);
  if (!Object.keys(rules).length && !(stampBlock && cfg.stamp) && !fixed.length) return doc;
  const signed = { ...(doc.signed || {}) };
  for (const s of fixed) signed[`@${s.id}`] = { image: s.image, name: s.name, ...(s.position ? { title: s.position } : {}), date: doc.date };
  const slots: string[] = [];
  for (const [label, rule] of Object.entries(rules)) {
    const i = labels.indexOf(label);
    const real = doc.signatures.includes(label) ? label : i >= 0 && doc.signatures[i] ? doc.signatures[i] : label;
    const keys = [...new Set([real, label])];
    const signer = rule.signer ? cfg.signers.find((s) => s.id === rule.signer) : undefined;
    // ลายเซ็นจริงที่เก็บไว้แล้ว (เช่น ลูกค้าเซ็นรับงานบนมือถือ) ไม่ถูกแทนที่
    if (signer && !signed[real]?.image) for (const k of keys) signed[k] = { ...signed[real], image: signer.image, name: signer.name, ...(signer.position ? { title: signer.position } : {}), date: signed[real]?.date || doc.date };
    if (rule.stamp && cfg.stamp) slots.push(...keys);
  }
  return { ...doc, signed, ...(cfg.stamp && (slots.length || stampBlock) ? { stamp: { image: cfg.stamp, size: cfg.stampSize, slots } } : {}) };
}
