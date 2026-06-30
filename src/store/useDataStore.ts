import { create } from 'zustand';
import type { DashboardData, ThresholdOverrides } from '../types';
import type { Language } from '../i18n/translations';
import { supabase } from '../lib/supabase';
import { normalizeDashboardData } from '../utils/normalizeDashboardData';

const THRESHOLD_SCOPES = ['overview', 'revenue', 'branch', 'procedure'] as const;

export interface ReportMeta {
  id: string;
  file_name: string;
  year: number | null;
  uploaded_at: string;
}

interface DataStore {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  selectedMonths: number[];
  selectedYear: number | null;
  operationSelectedMonths: number[];
  operationSelectedYear: number | null;
  showTarget: boolean;
  language: Language;
  reports: ReportMeta[];
  currentReportId: string | null;
  thresholdOverrides: ThresholdOverrides | null;
  fetchData: () => Promise<void>;
  fetchThresholdOverrides: () => Promise<void>;
  fetchReports: () => Promise<void>;
  loadReport: (id: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  saveReport: (fileName: string, data: DashboardData, year?: number) => Promise<void>;
  setSelectedMonths: (months: number[]) => void;
  toggleMonth: (month: number) => void;
  selectYTD: () => void;
  selectAllMonths: () => void;
  setSelectedYear: (year: number) => void;
  setOperationSelectedMonths: (months: number[]) => void;
  toggleOperationMonth: (month: number) => void;
  selectOperationYTD: () => void;
  selectOperationAllMonths: () => void;
  setOperationSelectedYear: (year: number) => void;
  resetOverviewFilters: () => void;
  resetOperationFilters: () => void;
  setShowTarget: (val: boolean) => void;
  setLanguage: (lang: Language) => void;
  updateData: (newData: DashboardData) => void;
}

const currentMonthIdx = new Date().getMonth();
const currentYear = new Date().getFullYear();

function normalizeYear(year: number | null): number | null {
  if (year == null) return null;
  return year > 2500 ? year - 543 : year;
}

function getYTDMonthsForYear(year: number | null): number[] {
  const normalizedYear = normalizeYear(year);
  const monthCount = normalizedYear != null && normalizedYear < currentYear ? 12 : currentMonthIdx + 1;
  return Array.from({ length: monthCount }, (_, i) => i);
}

function isSameMonthSelection(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((month, idx) => month === b[idx]);
}

export const useDataStore = create<DataStore>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  selectedMonths: getYTDMonthsForYear(null),
  selectedYear: null,
  operationSelectedMonths: getYTDMonthsForYear(currentYear),
  operationSelectedYear: currentYear,
  showTarget: false,
  language: 'en',
  reports: [],
  currentReportId: null,
  thresholdOverrides: null,

  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      await get().fetchThresholdOverrides();
      if (supabase) {
        // Load all report metas first to know available years
        const { data: allReports } = await supabase
          .from('monthly_reports')
          .select('id, file_name, year, uploaded_at')
          .order('uploaded_at', { ascending: false });

        if (allReports && allReports.length > 0) {
          // Determine which year to load: use selectedYear or default to latest
          const { selectedYear } = get();
          const availableYears = [...new Set(
            allReports.map(r => r.year).filter((y): y is number => y != null)
          )].sort((a, b) => b - a);
          const yearToLoad = selectedYear ?? availableYears[0];

          const latestRes = await supabase
            .from('monthly_reports')
            .select('id, file_name, year, uploaded_at, data')
            .eq('year', yearToLoad)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!latestRes.error && latestRes.data) {
            set({
              data: normalizeDashboardData(latestRes.data.data as DashboardData),
              currentReportId: latestRes.data.id,
              reports: allReports,
              selectedYear: yearToLoad,
              loading: false,
            });
            return;
          }
        }
      }
      // Fallback: load from /data.json
      const res = await fetch('/data.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      set({ data: normalizeDashboardData(json as DashboardData), loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      set({ error: msg, loading: false });
    }
  },

  fetchThresholdOverrides: async () => {
    if (!supabase) {
      set({ thresholdOverrides: null });
      return;
    }

    const { data: rows, error } = await supabase
      .from('threshold_settings')
      .select('scope, minimum_gp_margin_pct')
      .eq('is_active', true);

    if (error) {
      set({ thresholdOverrides: null });
      return;
    }

    const overrides = (rows ?? []).reduce<ThresholdOverrides>((acc, row) => {
      const scope = row.scope as typeof THRESHOLD_SCOPES[number] | undefined;
      if (scope && THRESHOLD_SCOPES.includes(scope)) {
        acc[scope] = { minimumGpMarginPct: row.minimum_gp_margin_pct ?? undefined };
      }
      return acc;
    }, {});

    set({ thresholdOverrides: Object.keys(overrides).length ? overrides : null });
  },

  fetchReports: async () => {
    if (!supabase) return;
    const { data: rows } = await supabase
      .from('monthly_reports')
      .select('id, file_name, year, uploaded_at')
      .order('uploaded_at', { ascending: false });
    if (rows) set({ reports: rows });
  },

  deleteReport: async (id) => {
    if (!supabase) return;
    const { error } = await supabase.from('monthly_reports').delete().eq('id', id);
    if (error) throw new Error(`ลบไม่สำเร็จ: ${error.message}`);
    const { currentReportId } = get();
    set(state => ({ reports: state.reports.filter(r => r.id !== id) }));
    // If deleted report was the active one, reload to get next latest
    if (currentReportId === id) {
      set({ data: null, currentReportId: null });
      get().fetchData();
    }
  },

  loadReport: async (id) => {
    if (!supabase) return;
    set({ loading: true });
    const { data: row, error } = await supabase
      .from('monthly_reports')
      .select('id, data')
      .eq('id', id)
      .single();
    if (!error && row) {
      set({ data: normalizeDashboardData(row.data as DashboardData), currentReportId: row.id, loading: false });
    } else {
      set({ loading: false });
    }
  },

  saveReport: async (fileName, data, year?) => {
    const normalizedData = normalizeDashboardData(data);
    set({ data: normalizedData });
    if (!supabase) return;
    const reportYear = year ?? new Date().getFullYear();
    const { data: row, error } = await supabase
      .from('monthly_reports')
      .insert({ file_name: fileName, data: normalizedData, year: reportYear })
      .select('id, file_name, year, uploaded_at')
      .single();
    if (error) {
      throw new Error(`บันทึกข้อมูลไม่สำเร็จ: ${error.message}`);
    }
    if (row) {
      set(state => ({
        currentReportId: row.id,
        reports: [row, ...state.reports],
        selectedYear: reportYear,
      }));
    }
  },

  setSelectedMonths: (months) => set({ selectedMonths: months }),

  toggleMonth: (month) => {
    const current = get().selectedMonths;
    if (current.includes(month)) {
      const next = current.filter(m => m !== month);
      set({ selectedMonths: next.length > 0 ? next : current });
    } else {
      set({ selectedMonths: [...current, month].sort((a, b) => a - b) });
    }
  },

  selectYTD: () => {
    const months = getYTDMonthsForYear(get().selectedYear);
    set({ selectedMonths: months });
  },

  selectAllMonths: () => {
    set({ selectedMonths: Array.from({ length: 12 }, (_, i) => i) });
  },

  setSelectedYear: (year) => {
    const currentSelection = get().selectedMonths;
    const currentYTD = getYTDMonthsForYear(get().selectedYear);
    const nextSelection = isSameMonthSelection(currentSelection, currentYTD)
      ? getYTDMonthsForYear(year)
      : currentSelection;
    set({ selectedYear: year, selectedMonths: nextSelection });
    get().fetchData();
  },

  setOperationSelectedMonths: (months) => set({ operationSelectedMonths: months }),

  toggleOperationMonth: (month) => {
    const current = get().operationSelectedMonths;
    if (current.includes(month)) {
      const next = current.filter(m => m !== month);
      set({ operationSelectedMonths: next.length > 0 ? next : current });
    } else {
      set({ operationSelectedMonths: [...current, month].sort((a, b) => a - b) });
    }
  },

  selectOperationYTD: () => {
    const months = getYTDMonthsForYear(get().operationSelectedYear);
    set({ operationSelectedMonths: months });
  },

  selectOperationAllMonths: () => {
    set({ operationSelectedMonths: Array.from({ length: 12 }, (_, i) => i) });
  },

  setOperationSelectedYear: (year) => {
    const currentSelection = get().operationSelectedMonths;
    const currentYTD = getYTDMonthsForYear(get().operationSelectedYear);
    const nextSelection = isSameMonthSelection(currentSelection, currentYTD)
      ? getYTDMonthsForYear(year)
      : currentSelection;
    set({ operationSelectedYear: year, operationSelectedMonths: nextSelection });
  },

  resetOverviewFilters: () => {
    const selectedYear = get().selectedYear;
    set({
      selectedMonths: getYTDMonthsForYear(selectedYear),
      showTarget: false,
    });
  },

  resetOperationFilters: () => {
    const operationSelectedYear = get().operationSelectedYear;
    set({
      operationSelectedMonths: getYTDMonthsForYear(operationSelectedYear),
    });
  },

  setShowTarget: (val) => set({ showTarget: val }),
  setLanguage: (lang) => set({ language: lang }),
  updateData: (newData) => set({ data: normalizeDashboardData(newData) }),
}));
