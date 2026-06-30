export function roundToDecimals(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatMillions(value: number, decimals = 2): string {
  return `${roundToDecimals(value / 1_000_000, decimals).toFixed(decimals)}M`;
}

export function formatCurrency(value: number, compact = false): string {
  const neg = value < 0;
  const abs = Math.abs(value);
  const body = compact
    ? `฿${formatMillions(abs)}`
    : `฿${roundToDecimals(abs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return neg ? `-${body}` : body;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${roundToDecimals(value, decimals).toFixed(decimals)}%`;
}

export function formatMoM(current: number, previous: number, momLabel = 'MoM'): { value: number; label: string; positive: boolean } {
  if (previous === 0) return { value: 0, label: '—', positive: true };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const positive = pct >= 0;
  return {
    value: pct,
    label: `${positive ? '+' : ''}${roundToDecimals(pct, 2).toFixed(2)}% ${momLabel}`,
    positive,
  };
}

export function formatVsPlan(actual: number, plan: number, ofLabel = 'of plan'): { value: number; label: string; positive: boolean } {
  if (plan === 0) return { value: 0, label: '—', positive: true };
  const pct = (actual / plan) * 100;
  const positive = pct >= 100;
  return {
    value: pct,
    label: `${roundToDecimals(pct, 2).toFixed(2)}% ${ofLabel}`,
    positive,
  };
}

export function calcGPPercent(grossProfit: number, revenue: number): number {
  if (revenue === 0) return 0;
  return (grossProfit / revenue) * 100;
}

export function sumMonths(values: number[], monthIndices: number[]): number {
  return monthIndices.reduce((sum, idx) => sum + (values[idx] ?? 0), 0);
}

export function getMonthIndicesUpToDate(): number[] {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-based
  return Array.from({ length: currentMonth + 1 }, (_, i) => i);
}
