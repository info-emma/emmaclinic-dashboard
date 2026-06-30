import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface AnnualMetrics {
  mainRevenue: number;
  revenue: number;
  operatingCost: number;
  grossProfit: number;
  sellingExpenses: number;
  adminExpenses: number;
  totalSGA: number;
  operatingProfit: number;
  depreciation: number;
  ebit: number;
  financeCost: number;
  ebt: number;
  tax: number;
  netProfit: number;
}

export interface CompanyData {
  name: string;
  year: number;
  quarter?: number;
  metrics: AnnualMetrics;
  fileName: string;
  uploadedAt: string;
}

interface CompareStore {
  companies: Record<string, CompanyData | null>;
  updateCompany: (id: string, data: CompanyData) => void;
  clearCompany: (id: string) => void;
  loadFromSupabase: () => Promise<void>;
  saveCompany: (id: string, data: CompanyData) => Promise<void>;
  filterYear: number | 'all';
  filterQuarter: number | 'all';
  setFilterYear: (year: number | 'all') => void;
  setFilterQuarter: (quarter: number | 'all') => void;
}

function emptyCompanies(): Record<string, CompanyData | null> {
  return {
    emma: null,
    klinique: null,
    masterpiece: null,
    teeraporn: null,
  };
}

function normalizeAnnualMetrics(metrics: Partial<AnnualMetrics> | null | undefined): AnnualMetrics {
  return {
    mainRevenue: metrics?.mainRevenue ?? metrics?.revenue ?? 0,
    revenue: metrics?.revenue ?? metrics?.mainRevenue ?? 0,
    operatingCost: metrics?.operatingCost ?? 0,
    grossProfit: metrics?.grossProfit ?? 0,
    sellingExpenses: metrics?.sellingExpenses ?? 0,
    adminExpenses: metrics?.adminExpenses ?? 0,
    totalSGA: metrics?.totalSGA ?? 0,
    operatingProfit: metrics?.operatingProfit ?? 0,
    depreciation: metrics?.depreciation ?? 0,
    ebit: metrics?.ebit ?? 0,
    financeCost: metrics?.financeCost ?? 0,
    ebt: metrics?.ebt ?? 0,
    tax: metrics?.tax ?? 0,
    netProfit: metrics?.netProfit ?? 0,
  };
}

export const useCompareStore = create<CompareStore>((set) => ({
  companies: emptyCompanies(),
  filterYear: 'all',
  filterQuarter: 'all',

  setFilterYear: (year) => set({ filterYear: year }),
  setFilterQuarter: (quarter) => set({ filterQuarter: quarter }),

  updateCompany: (id, data) =>
    set((state) => ({
      companies: { ...state.companies, [id]: data },
    })),

  clearCompany: (id) =>
    set((state) => ({
      companies: { ...state.companies, [id]: null },
    })),

  loadFromSupabase: async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('company_comparisons')
      .select('company_id, name, year, file_name, metrics, uploaded_at')
      .order('uploaded_at', { ascending: false });
    if (!error && rows) {
      const companies = emptyCompanies();
      for (const row of rows) {
        if (!(row.company_id in companies) || companies[row.company_id] !== null) continue;
        const metricsJson = row.metrics as Partial<AnnualMetrics> & { _quarter?: number };
        companies[row.company_id] = {
          name: row.name,
          year: row.year,
          quarter: typeof metricsJson._quarter === 'number' ? metricsJson._quarter : undefined,
          metrics: normalizeAnnualMetrics(metricsJson),
          fileName: row.file_name,
          uploadedAt: row.uploaded_at,
        };
      }
      set({ companies });
    }
  },

  saveCompany: async (id, data) => {
    set((state) => ({
      companies: { ...state.companies, [id]: data },
    }));
    if (!supabase) return;
    // Store quarter inside metrics JSONB (_quarter) — avoids needing a separate DB column
    const metricsPayload = data.quarter != null
      ? { ...normalizeAnnualMetrics(data.metrics), _quarter: data.quarter }
      : normalizeAnnualMetrics(data.metrics);
    const { error } = await supabase.from('company_comparisons').upsert(
      {
        company_id: id,
        name: data.name,
        year: data.year,
        file_name: data.fileName,
        metrics: metricsPayload,
        uploaded_at: data.uploadedAt,
      },
      { onConflict: 'company_id' }
    );
    if (error) throw new Error(error.message);
  },
}));
