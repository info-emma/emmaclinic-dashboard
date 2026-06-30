import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, BarChart2, Activity } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useT } from '../i18n/useT';
import KPICard from '../components/cards/KPICard';
import TrendChart from '../components/charts/TrendChart';
import PlanActualChart from '../components/charts/PlanActualChart';
import PLSummaryChart from '../components/charts/PLSummaryChart';
import ThresholdLegend from '../components/charts/ThresholdLegend';
import { resolveGPMarginThresholdConfig } from '../config/thresholds';
import { formatCurrency, formatPercent, formatMoM, formatVsPlan, sumMonths, calcGPPercent } from '../utils/formatters';
import { getFloorPercentRemark, getFloorPercentStatus, getPlanAchievementRemark, getPlanAchievementStatus, getPositiveRemark, getPositiveStatus, getStatusTextClass } from '../utils/metricStatus';
import { calculateAchievementThresholdPercent, calculateRevenueThresholdForGPMargin } from '../utils/thresholds';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export default function Overview() {
  const { data, selectedMonths, showTarget, thresholdOverrides } = useDataStore();
  const t = useT();
  const thresholdConfig = resolveGPMarginThresholdConfig('overview', data?.thresholdOverrides, thresholdOverrides);

  const metrics = useMemo(() => {
    if (!data?.actual) return null;
    const a = data.actual;
    const sm = selectedMonths;
    const lastM = sm[sm.length - 1] ?? 0;
    const prevM = lastM > 0 ? lastM - 1 : 0;

    const rev = sumMonths(a.totalRevenue.monthly, sm);
    const gp = sumMonths(a.grossProfit.monthly, sm);
    const ebitda = sumMonths(a.ebitda.monthly, sm);
    const np = sumMonths(a.netProfit.monthly, sm);

    const revMoM = formatMoM(a.totalRevenue.monthly[lastM] ?? 0, a.totalRevenue.monthly[prevM] ?? 0, t.mom);
    const npMoM = formatMoM(a.netProfit.monthly[lastM] ?? 0, a.netProfit.monthly[prevM] ?? 0, t.mom);

    const comp = showTarget ? data.target : data.plan;
    const planRev = comp ? sumMonths(comp.totalRevenue.monthly.plan, sm) : 0;
    const planNP = comp ? sumMonths(comp.netProfit.monthly.plan, sm) : 0;
    const ofLabel = showTarget ? t.ofTarget : t.ofPlan;
    const vsPlanRev = planRev > 0 ? formatVsPlan(rev, planRev, ofLabel) : null;
    const vsPlanNP = planNP !== 0 ? formatVsPlan(np, planNP, ofLabel) : null;

    return { rev, gp, ebitda, np, revMoM, npMoM, vsPlanRev, vsPlanNP };
  }, [data, selectedMonths, showTarget, t]);

  const comp = showTarget ? data?.target : data?.plan;
  const thresholdPct = thresholdConfig.minimumGpMarginPct;
  const revenueThreshold = comp
    ? calculateRevenueThresholdForGPMargin(
        comp.totalRevenue.monthly.plan,
        comp.grossProfit.monthly.plan,
        thresholdPct
      )
    : [];
  const achievementThreshold = comp
    ? calculateAchievementThresholdPercent(revenueThreshold, comp.totalRevenue.monthly.plan)
    : [];
  const basisLabel = showTarget ? t.target.toLowerCase() : t.plan.toLowerCase();
  const thresholdLabel = t.thresholdMinRevenueLabel.replace('{{pct}}', String(thresholdPct));
  const thresholdDescription = t.thresholdRevenueDescription
    .replace('{{pct}}', String(thresholdPct))
    .replace('{{basis}}', basisLabel);
  const thresholdAchievementDescription = t.thresholdAchievementDescription;

  const plSummaryItems = useMemo(() => {
    if (!data?.actual) return [];
    const a = data.actual;
    const sm = selectedMonths;
    return [
      { label: t.wfRevenue,    value: sumMonths(a.totalRevenue.monthly, sm) },
      { label: t.wfGrossProfit, value: sumMonths(a.grossProfit.monthly, sm) },
      { label: t.wfEBITDA,     value: sumMonths(a.ebitda.monthly, sm) },
      { label: t.wfEBIT,       value: sumMonths(a.ebit.monthly, sm) },
      { label: t.wfNetProfit,  value: sumMonths(a.netProfit.monthly, sm) },
    ];
  }, [data, selectedMonths, t]);

  if (!data?.actual) {
    return <div className="flex items-center justify-center h-64"><p className="font-inter text-emma-grey text-sm">No data available.</p></div>;
  }

  const gpPct = metrics ? calcGPPercent(metrics.gp, metrics.rev) : 0;
  const ebitdaPct = metrics && metrics.rev > 0 ? (metrics.ebitda / metrics.rev) * 100 : 0;

  return (
    <div className="space-y-6">
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-3" {...fadeUp} transition={{ duration: 0.3 }}>
        <KPICard label={t.totalRevenue} value={metrics ? formatCurrency(metrics.rev, true) : '—'}
          subValue={metrics ? formatCurrency(metrics.rev) : undefined}
          momChange={metrics?.revMoM} vsPlan={metrics?.vsPlanRev ?? undefined}
          valueClassName={metrics?.vsPlanRev ? getStatusTextClass(getPlanAchievementStatus({ actual: metrics.rev, plan: comp ? sumMonths(comp.totalRevenue.monthly.plan, selectedMonths) : 0 })) : undefined}
          remark={metrics ? getPlanAchievementRemark('Revenue vs plan', metrics.rev, comp ? sumMonths(comp.totalRevenue.monthly.plan, selectedMonths) : 0) : undefined}
          icon={<DollarSign size={14} />} accent />
        <KPICard label={t.grossProfit} value={metrics ? formatCurrency(metrics.gp, true) : '—'}
          subValue={metrics ? `${t.gpMargin} ${formatPercent(gpPct)}` : undefined}
          valueClassName={metrics ? getStatusTextClass(getPositiveStatus(metrics.gp)) : undefined}
          subValueClassName={metrics ? getStatusTextClass(getFloorPercentStatus(gpPct, 50, 5)) : undefined}
          remark={metrics ? `${getPositiveRemark('Gross profit', metrics.gp)} ${getFloorPercentRemark('GP margin', gpPct, 50, 5)}` : undefined}
          icon={<TrendingUp size={14} />} />
        <KPICard label={t.ebitda} value={metrics ? formatCurrency(metrics.ebitda, true) : '—'}
          subValue={metrics ? `${t.margin} ${formatPercent(ebitdaPct)}` : undefined}
          valueClassName={metrics ? getStatusTextClass(getPositiveStatus(metrics.ebitda)) : undefined}
          subValueClassName={metrics ? getStatusTextClass(getPositiveStatus(ebitdaPct, 5)) : undefined}
          remark={metrics ? `${getPositiveRemark('EBITDA', metrics.ebitda)} ${getPositiveRemark('EBITDA margin', ebitdaPct, 5, 'positive and above the safety buffer')}` : undefined}
          icon={<BarChart2 size={14} />} />
        <KPICard label={t.netProfit} value={metrics ? formatCurrency(metrics.np, true) : '—'}
          momChange={metrics?.npMoM} vsPlan={metrics?.vsPlanNP ?? undefined}
          valueClassName={metrics ? getStatusTextClass(getPositiveStatus(metrics.np)) : undefined}
          remark={metrics ? `${getPositiveRemark('Net profit', metrics.np)} ${metrics.vsPlanNP ? getPlanAchievementRemark('Net profit vs plan', metrics.np, comp ? sumMonths(comp.netProfit.monthly.plan, selectedMonths) : 0) : ''}` : undefined}
          icon={<Activity size={14} />} />
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4" {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="emma-card">
          <h3 className="emma-label mb-3">{t.revenueTrend}</h3>
          <div className="h-[180px] sm:h-[220px]">
            <TrendChart
              actual={data.actual.totalRevenue.monthly}
              plan={comp?.totalRevenue.monthly.plan}
              threshold={revenueThreshold}
              thresholdLabel={thresholdLabel}
              selectedMonths={selectedMonths}
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
        <h3 className="emma-label mb-3">{t.plWaterfall}</h3>
        <div className="h-[220px] sm:h-[260px]">
          <PLSummaryChart items={plSummaryItems} />
        </div>
      </motion.div>
    </div>
  );
}
