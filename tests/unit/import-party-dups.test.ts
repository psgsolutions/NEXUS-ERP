import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATES, mapHeaders, parseRows } from "@/lib/import/templates";
import { isDupWarning, markPartyDuplicates, type DupRow } from "@/lib/import/party-dups";

const BMA = "0994000165510";
const OTHER = "0105536092641";
const t = IMPORT_TEMPLATES.customers;
const head = ["ชื่อลูกค้า*", "เลขประจำตัวผู้เสียภาษี"];

/** แปลงไฟล์ → ตรวจซ้ำ (ทำแบบเดียวกับหน้านำเข้า) */
function check(data: any[][], existing: Array<Record<string, any>> = []) {
  const rows: DupRow[] = parseRows(t, data, mapHeaders(t, head).index).map((r) => ({ ...r, fixes: [], status: r.errors.length ? "invalid" : "ready" }));
  markPartyDuplicates(t, rows, existing);
  const state = (r: DupRow) => (r.status === "invalid" ? "invalid" : r.fixes?.some(isDupWarning) ? "review" : "ready");
  return rows.map(state);
}

describe("duplicate check before import (customers / suppliers)", () => {
  const existing = [{ id: "CUS-2611-0001", name: "สำนักงานเขตบางรัก", taxId: BMA, branchCode: "00000" }];

  it("same tax ID + same name as a record in the system → not passed", () => {
    expect(check([["สำนักงานเขต บางรัก", BMA]], existing)).toEqual(["invalid"]);
  });

  it("same tax ID, different name → needs review (fix or dismiss)", () => {
    expect(check([["สำนักงานเขตปทุมวัน", BMA]], existing)).toEqual(["review"]);
    expect(check([["ก", OTHER], ["ข", OTHER]])).toEqual(["ready", "review"]);
  });

  it("after the row is fixed it is ready", () => {
    // แก้ชื่อซ้ำให้เป็นหน่วยงานใหม่ แต่เลขยังซ้ำ → ตรวจสอบ · แก้เลขเป็นรายอื่น → พร้อม
    expect(check([["สำนักงานเขตบางรัก 2", BMA]], existing)).toEqual(["review"]);
    expect(check([["สำนักงานเขตบางรัก", OTHER]], existing)).toEqual(["ready"]);
  });

  it("a row that updates the same record (has its code) is not a duplicate of itself", () => {
    const rows: DupRow[] = [{ rowNo: 2, values: { _id: "CUS-2611-0001", name: "สำนักงานเขตบางรัก", taxId: BMA, branchCode: "00000" }, errors: [], status: "ready", fixes: [] }];
    markPartyDuplicates(t, rows, existing);
    expect(rows[0].status).toBe("ready");
    expect(rows[0].fixes).toEqual([]);
  });
});
