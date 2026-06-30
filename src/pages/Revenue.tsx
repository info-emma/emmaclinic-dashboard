import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useDataStore } from '../store/useDataStore';
import { useT } from '../i18n/useT';
import KPICard from '../components/cards/KPICard';
import TrendChart from '../components/charts/TrendChart';
import PlanActualChart from '../components/charts/PlanActualChart';
import RevenueBreakdownChart from '../components/charts/RevenueBreakdownChart';
import ThresholdLegend from '../components/charts/ThresholdLegend';
import { resolveGPMarginThresholdConfig } from '../config/thresholds';
import { formatCurrency, formatPercent, formatMoM, formatVsPlan, sumMonths, calcGPPercent } from '../utils/formatters';
import { getCeilingPercentRemark, getCeilingPercentStatus, getFloorPercentRemark, getFloorPercentStatus, getPlanAchievementRemark, getPlanAchievementStatus, getPositiveRemark, getPositiveStatus, getStatusTextClass } from '../utils/metricStatus';
import { calculateAchievementThresholdPercent, calculateRevenueThresholdForGPMargin } from '../utils/thresholds';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };
type SortKey = 'value' | 'label';

export default function Revenue() {
  const { data, selectedMonths, showTarget, thresholdOverrides } = useDataStore();
  const t = useT();
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const thresholdConfig = resolveGPMarginThresholdConfig('revenue', data?.thresholdOverrides, thresholdOverrides);

  const metrics = useMemo(() => {
    if (!data?.actual) return null;
    const a = data.actual;
    const sm = selectedMonths;
    const lastM = sm[sm.length - 1] ?? 0;
    const prevM = lastM > 0 ? lastM - 1 : 0;
    const rev = sumMonths(a.totalRevenue.monthly, sm);
    const opex = sumMonths(a.operatingCost.monthly, sm);
    const gp = sumMonths(a.grossProfit.monthly, sm);
    const comp = showTarget ? data.target : data.plan;
    const planRev = comp ? sumMonths(comp.totalRevenue.monthly.plan, sm) : 0;
    const ofLabel = showTarget ? t.ofTarget : t.ofPlan;
    const vsPlan = planRev > 0 ? formatVsPlan(rev, planRev, ofLabel) : null;
    const mom = formatMoM(a.totalRevenue.monthly[lastM] ?? 0, a.totalRevenue.monthly[prevM] ?? 0, t.mom);
    return { rev, opex, gp, gpPct: calcGPPercent(gp, rev), mom, vsPlan, opexPct: rev > 0 ? (opex / rev) * 100 : 0 };
  }, [data, selectedMonths, showTarget, t]);

  const breakdown = useMemo(() => {
    if (!data?.actual?.revenueBreakdown) return [];
    const items = Object.values(data.actual.revenueBreakdown).map(item => ({
      label: item.label, value: sumMonths(item.monthly, selectedMonths),
    }));
    return sortKey === 'value' ? [...items].sort((a, b) => b.value - a.value) : [...items].sort((a, b) => a.label.localeCompare(b.label));
  }, [data, selectedMonths, sortKey]);

  const comp = showTarget ? data?.target : data?.plan;
  const revenueThreshold = comp
    ? calculateRevenueThresholdForGPMargin(
        comp.totalRevenue.monthly.plan,
        comp.grossProfit.monthly.plan,
        thresholdConfig.minimumGpMarginPct
      )
    : [];
  const achievementThreshold = comp
    ? calculateAchievementThresholdPercent(revenueThreshold, comp.totalRevenue.monthly.plan)
    : [];
  const basisLabel = showTarget ? t.target.toLowerCase() : t.plan.toLowerCase();
  const thresholdLabel = t.thresholdMinRevenueLabel.replace('{{pct}}', String(thresholdConfig.minimumGpMarginPct));
  const thresholdDescription = t.thresholdRevenueDescription
    .replace('{{pct}}', String(thresholdConfig.minimumGpMarginPct))
    .replace('{{basis}}', basisLabel);
  const thresholdAchievementDescription = t.thresholdAchievementDescription;

  if (!data?.actual) return <div className="flex items-center justify-center h-64"><p className="font-inter text-emma-grey text-sm">No data available.</p></div>;

  return (
    <div className="space-y-6">
      <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" {...fadeUp} transition={{ duration: 0.3 }}>
        <KPICard label={t.totalRevenue} value={metrics ? formatCurrency(metrics.rev, true) : '—'}
          subValue={metrics ? formatCurrency(metrics.rev) : undefined}
          momChange={metrics?.mom} vsPlan={metrics?.vsPlan ?? undefined}
          valueClassName={metrics?.vsPlan ? getStatusTextClass(getPlanAchievementStatus({ actual: metrics.rev, plan: comp ? sumMonths(comp.totalRevenue.monthly.plan, selectedMonths) : 0 })) : undefined}
          remark={metrics ? getPlanAchievementRemark('Revenue vs plan', metrics.rev, comp ? sumMonths(comp.totalRevenue.monthly.plan, selectedMonths) : 0) : undefined}
          accent />
        <KPICard label={t.operatingCost} value={metrics ? formatCurrency(metrics.opex, true) : '—'}
          subValue={metrics ? `${formatPercent(metrics.opexPct)} ${t.ofRevenue}` : undefined}
          valueClassName={metrics ? getStatusTextClass(getPositiveStatus(-metrics.opex)) : undefined}
          subValueClassName={metrics ? getStatusTextClass(getCeilingPercentStatus(metrics.opexPct, 50, 5)) : undefined}
          remark={metrics ? `Operating cost is treated as an expense, so higher values are worse. ${getCeilingPercentRemark('Operating cost ratio', metrics.opexPct, 50, 5)}` : undefined} />
        <KPICard label={t.grossProfit} value={metrics ? formatCurrency(metrics.gp, true) : '—'}
          subValue={metrics ? `${t.gpMargin} ${formatPercent(metrics.gpPct)}` : undefined}
          valueClassName={metrics ? getStatusTextClass(getPositiveStatus(metrics.gp)) : undefined}
          subValueClassName={metrics ? getStatusTextClass(getFloorPercentStatus(metrics.gpPct, 50, 5)) : undefined}
          remark={metrics ? `${getPositiveRemark('Gross profit', metrics.gp)} ${getFloorPercentRemark('GP margin', metrics.gpPct, 50, 5)}` : undefined} />
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4" {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="emma-card">
          <h3 className="emma-label mb-3">{t.monthlyRevenueTrend}</h3>
          <div className="h-[180px] sm:h-[220px]">
            <TrendChart
              actual={data.actual.totalRevenue.monthly}
              plan={comp?.totalRevenue.monthly.plan}
              threshold={revenueThreshold}
              thresholdLabel={thresholdLabel}
              selectedMonths={selectedMonths}
              showBars
            />
          </div>
          <ThresholdLegend
            thresholdLabel={thresholdLabel}
            thresholdDescription={thresholdDescription}
          />
        </div>
        <div className="emma-card">
          <h3 className="emma-label mb-3">{t.revenueVs} {showTarget ? t.target : t.plan}</h3>
          <div className="h-[180px] sm:h-[220px]">
            <PlanActualChart actual={data.actual.totalRevenue.monthly}
              plan={comp?.totalRevenue.monthly.plan ?? []}
              target={comp?.totalRevenue.monthly.plan ?? []}
              showTarget={showTarget}
              selectedMonths={selectedMonths}
              achievementThreshold={achievementThreshold}
              achievementThresholdLabel={thresholdLabel} />
          </div>
          <ThresholdLegend
            thresholdLabel={thresholdLabel}
            thresholdDescription={thresholdDescription}
            achievementDescription={thresholdAchievementDescription}
          />
        </div>
      </motion.div>

      <motion.div className="emma-card" {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="emma-label">{t.revenueBreakdown}</h3>
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
        <div style={{ height: Math.max(240, breakdown.length * 32 + 40) }}>
          <RevenueBreakdownChart data={breakdown} horizontal />
        </div>
      </motion.div>
    </div>
  );
}
