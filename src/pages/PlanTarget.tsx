import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useDataStore } from '../store/useDataStore';
import { useT } from '../i18n/useT';
import KPICard from '../components/cards/KPICard';
import PlanActualChart from '../components/charts/PlanActualChart';
import { formatCurrency, formatPercent, formatVsPlan, sumMonths } from '../utils/formatters';
import { getPlanAchievementRemark, getPlanAchievementStatus, getPositiveStatus, getStatusTextClass } from '../utils/metricStatus';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

function AchievementTable({ tableLabel, actual, plan, selectedMonths, t }: {
  tableLabel: string; actual: number[]; plan: number[];
  selectedMonths: number[]; t: ReturnType<typeof useT>;
}) {
  return (
    <div className="overflow-x-auto">
      <p className="font-inter text-xs font-semibold text-emma-black mb-2">{tableLabel}</p>
      <table className="w-full text-xs font-inter">
        <thead>
          <tr className="border-b border-emma-border">
            <th className="text-left py-1.5 pr-3 text-emma-grey font-medium w-16">{t.month}</th>
            <th className="text-right py-1.5 px-2 text-emma-grey font-medium">{t.actual}</th>
            <th className="text-right py-1.5 px-2 text-emma-grey font-medium">{t.plan}</th>
            <th className="text-right py-1.5 px-2 text-emma-grey font-medium">{t.diff}</th>
            <th className="text-right py-1.5 pl-2 text-emma-grey font-medium">{t.achPct}</th>
          </tr>
        </thead>
        <tbody>
          {t.months.map((m, i) => {
            const isSelected = selectedMonths.includes(i);
            const a = actual[i] ?? 0;
            const p = plan[i] ?? 0;
            const diff = a - p;
            const ach = p !== 0 ? (a / p) * 100 : 0;
            const actualClass = getStatusTextClass(getPositiveStatus(a));
            const diffClass = getStatusTextClass(getPositiveStatus(diff));
            const achClass = getStatusTextClass(getPlanAchievementStatus({ actual: a, plan: p }));
            return (
              <tr key={i} className={`border-b border-emma-border/50 transition-colors ${isSelected ? 'bg-emma-nude/40' : 'opacity-50'}`}>
                <td className="py-1.5 pr-3 text-emma-grey font-medium">{m}</td>
                <td className={`text-right py-1.5 px-2 ${actualClass}`}>{formatCurrency(a, true)}</td>
                <td className="text-right py-1.5 px-2 text-emma-grey">{formatCurrency(p, true)}</td>
                <td className={`text-right py-1.5 px-2 ${diffClass}`}>
                  {diff >= 0 ? '+' : ''}{formatCurrency(diff, true)}
                </td>
                <td className={`text-right py-1.5 pl-2 font-medium ${achClass}`}>
                  {p !== 0 ? formatPercent(ach, 0) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-emma-border">
            <td className="py-2 pr-3 font-semibold text-emma-black">{t.total}</td>
            <td className={`text-right py-2 px-2 font-semibold ${getStatusTextClass(getPositiveStatus(sumMonths(actual, selectedMonths)))}`}>{formatCurrency(sumMonths(actual, selectedMonths), true)}</td>
            <td className="text-right py-2 px-2 font-semibold text-emma-grey">{formatCurrency(sumMonths(plan, selectedMonths), true)}</td>
            {(() => {
              const d = sumMonths(actual, selectedMonths) - sumMonths(plan, selectedMonths);
              return <td className={`text-right py-2 px-2 font-semibold ${getStatusTextClass(getPositiveStatus(d))}`}>{d >= 0 ? '+' : ''}{formatCurrency(d, true)}</td>;
            })()}
            {(() => {
              const p = sumMonths(plan, selectedMonths);
              const a = sumMonths(actual, selectedMonths);
              const ach = p !== 0 ? (a / p) * 100 : 0;
              return <td className={`text-right py-2 pl-2 font-semibold ${getStatusTextClass(getPlanAchievementStatus({ actual: a, plan: p }))}`}>{p !== 0 ? formatPercent(ach, 0) : '—'}</td>;
            })()}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function PlanTarget() {
  const { data, selectedMonths, showTarget } = useDataStore();
  const t = useT();
  const comp = showTarget ? data?.target : data?.plan;
  const modeLabel = showTarget ? t.vsTarget : t.vsPlan;
  const planLabel = showTarget ? t.target : t.plan;

  const metrics = useMemo(() => {
    if (!data?.actual || !comp) return null;
    const sm = selectedMonths;
    const rev = sumMonths(data.actual.totalRevenue.monthly, sm);
    const planRev = sumMonths(comp.totalRevenue.monthly.plan, sm);
    const np = sumMonths(data.actual.netProfit.monthly, sm);
    const planNp = sumMonths(comp.netProfit.monthly.plan, sm);
    const ebitda = sumMonths(data.actual.ebitda.monthly, sm);
    const planEbitda = sumMonths(comp.ebitda.monthly.plan, sm);
    const ofLabel = showTarget ? t.ofTarget : t.ofPlan;
    return {
      revAch: planRev > 0 ? formatVsPlan(rev, planRev, ofLabel) : null,
      npAch: planNp !== 0 ? formatVsPlan(np, planNp, ofLabel) : null,
      ebitdaAch: planEbitda !== 0 ? formatVsPlan(ebitda, planEbitda, ofLabel) : null,
      rev, planRev, np, planNp, ebitda, planEbitda,
    };
  }, [data, comp, selectedMonths, showTarget, t]);

  if (!data?.actual || !comp) return <div className="flex items-center justify-center h-64"><p className="font-inter text-emma-grey text-sm">No data available.</p></div>;

  return (
    <div className="space-y-6">
      <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" {...fadeUp} transition={{ duration: 0.3 }}>
        <KPICard label={`${t.revenueVsLabel} ${planLabel}`}
          value={metrics ? formatCurrency(metrics.rev, true) : '—'}
          subValue={metrics ? `${planLabel}: ${formatCurrency(metrics.planRev, true)}` : undefined}
          valueClassName={metrics ? getStatusTextClass(getPlanAchievementStatus({ actual: metrics.rev, plan: metrics.planRev })) : undefined}
          remark={metrics ? getPlanAchievementRemark('Revenue vs plan', metrics.rev, metrics.planRev) : undefined}
          vsPlan={metrics?.revAch ?? undefined} accent />
        <KPICard label={`${t.ebitdaVsLabel} ${planLabel}`}
          value={metrics ? formatCurrency(metrics.ebitda, true) : '—'}
          subValue={metrics ? `${planLabel}: ${formatCurrency(metrics.planEbitda, true)}` : undefined}
          valueClassName={metrics ? getStatusTextClass(getPlanAchievementStatus({ actual: metrics.ebitda, plan: metrics.planEbitda })) : undefined}
          remark={metrics ? getPlanAchievementRemark('EBITDA vs plan', metrics.ebitda, metrics.planEbitda) : undefined}
          vsPlan={metrics?.ebitdaAch ?? undefined} />
        <KPICard label={`${t.netProfitVsLabel} ${planLabel}`}
          value={metrics ? formatCurrency(metrics.np, true) : '—'}
          subValue={metrics ? `${planLabel}: ${formatCurrency(metrics.planNp, true)}` : undefined}
          valueClassName={metrics ? getStatusTextClass(getPlanAchievementStatus({ actual: metrics.np, plan: metrics.planNp })) : undefined}
          remark={metrics ? getPlanAchievementRemark('Net profit vs plan', metrics.np, metrics.planNp) : undefined}
          vsPlan={metrics?.npAch ?? undefined} />
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4" {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="emma-card">
          <h3 className="emma-label mb-3">{t.revenueActualVs} {planLabel}</h3>
          <div className="h-[180px] sm:h-[220px]">
            <PlanActualChart actual={data.actual.totalRevenue.monthly} plan={comp.totalRevenue.monthly.plan}
              target={comp.totalRevenue.monthly.plan} showTarget={showTarget} selectedMonths={selectedMonths} />
          </div>
        </div>
        <div className="emma-card">
          <h3 className="emma-label mb-3">{t.netProfitActualVs} {planLabel}</h3>
          <div className="h-[180px] sm:h-[220px]">
            <PlanActualChart actual={data.actual.netProfit.monthly} plan={comp.netProfit.monthly.plan}
              target={comp.netProfit.monthly.plan} showTarget={showTarget} selectedMonths={selectedMonths} />
          </div>
        </div>
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4" {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="emma-card">
          <AchievementTable tableLabel={`${t.revenueVsLabel} ${planLabel}`}
            actual={data.actual.totalRevenue.monthly} plan={comp.totalRevenue.monthly.plan}
            selectedMonths={selectedMonths} t={t} />
        </div>
        <div className="emma-card">
          <AchievementTable tableLabel={`${t.netProfitVsLabel} ${planLabel}`}
            actual={data.actual.netProfit.monthly} plan={comp.netProfit.monthly.plan}
            selectedMonths={selectedMonths} t={t} />
        </div>
      </motion.div>
    </div>
  );
}
