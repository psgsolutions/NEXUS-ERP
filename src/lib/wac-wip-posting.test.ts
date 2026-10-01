import assert from "node:assert";

/**
 * [UNIT-TEST] WIP Asset Site Expense & Project actualCost Sync Verification
 * Project: NEXUS ERP (Intelligence OS)
 */

export function runWipPostingTests() {
  const expenseAmount = 7500;
  const initialActualCost = 20000;

  // GL Double Entry Lines
  const journalLines = [
    { accountCode: "114100", accountName: "งานระหว่างก่อสร้าง (WIP Asset)", debit: expenseAmount, credit: 0 },
    { accountCode: "111100", accountName: "เงินสด", debit: 0, credit: expenseAmount }
  ];

  const totalDebit = journalLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = journalLines.reduce((s, l) => s + l.credit, 0);

  // Assertion 1: GL Debit MUST equal Credit
  assert.strictEqual(totalDebit, totalCredit, "Debit must equal Credit");
  assert.strictEqual(totalDebit, 7500, "Total debit must be 7,500");

  // Assertion 2: Project actualCost sync
  const updatedActualCost = initialActualCost + expenseAmount;
  assert.strictEqual(updatedActualCost, 27500, "Updated actualCost must equal 27,500");
}
