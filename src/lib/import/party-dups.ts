import { exactDuplicate, partyUnitKey, sameTaxIdRecords } from "@/lib/party-identity";
import type { ImportTemplate } from "./templates";
import type { FieldFix } from "./row-check";

/** แถวที่ตรวจแล้ว (ส่วนที่ใช้ตรวจซ้ำ) */
export interface DupRow { rowNo: number; values: Record<string, any>; errors: string[]; status: string; fixes?: FieldFix[] }

/** คำเตือนเลขผู้เสียภาษีซ้ำ (ต่างจากคำเตือนคำผิด) */
export const isDupWarning = (f: FieldFix) => f.from.startsWith("dup:");

/**
 * ตรวจซ้ำของลูกค้า/ผู้ขาย ก่อนนำเข้า (server ตรวจอีกชั้นตอนบันทึก)
 *  - เลข+สาขา+ชื่อ ตรงกับรายการที่บริษัทใช้อยู่ = ไม่ผ่าน (แก้ชื่อ/ลบแถว แล้วสถานะเป็นพร้อม)
 *  - ตรงกับรายการกลางของเครือที่บริษัทนี้ไม่ได้ใช้ (เคยลบ/บริษัทอื่นสร้าง) = นำกลับมาใช้ด้วยรหัสเดิม (_adopt)
 *  - เลขผู้เสียภาษีเดียวกัน แต่ชื่อต่าง (กับแถวอื่นในไฟล์ หรือในระบบ) = ตรวจสอบ
 *    ถ้าเป็นที่เดียวกันให้แก้ชื่อให้ตรงหรือลบแถว · ถ้าเป็นหน่วยงานแยก กดปล่อยผ่าน → พร้อม
 */
export function markPartyDuplicates<R extends DupRow>(t: ImportTemplate, rows: R[], existing: Array<Record<string, any>>) {
  const taxHeader = t.columns.find((c) => c.key === "taxId")?.header || "เลขผู้เสียภาษี";
  const seen = new Map<string, R[]>();
  const warn = (r: R, ref: string, message: string) => {
    r.fixes = [...(r.fixes || []), { key: "taxId", header: taxHeader, from: `dup:${ref}`, to: "", message }];
  };
  for (const r of rows) {
    const taxId = String(r.values.taxId || "");
    if (!taxId) continue;
    const branch = String(r.values.branchCode || "00000");
    const key = partyUnitKey(r.values);
    const k = `${taxId}|${branch}`;
    const before = seen.get(k) || [];
    const other = before.find((p) => partyUnitKey(p.values) !== key);
    if (other) warn(r, `row${other.rowNo}`, `${taxHeader}เดียวกับแถว ${other.rowNo} (${other.values.name}) แต่ชื่อต่างกัน — ถ้าเป็นที่เดียวกันให้แก้ชื่อให้ตรงหรือลบแถว · ถ้าเป็นหน่วยงานแยก กดปล่อยผ่าน`);
    seen.set(k, [...before, r]);
    const same = sameTaxIdRecords(existing, taxId, String(r.values._id || "")).filter((e) => e.branchCode === branch);
    const exact = exactDuplicate(same, branch, r.values);
    const exactRecord = exact ? existing.find((x) => String(x.id) === exact.id) : null;
    if (exact && exactRecord?._inCompany === false && !r.values._id) {
      // มีในข้อมูลกลางของเครือ แต่บริษัทนี้ไม่ได้ใช้ (เคยลบออก หรือบริษัทอื่นในเครือสร้างไว้) = นำรายการเดิมกลับมาใช้ (รหัสเดิม) แล้วอัปเดตตามไฟล์
      r.values = { ...r.values, _id: exact.id, _adopt: true };
    } else if (exact) {
      r.errors = [...r.errors, `ซ้ำกับ${t.label}ในระบบ ${exact.id} (${exact.name}) — แก้ชื่อ หรือลบแถวนี้`];
      r.status = "invalid";
    } else if (same.length && !other) {
      warn(r, same.map((s) => s.id).join(","), `${taxHeader}นี้มีในระบบแล้ว: ${same.slice(0, 2).map((s) => `${s.id} ${s.name}`).join(", ")}${same.length > 2 ? ` และอีก ${same.length - 2} รายการ` : ""} — ถ้าเป็นที่เดียวกันให้แก้ชื่อให้ตรงหรือลบแถว · ถ้าเป็นหน่วยงานแยก กดปล่อยผ่าน`);
    }
  }
}
