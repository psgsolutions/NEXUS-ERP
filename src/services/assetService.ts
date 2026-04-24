import { FixedAsset, DepreciationEntry } from "@/types/database";
import { AccountingEngine } from "./accountingEngine";

/**
 * Nexus Asset Management Service V4.0
 * Handles fixed asset depreciation and lifecycle management.
 */
export const AssetService = {
  /**
   * Calculates monthly depreciation using Straight-Line method.
   * Depreciation = (Purchase Value - Salvage Value) / (Useful Life * 12)
   */
  calculateMonthlyDepreciation(asset: FixedAsset): number {
    const totalDepreciable = asset.purchaseValue - asset.salvageValue;
    const totalMonths = asset.usefulLifeYears * 12;
    return totalDepreciable / totalMonths;
  },

  /**
   * Processes depreciation for a batch of assets and posts to accounting.
   */
  async processBatchDepreciation(assets: FixedAsset[], period: string) {
    const entries: Partial<DepreciationEntry>[] = [];
    let totalBatchAmount = 0;

    for (const asset of assets) {
      if (asset.status !== 'active' || asset.currentValue <= asset.salvageValue) continue;

      const amount = this.calculateMonthlyDepreciation(asset);
      totalBatchAmount += amount;

      entries.push({
        assetId: asset.id,
        period,
        amount,
        accumulatedDepreciation: (asset.purchaseValue - asset.currentValue) + amount,
        bookValue: asset.currentValue - amount
      });
    }

    // Auto-Post to Accounting
    if (totalBatchAmount > 0) {
      await AccountingEngine.postJournalEntry({
        description: `[AUTO] Monthly Depreciation for ${period}`,
        totalAmount: totalBatchAmount,
        items: [
          {
            accountId: '5121-00', // Depreciation Expense
            accountName: 'ค่าเสื่อมราคา (Depreciation Expense)',
            debit: totalBatchAmount,
            credit: 0
          },
          {
            accountId: '1591-00', // Accumulated Depreciation
            accountName: 'ค่าเสื่อมราคาสะสม (Accumulated Depreciation)',
            debit: 0,
            credit: totalBatchAmount
          }
        ]
      });
    }

    return entries;
  }
};
