import { describe, expect, it } from "vitest";
import { DESIGNABLE_DOCS } from "@/lib/documents/build";
import { applyFormToAll } from "@/lib/documents/design-data";
import { defaultFreeLayout, normalizeDesign, type FreeBlock } from "@/lib/documents/design";

/** ฟอร์มใบเสนอราคาที่ออกแบบเอง: กรอบ/สี/มุม ข้อความชื่อเอกสาร แถวข้อมูลแยกช่อง ลายเซ็นในช่องลงนาม คอลัมน์ที่ตั้งเอง */
function quotationForm() {
  const base = defaultFreeLayout("quotation", "Sarabun", DESIGNABLE_DOCS[0].meta);
  const blocks: FreeBlock[] = [
    ...base.blocks.map((b) => (b.kind === "items" ? { ...b, table: "grid" as const, headBg: "#112233", radius: 6, colSpec: [{ key: "no" as const, width: 6 }, { key: "description" as const, label: "รายการสินค้า" }, { key: "qty" as const, align: "center" as const }, { key: "price" as const }, { key: "amount" as const, width: 15 }] } : b)),
    { id: "band", kind: "rect", x: 0, y: 0, w: 595, h: 20, bg: "@primary", radius: 8 },
    { id: "head", kind: "text", x: 300, y: 100, w: 200, h: 20, text: "ใบเสนอราคา / QUOTATION", bold: true, color: "#ffffff" },
    { id: "lbl", kind: "field", field: "m:ยืนราคาถึง", show: "label", text: "ยืนราคาถึง", x: 32, y: 150, w: 80, h: 14 },
    { id: "val", kind: "field", field: "m:ยืนราคาถึง", hideLabel: true, x: 120, y: 150, w: 80, h: 14 },
    { id: "pay", kind: "field", field: "f:paymentTerms", x: 32, y: 170, w: 200, h: 14 },
    { id: "sig", kind: "sign", slot: "ผู้อนุมัติ", x: 300, y: 720, w: 150, h: 60 },
  ];
  return normalizeDesign({ perDoc: { quotation: { title: "ใบเสนอราคาพิเศษ", free: { enabled: true, blocks, margins: [20, 24, 20, 24], paper: "A4" } } } });
}
const byId = (d: any, type: string, id: string) => d.perDoc[type].free.blocks.find((b: FreeBlock) => b.id === id);

describe("custom form as the template for every document", () => {
  const all = applyFormToAll(quotationForm(), "quotation", DESIGNABLE_DOCS.map((d) => d.type));

  it("copies look: frames, colours, corners, table style, margins", () => {
    for (const d of DESIGNABLE_DOCS) {
      expect(byId(all, d.type, "band"), d.type).toMatchObject({ bg: "@primary", radius: 8, w: 595 });
      expect(all.perDoc[d.type].free!.margins, d.type).toEqual([20, 24, 20, 24]);
      const items = all.perDoc[d.type].free!.blocks.find((b) => b.kind === "items")!;
      expect(items, d.type).toMatchObject({ table: "grid", headBg: "#112233", radius: 6 });
    }
  });

  it("keeps each document's own content: rows, columns, signature slots, titles", () => {
    // ใบวางบิล: แถวข้อมูลของใบวางบิล · คอลัมน์ของใบวางบิล · ช่องลงนามของใบวางบิล
    expect(byId(all, "billing_note", "val").field).toBe("m:กำหนดชำระ");
    expect(byId(all, "billing_note", "lbl")).toMatchObject({ field: "m:กำหนดชำระ" });
    expect(byId(all, "billing_note", "lbl").text).toBeUndefined();
    expect(byId(all, "billing_note", "pay")).toBeUndefined(); // ใบวางบิลไม่มีเงื่อนไขการชำระเงิน
    expect(all.perDoc.billing_note.free!.blocks.find((b) => b.kind === "items")!.colSpec!.map((c) => c.key)).toEqual(["no", "code", "description", "amount"]);
    expect(byId(all, "billing_note", "sig").slot).toBe("ผู้รับวางบิล");
    expect(byId(all, "billing_note", "head").text).toBe("ใบวางบิล / BILLING NOTE");
    expect(all.perDoc.billing_note.free!.blocks.find((b) => b.kind === "signatures")!.labels).toBeUndefined();
    // ใบเสร็จ: แถวข้อมูลของใบเสร็จ
    expect(byId(all, "receipt", "val").field).toBe("m:ชำระโดย");
    // คงความกว้าง/การจัดวางของคอลัมน์ที่มีทั้งสองเอกสาร
    expect(all.perDoc.receipt.free!.blocks.find((b) => b.kind === "items")!.colSpec!.find((c) => c.key === "amount")).toMatchObject({ width: 15 });
    // ชื่อเอกสารที่ตั้งเฉพาะใบเสนอราคาไม่ถูกลอกไป
    expect(all.perDoc.receipt.title).toBeUndefined();
    expect(all.perDoc.quotation.title).toBe("ใบเสนอราคาพิเศษ");
  });

  it("follows each document's rules: no totals without amounts, tax invoice keeps quantity", () => {
    expect(all.perDoc.delivery_note.free!.blocks.some((b) => b.kind === "totals" || b.kind === "words")).toBe(false);
    expect(all.perDoc.invoice.free!.blocks.find((b) => b.kind === "items")!.colSpec!.some((c) => c.key === "qty")).toBe(true);
    // ใบส่งของมีช่องลงนาม 3 ช่อง: ลายเซ็นช่องที่ 2 ของต้นแบบ → ช่องที่ 2 ของใบส่งของ
    expect(byId(all, "delivery_note", "sig").slot).toBe("ผู้รับของ");
  });
});
