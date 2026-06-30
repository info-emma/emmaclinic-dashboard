import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Layers, RefreshCw, Trash2, Upload, ChevronDown, ChevronRight, History } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useBranchStore } from '../store/useBranchStore';
import { useT } from '../i18n/useT';
import KPICard from '../components/cards/KPICard';
import TrendChart from '../components/charts/TrendChart';
import RevenueBreakdownChart from '../components/charts/RevenueBreakdownChart';
import PLSummaryChart from '../components/charts/PLSummaryChart';
import DataUpload from '../components/upload/DataUpload';
import { formatCurrency, formatPercent, formatMoM, sumMonths, calcGPPercent } from '../utils/formatters';
import { getCeilingPercentRemark, getCeilingPercentStatus, getFloorPercentRemark, getFloorPercentStatus, getPositiveRemark, getPositiveStatus, getStatusTextClass } from '../utils/metricStatus';
import { MONTHS } from '../types';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };
type SortKey = 'value' | 'label';

function gpDotColor(p: number) {
  if (p > 50) return '#4CAF7D';
  if (p >= 45) return '#E4B87A';
  return '#E07070';
}

function DotIndicator({ pct }: { pct: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: 7, height: 7, backgroundColor: gpDotColor(pct) }}
    />
  );
}

const PROC_META: { key: string; labelEn: string; labelTh: string }[] = [
  { key: 'noseClose',     labelEn: 'Nose (Close)',    labelTh: 'จมูก (Close)' },
  { key: 'noseOpen',      labelEn: 'Nose (Open)',     labelTh: 'จมูก (Open)' },
  { key: 'chin',          labelEn: 'Chin',            labelTh: 'คาง' },
  { key: 'eyes',          labelEn: 'Eyes',            labelTh: 'ตา (2 ชั้น)' },
  { key: 'lips',          labelEn: 'Lips',            labelTh: 'ปาก' },
  { key: 'breast',        labelEn: 'Breast Aug.',     labelTh: 'หน้าอก' },
  { key: 'facelift',      labelEn: 'Facelift',        labelTh: 'Facelift' },
  { key: 'endotine',      labelEn: 'Endotine',        labelTh: 'Endotine' },
  { key: 'contouring',    labelEn: 'Contouring',      labelTh: 'ปรับรูปหน้า' },
  { key: 'lifting',       labelEn: 'Lifting',         labelTh: 'ยกกระชับ' },
  { key: 'skinTreatment', labelEn: 'Skin Treatment',  labelTh: 'งานผิว' },
  { key: 'otherRevenue',  labelEn: 'Other Revenue',   labelTh: 'รายได้อื่นๆ' },
];

export default function CostAnalysis() {
  const { data, selectedMonths, selectedYear, language } = useDataStore();
  const { reports: branchReports, dataByMonth, loadForYear, deleteBranchReport } = useBranchStore();
  const t = useT();
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [branchHistoryOpen, setBranchHistoryOpen] = useState(false);

  // Load branch data whenever the selected year changes
  useEffect(() => {
    if (selectedYear != null) loadForYear(selectedYear);
  }, [selectedYear, loadForYear]);

  // ── Main P&L metrics ───────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!data?.actual) return null;
    const a = data.actual;
    const sm = selectedMonths;
    const lastM = sm[sm.length - 1] ?? 0;
    const prevM = lastM > 0 ? lastM - 1 : 0;
    const rev  = sumMonths(a.totalRevenue.monthly, sm);
    const opex = sumMonths(a.operatingCost.monthly, sm);
    const sga  = sumMonths(a.totalSGA.monthly, sm);
    const deprc = sumMonths(a.depreciation.monthly, sm);
    const gp   = sumMonths(a.grossProfit.monthly, sm);
    const opexMoM = formatMoM(a.operatingCost.monthly[lastM] ?? 0, a.operatingCost.monthly[prevM] ?? 0, t.mom);
    return {
      rev, opex, sga, deprc, gp, opexMoM,
      opexPct: rev > 0 ? (opex / rev) * 100 : 0,
      sgaPct:  rev > 0 ? (sga  / rev) * 100 : 0,
      gpPct:   calcGPPercent(gp, rev),
    };
  }, [data, selectedMonths, t]);

  const marketingBreakdown = useMemo(() => {
    if (!data?.actual?.marketingBreakdown) return [];
    const items = Object.values(data.actual.marketingBreakdown).map(item => ({
      label: item.label, value: sumMonths(item.monthly, selectedMonths),
    })).filter(i => i.value !== 0);
    return sortKey === 'value'
      ? [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      : [...items].sort((a, b) => a.label.localeCompare(b.label));
  }, [data, selectedMonths, sortKey]);

  const plSummaryItems = useMemo(() => {
    if (!data?.actual || !metrics) return [];
    const a = data.actual;
    const sm = selectedMonths;
    return [
      { label: t.wfRevenue,   value: metrics.rev },
      { label: t.wfGP,        value: metrics.gp },
      { label: t.wfEBITDA,    value: sumMonths(a.ebitda.monthly, sm) },
      { label: t.wfNetProfit, value: sumMonths(a.netProfit.monthly, sm) },
    ];
  }, [data, selectedMonths, metrics, t]);

  // ── Branch P&L aggregation ─────────────────────────────────────────────────
  // Sum branch metrics across selectedMonths that have uploaded data
  const aggregatedBranches = useMemo(() => {
    const availableMonths = selectedMonths.filter(m => m in dataByMonth);
    if (availableMonths.length === 0) return null;

    const branchKeys = dataByMonth[availableMonths[0]].branches.map(b => ({
      key: b.branchKey, name: b.branchName,
    }));

    return branchKeys.map(({ key, name }) => {
      let totalRevenue = 0, grossProfit = 0, totalSGA = 0, ebitda = 0, netProfit = 0;
      for (const m of availableMonths) {
        const b = dataByMonth[m]?.branches.find(x => x.branchKey === key);
        if (!b) continue;
        totalRevenue += b.metrics.totalRevenue;
        grossProfit  += b.metrics.grossProfit;
        totalSGA     += b.metrics.totalSGA;
        ebitda       += b.metrics.ebitda;
        netProfit    += b.metrics.netProfit;
      }
      return {
        branchKey: key,
        branchName: name,
        totalRevenue,
        grossProfit,
        totalSGA,
        ebitda,
        netProfit,
        gpPct:  totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
        netPct: totalRevenue > 0 ? (netProfit   / totalRevenue) * 100 : 0,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [dataByMonth, selectedMonths]);

  // ── GP by Procedure aggregation (from main P&L revenueBreakdown) ──────────
  const gpByProcedure = useMemo(() => {
    if (!data?.actual) return null;
    const a = data.actual;
    const sm = selectedMonths;

    const totalRev = sumMonths(a.totalRevenue.monthly, sm);
    const totalGP  = sumMonths(a.grossProfit.monthly, sm);
    const overallGPPct = totalRev > 0 ? totalGP / totalRev : 0;

    const items = PROC_META
      .map(p => {
        const item = a.revenueBreakdown[p.key];
        const revenue = item ? sumMonths(item.monthly, sm) : 0;
        return { key: p.key, labelEn: p.labelEn, labelTh: p.labelTh, revenue, estGP: revenue * overallGPPct };
      })
      .filter(p => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const procRevTotal = items.reduce((s, p) => s + p.revenue, 0);
    const itemsWithPct = items.map(p => ({ ...p, revPct: procRevTotal > 0 ? p.revenue / procRevTotal : 0 }));

    return { items: itemsWithPct, overallGPPct, totalRev, totalGP };
  }, [data, selectedMonths]);

  // Months that have branch data uploaded (for the history list)
  const branchReportsSorted = useMemo(
    () => [...branchReports].sort((a, b) => a.month - b.month),
    [branchReports],
  );

  return (
    <div className="space-y-6">

      {/* ── Main P&L section (only shown when PL data exists) ──────────────── */}
      {data?.actual && (
        <>
          <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-3" {...fadeUp} transition={{ duration: 0.3 }}>
            <KPICard label={t.operatingCost} value={metrics ? formatCurrency(metrics.opex, true) : '—'}
              subValue={metrics ? `${formatPercent(metrics.opexPct)} ${t.ofRevenue}` : undefined}
              valueClassName={metrics ? getStatusTextClass(getPositiveStatus(-metrics.opex)) : undefined}
              subValueClassName={metrics ? getStatusTextClass(getCeilingPercentStatus(metrics.opexPct, 50, 5)) : undefined}
              remark={metrics ? `Operating cost is treated as an expense, so higher values are worse. ${getCeilingPercentRemark('Operating cost ratio', metrics.opexPct, 50, 5)}` : undefined}
              momChange={metrics?.opexMoM} accent />
            <KPICard label={t.ebitda.replace('EBITDA', 'SG&A')} value={metrics ? formatCurrency(metrics.sga, true) : '—'}
              subValue={metrics ? `${formatPercent(metrics.sgaPct)} ${t.ofRevenue}` : undefined}
              valueClassName={metrics ? getStatusTextClass(getPositiveStatus(-metrics.sga)) : undefined}
              subValueClassName={metrics ? getStatusTextClass(getCeilingPercentStatus(metrics.sgaPct, 50, 5)) : undefined}
              remark={metrics ? `SG&A is treated as an expense, so higher values are worse. ${getCeilingPercentRemark('SG&A ratio', metrics.sgaPct, 50, 5)}` : undefined} />
            <KPICard label={t.depreciation} value={metrics ? formatCurrency(metrics.deprc, true) : '—'}
              valueClassName={metrics ? getStatusTextClass(getPositiveStatus(-metrics.deprc)) : undefined}
              remark={metrics ? 'Depreciation is treated as a cost, so higher values are worse for the status colour.' : undefined} />
            <KPICard label={t.gpMargin} value={metrics ? formatPercent(metrics.gpPct) : '—'}
              subValue={metrics ? formatCurrency(metrics.gp, true) : undefined}
              valueClassName={metrics ? getStatusTextClass(getFloorPercentStatus(metrics.gpPct, 50, 5)) : undefined}
              subValueClassName={metrics ? getStatusTextClass(getPositiveStatus(metrics.gp)) : undefined}
              remark={metrics ? `${getFloorPercentRemark('GP margin', metrics.gpPct, 50, 5)} ${getPositiveRemark('Gross profit', metrics.gp)}` : undefined} />
          </motion.div>

          <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4" {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
            <div className="emma-card">
              <h3 className="emma-label mb-3">{t.costTrend}</h3>
              <div className="h-[180px] sm:h-[220px]">
                <TrendChart actual={data.actual.operatingCost.monthly} selectedMonths={selectedMonths} showBars />
              </div>
            </div>
            <div className="emma-card">
              <h3 className="emma-label mb-3">{t.plWaterfallShort}</h3>
              <div className="h-[180px] sm:h-[220px]">
                <PLSummaryChart items={plSummaryItems} />
              </div>
            </div>
          </motion.div>

          {marketingBreakdown.length > 0 && (
            <motion.div className="emma-card" {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="emma-label">{t.marketingBreakdown}</h3>
                <div className="flex gap-2">
                  {(['value', 'label'] as SortKey[]).map(k => (
                    <button key={k} onClick={() => setSortKey(k)}
                      className={`text-xs font-inter px-2.5 py-1 rounded-full border transition-colors
                        ${sortKey === k ? 'bg-emma-gold text-white border-emma-gold' : 'border-emma-border text-emma-grey hover:border-emma-gold-light'}`}>
                      {k === 'value' ? t.byValue : t.azSort}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ height: Math.max(240, marketingBreakdown.length * 32 + 40) }}>
                <RevenueBreakdownChart data={marketingBreakdown} horizontal />
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ── GP by Procedure ───────────────────────────────────────────────── */}
      {gpByProcedure && gpByProcedure.items.length > 0 && (
        <motion.div className="space-y-3" {...fadeUp} transition={{ duration: 0.3, delay: 0.15 }}>
          {/* Section header */}
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-emma-gold rounded-full" />
            <h3 className="font-inter text-sm font-semibold text-emma-black flex items-center gap-1.5">
              <Layers size={14} className="text-emma-gold-dark" />
              {t.gpByProcedure}
            </h3>
          </div>

          {/* Info note */}
          <p className="text-xs font-inter text-emma-grey-dark italic px-1">
            {t.gpByProcedureNote.replace('{{pct}}', formatPercent(gpByProcedure.overallGPPct * 100))}
          </p>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3">
            <KPICard
              label={t.procedureRevenue}
              value={formatCurrency(gpByProcedure.totalRev, true)}
              valueClassName={getStatusTextClass(getPositiveStatus(gpByProcedure.totalRev))}
            />
            <KPICard
              label={t.overallGPMargin}
              value={formatPercent(gpByProcedure.overallGPPct * 100)}
              subValue={formatCurrency(gpByProcedure.totalGP, true)}
              valueClassName={getStatusTextClass(getFloorPercentStatus(gpByProcedure.overallGPPct * 100, 50, 5))}
              subValueClassName={getStatusTextClass(getPositiveStatus(gpByProcedure.totalGP))}
            />
          </div>

          {/* Revenue bar chart */}
          <div className="emma-card">
            <h4 className="emma-label mb-3">{t.revenueByProcedure}</h4>
            <div style={{ height: Math.max(220, gpByProcedure.items.length * 30 + 50) }}>
              <RevenueBreakdownChart
                data={gpByProcedure.items.map(p => ({
                  label: language === 'en' ? p.labelEn : p.labelTh,
                  value: p.revenue,
                }))}
                horizontal
              />
            </div>
          </div>

          {/* Ranked table */}
          <div className="emma-card p-0 overflow-x-auto">
            <table className="w-full text-sm font-inter min-w-[500px]">
              <thead>
                <tr className="border-b border-emma-border bg-emma-nude/30">
                  <th className="text-center px-3 py-3 text-emma-grey-dark font-medium w-12">{t.rank}</th>
                  <th className="text-left px-4 py-3 text-emma-grey-dark font-medium">{t.procedure}</th>
                  <th className="text-right px-4 py-3 text-emma-grey-dark font-medium">{t.totalRevenue}</th>
                  <th className="text-right px-4 py-3 text-emma-grey-dark font-medium">{t.revenueShare}</th>
                  <th className="text-right px-4 py-3 text-emma-grey-dark font-medium">{t.estGP}</th>
                </tr>
              </thead>
              <tbody>
                {gpByProcedure.items.map((p, i) => (
                  <tr
                    key={p.key}
                    className={`border-b border-emma-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-emma-nude/20'}`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      {i < 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emma-gold/15 text-emma-gold-dark text-xs font-semibold border border-emma-gold/30">
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-xs text-emma-grey-dark">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-emma-black">
                      {language === 'en' ? p.labelEn : p.labelTh}
                    </td>
                    <td className="px-4 py-2.5 text-right text-emma-black">
                      {formatCurrency(p.revenue, true)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${
                      p.revPct > 0.2 ? 'text-emerald-600' : p.revPct > 0.1 ? 'text-amber-600' : 'text-emma-grey-dark'
                    }`}>
                      {formatPercent(p.revPct * 100)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${getStatusTextClass(getPositiveStatus(p.estGP))}`}>
                      {formatCurrency(p.estGP, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── P&L by Branch ─────────────────────────────────────────────────── */}
      <div>
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-emma-gold rounded-full" />
            <h3 className="font-inter text-sm font-semibold text-emma-black flex items-center gap-1.5">
              <GitBranch size={14} className="text-emma-gold-dark" />
              {t.plByBranch}
            </h3>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emma-gold/20 hover:bg-emma-gold/30 border border-emma-gold/40 text-emma-gold-dark text-xs font-inter font-medium rounded transition-all duration-200"
          >
            <Upload size={12} />
            {t.uploadBranchData}
          </button>
        </div>

        {/* Uploaded months history */}
        {branchReportsSorted.length > 0 && (
          <div className="emma-card p-0 overflow-hidden mb-4">
            <button
              onClick={() => setBranchHistoryOpen(open => !open)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-emma-nude/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-inter font-semibold text-emma-black">
                <History size={14} className="text-emma-gold-dark" />
                Uploaded Branch Files ({branchReportsSorted.length})
              </span>
              {branchHistoryOpen
                ? <ChevronDown size={16} className="text-emma-grey" />
                : <ChevronRight size={16} className="text-emma-grey" />}
            </button>

            {branchHistoryOpen && branchReportsSorted.map(r => (
              <div key={r.id} className="flex items-center border-t border-emma-border">
                <div className="flex-1 px-4 py-2.5 min-w-0">
                  <span className="text-xs font-inter font-medium text-emma-black">
                    {MONTHS[r.month]} {r.year > 2500 ? r.year - 543 : r.year}
                  </span>
                  <span className="ml-2 text-[10px] text-emma-grey">{r.file_name}</span>
                </div>
                <button
                  onClick={async () => {
                    setDeletingId(r.id);
                    try { await deleteBranchReport(r.id); } finally { setDeletingId(null); }
                  }}
                  disabled={deletingId === r.id}
                  className="flex-shrink-0 px-4 py-2.5 text-emma-grey hover:text-red-500 transition-colors disabled:opacity-40"
                  title="ลบ"
                >
                  {deletingId === r.id
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Branch dashboard — shown when aggregated data exists */}
        {aggregatedBranches && aggregatedBranches.length > 0 ? (
          <>
            {/* Revenue bar chart */}
            <div className="emma-card mb-4">
              <h4 className="emma-label mb-3">{t.revenueByBranch}</h4>
              <div style={{ height: Math.max(260, aggregatedBranches.length * 28 + 60) }}>
                <RevenueBreakdownChart
                  data={aggregatedBranches.map(b => ({ label: b.branchName, value: b.totalRevenue }))}
                  horizontal
                />
              </div>
            </div>

            {/* Metrics table */}
            <div className="emma-card p-0 overflow-x-auto">
              <table className="w-full text-xs font-inter min-w-[640px]">
                <thead>
                  <tr className="border-b border-emma-border bg-emma-nude/30">
                    <th className="text-left px-4 py-3 text-emma-grey font-medium">{t.branchCol}</th>
                    <th className="text-right px-4 py-3 text-emma-grey font-medium">{t.totalRevenue}</th>
                    <th className="text-right px-4 py-3 text-emma-grey font-medium">{t.grossProfit}</th>
                    <th className="text-right px-3 py-3 text-emma-grey font-medium">{t.gpMargin}</th>
                    <th className="text-right px-4 py-3 text-emma-grey font-medium">{t.ebitda}</th>
                    <th className="text-right px-4 py-3 text-emma-grey font-medium">{t.netProfit}</th>
                    <th className="text-right px-3 py-3 text-emma-grey font-medium">Net%</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedBranches.map((b, i) => (
                    <tr key={b.branchKey} className={`border-b border-emma-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-emma-nude/20'}`}>
                      <td className="px-4 py-2.5 font-medium text-emma-black">{b.branchName}</td>
                      <td className={`px-4 py-2.5 text-right ${getStatusTextClass(getPositiveStatus(b.totalRevenue))}`}>{formatCurrency(b.totalRevenue, true)}</td>
                      <td className={`px-4 py-2.5 text-right ${getStatusTextClass(getPositiveStatus(b.grossProfit))}`}>{formatCurrency(b.grossProfit, true)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <DotIndicator pct={b.gpPct} />
                          <span className="font-semibold" style={{ color: gpDotColor(b.gpPct) }}>
                            {formatPercent(b.gpPct)}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-emma-black">{formatCurrency(b.ebitda, true)}</td>
                      <td className="px-4 py-2.5 text-right text-emma-black">{formatCurrency(b.netProfit, true)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emma-black">{formatPercent(b.netPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="emma-card flex flex-col items-center py-14 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emma-nude flex items-center justify-center">
              <GitBranch size={22} className="text-emma-gold-dark" />
            </div>
            <div>
              <p className="font-playfair text-base text-emma-black mb-1">{t.noBranchData}</p>
              <p className="font-inter text-xs text-emma-grey max-w-xs">{t.noBranchDataDesc}</p>
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded border border-emma-gold/40 bg-emma-nude/60 hover:bg-emma-gold/10 hover:border-emma-gold text-xs font-inter text-emma-gold-dark transition-all duration-200"
            >
              <Upload size={12} />
              {t.uploadBranchData}
            </button>
          </div>
        )}
      </div>

      {uploadOpen && <DataUpload onClose={() => setUploadOpen(false)} />}
    </div>
  );
}
