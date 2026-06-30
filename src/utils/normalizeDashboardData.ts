import type { ActualData, DashboardData, MonthlyMetric, PlanData, PlanMetric, PlanMetricQuarterly } from '../types';

const MONTH_COUNT = 12;
const QUARTER_SLICES = {
  Q1: [0, 3],
  Q2: [3, 6],
  Q3: [6, 9],
  Q4: [9, 12],
} as const;

function normalizeNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function normalizeMonthlyValues(values?: number[] | null): number[] {
  return Array.from({ length: MONTH_COUNT }, (_, idx) => normalizeNumber(values?.[idx]));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + normalizeNumber(value), 0);
}

function addSeries(...series: number[][]): number[] {
  return Array.from({ length: MONTH_COUNT }, (_, idx) =>
    series.reduce((total, values) => total + normalizeNumber(values[idx]), 0)
  );
}

function subtractSeries(base: number[], ...series: number[][]): number[] {
  return Array.from({ length: MONTH_COUNT }, (_, idx) =>
    series.reduce((total, values) => total - normalizeNumber(values[idx]), normalizeNumber(base[idx]))
  );
}

function isMeaningful(values: number[]): boolean {
  return values.some(value => Math.abs(value) > 0.000001);
}

function createMonthlyMetric(values?: number[] | null): MonthlyMetric {
  const monthly = normalizeMonthlyValues(values);
  return { monthly, total: sum(monthly) };
}

function metricValues(metric?: MonthlyMetric | null): number[] {
  return normalizeMonthlyValues(metric?.monthly);
}

function createQuarterlyFromMonthly(
  plan: number[],
  actual: number[],
  diff: number[]
): PlanMetricQuarterly {
  return {
    Q1: createQuarterMetric(plan, actual, diff, ...QUARTER_SLICES.Q1),
    Q2: createQuarterMetric(plan, actual, diff, ...QUARTER_SLICES.Q2),
    Q3: createQuarterMetric(plan, actual, diff, ...QUARTER_SLICES.Q3),
    Q4: createQuarterMetric(plan, actual, diff, ...QUARTER_SLICES.Q4),
  };
}

function createQuarterMetric(plan: number[], actual: number[], diff: number[], start: number, end: number) {
  return {
    plan: sum(plan.slice(start, end)),
    actual: sum(actual.slice(start, end)),
    diff: sum(diff.slice(start, end)),
  };
}

function createPlanMetric(
  planValues?: number[] | null,
  actualValues?: number[] | null,
  diffValues?: number[] | null
): PlanMetric {
  const plan = normalizeMonthlyValues(planValues);
  const actual = normalizeMonthlyValues(actualValues);
  const diff = normalizeMonthlyValues(diffValues ?? subtractSeries(actual, plan));

  return {
    monthly: { plan, actual, diff },
    quarterly: createQuarterlyFromMonthly(plan, actual, diff),
    annual: {
      plan: sum(plan),
      actual: sum(actual),
      diff: sum(diff),
    },
  };
}

function planMetricValues(metric?: PlanMetric | null) {
  return {
    plan: normalizeMonthlyValues(metric?.monthly?.plan),
    actual: normalizeMonthlyValues(metric?.monthly?.actual),
    diff: normalizeMonthlyValues(metric?.monthly?.diff),
  };
}

function marketingMonthlyTotals(actual?: ActualData | null): number[] {
  const items = Object.values(actual?.marketingBreakdown ?? {});
  if (items.length === 0) return Array(MONTH_COUNT).fill(0);
  return Array.from({ length: MONTH_COUNT }, (_, idx) =>
    items.reduce((total, item) => total + normalizeNumber(item.monthly?.[idx]), 0)
  );
}

function normalizeActualData(actual?: ActualData | null): ActualData | null {
  if (!actual) return null;

  const totalRevenue = createMonthlyMetric(metricValues(actual.totalRevenue));
  const operatingCost = createMonthlyMetric(metricValues(actual.operatingCost));
  const derivedGrossProfit = subtractSeries(totalRevenue.monthly, operatingCost.monthly);
  const grossProfit = createMonthlyMetric(
    isMeaningful(metricValues(actual.grossProfit)) ? metricValues(actual.grossProfit) : derivedGrossProfit
  );

  const sellingValues = metricValues(actual.sellingExpenses);
  const fallbackSellingValues = marketingMonthlyTotals(actual);
  const sellingExpenses = createMonthlyMetric(isMeaningful(sellingValues) ? sellingValues : fallbackSellingValues);

  const adminValues = metricValues(actual.adminExpenses);
  const totalSgaValues = metricValues(actual.totalSGA);
  const derivedAdminValues = subtractSeries(totalSgaValues, sellingExpenses.monthly);
  const adminExpenses = createMonthlyMetric(
    isMeaningful(adminValues) ? adminValues : derivedAdminValues
  );

  const totalSGA = createMonthlyMetric(
    isMeaningful(totalSgaValues) ? totalSgaValues : addSeries(sellingExpenses.monthly, adminExpenses.monthly)
  );

  const ebitdaValues = metricValues(actual.ebitda);
  const derivedEbitdaValues = subtractSeries(grossProfit.monthly, totalSGA.monthly);
  const ebitda = createMonthlyMetric(isMeaningful(ebitdaValues) ? ebitdaValues : derivedEbitdaValues);

  const depreciation = createMonthlyMetric(metricValues(actual.depreciation));
  const ebitValues = metricValues(actual.ebit);
  const derivedEbitValues = subtractSeries(ebitda.monthly, depreciation.monthly);
  const ebit = createMonthlyMetric(isMeaningful(ebitValues) ? ebitValues : derivedEbitValues);

  const financeCost = createMonthlyMetric(metricValues(actual.financeCost));
  const ebtValues = metricValues(actual.ebt);
  const derivedEbtValues = subtractSeries(ebit.monthly, financeCost.monthly);
  const ebt = createMonthlyMetric(isMeaningful(ebtValues) ? ebtValues : derivedEbtValues);

  const netProfitValues = metricValues(actual.netProfit);
  const taxValues = metricValues(actual.tax);
  const derivedTaxValues = subtractSeries(ebt.monthly, netProfitValues);
  const tax = createMonthlyMetric(isMeaningful(taxValues) ? taxValues : derivedTaxValues);
  const netProfit = createMonthlyMetric(
    isMeaningful(netProfitValues) ? netProfitValues : subtractSeries(ebt.monthly, tax.monthly)
  );

  return {
    ...actual,
    totalRevenue,
    operatingCost,
    grossProfit,
    sellingExpenses,
    adminExpenses,
    totalSGA,
    ebitda,
    depreciation,
    ebit,
    financeCost,
    ebt,
    tax,
    netProfit,
  };
}

function normalizePlanData(plan?: PlanData | null): PlanData | null {
  if (!plan) return null;

  const totalRevenue = createPlanMetric(
    planMetricValues(plan.totalRevenue).plan,
    planMetricValues(plan.totalRevenue).actual,
    planMetricValues(plan.totalRevenue).diff
  );

  const operatingRevenueValues = planMetricValues(plan.operatingRevenue);
  const operatingRevenue = createPlanMetric(
    isMeaningful(operatingRevenueValues.plan) ? operatingRevenueValues.plan : totalRevenue.monthly.plan,
    isMeaningful(operatingRevenueValues.actual) ? operatingRevenueValues.actual : totalRevenue.monthly.actual,
    isMeaningful(operatingRevenueValues.diff) ? operatingRevenueValues.diff : subtractSeries(totalRevenue.monthly.actual, totalRevenue.monthly.plan)
  );

  const operatingCostValues = planMetricValues(plan.operatingCost);
  const operatingCost = createPlanMetric(
    operatingCostValues.plan,
    operatingCostValues.actual,
    operatingCostValues.diff
  );

  const grossProfitValues = planMetricValues(plan.grossProfit);
  const derivedGrossProfitPlan = subtractSeries(totalRevenue.monthly.plan, operatingCost.monthly.plan);
  const derivedGrossProfitActual = subtractSeries(totalRevenue.monthly.actual, operatingCost.monthly.actual);
  const grossProfit = createPlanMetric(
    isMeaningful(grossProfitValues.plan) ? grossProfitValues.plan : derivedGrossProfitPlan,
    isMeaningful(grossProfitValues.actual) ? grossProfitValues.actual : derivedGrossProfitActual,
    isMeaningful(grossProfitValues.diff) ? grossProfitValues.diff : subtractSeries(derivedGrossProfitActual, derivedGrossProfitPlan)
  );

  const sellingValues = planMetricValues(plan.sellingExpenses);
  const sellingExpenses = createPlanMetric(sellingValues.plan, sellingValues.actual, sellingValues.diff);

  const adminValues = planMetricValues(plan.adminExpenses);
  const totalSgaValues = planMetricValues(plan.totalSGA);
  const derivedAdminPlan = subtractSeries(totalSgaValues.plan, sellingExpenses.monthly.plan);
  const derivedAdminActual = subtractSeries(totalSgaValues.actual, sellingExpenses.monthly.actual);
  const adminExpenses = createPlanMetric(
    isMeaningful(adminValues.plan) ? adminValues.plan : derivedAdminPlan,
    isMeaningful(adminValues.actual) ? adminValues.actual : derivedAdminActual,
    isMeaningful(adminValues.diff) ? adminValues.diff : subtractSeries(derivedAdminActual, derivedAdminPlan)
  );

  const totalSGA = createPlanMetric(
    isMeaningful(totalSgaValues.plan) ? totalSgaValues.plan : addSeries(sellingExpenses.monthly.plan, adminExpenses.monthly.plan),
    isMeaningful(totalSgaValues.actual) ? totalSgaValues.actual : addSeries(sellingExpenses.monthly.actual, adminExpenses.monthly.actual),
    isMeaningful(totalSgaValues.diff) ? totalSgaValues.diff : subtractSeries(
      addSeries(sellingExpenses.monthly.actual, adminExpenses.monthly.actual),
      addSeries(sellingExpenses.monthly.plan, adminExpenses.monthly.plan)
    )
  );

  const depreciationValues = planMetricValues(plan.depreciation);
  const depreciation = createPlanMetric(depreciationValues.plan, depreciationValues.actual, depreciationValues.diff);

  const ebitdaValues = planMetricValues(plan.ebitda);
  const derivedEbitdaPlan = subtractSeries(grossProfit.monthly.plan, totalSGA.monthly.plan);
  const derivedEbitdaActual = subtractSeries(grossProfit.monthly.actual, totalSGA.monthly.actual);
  const ebitda = createPlanMetric(
    isMeaningful(ebitdaValues.plan) ? ebitdaValues.plan : derivedEbitdaPlan,
    isMeaningful(ebitdaValues.actual) ? ebitdaValues.actual : derivedEbitdaActual,
    isMeaningful(ebitdaValues.diff) ? ebitdaValues.diff : subtractSeries(derivedEbitdaActual, derivedEbitdaPlan)
  );

  const ebitValues = planMetricValues(plan.ebit);
  const derivedEbitPlan = subtractSeries(ebitda.monthly.plan, depreciation.monthly.plan);
  const derivedEbitActual = subtractSeries(ebitda.monthly.actual, depreciation.monthly.actual);
  const ebit = createPlanMetric(
    isMeaningful(ebitValues.plan) ? ebitValues.plan : derivedEbitPlan,
    isMeaningful(ebitValues.actual) ? ebitValues.actual : derivedEbitActual,
    isMeaningful(ebitValues.diff) ? ebitValues.diff : subtractSeries(derivedEbitActual, derivedEbitPlan)
  );

  const financeCostValues = planMetricValues(plan.financeCost);
  const financeCost = createPlanMetric(financeCostValues.plan, financeCostValues.actual, financeCostValues.diff);

  const ebtValues = planMetricValues(plan.ebt);
  const derivedEbtPlan = subtractSeries(ebit.monthly.plan, financeCost.monthly.plan);
  const derivedEbtActual = subtractSeries(ebit.monthly.actual, financeCost.monthly.actual);
  const ebt = createPlanMetric(
    isMeaningful(ebtValues.plan) ? ebtValues.plan : derivedEbtPlan,
    isMeaningful(ebtValues.actual) ? ebtValues.actual : derivedEbtActual,
    isMeaningful(ebtValues.diff) ? ebtValues.diff : subtractSeries(derivedEbtActual, derivedEbtPlan)
  );

  const netProfitValues = planMetricValues(plan.netProfit);
  const taxValues = planMetricValues(plan.tax);
  const derivedTaxPlan = subtractSeries(ebt.monthly.plan, netProfitValues.plan);
  const derivedTaxActual = subtractSeries(ebt.monthly.actual, netProfitValues.actual);
  const tax = createPlanMetric(
    isMeaningful(taxValues.plan) ? taxValues.plan : derivedTaxPlan,
    isMeaningful(taxValues.actual) ? taxValues.actual : derivedTaxActual,
    isMeaningful(taxValues.diff) ? taxValues.diff : subtractSeries(derivedTaxActual, derivedTaxPlan)
  );

  const netProfit = createPlanMetric(
    netProfitValues.plan,
    netProfitValues.actual,
    isMeaningful(netProfitValues.diff) ? netProfitValues.diff : subtractSeries(netProfitValues.actual, netProfitValues.plan)
  );

  return {
    ...plan,
    totalRevenue,
    operatingRevenue,
    operatingCost,
    grossProfit,
    sellingExpenses,
    adminExpenses,
    totalSGA,
    ebitda,
    ebitdaSummary: createPlanMetric(ebitda.monthly.plan, ebitda.monthly.actual, ebitda.monthly.diff),
    depreciation,
    ebit,
    financeCost,
    ebt,
    tax,
    netProfit,
  };
}

export function normalizeDashboardData(data: DashboardData | null): DashboardData | null {
  if (!data) return null;

  return {
    ...data,
    actual: normalizeActualData(data.actual),
    plan: normalizePlanData(data.plan),
    target: normalizePlanData(data.target),
  };
}
