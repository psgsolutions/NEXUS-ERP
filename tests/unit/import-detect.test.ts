import { describe, expect, it } from "vitest";
import { detectEntity, sheetName } from "@/lib/import/detect";
import { IMPORT_TEMPLATES } from "@/lib/import/templates";
import { OPENING_TEMPLATES } from "@/lib/import/opening";

const ALL = [...Object.values(IMPORT_TEMPLATES), ...Object.values(OPENING_TEMPLATES)];
const headersOf = (entity: string) => ALL.find((t) => t.entity === entity)!.columns.map((c) => (c.required ? `${c.header}*` : c.header));

describe("multi-file import: which data each sheet holds", () => {
  it("recognises every template from its own header row, regardless of file name", () => {
    for (const t of ALL) expect(detectEntity(headersOf(t.entity), ["ไฟล์.xlsx", "ข้อมูล"], ALL).entity, t.entity).toBe(t.entity);
  });

  it("works with only the required columns and extra unknown columns", () => {
    const minimal = IMPORT_TEMPLATES.products.columns.filter((c) => c.required).map((c) => c.header);
    expect(detectEntity([...minimal, "คอลัมน์อื่น"], [], ALL).entity).toBe("products");
  });

  it("file/sheet names break ties; unknown headers give no entity", () => {
    const ar = headersOf("ar");
    expect(detectEntity(ar, ["ลูกหนี้-2569.xlsx"], ALL).entity).toBe("ar");
    expect(detectEntity(["คอลัมน์", "จำเป็น", "ตัวอย่าง"], ["คำอธิบาย"], ALL)).toMatchObject({ entity: null });
  });

  it("only offers templates the user may import", () => {
    const onlyCustomers = [IMPORT_TEMPLATES.customers];
    expect(detectEntity(headersOf("products"), [], onlyCustomers).entity).toBeNull();
  });

  it("combined template sheet names are valid Excel names", () => {
    for (const t of ALL) {
      const n = sheetName(t.label);
      expect(n.length).toBeLessThanOrEqual(31);
      expect(n).not.toMatch(/[\\/?*[\]:]/);
    }
  });
});
