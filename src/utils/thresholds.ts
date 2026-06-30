export function calculateRevenueThresholdForGPMargin(
  revenue: number[],
  grossProfit: number[],
  minimumGpMarginPct = 50
): number[] {
  const minimumGpRatio = minimumGpMarginPct / 100;

  return revenue.map((revenueValue, index) => {
    const grossProfitValue = grossProfit[index] ?? 0;
    const operatingCost = revenueValue - grossProfitValue;

    if (!Number.isFinite(revenueValue) || !Number.isFinite(operatingCost)) return 0;
    if (revenueValue <= 0 || operatingCost <= 0) return Math.max(revenueValue, 0);
    if (minimumGpRatio >= 1) return revenueValue;

    const requiredRevenue = operatingCost / (1 - minimumGpRatio);
    return Math.max(requiredRevenue, 0);
  });
}

export function calculateAchievementThresholdPercent(
  thresholdRevenue: number[],
  comparatorRevenue: number[]
): number[] {
  return comparatorRevenue.map((revenueValue, index) => {
    const thresholdValue = thresholdRevenue[index] ?? 0;
    if (!Number.isFinite(revenueValue) || revenueValue <= 0 || !Number.isFinite(thresholdValue)) return 0;
    return (thresholdValue / revenueValue) * 100;
  });
}
