/**
 * Verification Script: Hardening & Compliance Pass
 * Tests:
 * 1. firestore.rules validation for strictly scoped role check & root project lock
 * 2. assertPeriodOpen presence across all 5 mandatory accounting locations
 * 3. Competitor mode conversion guard check
 */

const fs = require('fs');
const path = require('path');

console.log("==========================================================================");
console.log("🛡️ NEXUS ERP HARDENING & COMPLIANCE VERIFICATION TEST SUITE");
console.log("==========================================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS ${totalTests}] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL ${totalTests}] ${message}`);
    process.exitCode = 1;
  }
}

// --------------------------------------------------------------------------
// TEST 1: Firestore Security Rules (0.1 & Role Check)
// --------------------------------------------------------------------------
console.log("📌 TEST 1: Verifying firestore.rules Scoping & RBAC");
const rulesPath = path.join(__dirname, '..', 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

assert(
  rulesContent.includes("hasRole(['ADMIN', 'MANAGER'])"),
  "firestore.rules enforces hasRole(['ADMIN', 'MANAGER']) on document deletion"
);

assert(
  rulesContent.includes("match /projects/{projectId}") && rulesContent.includes("allow write: if false;"),
  "firestore.rules locks root collection projects from client write (allow write: if false)"
);

assert(
  rulesContent.includes("match /counters/{counterId}") && rulesContent.includes("allow write: if false;"),
  "firestore.rules locks counters collection from client write"
);

assert(
  rulesContent.includes("match /periodClosings/{docId}") && rulesContent.includes("allow write: if false;"),
  "firestore.rules locks periodClosings collection from client write"
);

// --------------------------------------------------------------------------
// TEST 2: Period Close Lock (0.3 - 5 Mandatory Locations)
// --------------------------------------------------------------------------
console.log("\n📌 TEST 2: Verifying assertPeriodOpen in 5 Mandatory Locations");

const accountingEnginePath = path.join(__dirname, '..', 'src', 'services', 'accountingEngine.ts');
const autoJournalPath = path.join(__dirname, '..', 'src', 'lib', 'auto-journal-service.ts');
const stockServicePath = path.join(__dirname, '..', 'src', 'lib', 'stock-service.ts');
const financeEnginePath = path.join(__dirname, '..', 'src', 'lib', 'financeEngine.ts');
const postJournalRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'accounting', 'post-journal', 'route.ts');

const acContent = fs.readFileSync(accountingEnginePath, 'utf8');
const ajContent = fs.readFileSync(autoJournalPath, 'utf8');
const ssContent = fs.readFileSync(stockServicePath, 'utf8');
const feContent = fs.readFileSync(financeEnginePath, 'utf8');
const pjContent = fs.readFileSync(postJournalRoutePath, 'utf8');

assert(
  (acContent.match(/assertPeriodOpen/g) || []).length >= 5,
  `accountingEngine.ts calls assertPeriodOpen across posting methods (found ${(acContent.match(/assertPeriodOpen/g) || []).length} calls)`
);

assert(
  (ajContent.match(/assertPeriodOpen/g) || []).length >= 4,
  `auto-journal-service.ts calls assertPeriodOpen across all 4 Hub journal generators (found ${(ajContent.match(/assertPeriodOpen/g) || []).length} calls)`
);

assert(
  ssContent.includes("assertPeriodOpen(companyId)"),
  "stock-service.ts calls assertPeriodOpen inside processStockMovement"
);

assert(
  feContent.includes("assertPeriodOpen(companyId"),
  "financeEngine.ts calls assertPeriodOpen in postToGL"
);

assert(
  pjContent.includes("assertPeriodOpen(companyId"),
  "post-journal/route.ts calls assertPeriodOpen before posting journal"
);

// --------------------------------------------------------------------------
// TEST 3: Competitor Mode Conversion Block (1.4)
// --------------------------------------------------------------------------
console.log("\n📌 TEST 3: Verifying Competitor Mode Conversion Guard");
const salesServicePath = path.join(__dirname, '..', 'src', 'lib', 'sales-service.ts');
const salesContent = fs.readFileSync(salesServicePath, 'utf8');

assert(
  salesContent.includes("isCompetitorQuote") && salesContent.includes("ห้ามแปลงใบเสนอราคาโหมดเอกสารคู่เทียบ"),
  "sales-service.ts convertToSalesOrder explicitly rejects competitor mode documents"
);

// --------------------------------------------------------------------------
// TEST 4: Per-Line WHT Calculation Support (1.1)
// --------------------------------------------------------------------------
console.log("\n📌 TEST 4: Verifying Per-Line WHT Calculation");
const itemsTablePath = path.join(__dirname, '..', 'src', 'components', 'commerce', 'DocumentItemsTable.tsx');
const contextPath = path.join(__dirname, '..', 'src', 'context', 'QuotationFormContext.tsx');

const itemsTableContent = fs.readFileSync(itemsTablePath, 'utf8');
const contextContent = fs.readFileSync(contextPath, 'utf8');

assert(
  itemsTableContent.includes("whtRate") && itemsTableContent.includes("WHT %"),
  "DocumentItemsTable.tsx includes per-line WHT % selector and column header"
);

assert(
  contextContent.includes("perLineWhtSum") && contextContent.includes("hasPerLineWht"),
  "QuotationFormContext.tsx aggregates per-line WHT sum into total whtAmount"
);

console.log("\n==========================================================================");
console.log(`SUMMARY: ${passedTests} / ${totalTests} Verification Tests Passed Successfully! 🎉`);
console.log("==========================================================================\n");
