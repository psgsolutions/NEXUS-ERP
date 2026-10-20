import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES, guideFor } from "@/lib/help/guides";
import { introsForRoles, tasksForRoles, visitTargets } from "@/lib/help/onboarding";
import { pageLabel } from "@/lib/page-labels";

// เส้นทางของทุกหน้าในระบบ (จากไฟล์ page.tsx)
const APP = path.resolve(__dirname, "../../src/app/(authenticated)");
const routes: string[] = [];
const walk = (dir: string, rel: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name), `${rel}/${e.name}`);
    else if (e.name === "page.tsx") routes.push(rel || "/");
  }
};
walk(APP, "");
const exists = (href: string) => {
  const p = href.split("?")[0];
  return routes.some((r) => new RegExp(`^${r.replace(/\[[^\]]+\]/g, "[^/]+")}$`).test(p));
};

describe("in-app help", () => {
  it("every guide link and onboarding link points to a real page", () => {
    const links = [
      ...Object.values(GUIDES).flatMap((g) => (g.next || []).map((l) => l.href)),
      ...tasksForRoles(["SALES", "PURCHASING", "WAREHOUSE", "ACCOUNTANT", "ENGINEER", "TECHNICIAN", "HR", "EXECUTIVE", "ADMIN", "SUPERADMIN"]).map((t) => t.href),
    ];
    expect(links.filter((h) => !exists(h))).toEqual([]);
  });

  it("guides match the most specific page", () => {
    expect(guideFor("/sales")?.title).toBe("งานขาย");
    expect(guideFor("/sales/orders/SO-1")?.title).toBe("ใบสั่งขาย");
    expect(guideFor("/sales/quotations/new")?.title).toBe("ใบเสนอราคา");
    expect(guideFor("/finance/receipts/new")?.title).toBe("รับชำระเงินจากลูกค้า");
    expect(guideFor("/finance/journal/FIN-1")?.title).toBe("รายการบัญชี");
    expect(guideFor("/finance")?.title).toBe("การเงินและบัญชี");
    expect(guideFor("/salesx")).toBeNull();
  });

  it("page labels for the breadcrumb", () => {
    expect(pageLabel("/finance/reports")).toBe("รายงานบัญชีและภาษี");
    expect(pageLabel("/finance/whatever")).toBe("การเงินและบัญชี");
    expect(pageLabel("/inventory/stock-card")).toBe("คลังสินค้า");
    expect(pageLabel("/unknown")).toBe("");
  });

  it("onboarding merges roles without duplicates, help last", () => {
    const ids = tasksForRoles(["SALES", "ACCOUNTANT", "sales"]).map((t) => t.id);
    expect(ids).toEqual(["customer", "quotation", "salesOrder", "postJournal", "receipt", "payment", "reports", "help"]);
    expect(tasksForRoles(["CUSTOMER"])).toEqual([]);
    expect(introsForRoles(["SALES", "SALES", "UNKNOWN"]).map((i) => i.role)).toEqual(["ฝ่ายขาย"]);
    expect(visitTargets([{ check: { kind: "visit", path: "/hr" }, done: false }, { check: { kind: "visit", path: "/x" }, done: true }])).toEqual(["/hr"]);
  });
});

describe("navigation parent pages", () => {
  it("every list page exists and parents resolve to the nearest list page", async () => {
    const { LIST_PAGES, parentPage } = await import("@/lib/page-labels");
    expect(LIST_PAGES.filter((h) => !exists(h))).toEqual([]);
    expect(parentPage("/sales/quotations/QT-1")).toBe("/sales/quotations");
    expect(parentPage("/finance/receipts/new")).toBe("/finance");
    expect(parentPage("/customers/C1")).toBe("/customers");
    expect(parentPage("/sales")).toBeNull();
    expect(parentPage("/unknown/x")).toBeNull();
  });
});
