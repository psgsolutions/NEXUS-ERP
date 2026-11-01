import { describe, expect, it } from "vitest";
import { DESIGNABLE_DOCS } from "@/lib/documents/build";
import { followsMaster, resetToMaster, setMaster, syncFollowers, trackOwnEdits } from "@/lib/documents/design-data";
import { defaultFreeLayout, normalizeDesign, type DocumentDesign, type FreeBlock } from "@/lib/documents/design";

/** ใบเสนอราคาที่ออกแบบเอง + เอกสารอื่นยังเป็นผังตั้งต้น */
function start(): DocumentDesign {
  const base = defaultFreeLayout("quotation", "Sarabun", DESIGNABLE_DOCS[0].meta);
  const blocks: FreeBlock[] = [...base.blocks, { id: "band", kind: "rect", x: 0, y: 0, w: 595, h: 20, bg: "@primary" }];
  return normalizeDesign({ perDoc: { quotation: { free: { enabled: true, blocks, margins: [20, 24, 20, 24] } }, invoice: { free: defaultFreeLayout("invoice", "Sarabun") } } });
}
const block = (d: DocumentDesign, type: string, id: string) => d.perDoc[type]?.free?.blocks.find((b) => b.id === id);
/** แก้ผังของเอกสาร (เหมือนหน้าออกแบบ: เอกสารผู้ตามจำส่วนที่แก้เอง แล้วซิงก์) */
function edit(d: DocumentDesign, type: string, fn: (b: FreeBlock[]) => FreeBlock[]): DocumentDesign {
  const per = d.perDoc[type], free = { ...per.free!, blocks: fn(per.free!.blocks) };
  return syncFollowers({ ...d, perDoc: { ...d.perDoc, [type]: followsMaster(d, type) ? trackOwnEdits(per, free) : { ...per, free } } });
}
const move = (id: string, x: number) => (bs: FreeBlock[]) => bs.map((b) => (b.id === id ? { ...b, x } : b));

describe("master document: other documents follow, but stay freely editable", () => {
  const m = setMaster(start(), "quotation");

  it("every other document takes the master's form, with its own content", () => {
    expect(m.master).toBe("quotation");
    for (const t of DESIGNABLE_DOCS.filter((x) => x.type !== "quotation")) {
      expect(block(m, t.type, "band"), t.type).toMatchObject({ bg: "@primary", w: 595 });
      expect(m.perDoc[t.type].free!.margins, t.type).toEqual([20, 24, 20, 24]);
    }
  });

  it("changing the master updates followers immediately", () => {
    const d = edit(m, "quotation", move("band", 40));
    expect(block(d, "invoice", "band")!.x).toBe(40);
    expect(block(d, "receipt", "band")!.x).toBe(40);
  });

  it("a follower's own edits are kept and never overwritten by the master", () => {
    let d = edit(m, "invoice", move("band", 100));
    expect(d.perDoc.invoice.own).toContain("band");
    d = edit(d, "quotation", (bs) => bs.map((b) => (b.id === "band" ? { ...b, x: 7, h: 30 } : b)));
    expect(block(d, "invoice", "band")).toMatchObject({ x: 100, h: 20 }); // ของใบแจ้งหนี้เอง
    expect(block(d, "receipt", "band")).toMatchObject({ x: 7, h: 30 });   // เอกสารอื่นยังตามต้นแบบ
  });

  it("blocks a follower adds or deletes stay that way when the master changes", () => {
    let d = edit(m, "invoice", (bs) => [...bs.filter((b) => b.id !== "band"), { id: "note-x", kind: "text", x: 10, y: 10, w: 100, h: 20, text: "เฉพาะใบแจ้งหนี้" }]);
    d = edit(d, "quotation", move("band", 55));
    expect(block(d, "invoice", "band")).toBeUndefined();
    expect(block(d, "invoice", "note-x")).toMatchObject({ text: "เฉพาะใบแจ้งหนี้" });
  });

  it("frame and letterhead follow unless set on the follower", () => {
    let d = edit(m, "invoice", (bs) => bs);
    d = syncFollowers({ ...d, perDoc: { ...d.perDoc, invoice: trackOwnEdits(d.perDoc.invoice, { ...d.perDoc.invoice.free!, landscape: true }) } });
    expect(d.perDoc.invoice.own).toContain("@frame");
    d = edit(d, "quotation", (bs) => bs);
    d = syncFollowers({ ...d, perDoc: { ...d.perDoc, quotation: { ...d.perDoc.quotation, free: { ...d.perDoc.quotation.free!, margins: [30, 30, 30, 30] } } } });
    expect(d.perDoc.invoice.free!.landscape).toBe(true);
    expect(d.perDoc.receipt.free!.margins).toEqual([30, 30, 30, 30]);
  });

  it("reset returns a follower to the master; detached documents are left alone", () => {
    let d = edit(m, "invoice", move("band", 100));
    d = resetToMaster(d, "invoice");
    expect(block(d, "invoice", "band")!.x).toBe(0);
    expect(d.perDoc.invoice.own).toBeUndefined();
    d = { ...d, perDoc: { ...d.perDoc, receipt: { ...d.perDoc.receipt, detached: true } } };
    d = edit(d, "quotation", move("band", 66));
    expect(block(d, "receipt", "band")!.x).toBe(0);
    expect(block(d, "invoice", "band")!.x).toBe(66);
  });

  it("master and per-document edits survive save (normalize)", () => {
    const d = normalizeDesign(JSON.parse(JSON.stringify(edit(m, "invoice", move("band", 100)))));
    expect(d.master).toBe("quotation");
    expect(d.perDoc.invoice.own).toContain("band");
    expect(normalizeDesign({ ...d, master: "nope" }).master).toBeUndefined();
  });
});
