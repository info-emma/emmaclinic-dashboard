export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export type MonthName = typeof MONTHS[number];

export interface MonthlyMetric {
  monthly: number[];
  total: number;
}

export interface RevenueItem {
  key: string;
  label: string;
  monthly: number[];
  total: number;
}

export interface MarketingItem {
  key: string;
  label: string;
  monthly: number[];
  total: number;
}

export interface ActualData {
  totalRevenue: MonthlyMetric;
  operatingCost: MonthlyMetric;
  grossProfit: MonthlyMetric;
  totalSGA: MonthlyMetric;
  ebitda: MonthlyMetric;
  depreciation: MonthlyMetric;
  ebit: MonthlyMetric;
  financeCost: MonthlyMetric;
  netProfit: MonthlyMetric;
  revenueBreakdown: Record<string, RevenueItem>;
  marketingBreakdown: Record<string, MarketingItem>;
  // Extended — populated from re-upload; undefined on older Supabase records
  sellingExpenses?: MonthlyMetric;
  adminExpenses?: MonthlyMetric;
  ebt?: MonthlyMetric;
  tax?: MonthlyMetric;
}

export interface PlanMetricMonthly {
  plan: number[];
  actual: number[];
  diff: number[];
}

export interface PlanMetricQuarterly {
  Q1: { plan: number; actual: number; diff: number };
  Q2: { plan: number; actual: number; diff: number };
  Q3: { plan: number; actual: number; diff: number };
  Q4: { plan: number; actual: number; diff: number };
}

export interface PlanMetric {
  monthly: PlanMetricMonthly;
  quarterly: PlanMetricQuarterly;
  annual: { plan: number; actual: number; diff: number };
}

export interface PlanData {
  totalRevenue: PlanMetric;
  netProfit: PlanMetric;
  grossProfit: PlanMetric;
  ebitda: PlanMetric;
  ebitdaSummary: PlanMetric;
  // Extended — populated from re-upload; undefined on older Supabase records
  operatingRevenue?: PlanMetric;
  operatingCost?: PlanMetric;
  sellingExpenses?: PlanMetric;
  adminExpenses?: PlanMetric;
  totalSGA?: PlanMetric;
  depreciation?: PlanMetric;
  ebit?: PlanMetric;
  financeCost?: PlanMetric;
  ebt?: PlanMetric;
  tax?: PlanMetric;
}

export interface ThresholdOverride {
  minimumGpMarginPct?: number;
}

export interface ThresholdOverrides {
  overview?: ThresholdOverride;
  revenue?: ThresholdOverride;
  branch?: ThresholdOverride;
  procedure?: ThresholdOverride;
}

export interface DashboardData {
  actual: ActualData | null;
  plan: PlanData | null;
  target: PlanData | null;
  lastUpdated: string | null;
  fileName: string | null;
  thresholdOverrides?: ThresholdOverrides;
  error?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

// ─── Branch P&L Types ────────────────────────────────────────────────────────

export interface BranchRevenueBreakdown {
  noseClose: number;
  noseOpen: number;
  chin: number;
  eyes: number;
  lips: number;
  breast: number;
  endotine: number;
  contouring: number;
  lifting: number;
  skinTreatment: number;
}

export interface BranchMetrics {
  totalRevenue: number;
  operatingCost: number;
  grossProfit: number;
  totalSGA: number;
  ebitda: number;
  depreciation: number;
  netProfit: number;
  revenueBreakdown: BranchRevenueBreakdown;
}

export interface BranchEntry {
  branchKey: string;
  branchName: string;
  metrics: BranchMetrics;
}

export interface BranchPLData {
  month: number;   // 0–11
  year: number;
  fileName: string;
  branches: BranchEntry[];
  grandTotal: BranchMetrics;
}

export interface BranchReportMeta {
  id: string;
  file_name: string;
  month: number;
  year: number;
  uploaded_at: string;
}
