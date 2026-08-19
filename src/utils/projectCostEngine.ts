/**
 * คำนวณสัดส่วนงบประมาณหน้างานอัตโนมัติจากมูลค่ารวมโครงการ (Total Contract Value)
 */
export function calculateProjectBudget(totalContractValue: number) {
  // สัดส่วนมาตรฐานตามเกณฑ์โครงการใหญ่ (5-10 ล้านบาท)
  const allocationRates = {
    travelRate: 0.03,       // งบค่าเดินทาง 3%
    accommodRate: 0.02,     // ที่พัก/รับรอง 2%
    giveawayRate: 0.01,     // งบของแถม 1%
    contingencyRate: 0.03,  // ค่าใช้จ่ายอื่นๆ (สำรองฉุกเฉิน) 3%
    commissionRate: 0.02,   // ค่าคอมมิชชั่น (จ่ายตาม Cash Collection Basis) 2%
  };

  const travelBudget = totalContractValue * allocationRates.travelRate;
  const accommBudget = totalContractValue * allocationRates.accommodRate;
  const giveawayBudget = totalContractValue * allocationRates.giveawayRate;
  const othersBudget = totalContractValue * allocationRates.contingencyRate;
  const commissionBudget = totalContractValue * allocationRates.commissionRate;

  const totalOverhead = travelBudget + accommBudget + giveawayBudget + othersBudget + commissionBudget;
  const netEstimatedProfit = totalContractValue - totalOverhead;

  return {
    totalContractValue,
    breakdown: {
      travel: travelBudget,
      accommodations: accommBudget,
      giveaways: giveawayBudget,
      others: othersBudget,
      commission: commissionBudget,
    },
    totalOverhead,
    netEstimatedProfit,
  };
}
