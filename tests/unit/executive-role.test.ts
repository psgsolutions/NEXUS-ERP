import { describe, expect, it } from "vitest";
import { can, canAccessRoute, purchaseApprovalLimit, quotationApprovalLimit } from "@/lib/permissions";

// ผู้บริหาร (ตัดสินใจ 2026-11-15): ทำได้ทุกอย่างยกเว้นงานบัญชี · อนุมัติทุกวงเงิน · ผู้มีอำนาจลงนาม
describe("ตำแหน่งผู้บริหาร", () => {
  const R = ["EXECUTIVE"];
  it("ทำงานได้ทุกโมดูลยกเว้นบัญชี", () => {
    for (const p of ["sales:edit", "sales:delete", "sales:cost", "inventory:edit", "procurement:edit", "projects:edit", "hr:edit", "users:manage", "settings:manage"] as const) expect(can(R, p)).toBe(true);
  });
  it("ไม่ทำงานบัญชี / ออกใบกำกับ-วางบิล-ใบเสร็จ แต่ดูข้อมูลการเงินได้", () => {
    for (const p of ["finance:edit", "finance:post", "finance:delete", "sales:billing"] as const) expect(can(R, p)).toBe(false);
    expect(can(R, "finance:view")).toBe(true);
    expect(canAccessRoute(R, "/finance/reports")).toBe(true);
    expect(canAccessRoute(R, "/pos")).toBe(false);
  });
  it("อนุมัติทุกวงเงิน", () => {
    expect(purchaseApprovalLimit(R)).toBe(Infinity);
    expect(quotationApprovalLimit(R)).toBe(Infinity);
    expect(can(R, "projects:approve")).toBe(true);
  });
});
