import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { BranchPLData, BranchReportMeta } from '../types';

interface BranchStore {
  reports: BranchReportMeta[];
  availableYears: number[];
  dataByMonth: Record<number, BranchPLData>; // key: month 0–11
  loadedYear: number | null;
  loading: boolean;
  fetchAvailableYears: () => Promise<void>;
  loadForYear: (year: number) => Promise<void>;
  saveBranchReport: (data: BranchPLData) => Promise<void>;
  saveBranchReports: (dataArray: BranchPLData[]) => Promise<void>;
  deleteBranchReport: (id: string) => Promise<void>;
}

export const useBranchStore = create<BranchStore>((set, get) => ({
  reports: [],
  availableYears: [],
  dataByMonth: {},
  loadedYear: null,
  loading: false,

  fetchAvailableYears: async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from('branch_reports')
      .select('year');

    if (!error && rows) {
      const years = [...new Set(
        rows.map(row => row.year).filter((year): year is number => typeof year === 'number')
      )].sort((a, b) => b - a);
      set({ availableYears: years });
    }
  },

  loadForYear: async (year) => {
    if (!supabase) return;
    await get().fetchAvailableYears();
    // Skip if already loaded for this year and we have data
    const { loadedYear, dataByMonth } = get();
    if (loadedYear === year && Object.keys(dataByMonth).length > 0) return;

    set({ loading: true });
    const { data: rows, error } = await supabase
      .from('branch_reports')
      .select('id, file_name, month, year, uploaded_at, data')
      .eq('year', year)
      .order('uploaded_at', { ascending: false });

    if (!error && rows) {
      const byMonth: Record<number, BranchPLData> = {};
      const metas: BranchReportMeta[] = [];
      for (const row of rows) {
        metas.push({
          id: row.id,
          file_name: row.file_name,
          month: row.month,
          year: row.year,
          uploaded_at: row.uploaded_at,
        });
        // Keep only the latest upload per month
        if (!(row.month in byMonth)) byMonth[row.month] = row.data as BranchPLData;
      }
      set({ reports: metas, dataByMonth: byMonth, loadedYear: year, loading: false });
    } else {
      set({ loading: false });
    }
  },

  saveBranchReport: async (data) => {
    if (!supabase) return;
    const { data: row, error } = await supabase
      .from('branch_reports')
      .insert({ file_name: data.fileName, month: data.month, year: data.year, data })
      .select('id, file_name, month, year, uploaded_at')
      .single();
    if (error) throw new Error(`บันทึกข้อมูล branch ไม่สำเร็จ: ${error.message}`);
    if (row) {
      set(state => ({
        // Replace any previous upload for the same year+month
        reports: [
          row,
          ...state.reports.filter(r => !(r.year === data.year && r.month === data.month)),
        ],
        dataByMonth: { ...state.dataByMonth, [data.month]: data },
        loadedYear: data.year,
      }));
    }
  },

  saveBranchReports: async (dataArray) => {
    if (!supabase) return;
    for (const data of dataArray) {
      const { data: row, error } = await supabase
        .from('branch_reports')
        .upsert(
          { file_name: data.fileName, month: data.month, year: data.year, data },
          { onConflict: 'year,month' }
        )
        .select('id, file_name, month, year, uploaded_at')
        .single();
      if (error) throw new Error(`บันทึกข้อมูล branch เดือน ${data.month + 1} ไม่สำเร็จ: ${error.message}`);
      if (row) {
        set(state => ({
          reports: [
            row,
            ...state.reports.filter(r => !(r.year === data.year && r.month === data.month)),
          ],
          dataByMonth: { ...state.dataByMonth, [data.month]: data },
          loadedYear: data.year,
        }));
      }
    }
  },

  deleteBranchReport: async (id) => {
    if (!supabase) return;
    const report = get().reports.find(r => r.id === id);
    const { error } = await supabase.from('branch_reports').delete().eq('id', id);
    if (error) throw new Error(`ลบไม่สำเร็จ: ${error.message}`);
    set(state => {
      const newDataByMonth = { ...state.dataByMonth };
      if (report) delete newDataByMonth[report.month];
      return {
        reports: state.reports.filter(r => r.id !== id),
        dataByMonth: newDataByMonth,
      };
    });
  },
}));
