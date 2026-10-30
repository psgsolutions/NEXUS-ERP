import { describe, expect, it, vi } from "vitest";

// ตัวส่งออกเป็นฟังก์ชันล้วน — ไม่ต้องเชื่อม Firebase
vi.mock("@/lib/firebase-client", () => ({ db: {} }));

const { buildWhtRecords } = await import("@/lib/tax-calc");
const { exportWHTToCSV } = await import("@/lib/tax-filing-service");

const parse = (csv: string) => csv.replace(/^﻿/, "").split("\r\n").map((line) => {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur); return out;
});

describe("ภ.ง.ด.53 export (RD Prep columns)", () => {
  const recs = buildWhtRecords([
    { id: "a", data: { whtId: "WHT-1", vendor: 'บริษัท "ดี, จำกัด"', taxId: "0105555555555", vendorType: "CORPORATE", baseAmount: 10000, whtRate: 3, whtAmount: 300, filingDate: "2026-10-15", payee: { branchCode: "00001", address: "1 ถนนทดสอบ" } } },
    { id: "b", data: { whtId: "WHT-2", vendor: "ไม่มีเลข", vendorType: "CORPORATE", baseAmount: 5000, whtRate: 3, whtAmount: 150, filingDate: "2026-10-20" } },
  ], new Map(), "2026-10", "PND53");

  it("quotes names with commas/quotes, uses BE dates, branch, address and condition 1", () => {
    const rows = parse(exportWHTToCSV(recs, "PND53", "2026-10"));
    const head = rows[2], first = rows[3];
    expect(head.slice(0, 6)).toEqual(["ลำดับ", "เลขประจำตัวผู้เสียภาษี", "สาขา", "ชื่อผู้มีเงินได้", "ที่อยู่", "วันที่จ่าย"]);
    expect(first.length).toBe(head.length);
    expect(first[1]).toBe("0105555555555");
    expect(first[2]).toBe("00001");
    expect(first[3]).toBe('บริษัท "ดี, จำกัด"');
    expect(first[5]).toBe("15/10/2569");
    expect(first[10]).toBe("1");
  });

  it("never exports a made-up tax ID", () => {
    expect(recs[1].missingTaxId).toBe(true);
    const rows = parse(exportWHTToCSV(recs, "PND53", "2026-10"));
    expect(rows[4][1]).toBe("");
    expect(rows[4][12]).toContain("ไม่มีเลขผู้เสียภาษี");
  });
});
