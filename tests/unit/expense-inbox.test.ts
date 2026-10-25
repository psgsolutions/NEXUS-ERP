import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { claimDescription, needsSubstitute, normalizeInboxData } from "@/lib/expense-inbox";
import { verifyLineSignature } from "@/lib/line.server";

describe("photo bills → expenses", () => {
  it("cash bills carry no VAT and need a substitute receipt; totals are recomputed", () => {
    const d = normalizeInboxData({ docType: "CASH_BILL", vendorName: "ร้านวัสดุ", vat: 70, total: 999, items: [{ description: "สายไฟ", qty: 2, unitPrice: 150 }, { description: "เทป", amount: 40 }] });
    expect(d.vat).toBe(0);
    expect(d.items[0].amount).toBe(300);
    expect(d.total).toBe(340);
    expect(needsSubstitute(d)).toBe(true);
    expect(claimDescription(d)).toContain("ใบรับรองแทนใบเสร็จ");
  });

  it("tax invoices keep VAT; bad values are cleaned", () => {
    const d = normalizeInboxData({ docType: "TAX_INVOICE", vendorTaxId: "0-1055-61234-56-7", subtotal: "1,000", vat: "70", date: "2569-10-05", suggestedAccount: "x" });
    expect(d).toMatchObject({ subtotal: 1000, vat: 70, total: 1070, vendorTaxId: "0105561234567", suggestedAccount: "" });
    expect(d.date).toBe("2026-10-05");
    expect(needsSubstitute(d)).toBe(false);
    expect(normalizeInboxData({ docType: "HACK" }).docType).toBe("CASH_BILL");
  });

  it("LINE webhook signature must match the channel secret", () => {
    process.env.LINE_CHANNEL_SECRET = "test-secret";
    const body = JSON.stringify({ events: [] });
    const sig = crypto.createHmac("sha256", "test-secret").update(body).digest("base64");
    expect(verifyLineSignature(body, sig)).toBe(true);
    expect(verifyLineSignature(body + " ", sig)).toBe(false);
    expect(verifyLineSignature(body, null)).toBe(false);
    delete process.env.LINE_CHANNEL_SECRET;
  });
});
