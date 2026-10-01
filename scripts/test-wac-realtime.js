/**
 * NEXUS ERP (Intelligence OS) — WAC Real-time Goods Receipt Test Script
 * Verifies 2-stage Goods Receipt WAC recalculation formula and onHand increments.
 */

function calculateWAC(oldOnHand, oldWAC, receivedQty, receivedCost) {
  if (receivedQty <= 0) return oldWAC;
  const safeOldOnHand = Math.max(0, oldOnHand);
  const totalQty = safeOldOnHand + receivedQty;
  if (totalQty <= 0) return Math.max(0, receivedCost);

  const totalValue = (safeOldOnHand * oldWAC) + (receivedQty * receivedCost);
  const newWAC = totalValue / totalQty;
  return Number(newWAC.toFixed(4));
}

console.log("🛡️ Running NEXUS ERP WAC Real-time Goods Receipt Verification Test...\n");

// Initial State
let onHand = 0;
let costWAC = 0;

console.log(`[Initial State] onHand: ${onHand}, costWAC: ฿${costWAC.toFixed(2)}`);

// --- Round 1: Receive 100 units at ฿10.00 ---
const r1Qty = 100;
const r1Cost = 10.00;
costWAC = calculateWAC(onHand, costWAC, r1Qty, r1Cost);
onHand += r1Qty;

console.log(`[Goods Receipt #1] Received ${r1Qty} units @ ฿${r1Cost.toFixed(2)}`);
console.log(`   => Updated onHand: ${onHand}, Updated costWAC: ฿${costWAC.toFixed(2)}`);

if (onHand !== 100 || costWAC !== 10.00) {
  console.error("❌ Test Failed at Round 1!");
  process.exit(1);
}

// --- Round 2: Receive 50 units at ฿16.00 ---
const r2Qty = 50;
const r2Cost = 16.00;
costWAC = calculateWAC(onHand, costWAC, r2Qty, r2Cost);
onHand += r2Qty;

console.log(`[Goods Receipt #2] Received ${r2Qty} units @ ฿${r2Cost.toFixed(2)}`);
console.log(`   => Updated onHand: ${onHand}, Updated costWAC: ฿${costWAC.toFixed(2)}`);

// Expected: (100 * 10 + 50 * 16) / 150 = 1800 / 150 = 12.00
if (onHand !== 150 || costWAC !== 12.00) {
  console.error("❌ Test Failed at Round 2!");
  process.exit(1);
}

console.log("\n✅ ALL WAC REAL-TIME VERIFICATION TESTS PASSED SUCCESSFULLY!");
process.exit(0);
