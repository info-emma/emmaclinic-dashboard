import type { ThresholdOverrides } from '../types';

export type ThresholdScope = 'overview' | 'revenue' | 'branch' | 'procedure';

export interface GPMarginThresholdConfig {
  minimumGpMarginPct: number;
  allowDynamicOverride: boolean;
}

export const GP_MARGIN_THRESHOLD_CONFIG: Record<ThresholdScope, GPMarginThresholdConfig> = {
  overview: {
    minimumGpMarginPct: 50,
    allowDynamicOverride: true,
  },
  revenue: {
    minimumGpMarginPct: 50,
    allowDynamicOverride: true,
  },
  branch: {
    minimumGpMarginPct: 50,
    allowDynamicOverride: true,
  },
  procedure: {
    minimumGpMarginPct: 50,
    allowDynamicOverride: true,
  },
};

export function getGPMarginThresholdConfig(scope: ThresholdScope): GPMarginThresholdConfig {
  return GP_MARGIN_THRESHOLD_CONFIG[scope];
}

export function resolveGPMarginThresholdConfig(
  scope: ThresholdScope,
  sourceOverrides?: ThresholdOverrides | null,
  supabaseOverrides?: ThresholdOverrides | null
): GPMarginThresholdConfig {
  const base = getGPMarginThresholdConfig(scope);
  const source = sourceOverrides?.[scope];
  const supabase = supabaseOverrides?.[scope];

  return {
    minimumGpMarginPct: supabase?.minimumGpMarginPct ?? source?.minimumGpMarginPct ?? base.minimumGpMarginPct,
    allowDynamicOverride: base.allowDynamicOverride,
  };
}
