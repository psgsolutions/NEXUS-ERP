/**
 * ยอดยกมาเมื่อเริ่มใช้ระบบ (ฟังก์ชันล้วน — ใช้ทั้งหน้าจอ, API และ unit test)
 *  - งบทดลองยกมา: ใบสำคัญ JV วันที่เริ่มใช้ระบบ (อ้างอิง OPENING-TB) ผ่าน /api/finance/journal-entries
 *  - ลูกหนี้/เจ้าหนี้คงค้างรายใบ: ใบแจ้งหนี้/รายการค้างจ่ายยกมา ไม่บันทึกบัญชี (ยอดรวมอยู่ในงบทดลองแล้ว)
 *    และไม่เข้ารายงานภาษี (ภาษีขาย/ซื้อยื่นในระบบเดิมแล้ว) — รับชำระ/จ่ายชำระต่อในระบบได้ตามปกติ
 */
import { CHART_OF_ACCOUNTS } from "@/lib/chart-of-accounts";
import type { ImportColumn, ImportTemplate } from "./templates";

export type OpeningKind = "tb" | "ar" | "ap";
export const OPENING_TB_REF = "OPENING-TB";
export const OPENING_DOC_KIND = "opening";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** รหัสบัญชีจากไฟล์ -> รหัสในผังบัญชี (1131 / 113100 / 1131-00 -> 1131-00) */
export function chartAccountCode(v: any): string {
  const s = String(v ?? "").trim();
  const exact = CHART_OF_ACCOUNTS.find((a) => a.code === s);
  if (exact) return exact.code;
  const digits = s.replace(/\D/g, "");
  const code = digits.length === 4 ? `${digits}-00` : digits.length === 6 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : s;
  return CHART_OF_ACCOUNTS.some((a) => a.code === code) ? code : "";
}

const PARTY_DOC = (party: "ลูกค้า" | "ผู้ขาย", amountHeader: string): ImportColumn[] => [
  { key: "docNo", header: "เลขที่เอกสาร", required: true, type: "text", example: party === "ลูกค้า" ? "INV6909-015" : "SUP-IV-8812", note: "เลขที่ใบกำกับ/ใบแจ้งหนี้ในระบบเดิม" },
  { key: "date", header: "วันที่เอกสาร", required: true, type: "date", example: "15/09/2569", note: "วว/ดด/ปปปป (พ.ศ. หรือ ค.ศ.) หรือเซลล์วันที่ของ Excel" },
  { key: "dueDate", header: "วันครบกำหนด", type: "date", example: "15/10/2569", note: "ว่าง = วันที่เอกสาร" },
  { key: "partyName", header: `ชื่อ${party}`, required: true, type: "text", example: party === "ลูกค้า" ? "บริษัท ตัวอย่าง จำกัด" : "บริษัท ซัพพลาย จำกัด", note: `ต้องมีในระบบแล้ว (นำเข้า${party}ก่อน) — จับคู่ด้วยเลขผู้เสียภาษีก่อน แล้วจึงใช้ชื่อ` },
  { key: "taxId", header: "เลขประจำตัวผู้เสียภาษี", type: "taxId", example: "0105561234567" },
  { key: "branchCode", header: "รหัสสาขา", type: "branch", example: "00000" },
  { key: "amount", header: amountHeader, required: true, type: "number", example: "53500", note: "ยอดที่ยังค้าง ณ วันเริ่มใช้ระบบ (รวม VAT)" },
  { key: "subTotal", header: "ยอดก่อน VAT", type: "number", example: "50000", note: "ใช้คำนวณภาษีหัก ณ ที่จ่ายตอนรับ/จ่ายเงิน — ว่าง = เท่ากับยอดค้าง" },
  { key: "note", header: "หมายเหตุ", type: "text", example: "" },
];

const partyValidate = (v: Record<string, any>) => {
  const e: string[] = [];
  if (!(v.amount > 0)) e.push("ยอดค้างต้องมากกว่า 0");
  if (v.subTotal !== undefined && v.subTotal > v.amount + 0.009) e.push("ยอดก่อน VAT มากกว่ายอดค้าง");
  if (v.dueDate && v.date && v.dueDate < v.date) e.push("วันครบกำหนดก่อนวันที่เอกสาร");
  return e;
};

export const OPENING_TEMPLATES: Record<OpeningKind, ImportTemplate> = {
  tb: {
    entity: "tb", label: "งบทดลองยกมา", permission: "finance:edit",
    uniqueKeys: [["accountCode"]],
    columns: [
      { key: "accountCode", header: "รหัสบัญชี", required: true, type: "text", example: "1131-00", note: "ตามผังบัญชีของระบบ (ดูชีต \"ผังบัญชี\") — 1131 หรือ 113100 ก็ได้" },
      { key: "accountName", header: "ชื่อบัญชี", type: "text", example: "ลูกหนี้การค้า", note: "ไม่ใช้คำนวณ (ไว้ตรวจทาน)" },
      { key: "debit", header: "เดบิต", type: "number", example: "250000" },
      { key: "credit", header: "เครดิต", type: "number", example: "" },
    ],
    validate: (v) => {
      const e: string[] = [];
      const code = chartAccountCode(v.accountCode);
      if (!code) e.push(`ไม่พบรหัสบัญชี ${v.accountCode} ในผังบัญชี`);
      else v.accountCode = code;
      if ((v.debit || 0) > 0 === (v.credit || 0) > 0) e.push("ต้องมีเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง");
      return e;
    },
  },
  ar: { entity: "ar", label: "ลูกหนี้คงค้าง", permission: "finance:edit", uniqueKeys: [["docNo"]], columns: PARTY_DOC("ลูกค้า", "ยอดค้างรับ"), validate: partyValidate },
  ap: { entity: "ap", label: "เจ้าหนี้คงค้าง", permission: "finance:edit", uniqueKeys: [["partyName", "docNo"]], columns: PARTY_DOC("ผู้ขาย", "ยอดค้างจ่าย"), validate: partyValidate },
};

/** ยอดรวมงบทดลอง + บรรทัดสำหรับ /api/finance/journal-entries */
export function tbLines(rows: { accountCode: string; debit?: number; credit?: number; accountName?: string }[]) {
  const lines = rows.map((r) => ({ accountCode: r.accountCode, debit: r2(r.debit || 0), credit: r2(r.credit || 0) }));
  const debit = r2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = r2(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, debit, credit, balanced: debit > 0 && Math.abs(debit - credit) < 0.005 };
}

/** รหัสเอกสารยกมา (ไม่ซ้ำ: ลูกหนี้ตามเลขที่, เจ้าหนี้ตามผู้ขาย+เลขที่) */
export function openingDocId(kind: "ar" | "ap", docNo: string, partyId = "") {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 60);
  return kind === "ar" ? `OBAR-${clean(docNo)}` : `OBAP-${clean(partyId)}-${clean(docNo)}`;
}

/** ผลต่างกระทบยอด (ยอดในบัญชีแยกประเภท − ยอดรายตัว) */
export function reconcileRow(label: string, account: string, gl: number, sub: number) {
  return { label, account, gl: r2(gl), sub: r2(sub), diff: r2(gl - sub) };
}
