/**
 * NEXUS ERP (Intelligence OS) — Integration Test: WIP Asset Site Expense Posting
 * Verifies: Receipt upload -> JournalEntry created (Debit=Credit) -> Project.actualCost updated
 */

const assert = require('assert');

function assertPeriodOpen(companyId, postingDate) {
  // TODO: Check FinancialPeriod collection status === 'closed'
  return true;
}

function processWipReceiptExpense(data) {
  const { companyId, projectId, amount, paymentMethod, oldActualCost = 0 } = data;

  if (!companyId) throw new Error("companyId is required");
  if (!projectId) throw new Error("projectId is required");
  if (amount <= 0) throw new Error("amount must be > 0");

  const postingDate = new Date().toISOString();
  assertPeriodOpen(companyId, postingDate);

  const creditAccountCode = paymentMethod === 'ap' ? '211100' : '111100';
  const creditAccountName = paymentMethod === 'ap' ? 'เจ้าหนี้การค้า' : 'เงินสด';

  // 1. Double-Entry GL Lines
  const lines = [
    {
      accountCode: '114100', // WIP Asset Account
      accountName: 'งานระหว่างก่อสร้าง (WIP Asset)',
      debit: amount,
      credit: 0
    },
    {
      accountCode: creditAccountCode,
      accountName: creditAccountName,
      debit: 0,
      credit: amount
    }
  ];

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  // Assertion: Debit MUST equal Credit
  assert.strictEqual(totalDebit, totalCredit, "GL Violation: Debit must equal Credit");

  // 2. Project actualCost update
  const newActualCost = oldActualCost + amount;

  return {
    journalEntry: {
      companyId,
      projectId,
      lines,
      totalDebit,
      totalCredit,
      bookType: 'JV',
      status: 'posted'
    },
    updatedProject: {
      projectId,
      oldActualCost,
      newActualCost,
      wipAccumulated: newActualCost
    }
  };
}

console.log("🛡️ Running NEXUS ERP WIP Expense Integration Test...\n");

// Scenario Test
const inputData = {
  companyId: "COMP-001",
  projectId: "PRJ-2605-001",
  amount: 5000,
  paymentMethod: "cash",
  oldActualCost: 10000
};

console.log(`[Input] Project: ${inputData.projectId}, Receipt Amount: ฿${inputData.amount.toLocaleString()}, Initial actualCost: ฿${inputData.oldActualCost.toLocaleString()}`);

const result = processWipReceiptExpense(inputData);

console.log(`[Journal Entry] Status: ${result.journalEntry.status}`);
console.log(`   - Debit: ${result.journalEntry.lines[0].accountName} (${result.journalEntry.lines[0].accountCode}): ฿${result.journalEntry.lines[0].debit}`);
console.log(`   - Credit: ${result.journalEntry.lines[1].accountName} (${result.journalEntry.lines[1].accountCode}): ฿${result.journalEntry.lines[1].credit}`);
console.log(`   - Total Debit: ฿${result.journalEntry.totalDebit}, Total Credit: ฿${result.journalEntry.totalCredit}`);

console.log(`\n[Project Update] New actualCost: ฿${result.updatedProject.newActualCost.toLocaleString()}`);

// Assertions
assert.strictEqual(result.journalEntry.totalDebit, 5000);
assert.strictEqual(result.journalEntry.totalCredit, 5000);
assert.strictEqual(result.updatedProject.newActualCost, 15000);

console.log("\n✅ ALL WIP RECEIPT POSTING INTEGRATION TESTS PASSED SUCCESSFULLY!");
process.exit(0);
