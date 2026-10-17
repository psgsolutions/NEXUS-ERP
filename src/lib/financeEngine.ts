import { assertPeriodOpen } from "./period-close-service";
import { apiFetch } from "@/lib/api-client";

export interface LedgerItem {
  accountCode: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string;
}

/**
 * [LOG-02] Double-Entry GL Engine
 * ส่งรายการบันทึกบัญชีไปที่ /api/accounting/post-journal เท่านั้น
 * (journal_entries เขียนได้จากเซิร์ฟเวอร์อย่างเดียว ไม่มีทางลัดเขียนตรงจาก client)
 */
export const postToGL = async (
  companyId: string,
  data: {
    description: string;
    reference: string;
    items: LedgerItem[];
    date?: string;
  }
): Promise<string> => {
  await assertPeriodOpen(companyId, data.date);

  // Debit ต้องเท่ากับ Credit
  const totalDebit = data.items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = data.items.reduce((sum, item) => sum + item.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error("Accounting Violation: Debit and Credit are not balanced.");
  }

  const res = await apiFetch("/api/accounting/post-journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      description: data.description,
      reference: data.reference,
      items: data.items,
      date: data.date
    })
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to post GL entry via server API");
  }
  return json.journalId;
};

/**
 * Pre-defined Account Mappings for Automation
 */
export const ACCOUNTS = {
  INVENTORY: { code: "113100", name: "สินค้าคงเหลือ" },
  CASH: { code: "111100", name: "เงินสด" },
  ACCOUNTS_PAYABLE: { code: "211100", name: "เจ้าหนี้การค้า" },
  ACCOUNTS_RECEIVABLE: { code: "112100", name: "ลูกหนี้การค้า" },
  SALES_INCOME: { code: "411100", name: "รายได้จากการขาย" },
  COST_OF_GOODS_SOLD: { code: "511100", name: "ต้นทุนขาย" },
};
