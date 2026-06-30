export const CHART_SERIES_COLORS = {
  actual: 'oklch(55.4% 0.135 66.442)',
  plan: 'oklch(73.7% 0.021 106.9)',
  achievement: '#000000',
  threshold: '#D94F4F',
  target: '#5C5048',
  actualMuted: 'oklch(82% 0.06 66.442)',
  negativeActual: '#D94F4F',
  negativeActualMuted: '#F4BFBF',
} as const;

export function getStandardSeriesColor(name: string): string {
  if (name === 'Actual') return CHART_SERIES_COLORS.actual;
  if (name === 'Plan') return CHART_SERIES_COLORS.plan;
  if (name === 'Target') return CHART_SERIES_COLORS.target;
  if (name === 'Achievement %') return CHART_SERIES_COLORS.achievement;
  if (name.includes('Threshold')) return CHART_SERIES_COLORS.threshold;
  return CHART_SERIES_COLORS.actual;
}
