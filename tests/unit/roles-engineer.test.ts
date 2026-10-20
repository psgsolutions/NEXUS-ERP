import { describe, expect, it } from "vitest";
import { can, canAccessRoute, canApproveQuotation, purchaseApprovalLimit, quotationApprovalLimit } from "@/lib/permissions";

// โครงสร้างงานจริง: วิศวกรทำทุกอย่างยกเว้นบัญชี/ออก PO/วางบิล, แอดมินการเงิน = บัญชี + จัดซื้อ
describe("engineer and finance-admin roles", () => {
  const ENG = ["ENGINEER"];
  const ADMIN_FIN = ["ACCOUNTANT", "PURCHASING"];

  it("engineer quotes with cost visibility but cannot bill, issue POs or post journals", () => {
    expect(can(ENG, "sales:edit")).toBe(true);
    expect(can(ENG, "sales:cost")).toBe(true);
    expect(can(ENG, "projects:edit")).toBe(true);
    expect(can(ENG, "sales:billing")).toBe(false);
    expect(can(ENG, "procurement:edit")).toBe(false);
    expect(can(ENG, "finance:edit")).toBe(false);
    expect(can(ENG, "sales:approve")).toBe(false); // ยกเลิกใบกำกับภาษีต้องใช้สิทธิ์นี้
    expect(canAccessRoute(ENG, "/procurement")).toBe(true); // เปิดใบขอซื้อได้
    expect(canAccessRoute(ENG, "/finance/receipts/new")).toBe(false);
    expect(canAccessRoute(ENG, "/pos")).toBe(false);
  });

  it("engineer approves quotations up to 1,000,000; executives without limit", () => {
    expect(quotationApprovalLimit(ENG)).toBe(1_000_000);
    expect(canApproveQuotation(ENG, 1_000_000)).toBe(true);
    expect(canApproveQuotation(ENG, 1_000_000.01)).toBe(false);
    expect(canApproveQuotation(["EXECUTIVE"], 9_999_999)).toBe(true);
    expect(quotationApprovalLimit(["SALES"])).toBe(0);
  });

  it("finance admin issues POs, bills and receives money", () => {
    expect(can(ADMIN_FIN, "procurement:edit")).toBe(true);
    expect(can(ADMIN_FIN, "finance:edit")).toBe(true);
    expect(purchaseApprovalLimit(ADMIN_FIN)).toBe(500_000);
    expect(canAccessRoute(ADMIN_FIN, "/finance/receipts/new")).toBe(true);
  });

  it("sales role keeps billing", () => {
    expect(can(["SALES"], "sales:billing")).toBe(true);
    expect(canAccessRoute(["SALES"], "/pos")).toBe(true);
  });
});
