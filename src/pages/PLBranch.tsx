import { useEffect, useMemo, useState } from 'react';
import {
  GitBranch, Upload, Trash2, Lightbulb, Sparkles, RefreshCw, ChevronDown, ChevronRight, History,
  Activity, AlertTriangle, Target, TrendingDown, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
  PieChart, Pie,
} from 'recharts';
import { useBranchStore } from '../store/useBranchStore';
import { useDataStore } from '../store/useDataStore';
import DataUpload from '../components/upload/DataUpload';
import KPICard from '../components/cards/KPICard';
import { MONTHS } from '../types';
import type { BranchMetrics, BranchRevenueBreakdown } from '../types';
import { formatCurrency, formatMillions, formatPercent, roundToDecimals } from '../utils/formatters';
import { getFloorPercentRemark, getFloorPercentStatus, getPositiveRemark, getPositiveStatus, getStatusTextClass } from '../utils/metricStatus';
import { useT } from '../i18n/useT';

const GOLD = '#C9A96E';
const GOLD_DARK = '#9C7A3C';
const NEG_COLOR = '#E07070';
const COLOR_OPCOST = '#7B9EC4';   // blue  – รวมต้นทุนกิจการ
const COLOR_SGA    = '#B8A0C8';   // purple – รวมค่าใช้จ่ายฯ
const COLOR_DEPR   = '#E4B87A';   // amber  – ค่าเสื่อมราคา

const PROC_LABELS: Record<string, string> = {
  noseClose:     'Nose (Close)',
  noseOpen:      'Nose (Open)',
  chin:          'Chin',
  eyes:          'Eyes',
  lips:          'Lips',
  breast:        'Breast',
  endotine:      'Endotine',
  contouring:    'Contouring',
  lifting:       'Lifting',
  skinTreatment: 'Skin Treatment',
};

const PROC_COLORS: Record<string, string> = {
  noseClose:    '#C4956A',
  breast:       '#8B5E3C',
  eyes:         '#D4A853',
  chin:         '#7B3F3F',
  noseOpen:     '#C47A8A',
  contouring:   '#4A6FA5',
  skinTreatment:'#5B9BD5',
  lifting:      '#4CAF7D',
  lips:         '#8BC34A',
  endotine:     '#26A69A',
};

const PROC_KEYS = Object.keys(PROC_LABELS) as (keyof BranchRevenueBreakdown)[];

function pct(num: number, den: number) {
  return den > 0 ? (num / den) * 100 : 0;
}
function fPct(num: number, den: number) {
  return den > 0 ? formatPercent(pct(num, den)) : '—';
}

function formatBranchMoney(value: number): string {
  return formatCurrency(value, true);
}

function formatBranchPercent(value: number): string {
  return formatPercent(value);
}

// Dot indicator: > 50% green, 45–50% yellow, < 45% red
function gpDotColor(p: number) {
  if (p > 50) return '#4CAF7D';
  if (p >= 45) return '#E4B87A';
  return '#E07070';
}

function DotIndicator({ pct: p }: { pct: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: 7, height: 7, backgroundColor: gpDotColor(p) }}
    />
  );
}

const GpBarLabel = ({ x, y, width, value }: { x?: number; y?: number; width?: number; value?: number }) => {
  if (value === undefined || x === undefined || y === undefined || width === undefined) return null;
  return (
    <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={11} fill={gpDotColor(value)} fontFamily="Inter, sans-serif" fontWeight={600}>
      {formatBranchPercent(value)}
    </text>
  );
};

export default function PLBranch() {
  const t = useT();
  const operationSelectedYear = useDataStore(s => s.operationSelectedYear);
  const operationSelectedMonths = useDataStore(s => s.operationSelectedMonths);
  const toggleOperationMonth = useDataStore(s => s.toggleOperationMonth);
  const { reports, dataByMonth, loadForYear, deleteBranchReport } = useBranchStore();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewBy, setViewBy] = useState<'revenue' | 'pct'>('revenue');
  const [aiRecs, setAiRecs] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const year = operationSelectedYear ?? new Date().getFullYear();

  useEffect(() => {
    loadForYear(year);
  }, [year, loadForYear]);

  // Available months sorted ascending (Jan first)
  const availableMonths = useMemo(
    () => Object.keys(dataByMonth).map(Number).sort((a, b) => a - b),
    [dataByMonth],
  );

  // Which months are actually active (empty = all available)
  const activeMonths = useMemo(
    () => (operationSelectedMonths.length > 0 ? operationSelectedMonths.filter(m => dataByMonth[m] !== undefined) : availableMonths),
    [operationSelectedMonths, availableMonths, dataByMonth],
  );

  // Aggregate metrics across all active months
  const { sortedBranches, gt } = useMemo(() => {
    if (activeMonths.length === 0) return { sortedBranches: [], gt: null };

    const branchMap: Record<string, { name: string; metrics: BranchMetrics }> = {};
    const emptyBreakdown = (): BranchRevenueBreakdown => ({
      noseClose: 0, noseOpen: 0, chin: 0, eyes: 0, lips: 0,
      breast: 0, endotine: 0, contouring: 0, lifting: 0, skinTreatment: 0,
    });

    for (const month of activeMonths) {
      const monthData = dataByMonth[month];
      if (!monthData) continue;
      for (const branch of monthData.branches) {
        if (!branchMap[branch.branchKey]) {
          branchMap[branch.branchKey] = {
            name: branch.branchName,
            metrics: { totalRevenue: 0, operatingCost: 0, grossProfit: 0, totalSGA: 0, ebitda: 0, depreciation: 0, netProfit: 0, revenueBreakdown: emptyBreakdown() },
          };
        }
        const acc = branchMap[branch.branchKey].metrics;
        const m = branch.metrics;
        acc.totalRevenue  += m.totalRevenue;
        acc.operatingCost += m.operatingCost;
        acc.grossProfit   += m.grossProfit;
        acc.totalSGA      += m.totalSGA;
        acc.ebitda        += m.ebitda;
        acc.depreciation  += m.depreciation;
        acc.netProfit     += m.netProfit;
        for (const k of Object.keys(emptyBreakdown()) as (keyof BranchRevenueBreakdown)[]) {
          acc.revenueBreakdown[k] += m.revenueBreakdown[k] ?? 0;
        }
      }
    }

    const branches = Object.entries(branchMap)
      .map(([branchKey, { name, metrics }]) => ({ branchKey, branchName: name, metrics }))
      .sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue);

    const sumMetric = (key: keyof Omit<BranchMetrics, 'revenueBreakdown'>) =>
      branches.reduce((s, b) => s + b.metrics[key], 0);

    const grandTotal: BranchMetrics = {
      totalRevenue:  sumMetric('totalRevenue'),
      operatingCost: sumMetric('operatingCost'),
      grossProfit:   sumMetric('grossProfit'),
      totalSGA:      sumMetric('totalSGA'),
      ebitda:        sumMetric('ebitda'),
      depreciation:  sumMetric('depreciation'),
      netProfit:     sumMetric('netProfit'),
      revenueBreakdown: Object.fromEntries(
        (Object.keys(emptyBreakdown()) as (keyof BranchRevenueBreakdown)[]).map(k => [
          k, branches.reduce((s, b) => s + b.metrics.revenueBreakdown[k], 0),
        ])
      ) as unknown as BranchRevenueBreakdown,
    };

    return { sortedBranches: branches, gt: grandTotal };
  }, [activeMonths, dataByMonth]);

  // Report history sorted latest first
  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month)),
    [reports],
  );

  // Bar chart data
  const revenueChartData = sortedBranches.map(b => ({
    name: b.branchName,
    revenue: b.metrics.totalRevenue,
    netProfit: b.metrics.netProfit,
  }));

  // GP% chart data
  const gpChartData = sortedBranches.map(b => ({
    name: b.branchName,
    gpPct: roundToDecimals(pct(b.metrics.grossProfit, b.metrics.totalRevenue)),
    netPct: roundToDecimals(pct(b.metrics.netProfit, b.metrics.totalRevenue)),
  }));

  // Cost breakdown chart data
  const costChartData = sortedBranches.map(b => ({
    name: b.branchName,
    operatingCost: b.metrics.operatingCost,
    totalSGA: b.metrics.totalSGA,
    depreciation: b.metrics.depreciation,
  }));

  const monthLabel = useMemo(() => {
    const sorted = [...activeMonths].sort((a, b) => a - b);
    if (sorted.length === 0) return '';
    if (sorted.length === availableMonths.length && availableMonths.length > 1) return `YTD ${year}`;
    if (sorted.length === 1) return `${MONTHS[sorted[0]]} ${year}`;
    return `${MONTHS[sorted[0]]}–${MONTHS[sorted[sorted.length - 1]]} ${year}`;
  }, [activeMonths, availableMonths.length, year]);

  // Procedure analytics (sorted by revenue desc)
  const procAnalytics = useMemo(() => {
    if (!gt || sortedBranches.length === 0) return [];
    return Object.entries(PROC_LABELS)
      .map(([key, label]) => {
        const total = sortedBranches.reduce(
          (s, b) => s + (b.metrics.revenueBreakdown[key as keyof BranchRevenueBreakdown] ?? 0), 0,
        );
        return { key, label, total, pct: gt.totalRevenue > 0 ? (total / gt.totalRevenue) * 100 : 0, color: PROC_COLORS[key] ?? GOLD };
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [sortedBranches, gt]);

  // MoM comparison (only when single month selected)
  const momComparison = useMemo(() => {
    if (activeMonths.length !== 1) return null;
    const prevMonth = activeMonths[0] - 1;
    if (prevMonth < 0) return null;
    const prevData = dataByMonth[prevMonth];
    if (!prevData) return null;
    const current = gt?.totalRevenue ?? 0;
    const prev = prevData.grandTotal.totalRevenue;
    if (prev === 0) return null;
    return { changePct: ((current - prev) / prev) * 100, label: MONTHS[prevMonth] };
  }, [activeMonths, dataByMonth, gt]);

  const keyInsight = useMemo(() => {
    if (procAnalytics.length < 3) return '';
    const [p1, p2, p3] = procAnalytics;
    const top3pct = formatBranchPercent(p1.pct + p2.pct + p3.pct);
    return `${p1.label} สร้างรายได้สูงสุด ${formatBranchMoney(p1.total)} (${formatBranchPercent(p1.pct)}) รองลงมาคือ ${p2.label} (${formatBranchPercent(p2.pct)}) และ ${p3.label} (${formatBranchPercent(p3.pct)}) โดย 3 อันดับแรกคิดเป็น ${top3pct} ของรายได้รวมทั้งหมด`;
  }, [procAnalytics]);

  const whatAiSees = useMemo(() => {
    if (!gt || sortedBranches.length === 0 || procAnalytics.length === 0) return null;

    const sortedMonths = [...activeMonths].sort((a, b) => a - b);
    const topProcedure = procAnalytics[0];
    const topProcedureBranches = sortedBranches
      .map(branch => ({
        name: branch.branchName,
        value: branch.metrics.revenueBreakdown[topProcedure.key as keyof BranchRevenueBreakdown] ?? 0,
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    const branchMix = sortedBranches
      .map(branch => {
        const topProc = PROC_KEYS
          .map(key => ({
            key,
            label: PROC_LABELS[key],
            value: branch.metrics.revenueBreakdown[key] ?? 0,
            color: PROC_COLORS[key] ?? GOLD,
          }))
          .sort((a, b) => b.value - a.value)[0];
        return {
          branch,
          topProc,
          topProcPct: pct(topProc?.value ?? 0, branch.metrics.totalRevenue),
        };
      })
      .filter(item => item.topProc && item.topProc.value > 0);

    const concentrationWatch = [...branchMix].sort((a, b) => b.topProcPct - a.topProcPct)[0];

    const procedureSpecialist = procAnalytics
      .filter(proc => proc.total >= gt.totalRevenue * 0.025)
      .map(proc => {
        const strongestBranch = sortedBranches
          .map(branch => ({
            name: branch.branchName,
            totalRevenue: branch.metrics.totalRevenue,
            value: branch.metrics.revenueBreakdown[proc.key as keyof BranchRevenueBreakdown] ?? 0,
          }))
          .sort((a, b) => b.value - a.value)[0];

        return {
          proc,
          branchName: strongestBranch?.name ?? '',
          value: strongestBranch?.value ?? 0,
          procShare: pct(strongestBranch?.value ?? 0, proc.total),
          branchShare: pct(strongestBranch?.value ?? 0, strongestBranch?.totalRevenue ?? 0),
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.procShare - a.procShare)[0];

    const monthTotals = sortedMonths.map(month => ({
      month,
      label: MONTHS[month],
      total: (dataByMonth[month]?.branches ?? []).reduce((sum, branch) => sum + branch.metrics.totalRevenue, 0),
    }));

    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths[sortedMonths.length - 2];
    const trend = lastMonth !== undefined && prevMonth !== undefined ? (() => {
      const lastTotal = monthTotals.find(item => item.month === lastMonth)?.total ?? 0;
      const prevTotal = monthTotals.find(item => item.month === prevMonth)?.total ?? 0;

      const procedureChanges = PROC_KEYS
        .map(key => {
          const lastValue = (dataByMonth[lastMonth]?.branches ?? []).reduce(
            (sum, branch) => sum + (branch.metrics.revenueBreakdown[key] ?? 0),
            0,
          );
          const prevValue = (dataByMonth[prevMonth]?.branches ?? []).reduce(
            (sum, branch) => sum + (branch.metrics.revenueBreakdown[key] ?? 0),
            0,
          );
          return {
            key,
            label: PROC_LABELS[key],
            color: PROC_COLORS[key] ?? GOLD,
            lastValue,
            prevValue,
            diff: lastValue - prevValue,
            changePct: prevValue > 0 ? ((lastValue - prevValue) / prevValue) * 100 : null,
          };
        })
        .filter(item => item.lastValue > 0 || item.prevValue > 0);

      const branchChanges = sortedBranches
        .map(branch => {
          const lastValue = dataByMonth[lastMonth]?.branches.find(item => item.branchKey === branch.branchKey)?.metrics.totalRevenue ?? 0;
          const prevValue = dataByMonth[prevMonth]?.branches.find(item => item.branchKey === branch.branchKey)?.metrics.totalRevenue ?? 0;
          return {
            name: branch.branchName,
            lastValue,
            prevValue,
            diff: lastValue - prevValue,
            changePct: prevValue > 0 ? ((lastValue - prevValue) / prevValue) * 100 : null,
          };
        })
        .filter(item => item.lastValue > 0 || item.prevValue > 0);

      return {
        prevLabel: MONTHS[prevMonth],
        lastLabel: MONTHS[lastMonth],
        totalDiff: lastTotal - prevTotal,
        totalChangePct: prevTotal > 0 ? ((lastTotal - prevTotal) / prevTotal) * 100 : null,
        topProcedureGrowth: [...procedureChanges].sort((a, b) => b.diff - a.diff)[0],
        topProcedureDrop: [...procedureChanges].sort((a, b) => a.diff - b.diff)[0],
        topBranchGrowth: [...branchChanges].sort((a, b) => b.diff - a.diff)[0],
      };
    })() : null;

    return {
      topProcedure,
      topProcedureBranches,
      concentrationWatch,
      procedureSpecialist,
      monthTotals,
      trend,
      branchMix: branchMix.slice(0, 4),
    };
  }, [activeMonths, dataByMonth, gt, procAnalytics, sortedBranches]);

  const generateAIRecommendations = async () => {
    if (sortedBranches.length === 0 || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const summary = sortedBranches.map(b =>
        `${b.branchName}: Revenue=฿${formatMillions(b.metrics.totalRevenue)}, GP%=${formatPercent(pct(b.metrics.grossProfit, b.metrics.totalRevenue))}, Net%=${formatPercent(pct(b.metrics.netProfit, b.metrics.totalRevenue))}, EBITDA=฿${formatMillions(b.metrics.ebitda)}`
      ).join('\n');
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: `You are a financial advisor for EMMA Clinic Thailand (premium aesthetic clinics).
Analyze branch performance and give ONE concise action recommendation (max 12 words) per branch.
Rules: GP% > 50% = strong, 45–50% = monitor costs, < 45% = urgent cost review.
Return ONLY a raw JSON array with no markdown, no code fences, no explanation:
[{"name":"<branchName>","rec":"<short action>"},...]`,
          messages: [{ role: 'user', content: summary }],
          maxTokens: 800,
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${resp.status}`);
      }
      const { content, error } = await resp.json();
      if (error) throw new Error(error);
      // Strip markdown code fences if Claude wraps the JSON
      const clean = content.replace(/```(?:json)?\n?/gi, '').replace(/```/g, '').trim();
      const parsed: { name: string; rec: string }[] = JSON.parse(clean);
      const map: Record<string, string> = {};
      for (const b of sortedBranches) {
        const match = parsed.find(
          p => p.name === b.branchName || b.branchName.includes(p.name) || p.name.includes(b.branchName),
        );
        if (match) map[b.branchKey] = match.rec;
      }
      if (Object.keys(map).length === 0) throw new Error('ไม่สามารถจับคู่ branch names ได้');
      setAiRecs(map);
    } catch (e: any) {
      console.error('AI recommendation error:', e);
      setAiError(e?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-emma-gold-dark" />
          <h2 className="font-playfair text-lg font-semibold text-emma-black">
            P&amp;L Branch
          </h2>
          {monthLabel && (
            <span className="text-sm text-emma-grey font-inter">— {monthLabel}</span>
          )}
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emma-gold/20 hover:bg-emma-gold/30 border border-emma-gold/40 text-emma-gold-dark text-xs font-inter font-medium rounded transition-all duration-200"
        >
          <Upload size={12} />
          {t.uploadBranchData}
        </button>
      </div>

      {/* ── Upload history ─────────────────────────────────────────────────── */}
      {sortedReports.length > 0 && (
        <div className="emma-card p-0 overflow-hidden">
          <button
            onClick={() => setHistoryOpen(open => !open)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-emma-nude/30 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-inter font-semibold text-emma-black">
              <History size={14} className="text-emma-gold-dark" />
              Uploaded Branch Files ({sortedReports.length})
            </span>
            {historyOpen
              ? <ChevronDown size={16} className="text-emma-grey" />
              : <ChevronRight size={16} className="text-emma-grey" />}
          </button>

          {historyOpen && sortedReports.map((r, i) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-4 py-2.5 border-t border-emma-border ${i < sortedReports.length - 1 ? '' : ''}`}
            >
              <span className="text-xs font-inter font-medium text-emma-gold-dark w-20 shrink-0">
                {MONTHS[r.month]} {r.year}
              </span>
              <span className="text-xs text-emma-grey font-inter truncate flex-1">{r.file_name}</span>
              <span className="text-[10px] text-emma-grey/60 font-inter shrink-0">
                {new Date(r.uploaded_at).toLocaleDateString('th-TH')}
              </span>
              <button
                onClick={() => deleteBranchReport(r.id)}
                className="p-1 text-emma-grey hover:text-red-500 transition-colors shrink-0"
                title="ลบ"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {sortedBranches.length === 0 && (
        <div className="emma-card flex flex-col items-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-emma-nude flex items-center justify-center">
            <GitBranch size={24} className="text-emma-gold-dark" />
          </div>
          <div>
            <p className="font-playfair text-base text-emma-black mb-1">{t.noBranchData}</p>
            <p className="text-xs text-emma-grey font-inter">{t.noBranchDataDesc}</p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emma-gold hover:bg-emma-gold-dark text-white text-xs font-inter font-medium rounded transition-all duration-200"
          >
            <Upload size={12} />
            {t.uploadBranchData}
          </button>
        </div>
      )}

      {/* ── Data section ───────────────────────────────────────────────────── */}
      {sortedBranches.length > 0 && gt && (
        <>
          {/* KPI Cards — Grand Total */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              label={t.totalRevenue}
              value={formatCurrency(gt.totalRevenue, true)}
              subValue={`${sortedBranches.length} ${t.branchCol}`}
              valueClassName={getStatusTextClass(getPositiveStatus(gt.totalRevenue))}
              remark={getPositiveRemark('Branch total revenue', gt.totalRevenue)}
              accent
            />
            <KPICard
              label={t.gpMargin}
              value={fPct(gt.grossProfit, gt.totalRevenue)}
              subValue={formatCurrency(gt.grossProfit, true)}
              valueClassName={getStatusTextClass(getFloorPercentStatus(pct(gt.grossProfit, gt.totalRevenue), 50, 5))}
              subValueClassName={getStatusTextClass(getPositiveStatus(gt.grossProfit))}
              remark={`${getFloorPercentRemark('GP margin', pct(gt.grossProfit, gt.totalRevenue), 50, 5)} ${getPositiveRemark('Gross profit', gt.grossProfit)}`}
            />
            <KPICard
              label="EBITDA%"
              value={fPct(gt.ebitda, gt.totalRevenue)}
              subValue={formatCurrency(gt.ebitda, true)}
              valueClassName={getStatusTextClass(getPositiveStatus(pct(gt.ebitda, gt.totalRevenue), 5))}
              subValueClassName={getStatusTextClass(getPositiveStatus(gt.ebitda))}
              remark={`${getPositiveRemark('EBITDA margin', pct(gt.ebitda, gt.totalRevenue), 5, 'positive and above the safety buffer')} ${getPositiveRemark('EBITDA', gt.ebitda)}`}
            />
            <KPICard
              label={`${t.netProfit}%`}
              value={fPct(gt.netProfit, gt.totalRevenue)}
              subValue={formatCurrency(gt.netProfit, true)}
              valueClassName={getStatusTextClass(getPositiveStatus(pct(gt.netProfit, gt.totalRevenue), 5))}
              subValueClassName={getStatusTextClass(getPositiveStatus(gt.netProfit))}
              remark={`${getPositiveRemark('Net profit margin', pct(gt.netProfit, gt.totalRevenue), 5, 'positive and above the safety buffer')} ${getPositiveRemark('Net profit', gt.netProfit)}`}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Revenue by Branch chart */}
            <div className="emma-card">
              <h3 className="emma-label mb-4">{t.revenueByBranch} — {monthLabel}</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 8, bottom: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 13, fontFamily: 'Noto Sans Thai, sans-serif', fill: '#5C5048' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={formatBranchMoney}
                      tick={{ fontSize: 13, fontFamily: 'Inter, sans-serif', fill: '#5C5048' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatBranchMoney(value), t.totalRevenue]}
                      contentStyle={{ borderRadius: 6, border: '1px solid #E8DDD0', fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={36}>
                      {revenueChartData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? GOLD_DARK : GOLD} fillOpacity={i === 0 ? 1 : 0.75} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GP% & Net% chart */}
            <div className="emma-card">
              <h3 className="emma-label mb-4">{t.gpNetByBranch} — {monthLabel}</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gpChartData} margin={{ top: 4, right: 8, left: 8, bottom: 32 }} barCategoryGap="30%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 13, fontFamily: 'Noto Sans Thai, sans-serif', fill: '#5C5048' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={formatBranchPercent}
                      tick={{ fontSize: 13, fontFamily: 'Inter, sans-serif', fill: '#5C5048' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatBranchPercent(value),
                        name === 'gpPct' ? 'GP%' : 'Net%',
                      ]}
                      contentStyle={{ borderRadius: 6, border: '1px solid #E8DDD0', fontSize: 12 }}
                    />
                    <ReferenceLine y={0} stroke="#ccc" />
                    <Bar dataKey="gpPct" name="gpPct" fill={GOLD} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={28} label={<GpBarLabel />} />
                    <Bar dataKey="netPct" name="netPct" radius={[3, 3, 0, 0]} maxBarSize={28}>
                      {gpChartData.map((d, i) => (
                        <Cell key={i} fill={d.netPct >= 0 ? '#6BAF9E' : NEG_COLOR} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1.5 mt-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] text-emma-grey font-inter uppercase tracking-wide">GP% Range:</span>
                  <span className="flex items-center gap-1 text-xs text-emma-grey-dark font-inter">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#4CAF7D' }} /> &gt;50%
                  </span>
                  <span className="flex items-center gap-1 text-xs text-emma-grey-dark font-inter">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#E4B87A' }} /> 45–50%
                  </span>
                  <span className="flex items-center gap-1 text-xs text-emma-grey-dark font-inter">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#E07070' }} /> &lt;45%
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-emma-grey-dark font-inter">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ background: GOLD }} /> GP%
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-emma-grey-dark font-inter">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#6BAF9E' }} /> Net%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Breakdown chart */}
          <div className="emma-card">
            <h3 className="emma-label mb-4">{t.costBreakdownByBranch} — {monthLabel}</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costChartData} margin={{ top: 4, right: 8, left: 8, bottom: 32 }} barCategoryGap="30%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 13, fontFamily: 'Noto Sans Thai, sans-serif', fill: '#5C5048' }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={formatBranchMoney}
                    tick={{ fontSize: 13, fontFamily: 'Inter, sans-serif', fill: '#5C5048' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        operatingCost: t.opCostFull,
                        totalSGA: t.sgaFull,
                        depreciation: t.deprcFull,
                      };
                      return [formatBranchMoney(value), labels[name] ?? name];
                    }}
                    contentStyle={{ borderRadius: 6, border: '1px solid #E8DDD0', fontSize: 11 }}
                  />
                  <Bar dataKey="operatingCost" name="operatingCost" fill={COLOR_OPCOST} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="totalSGA"      name="totalSGA"      fill={COLOR_SGA}    fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="depreciation"  name="depreciation"  fill={COLOR_DEPR}   fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 justify-end">
              <span className="flex items-center gap-1.5 text-xs text-emma-grey-dark font-inter">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_OPCOST }} /> {t.opCostShort}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emma-grey-dark font-inter">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_SGA }} /> {t.sgaShort}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emma-grey-dark font-inter">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR_DEPR }} /> {t.depreciation}
              </span>
            </div>
          </div>

          {/* Metrics table */}
          <div className="emma-card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-emma-border">
              <h3 className="emma-label">{t.branchMetrics} — {monthLabel}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-inter">
                <thead>
                  <tr className="border-b border-emma-border bg-emma-nude/40">
                    <th className="text-left px-4 py-2.5 text-emma-grey-dark font-medium">{t.branchCol}</th>
                    <th className="text-right px-4 py-2.5 text-emma-grey-dark font-medium">{t.totalRevenue}</th>
                    <th className="text-right px-4 py-2.5 text-emma-grey-dark font-medium">GP%</th>
                    <th className="px-4 py-2.5 text-emma-grey-dark font-medium min-w-[200px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Sparkles size={11} className="text-emma-gold" />
                            AI Recommend
                          </span>
                          <button
                            onClick={generateAIRecommendations}
                            disabled={aiLoading || sortedBranches.length === 0}
                            className="ml-auto px-2 py-0.5 rounded bg-emma-gold/10 hover:bg-emma-gold/20 text-emma-gold-dark text-[10px] font-medium transition-all disabled:opacity-40 flex items-center gap-1"
                          >
                            {aiLoading
                              ? <><RefreshCw size={9} className="animate-spin" /> Analyzing...</>
                              : <><Sparkles size={9} /> Generate</>}
                          </button>
                        </div>
                        {aiError && (
                          <span className="text-[9px] text-red-400 font-normal leading-tight">{aiError}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBranches.map((b, i) => {
                    const m = b.metrics;
                    return (
                      <tr
                        key={b.branchKey}
                        className={`border-b border-emma-border last:border-0 ${i === 0 ? 'bg-emma-gold/5' : 'hover:bg-emma-nude/30'} transition-colors`}
                      >
                        <td className="px-4 py-2.5 font-medium text-emma-black">
                          {i === 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emma-gold mr-1.5 mb-0.5" />}
                          {b.branchName}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-medium ${getStatusTextClass(getPositiveStatus(m.totalRevenue))}`}>
                          {formatCurrency(m.totalRevenue, true)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <DotIndicator pct={pct(m.grossProfit, m.totalRevenue)} />
                            <span style={{ color: gpDotColor(pct(m.grossProfit, m.totalRevenue)) }}>
                              {fPct(m.grossProfit, m.totalRevenue)}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {aiLoading ? (
                            <div className="h-5 w-40 bg-emma-border/40 rounded animate-pulse" />
                          ) : aiRecs[b.branchKey] ? (
                            <div className="inline-flex items-start gap-1.5 bg-emma-nude/60 border border-emma-border/60 rounded-lg px-2.5 py-1.5 max-w-[220px]">
                              <Sparkles size={10} className="text-emma-gold shrink-0 mt-0.5" />
                              <span className="text-[11px] font-inter text-emma-black leading-snug">{aiRecs[b.branchKey]}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-emma-grey/40 font-inter">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Grand Total row */}
                  <tr className="bg-emma-black text-emma-white">
                    <td className="px-4 py-2.5 font-semibold font-playfair">{t.grandTotal}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${getStatusTextClass(getPositiveStatus(gt.totalRevenue))}`}>
                      {formatCurrency(gt.totalRevenue, true)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <DotIndicator pct={pct(gt.grossProfit, gt.totalRevenue)} />
                        <span style={{ color: gpDotColor(pct(gt.grossProfit, gt.totalRevenue)) }}>
                          {fPct(gt.grossProfit, gt.totalRevenue)}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Revenue by Procedure — Rich Dashboard ─────────────────────── */}
          {procAnalytics.length > 0 && (
            <div className="emma-card p-0 overflow-hidden">
              {/* Header + toggle */}
              <div className="px-5 py-3 border-b border-emma-border flex items-center justify-between flex-wrap gap-2">
                <h3 className="emma-label">Revenue by Procedure — {monthLabel}</h3>
                <div className="flex items-center gap-1 bg-emma-nude rounded-full p-0.5">
                  {(['revenue', 'pct'] as const).map(v => (
                    <button key={v} onClick={() => setViewBy(v)}
                      className={`px-3 py-1 rounded-full text-xs font-inter font-medium transition-all ${viewBy === v ? 'bg-emma-gold text-white shadow-sm' : 'text-emma-grey hover:text-emma-black'}`}>
                      {v === 'revenue' ? 'Revenue' : '% Contribution'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Row 1: Total card + Ranked list */}
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
                  {/* Total revenue card */}
                  <div className="flex flex-col justify-start gap-2 p-4 bg-emma-nude/30 rounded-xl border border-emma-border">
                    <p className="text-[10px] font-inter font-medium text-emma-grey uppercase tracking-wide">Total Revenue</p>
                    <p className="font-playfair text-3xl font-semibold text-emma-black leading-tight">{formatCurrency(gt.totalRevenue, true)}</p>
                    {momComparison && (
                      <p className={`text-xs font-inter font-medium flex items-center gap-1 ${momComparison.changePct >= 0 ? 'text-acc-positive' : 'text-acc-negative'}`}>
                        {momComparison.changePct >= 0 ? '▲' : '▼'} {formatBranchPercent(Math.abs(momComparison.changePct))} vs {momComparison.label} {year}
                      </p>
                    )}
                    <p className="text-xs font-inter text-emma-grey mt-auto">{procAnalytics.length} procedure types</p>
                  </div>

                  {/* Top procedures ranked list */}
                  <div>
                    <p className="text-[10px] font-inter font-medium text-emma-grey uppercase tracking-wide mb-3">Top Procedures by Revenue</p>
                    <div className="space-y-2.5">
                      {procAnalytics.map((p, i) => (
                        <div key={p.key} className="flex items-center gap-2.5">
                          <span className="w-5 text-xs font-inter font-semibold text-emma-grey-dark text-right shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-inter text-emma-black">{p.label}</span>
                              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                <DotIndicator pct={p.pct} />
                                <span className="text-sm font-inter font-semibold text-emma-black">
                                  {viewBy === 'pct' ? formatBranchPercent(p.pct) : formatBranchMoney(p.total)}
                                </span>
                                {viewBy !== 'pct' && <span className="text-xs font-inter text-emma-grey w-12 text-right">{formatBranchPercent(p.pct)}</span>}
                              </div>
                            </div>
                            <div className="h-1.5 bg-emma-border rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t border-emma-border pt-2 mt-1">
                        <span className="text-sm font-inter font-semibold text-emma-black">Total</span>
                        <span className="text-sm font-inter font-semibold text-emma-black">{formatCurrency(gt.totalRevenue, true)}</span>
                        <span className="text-xs font-inter text-emma-grey w-8 text-right">100%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Procedure bar + Donut */}
                <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5 items-start">
                  <div>
                    <p className="text-[10px] font-inter font-medium text-emma-grey uppercase tracking-wide mb-2">
                      Revenue by Procedure{viewBy === 'pct' ? ' — % Contribution' : ' (Total)'}
                    </p>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={procAnalytics} margin={{ top: 24, right: 8, left: 0, bottom: 64 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 12, fontFamily: 'Inter, sans-serif', fill: '#5C5048' }}
                            angle={-35} textAnchor="end" interval={0} tickLine={false} axisLine={false} />
                          <YAxis hide />
                          <Tooltip
                            formatter={(v: number, name: string) => [
                              name === 'pct' ? formatBranchPercent(v) : formatBranchMoney(v),
                              name === 'pct' ? 'Contribution' : 'Revenue',
                            ]}
                            contentStyle={{ borderRadius: 6, border: '1px solid #E8DDD0', fontSize: 11 }}
                          />
                          <Bar dataKey={viewBy === 'pct' ? 'pct' : 'total'} radius={[4, 4, 0, 0]} maxBarSize={52}
                            label={{ position: 'top', fontSize: 11, fill: '#5C5048',
                              formatter: (v: number) => viewBy === 'pct' ? formatBranchPercent(v) : formatBranchMoney(v) }}>
                            {procAnalytics.map((p, i) => <Cell key={i} fill={p.color} fillOpacity={0.9} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Donut chart */}
                  <div>
                    <p className="text-[10px] font-inter font-medium text-emma-grey uppercase tracking-wide mb-3">Revenue Contribution</p>
                    <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-4">
                      <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={procAnalytics.map(p => ({ name: p.label, value: p.total }))}
                              cx="50%" cy="50%" innerRadius={62} outerRadius={92}
                              dataKey="value" paddingAngle={1}>
                              {procAnalytics.map((p, i) => <Cell key={i} fill={p.color} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatBranchMoney(v)}
                              contentStyle={{ borderRadius: 6, border: '1px solid #E8DDD0', fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="font-playfair text-sm font-semibold text-emma-black leading-tight">{formatCurrency(gt.totalRevenue, true)}</span>
                          <span className="text-[10px] text-emma-grey font-inter mt-0.5">Total Revenue</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {procAnalytics.map(p => (
                          <div key={p.key} className="flex items-center gap-2 text-xs font-inter">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                            <span className="text-emma-grey-dark flex-1">{p.label}</span>
                            <span className="font-semibold text-emma-black shrink-0">{formatBranchMoney(p.total)}</span>
                            <span className="text-emma-grey shrink-0 w-14 text-right">({formatBranchPercent(p.pct)})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Insight */}
                {keyInsight && (
                  <div className="flex items-start gap-2.5 bg-emma-nude/50 border border-emma-border rounded-lg px-4 py-3">
                    <Lightbulb size={14} className="text-emma-gold shrink-0 mt-0.5" />
                    <p className="text-xs font-inter text-emma-grey-dark leading-relaxed">
                      <span className="font-semibold text-emma-black">KEY INSIGHT</span>{'  '}{keyInsight}
                    </p>
                  </div>
                )}

                {/* What AI Sees */}
                {whatAiSees && (
                  <div className="border-t border-emma-border pt-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles size={15} className="text-emma-gold-dark" />
                          <h4 className="font-playfair text-base font-semibold text-emma-black">What AI Sees?</h4>
                        </div>
                        <p className="text-xs font-inter text-emma-grey mt-1">
                          Auto-read highlights from branch x procedure mix and monthly movement.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emma-gold/10 text-[10px] font-inter font-semibold text-emma-gold-dark uppercase tracking-wide">
                        {monthLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <div className="rounded-lg border border-emma-border bg-emma-nude/25 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Target size={14} className="text-emma-gold-dark" />
                          <span className="text-[10px] font-inter font-semibold text-emma-grey uppercase tracking-wide">Revenue Anchor</span>
                        </div>
                        <p className="font-playfair text-lg font-semibold text-emma-black leading-tight">{whatAiSees.topProcedure.label}</p>
                        <p className="text-xs font-inter text-emma-grey-dark mt-1">
                          {formatBranchMoney(whatAiSees.topProcedure.total)} หรือ {formatBranchPercent(whatAiSees.topProcedure.pct)} ของ revenue mix
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {whatAiSees.topProcedureBranches.map(branch => (
                            <span key={branch.name} className="px-2 py-1 rounded-full bg-white/70 border border-emma-border text-[10px] font-inter text-emma-grey-dark">
                              {branch.name} {formatBranchMoney(branch.value)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {whatAiSees.procedureSpecialist && (
                        <div className="rounded-lg border border-emma-border bg-white/70 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Activity size={14} className="text-[#4A6FA5]" />
                            <span className="text-[10px] font-inter font-semibold text-emma-grey uppercase tracking-wide">Specialist Signal</span>
                          </div>
                          <p className="font-playfair text-lg font-semibold text-emma-black leading-tight">
                            {whatAiSees.procedureSpecialist.branchName} x {whatAiSees.procedureSpecialist.proc.label}
                          </p>
                          <p className="text-xs font-inter text-emma-grey-dark mt-1">
                            ถือ {formatBranchPercent(whatAiSees.procedureSpecialist.procShare)} ของ {whatAiSees.procedureSpecialist.proc.label} ทั้งหมด
                          </p>
                          <div className="h-1.5 bg-emma-border rounded-full overflow-hidden mt-3">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, whatAiSees.procedureSpecialist.procShare)}%`,
                                backgroundColor: whatAiSees.procedureSpecialist.proc.color,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {whatAiSees.concentrationWatch && (
                        <div className="rounded-lg border border-emma-border bg-emma-nude/25 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={14} className="text-[#E4B87A]" />
                            <span className="text-[10px] font-inter font-semibold text-emma-grey uppercase tracking-wide">Concentration Watch</span>
                          </div>
                          <p className="font-playfair text-lg font-semibold text-emma-black leading-tight">{whatAiSees.concentrationWatch.branch.branchName}</p>
                          <p className="text-xs font-inter text-emma-grey-dark mt-1">
                            {whatAiSees.concentrationWatch.topProc.label} คิดเป็น {formatBranchPercent(whatAiSees.concentrationWatch.topProcPct)} ของสาขา
                          </p>
                          <div className="h-1.5 bg-emma-border rounded-full overflow-hidden mt-3">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, whatAiSees.concentrationWatch.topProcPct)}%`,
                                backgroundColor: whatAiSees.concentrationWatch.topProc.color,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4">
                      <div className="rounded-lg border border-emma-border bg-white/70 p-4">
                        <p className="text-[10px] font-inter font-semibold text-emma-grey uppercase tracking-wide mb-3">Branch x Procedure Notes</p>
                        <div className="space-y-3">
                          {whatAiSees.branchMix.map(item => (
                            <div key={item.branch.branchKey} className="grid grid-cols-[88px_1fr] sm:grid-cols-[110px_1fr] gap-3 items-center">
                              <span className="text-xs font-inter font-semibold text-emma-black truncate">{item.branch.branchName}</span>
                              <div>
                                <div className="flex items-center justify-between gap-3 mb-1">
                                  <span className="text-xs font-inter text-emma-grey-dark">
                                    นำโดย {item.topProc.label}
                                  </span>
                                  <span className="text-xs font-inter font-semibold text-emma-black shrink-0">
                                    {formatBranchPercent(item.topProcPct)}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-emma-border rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${Math.min(100, item.topProcPct)}%`, backgroundColor: item.topProc.color }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-emma-border bg-emma-nude/25 p-4">
                        <p className="text-[10px] font-inter font-semibold text-emma-grey uppercase tracking-wide mb-3">Monthly Trend</p>
                        <div className="flex items-end gap-2 h-24 mb-3">
                          {whatAiSees.monthTotals.map(month => {
                            const maxTotal = Math.max(...whatAiSees.monthTotals.map(item => item.total), 1);
                            return (
                              <div key={month.month} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                                <div
                                  className="w-full max-w-[34px] rounded-t bg-emma-gold/80"
                                  style={{ height: `${Math.max(8, (month.total / maxTotal) * 72)}px` }}
                                  title={`${month.label}: ${formatBranchMoney(month.total)}`}
                                />
                                <span className="text-[10px] font-inter text-emma-grey-dark">{month.label}</span>
                              </div>
                            );
                          })}
                        </div>

                        {whatAiSees.trend ? (
                          <div className="space-y-2">
                            <div className={`flex items-center gap-2 text-xs font-inter font-semibold ${whatAiSees.trend.totalDiff >= 0 ? 'text-acc-positive' : 'text-acc-negative'}`}>
                              {whatAiSees.trend.totalDiff >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                              <span>
                                {whatAiSees.trend.lastLabel} vs {whatAiSees.trend.prevLabel}: {whatAiSees.trend.totalDiff >= 0 ? '+' : ''}
                                {formatBranchMoney(whatAiSees.trend.totalDiff)}
                                {whatAiSees.trend.totalChangePct !== null && ` (${whatAiSees.trend.totalChangePct >= 0 ? '+' : ''}${formatBranchPercent(whatAiSees.trend.totalChangePct)})`}
                              </span>
                            </div>
                            {whatAiSees.trend.topProcedureGrowth && (
                              <p className="text-xs font-inter text-emma-grey-dark leading-relaxed">
                                Procedure โตเด่น: <span className="font-semibold text-emma-black">{whatAiSees.trend.topProcedureGrowth.label}</span> {whatAiSees.trend.topProcedureGrowth.diff >= 0 ? '+' : ''}{formatBranchMoney(whatAiSees.trend.topProcedureGrowth.diff)}
                              </p>
                            )}
                            {whatAiSees.trend.topBranchGrowth && (
                              <p className="text-xs font-inter text-emma-grey-dark leading-relaxed">
                                Branch ดันยอด: <span className="font-semibold text-emma-black">{whatAiSees.trend.topBranchGrowth.name}</span> {whatAiSees.trend.topBranchGrowth.diff >= 0 ? '+' : ''}{formatBranchMoney(whatAiSees.trend.topBranchGrowth.diff)}
                              </p>
                            )}
                            {whatAiSees.trend.topProcedureDrop && whatAiSees.trend.topProcedureDrop.diff < 0 && (
                              <p className="text-xs font-inter text-emma-grey-dark leading-relaxed">
                                จุดชะลอ: <span className="font-semibold text-emma-black">{whatAiSees.trend.topProcedureDrop.label}</span> {formatBranchMoney(whatAiSees.trend.topProcedureDrop.diff)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs font-inter text-emma-grey-dark leading-relaxed">
                            เลือกมากกว่า 1 เดือนเพื่อดู momentum รายเดือน
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Revenue by Procedure per Branch — detail table */}
          <div className="emma-card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-emma-border">
              <h3 className="emma-label">Revenue by Procedure — {monthLabel}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-inter">
                <thead>
                  <tr className="border-b border-emma-border bg-emma-nude/40">
                    <th className="text-left px-4 py-2.5 text-emma-grey-dark font-medium w-36">Procedure</th>
                    {sortedBranches.map(b => (
                      <th key={b.branchKey} className="text-right px-3 py-2.5 text-emma-grey-dark font-medium whitespace-nowrap">
                        {b.branchName}
                      </th>
                    ))}
                    <th className="text-right px-3 py-2.5 text-emma-grey-dark font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(PROC_LABELS).map(key => {
                    const rowTotal = sortedBranches.reduce(
                      (sum, b) => sum + (b.metrics.revenueBreakdown[key as keyof typeof b.metrics.revenueBreakdown] ?? 0), 0
                    );
                    if (rowTotal === 0) return null;
                    return (
                      <tr key={key} className="border-b border-emma-border last:border-0 hover:bg-emma-nude/20 transition-colors">
                        <td className="px-4 py-2 text-emma-grey-dark">{PROC_LABELS[key]}</td>
                        {sortedBranches.map(b => {
                          const val = b.metrics.revenueBreakdown[key as keyof typeof b.metrics.revenueBreakdown] ?? 0;
                          const pctVal = b.metrics.totalRevenue > 0 ? (val / b.metrics.totalRevenue) * 100 : 0;
                          return (
                            <td key={b.branchKey} className="px-3 py-2 text-right">
                              {val > 0 ? (
                                <>
                                  <span className="text-emma-black font-medium">{formatBranchMoney(val)}</span>
                                  <span className="text-emma-grey text-xs ml-1">({formatBranchPercent(pctVal)})</span>
                                </>
                              ) : <span className="text-emma-grey/40">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-medium text-emma-gold-dark">
                          {formatBranchMoney(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Grand total row */}
                  <tr className="bg-emma-black text-emma-white">
                    <td className="px-4 py-2.5 font-semibold font-playfair">{t.grandTotal}</td>
                    {sortedBranches.map(b => (
                      <td key={b.branchKey} className="px-3 py-2.5 text-right font-semibold">
                        {formatCurrency(b.metrics.totalRevenue, true)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {formatCurrency(gt.totalRevenue, true)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {uploadOpen && <DataUpload onClose={() => setUploadOpen(false)} />}
    </div>
  );
}
