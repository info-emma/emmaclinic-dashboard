import type { DashboardData, BranchPLData } from '../types';
import { formatCurrency } from './formatters';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number): string {
  return formatCurrency(n, true);
}

export function formatBranchDataContext(monthsData: BranchPLData[]): string {
  if (monthsData.length === 0) return '';
  const lines: string[] = ['\n=== Branch P&L ==='];
  for (const d of monthsData) {
    const label = `${MONTHS[d.month]} ${d.year}`;
    lines.push(`[${label}] Grand Total — Rev:${fmt(d.grandTotal.totalRevenue)} OpCost:${fmt(d.grandTotal.operatingCost)} GP:${fmt(d.grandTotal.grossProfit)} SGA:${fmt(d.grandTotal.totalSGA)} EBITDA:${fmt(d.grandTotal.ebitda)} Net:${fmt(d.grandTotal.netProfit)}`);
    for (const b of d.branches) {
      lines.push(`  ${b.branchName}: Rev:${fmt(b.metrics.totalRevenue)} GP:${fmt(b.metrics.grossProfit)} Net:${fmt(b.metrics.netProfit)}`);
    }
  }
  return lines.join('\n');
}

export function formatYearDataContext(year: number, data: DashboardData): string {
  const lines: string[] = [`\n=== ${year} ===`];
  const actual = data.actual;

  if (actual) {
    const monthLabel = (values: number[]) => values.map((value, index) => `${MONTHS[index]}:${fmt(value)}`).join(' ');
    lines.push(`Revenue: ${monthLabel(actual.totalRevenue.monthly)} | Total:${fmt(actual.totalRevenue.total)}`);
    lines.push(`OpCost: ${monthLabel(actual.operatingCost.monthly)} | Total:${fmt(actual.operatingCost.total)}`);
    lines.push(`GrossProfit: ${monthLabel(actual.grossProfit.monthly)} | Total:${fmt(actual.grossProfit.total)}`);
    lines.push(`SGA: ${monthLabel(actual.totalSGA.monthly)} | Total:${fmt(actual.totalSGA.total)}`);
    lines.push(`EBITDA: ${monthLabel(actual.ebitda.monthly)} | Total:${fmt(actual.ebitda.total)}`);
    lines.push(`NetProfit: ${monthLabel(actual.netProfit.monthly)} | Total:${fmt(actual.netProfit.total)}`);

    const revenueItems = Object.values(actual.revenueBreakdown ?? {})
      .filter(item => item.total > 0)
      .map(item => `${item.label}:${fmt(item.total)}`)
      .join(', ');

    if (revenueItems) lines.push(`RevByProcedure: ${revenueItems}`);
  }

  const plan = data.plan;
  if (plan?.totalRevenue?.monthly?.plan?.length) {
    lines.push(`Plan Revenue: ${plan.totalRevenue.monthly.plan.map((value, index) => `${MONTHS[index]}:${fmt(value)}`).join(' ')} | Annual:${fmt(plan.totalRevenue.annual.plan)}`);
    lines.push(`Plan NetProfit: ${plan.netProfit.monthly.plan.map((value, index) => `${MONTHS[index]}:${fmt(value)}`).join(' ')} | Annual:${fmt(plan.netProfit.annual.plan)}`);
  }

  return lines.join('\n');
}
