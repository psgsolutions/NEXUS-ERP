export interface ProjectBudgetBreakdown {
  travel: number;
  accommodation: number;
  giveaways: number;
  contingency: number;
  commission: number;
  totalBudget: number;
}

export interface SupplierPayoutPhase {
  phaseName: string;
  payoutAmount: number;
  isPaid: boolean;
  linkedMilestoneId?: string;
}

export const ProjectCostingService = {
  /**
   * คำนวณงบประมาณโครงการ (Auto-Budget Calculator)
   * อิงจากยอดรวมสุทธิ (Total Value) 
   * - Travel 3%
   * - Accommodation 2%
   * - Giveaways 1%
   * - Contingency 3%
   * - Commission 2%
   */
  calculateProjectBudget(totalValue: number): ProjectBudgetBreakdown {
    const travel = totalValue * 0.03;
    const accommodation = totalValue * 0.02;
    const giveaways = totalValue * 0.01;
    const contingency = totalValue * 0.03;
    const commission = totalValue * 0.02;

    const totalBudget = travel + accommodation + giveaways + contingency + commission;

    return {
      travel,
      accommodation,
      giveaways,
      contingency,
      commission,
      totalBudget
    };
  },

  /**
   * กำหนดสัดส่วนการจ่ายเงินผู้รับเหมา (Supplier Payout Mapping)
   * ผูกกับการส่งมอบงาน (Phases) หรือ งวดรับเงินสด (Cash Collection)
   */
  allocateSubcontractorPayout(
    totalSubcontractorCost: number, 
    phases: Array<{ name: string; percentage: number; milestoneId?: string }>
  ): SupplierPayoutPhase[] {
    
    // คำนวณยอดเงินในแต่ละงวดตามเปอร์เซ็นต์
    return phases.map(phase => {
      const payoutAmount = totalSubcontractorCost * (phase.percentage / 100);
      return {
        phaseName: phase.name,
        payoutAmount,
        isPaid: false,
        linkedMilestoneId: phase.milestoneId
      };
    });
  }
};
