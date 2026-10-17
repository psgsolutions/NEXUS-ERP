import { describe, expect, it } from "vitest";
import { ACCOUNTANT_PO_LIMIT, can, canAccessRoute, canViewCost, purchaseApprovalLimit, resolveRoles } from "@/lib/permissions";
import { canDispatchJobs } from "@/lib/jobs";

describe("ตำแหน่งและสิทธิ์", () => {
  it("roles[] ใหม่มาก่อน role เดียวแบบเก่า และตัดตำแหน่งที่ไม่รู้จัก", () => {
    expect(resolveRoles({ role: "ADMIN", roles: ["sales", "XYZ"] })).toEqual(["SALES"]);
  });

  it("บัญชีรุ่นเก่า ADMIN ได้ทุกตำแหน่งงาน, ACCOUNTANT ได้บัญชี+บุคคล", () => {
    const admin = resolveRoles({ role: "ADMIN" });
    expect(admin).toContain("SALES");
    expect(admin).toContain("ACCOUNTANT");
    expect(resolveRoles({ role: "ACCOUNTANT" }).sort()).toEqual(["ACCOUNTANT", "HR"]);
    expect(resolveRoles(null)).toEqual([]);
  });

  it("วงเงินอนุมัติใบสั่งซื้อ", () => {
    expect(purchaseApprovalLimit(["ACCOUNTANT"])).toBe(ACCOUNTANT_PO_LIMIT);
    expect(ACCOUNTANT_PO_LIMIT).toBe(500_000);
    expect(purchaseApprovalLimit(["EXECUTIVE"])).toBe(Infinity);
    expect(purchaseApprovalLimit("SUPERADMIN")).toBe(Infinity);
    expect(purchaseApprovalLimit(["SALES", "PURCHASING"])).toBe(0);
  });

  it("ฝ่ายขายไม่เห็นต้นทุน แต่ขายหน้าร้านได้", () => {
    expect(canViewCost(["SALES"])).toBe(false);
    expect(can(["SALES"], "sales:edit")).toBe(true);
    expect(canAccessRoute(["SALES"], "/pos")).toBe(true);
  });

  it("เปิดหน้าได้ตามสิทธิ์ (prefix ยาวกว่ามาก่อน)", () => {
    expect(canAccessRoute(["SALES"], "/finance/receipts/new")).toBe(true);
    expect(canAccessRoute(["SALES"], "/finance/journal")).toBe(false);
    expect(canAccessRoute(["SALES"], "/executive")).toBe(false);
    expect(canAccessRoute(["EXECUTIVE"], "/executive")).toBe(true);
    expect(canAccessRoute(["WAREHOUSE"], "/dashboard")).toBe(true);
    expect(canAccessRoute(["WAREHOUSE"], "/settings/users")).toBe(false);
    expect(canAccessRoute("SUPERADMIN", "/settings/users")).toBe(true);
  });

  it("ADMIN (ตำแหน่งใหม่) เห็นเฉพาะงานจัดการระบบ ไม่เห็นการเงิน", () => {
    expect(canAccessRoute(["ADMIN"], "/finance")).toBe(false);
    expect(canAccessRoute(["ADMIN"], "/settings")).toBe(true);
  });

  it("สิทธิ์จ่ายงาน", () => {
    expect(canDispatchJobs(null)).toBe(false);
    expect(canDispatchJobs(["EXECUTIVE"])).toBe(true);
  });
});
