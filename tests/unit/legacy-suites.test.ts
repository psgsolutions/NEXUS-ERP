import { describe, it, vi } from "vitest";

// ชุดทดสอบเดิมใน src/lib/*.test.ts เป็นฟังก์ชันที่ throw เมื่อไม่ผ่าน — เรียกผ่าน vitest ที่นี่
// โมดูลที่แตะ Firebase ถูก mock ไว้ เพราะชุดเหล่านี้ทดสอบเฉพาะการคำนวณ
vi.mock("@/lib/firebase-client", () => ({ db: {}, auth: {} }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: {}, adminAuth: {} }));
vi.spyOn(console, "log").mockImplementation(() => {});

describe("ชุดทดสอบเดิม", () => {
  it("ล็อกงวดบัญชี", async () => (await import("@/lib/period-close.test")).testPeriodCloseLockIntegration());
  it("ตรวจฟอร์มใบเสนอราคา", async () => (await import("@/lib/quotation-form-audit.test")).runQuotationFormAuditTests());
  it("ใบกำกับภาษีขาย", async () => (await import("@/lib/sales-tax-invoice.test")).runSalesTaxInvoiceTests());
  it("ย้ายงานไปฝั่งเซิร์ฟเวอร์", async () => (await import("@/lib/server-migration.test")).testServerMigrationFlows());
  it("ราคาผู้ขายสำหรับใบสั่งซื้อ", async () => (await import("@/lib/supplier-matrix-po.test")).testSupplierMatrixExtraction());
  it("ไฟล์ ภ.พ.30", async () => (await import("@/lib/tax-filing.test")).testPP30ExportFormat());
  it("ต้นทุนเฉลี่ยถ่วงน้ำหนัก", async () => (await import("@/lib/wac-realtime.test")).runWacRealtimeTests());
  it("ลงงานระหว่างทำ", async () => (await import("@/lib/wac-wip-posting.test")).runWipPostingTests());
  it("ประกันสินค้าไม่สร้างซ้ำ", async () => (await import("@/lib/warranty-cron.test")).testWarrantyCronDeduplication());
});
