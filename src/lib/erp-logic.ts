/**
 * [STRATEGIC-LOGIC-V2.9]
 * Central Intelligence for Financial Calculations & ERP Logic
 */

export type VatType = 'Inclusive' | 'Exclusive' | 'Non-VAT';
export type POType = 'STOCK' | 'PROJECT' | 'CONSUMABLE' | 'ASSET';
export type CustomerType = 'company' | 'government' | 'hospital' | 'person';
export type CustomerStatus = 'active' | 'draft' | 'suspended';

export const SCHEMA_VERSION = '2.9.5';

/**
 * Calculates financials for a set of items and VAT type.
 */
export function calculateFinancials(items: any[], vatType: VatType) {
  const net = items.reduce((acc, item) => acc + (item.qty * (item.price || 0)), 0);
  const cost = items.reduce((acc, item) => acc + (item.qty * (item.cost || 0)), 0);
  
  let vat = 0;
  let total = 0;

  if (vatType === 'Inclusive') {
    vat = net - (net / 1.07);
    total = net;
  } else if (vatType === 'Exclusive') {
    vat = net * 0.07;
    total = net + vat;
  } else {
    vat = 0;
    total = net;
  }

  const profit = net - cost;
  const gpPercent = net > 0 ? Math.round((profit / net) * 100) : 0;

  return {
    net,
    cost,
    vat,
    total,
    profit,
    gpPercent
  };
}

/**
 * Formats currency to Thai Baht standard.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value).replace('฿', '฿ ');
}

/**
 * Returns the color mapping for the Profit Rainbow based on GP%.
 */
export function getProfitRainbowColor(gpPercent: number) {
  if (gpPercent >= 50) return { bg: 'bg-nexus-teal/10', border: 'border-nexus-teal/20', text: 'text-nexus-teal', label: 'STRATEGIC MARGIN (EXCELLENT)' };
  if (gpPercent >= 30) return { bg: 'bg-nexus-blue/10', border: 'border-nexus-blue/20', text: 'text-nexus-blue', label: 'HEALTHY MARGIN (GOOD)' };
  if (gpPercent >= 15) return { bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', label: 'TACTICAL MARGIN (FAIR)' };
  if (gpPercent >= 0) return { bg: 'bg-danger/10', border: 'border-danger/20', text: 'text-danger', label: 'CRITICAL MARGIN (LOW)' };
  return { bg: 'bg-black', border: 'border-danger', text: 'text-white', label: 'NEGATIVE MARGIN' };
}
