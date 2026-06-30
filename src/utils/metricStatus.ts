export type MetricStatus = 'good' | 'warning' | 'bad' | 'neutral';

type StatusSurface = 'text' | 'badge';

interface RangeRuleOptions {
  value: number;
  min?: number;
  max?: number;
  warnBuffer?: number;
}

interface AchievementRuleOptions {
  actual: number;
  plan: number;
  warnGap?: number;
}

const STATUS_CLASSES: Record<StatusSurface, Record<MetricStatus, string>> = {
  text: {
    good: 'text-emerald-600',
    warning: 'text-amber-600',
    bad: 'text-rose-600',
    neutral: 'text-emma-black',
  },
  badge: {
    good: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    bad: 'bg-rose-50 text-rose-700',
    neutral: 'bg-emma-nude text-emma-grey-dark',
  },
};

export function getMetricStatusClass(status: MetricStatus, surface: StatusSurface = 'text'): string {
  return STATUS_CLASSES[surface][status];
}

export function getRangeStatus({
  value,
  min,
  max,
  warnBuffer = 5,
}: RangeRuleOptions): MetricStatus {
  if (!Number.isFinite(value)) return 'neutral';

  if (min !== undefined) {
    if (value < min) return 'bad';
    if (value < min + warnBuffer) return 'warning';
  }

  if (max !== undefined) {
    if (value > max) return 'bad';
    if (value > max - warnBuffer) return 'warning';
  }

  return 'good';
}

export function getPlanAchievementStatus({
  actual,
  plan,
  warnGap = 5,
}: AchievementRuleOptions): MetricStatus {
  if (!Number.isFinite(plan) || plan === 0) return 'neutral';
  const achievement = (actual / plan) * 100;
  return getRangeStatus({ value: achievement, min: 100 - warnGap, warnBuffer: warnGap });
}

export function getPositiveStatus(value: number, warningFloor = 0): MetricStatus {
  if (!Number.isFinite(value)) return 'neutral';
  if (value < 0) return 'bad';
  if (value <= warningFloor) return 'warning';
  return 'good';
}

export function getNegativeCostStatus(value: number, warningFloor = 0): MetricStatus {
  if (!Number.isFinite(value)) return 'neutral';
  if (value > 0) return 'bad';
  if (value >= warningFloor) return 'warning';
  return 'good';
}

export function getCeilingPercentStatus(value: number, max = 50, warnBuffer = 5): MetricStatus {
  return getRangeStatus({ value, max, warnBuffer });
}

export function getFloorPercentStatus(value: number, min = 0, warnBuffer = 5): MetricStatus {
  return getRangeStatus({ value, min, warnBuffer });
}

export function getStatusTextClass(status: MetricStatus): string {
  return getMetricStatusClass(status, 'text');
}

export function getStatusBadgeClass(status: MetricStatus): string {
  return getMetricStatusClass(status, 'badge');
}

export function getStatusLabel(status: MetricStatus): string {
  switch (status) {
    case 'good':
      return 'Green';
    case 'warning':
      return 'Yellow';
    case 'bad':
      return 'Red';
    default:
      return 'Neutral';
  }
}

export function getPlanAchievementRemark(label: string, actual: number, plan: number, warnGap = 5): string {
  if (!Number.isFinite(plan) || plan === 0) {
    return `${label}: no plan baseline is available for this period, so the status is neutral.`;
  }
  const achievement = (actual / plan) * 100;
  const status = getPlanAchievementStatus({ actual, plan, warnGap });
  const floor = 100 - warnGap;
  return `${getStatusLabel(status)}: ${label} is ${achievement.toFixed(1)}% of plan. Green is at least 100%, yellow is ${floor.toFixed(0)}-${(100 - 0.1).toFixed(1)}%, red is below ${floor.toFixed(0)}%.`;
}

export function getCeilingPercentRemark(label: string, value: number, max = 50, warnBuffer = 5): string {
  const status = getCeilingPercentStatus(value, max, warnBuffer);
  return `${getStatusLabel(status)}: ${label} is ${value.toFixed(1)}%. Green is below ${(max - warnBuffer).toFixed(0)}%, yellow is ${(max - warnBuffer).toFixed(0)}-${max.toFixed(0)}%, red is above ${max.toFixed(0)}%.`;
}

export function getFloorPercentRemark(label: string, value: number, min = 0, warnBuffer = 5): string {
  const status = getFloorPercentStatus(value, min, warnBuffer);
  return `${getStatusLabel(status)}: ${label} is ${value.toFixed(1)}%. Green is at least ${(min + warnBuffer).toFixed(0)}%, yellow is ${min.toFixed(0)}-${(min + warnBuffer).toFixed(0)}%, red is below ${min.toFixed(0)}%.`;
}

export function getPositiveRemark(label: string, value: number, warningFloor = 0, positiveMeaning = 'positive'): string {
  const status = getPositiveStatus(value, warningFloor);
  if (warningFloor > 0) {
    return `${getStatusLabel(status)}: ${label} is ${value.toFixed(1)}. Green means ${positiveMeaning} and above ${warningFloor.toFixed(0)}, yellow is between 0 and ${warningFloor.toFixed(0)}, red is below 0.`;
  }
  return `${getStatusLabel(status)}: ${label} is ${value.toFixed(1)}. Green means ${positiveMeaning}, yellow is near break-even, red means the value is negative.`;
}
