import assert from "node:assert";
import { calculateWAC } from "./stock-service";

/**
 * [UNIT-TEST] Real-time WAC Goods Receipt Formula Test
 * Project: NEXUS ERP (Intelligence OS)
 */
export function runWacRealtimeTests() {
  // Initial Stock State
  let onHand = 0;
  let costWAC = 0;

  // --- Round 1: Receive 100 units at 10.00 THB ---
  const round1Qty = 100;
  const round1Cost = 10.00;
  
  costWAC = calculateWAC(onHand, costWAC, round1Qty, round1Cost);
  onHand += round1Qty;

  assert.strictEqual(onHand, 100, "Round 1 onHand must be 100");
  assert.strictEqual(costWAC, 10.00, "Round 1 costWAC must be 10.00");

  // --- Round 2: Receive 50 units at 16.00 THB ---
  const round2Qty = 50;
  const round2Cost = 16.00;

  costWAC = calculateWAC(onHand, costWAC, round2Qty, round2Cost);
  onHand += round2Qty;

  // Formula: (100 * 10.00 + 50 * 16.00) / (100 + 50) = (1000 + 800) / 150 = 12.00 THB
  assert.strictEqual(onHand, 150, "Round 2 onHand must be 150");
  assert.strictEqual(costWAC, 12.00, "Round 2 costWAC must be 12.00");

  // --- Round 3: Issue stock (OUT) ---
  const issueQty = 30;
  onHand -= issueQty;

  assert.strictEqual(onHand, 120, "Round 3 onHand must be 120");
  assert.strictEqual(costWAC, 12.00, "Round 3 costWAC must remain 12.00");

  // --- Round 4: Zero stock initial receipt ---
  const initialWAC = calculateWAC(0, 0, 20, 45.50);
  assert.strictEqual(initialWAC, 45.50, "Initial receipt WAC must equal unit cost");
}
