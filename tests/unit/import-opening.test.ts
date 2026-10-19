import { describe, expect, it } from "vitest";
import { mapHeaders, parseDate, parseRows } from "@/lib/import/templates";
import { OPENING_TEMPLATES, chartAccountCode, openingDocId, tbLines } from "@/lib/import/opening";

describe("opening balance import", () => {
  it("parses Excel serials, ISO, and Thai Buddhist-era dates", () => {
    expect(parseDate(46295)).toBe("2026-09-30");
    expect(parseDate("2026-09-30")).toBe("2026-09-30");
    expect(parseDate("30/09/2569")).toBe("2026-09-30");
    expect(parseDate("1/2/2026")).toBe("2026-02-01");
    expect(parseDate("๓๐/๐๙/๒๕๖๙")).toBe("2026-09-30");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("30/09/69")).toBeNull();
  });

  it("maps account codes from old formats onto the chart of accounts", () => {
    expect(chartAccountCode("1131-00")).toBe("1131-00");
    expect(chartAccountCode("1131")).toBe("1131-00");
    expect(chartAccountCode(113100)).toBe("1131-00");
    expect(chartAccountCode("9999")).toBe("");
  });

  it("validates trial balance rows and totals", () => {
    const t = OPENING_TEMPLATES.tb;
    const { index } = mapHeaders(t, ["รหัสบัญชี", "ชื่อบัญชี", "เดบิต", "เครดิต"]);
    const rows = parseRows(t, [
      ["1112", "ธนาคาร", "100,000", ""],
      ["3111-00", "ทุน", "", 100000],
      ["9999", "?", 5, ""],
      ["1131-00", "ลูกหนี้", 5, 5],
      ["1112-00", "ธนาคารซ้ำ", 1, ""],
    ], index);
    expect(rows[0]).toMatchObject({ values: { accountCode: "1112-00", debit: 100000 }, errors: [] });
    expect(rows[2].errors[0]).toContain("ไม่พบรหัสบัญชี");
    expect(rows[3].errors[0]).toContain("อย่างใดอย่างหนึ่ง");
    expect(rows[4].errors[0]).toContain("ซ้ำกับแถว 2");
    const ok = tbLines(rows.slice(0, 2).map((r) => r.values as any));
    expect(ok).toMatchObject({ debit: 100000, credit: 100000, balanced: true });
    expect(tbLines([{ accountCode: "1111-00", debit: 1 }]).balanced).toBe(false);
  });

  it("validates open AR items", () => {
    const t = OPENING_TEMPLATES.ar;
    const { index, missing } = mapHeaders(t, ["เลขที่เอกสาร", "วันที่เอกสาร", "วันครบกำหนด", "ชื่อลูกค้า", "ยอดค้างรับ", "ยอดก่อน VAT"]);
    expect(missing).toEqual([]);
    const rows = parseRows(t, [
      ["IV-1", "15/09/2569", "15/10/2569", "ลูกค้า A", "53,500", "50000"],
      ["IV-2", "15/09/2569", "01/09/2569", "ลูกค้า A", 0, ""],
      ["IV-3", "15/09/2569", "", "ลูกค้า A", 100, 200],
      ["IV-1", "15/09/2569", "", "ลูกค้า B", 10, ""],
    ], index);
    expect(rows[0]).toMatchObject({ values: { date: "2026-09-15", dueDate: "2026-10-15", amount: 53500, subTotal: 50000 }, errors: [] });
    expect(rows[1].errors).toEqual(expect.arrayContaining(["ยอดค้างต้องมากกว่า 0", "วันครบกำหนดก่อนวันที่เอกสาร"]));
    expect(rows[2].errors).toContain("ยอดก่อน VAT มากกว่ายอดค้าง");
    expect(rows[3].errors[0]).toContain("ซ้ำกับแถว 2");
  });

  it("AP documents are unique per supplier, not globally", () => {
    const t = OPENING_TEMPLATES.ap;
    const { index } = mapHeaders(t, ["เลขที่เอกสาร", "วันที่เอกสาร", "ชื่อผู้ขาย", "ยอดค้างจ่าย"]);
    const rows = parseRows(t, [["001", "2026-09-01", "ร้าน A", 10], ["001", "2026-09-01", "ร้าน B", 20]], index);
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
    expect(openingDocId("ap", "IV/001", "SUP 1")).toBe("OBAP-SUP_1-IV_001");
    expect(openingDocId("ar", "INV6909-015")).toBe("OBAR-INV6909-015");
  });
});
