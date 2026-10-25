import { describe, expect, it } from "vitest";
import { DESIGNABLE_DOCS, sampleModelFor } from "@/lib/documents/build";
import { applySigning, normalizeSigning } from "@/lib/documents/esign";
import { A4, TEMPLATES, normalizeDesign } from "@/lib/documents/design";
import { DOC_PARTS, templateLayout } from "@/lib/documents/layout-templates";

const IMG = "data:image/png;base64,iVBORw0KGgo=";
const seller: any = { name: "บริษัท ทดสอบ จำกัด", address: "กรุงเทพ", taxId: "0105555555555", branchCode: "00000" };
const cfg = normalizeSigning({
  stamp: IMG, stampSize: 500,
  signers: [{ id: "md", name: "ผู้บริหาร", position: "กรรมการผู้จัดการ", image: IMG }, { id: "bad", name: "x", image: "data:text/html;base64,AAAA" }],
  assign: { receipt: { "ผู้รับเงิน": { signer: "md", stamp: true }, "ผู้จ่ายเงิน": { signer: "ghost" } }, "BAD TYPE": { a: { stamp: true } } },
});

describe("electronic signature and stamp", () => {
  it("keeps only valid images, known signers and sane sizes", () => {
    expect(cfg.signers.map((s) => s.id)).toEqual(["md"]);
    expect(cfg.stampSize).toBe(140);
    expect(cfg.assign).toEqual({ receipt: { "ผู้รับเงิน": { signer: "md", stamp: true } } });
  });

  it("signs and stamps issued documents only, never replaces a real signature", () => {
    const labels = DESIGNABLE_DOCS.find((d) => d.type === "receipt")!.signatures;
    const doc = sampleModelFor("receipt", seller, "2026-10-25");
    const out = applySigning(doc, cfg, labels);
    expect(out.signed?.["ผู้รับเงิน"]).toMatchObject({ image: IMG, name: "ผู้บริหาร", title: "กรรมการผู้จัดการ" });
    expect(out.signed?.["ผู้จ่ายเงิน"]).toBeUndefined();
    expect(out.stamp?.slots).toContain("ผู้รับเงิน");
    // ฉบับร่าง / ยกเลิก: ไม่มีลายเซ็นและตรา
    expect(applySigning({ ...doc, watermark: "ฉบับร่าง" }, cfg, labels)).toEqual({ ...doc, watermark: "ฉบับร่าง" });
    // ลายเซ็นจริงที่มีอยู่แล้วไม่ถูกแทน
    const real = applySigning({ ...doc, signed: { "ผู้รับเงิน": { image: "data:image/png;base64,REAL" } } }, cfg, labels);
    expect(real.signed?.["ผู้รับเงิน"]?.image).toBe("data:image/png;base64,REAL");
    // เอกสารจริงใช้ชื่อช่องต่างไป: ใช้ช่องลำดับเดียวกัน
    const renamed = applySigning({ ...doc, signatures: ["ผู้ชำระเงิน", "ผู้รับเงิน (การเงิน)"] }, cfg, labels);
    expect(renamed.signed?.["ผู้รับเงิน (การเงิน)"]?.image).toBe(IMG);
  });

  it("a placed stamp box stamps documents of that type even without a slot rule", () => {
    const design = normalizeDesign({ perDoc: { invoice: { free: { enabled: true, blocks: [...templateLayout("standard", "invoice", normalizeDesign({}).theme).blocks, { id: "st", kind: "stamp", x: 400, y: 640, w: 72, h: 72 }] } } } });
    const doc = sampleModelFor("invoice", { ...seller, design }, "2026-10-25");
    expect(applySigning(doc, cfg).stamp?.image).toBe(IMG);
    expect(applySigning(sampleModelFor("invoice", seller, "2026-10-25"), cfg).stamp).toBeUndefined();
  });
});

describe("templates follow the document type", () => {
  it("every template keeps document boxes inside the page and above the signatures", () => {
    for (const t of TEMPLATES) for (const d of DESIGNABLE_DOCS) {
      const blocks = templateLayout(t.layout || "standard", d.type, t.theme).blocks;
      const sign = blocks.find((b) => b.kind === "signatures")!;
      for (const b of blocks) {
        expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= A4.w + 0.5 && b.y + b.h <= A4.h + 0.5, `${t.id}/${d.type}/${b.id}`).toBe(true);
        if (["info", "notes", "payment", "words", "totals"].includes(b.kind)) expect(b.y + b.h <= sign.y + 1, `${t.id}/${d.type}/${b.id} overlaps signatures`).toBe(true);
      }
    }
  });

  it("receipt shows payment details in its own box (not repeated in the number box); billing note asks for the payment date", () => {
    const r = templateLayout("standard", "receipt", TEMPLATES[0].theme).blocks;
    expect(r.find((b) => b.kind === "info")?.fields).toEqual(DOC_PARTS.receipt.box);
    expect(r.find((b) => b.kind === "meta")?.hide).toContain("m:ชำระโดย");
    const bn = templateLayout("banner", "billing_note", TEMPLATES[0].theme).blocks;
    expect(bn.find((b) => b.id === "ack")?.text).toContain("นัดชำระ");
    expect(templateLayout("standard", "delivery_note", TEMPLATES[0].theme).blocks.some((b) => b.kind === "totals")).toBe(false);
  });
});
