import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useDataStore } from '../store/useDataStore';
import { useT } from '../i18n/useT';
import { formatCurrency, formatPercent, formatVsPlan, sumMonths } from '../utils/formatters';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
const QUARTER_MONTHS: Record<Quarter, [number, number, number]> = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11],
};

function getDefaultQuarter(): Quarter {
  const m = new Date().getMonth();
  if (m < 3) return 'Q1';
  if (m < 6) return 'Q2';
  if (m < 9) return 'Q3';
  return 'Q4';
}

function fmtM(val: number): string {
  if (val === 0) return '—';
  return formatCurrency(val, true).replace('฿', '');
}

function pctColor(pct: number, isCost: boolean): string {
  if (isCost) {
    if (pct <= 100) return 'text-emerald-600 font-semibold';
    if (pct <= 115) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-semibold';
  }
  if (pct >= 100) return 'text-emerald-600 font-semibold';
  if (pct >= 80) return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
}

interface PLRow {
  type: 'data' | 'sub' | 'section' | 'space';
  label: string;
  getPlan: (m: number) => number;
  getActual: (m: number) => number;
  isCost?: boolean;
  bold?: boolean;
  italic?: boolean;
  shaded?: boolean;
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function SGA() {
  const { data, selectedYear } = useDataStore();
  const t = useT();
  const [selectedQ, setSelectedQ] = useState<Quarter>(getDefaultQuarter);

  const months = QUARTER_MONTHS[selectedQ];
  const yearSuffix = selectedYear ? ` '${String(selectedYear).slice(2)}` : '';

  const rows: PLRow[] = useMemo(() => {
    const a = data?.actual;
    const p = data?.plan;

    function planVal(key: keyof NonNullable<typeof p>) {
      return (m: number) => (p?.[key] as { monthly?: { plan?: number[] } } | undefined)?.monthly?.plan?.[m] ?? 0;
    }
    function actualMetric(key: keyof NonNullable<typeof a>) {
      return (m: number) => (a?.[key] as { monthly?: number[] } | undefined)?.monthly?.[m] ?? 0;
    }

    // รายได้จากการประกอบกิจการ = sum of all procedure revenue (exclude otherRevenue)
    function surgicalRevenue(m: number): number {
      const rb = a?.revenueBreakdown;
      if (!rb) return 0;
      return Object.entries(rb)
        .filter(([k]) => k !== 'otherRevenue')
        .reduce((s, [, v]) => s + (v.monthly?.[m] ?? 0), 0);
    }


    return [
      // ── Revenue ──────────────────────────────────────────────
      { type: 'data', label: 'รายได้จากการประกอบกิจการ (Revenue)', bold: true, shaded: true,
        getPlan: planVal('operatingRevenue'), getActual: surgicalRevenue },
      { type: 'data', label: 'รายได้อื่น (Other Revenue)', bold: true, shaded: true,
        getPlan: () => 0, getActual: (m) => a?.revenueBreakdown?.otherRevenue?.monthly?.[m] ?? 0 },
      { type: 'data', label: 'รวมรายได้กิจการ (Total Revenue)', bold: true,
        getPlan: planVal('totalRevenue'), getActual: actualMetric('totalRevenue') },

      { type: 'space', label: '', getPlan: () => 0, getActual: () => 0 },

      // ── Operating Cost ────────────────────────────────────────
      { type: 'data', label: 'ต้นทุนในการประกอบกิจการ (Operating Expenses)', bold: true, shaded: true, isCost: true,
        getPlan: planVal('operatingCost'), getActual: actualMetric('operatingCost') },
      { type: 'data', label: 'ต้นทุนในการประกอบกิจการ (Operating Expenses)', bold: true, isCost: true,
        getPlan: planVal('operatingCost'), getActual: actualMetric('operatingCost') },

      // ── Gross Profit ──────────────────────────────────────────
      { type: 'data', label: 'กำไรก่อนค่าใช้จ่าย (Gross Profit)', bold: true,
        getPlan: planVal('grossProfit'), getActual: actualMetric('grossProfit') },

      { type: 'space', label: '', getPlan: () => 0, getActual: () => 0 },

      // ── SG&A ─────────────────────────────────────────────────
      { type: 'data', label: 'ค่าใช้จ่ายในการขาย (Selling Expenses)', bold: true, shaded: true, isCost: true,
        getPlan: planVal('sellingExpenses'),
        getActual: (m) => a?.sellingExpenses?.monthly?.[m] ?? 0 },
      { type: 'data', label: 'ค่าใช้จ่ายในการบริหาร (Administration Expenses)', bold: true, shaded: true, isCost: true,
        getPlan: planVal('adminExpenses'),
        getActual: (m) => a?.adminExpenses?.monthly?.[m] ?? 0 },
      { type: 'data', label: 'รวมค่าใช้จ่ายในการขายและบริหาร (SG&A Expenses)', bold: true, isCost: true,
        getPlan: planVal('totalSGA'), getActual: actualMetric('totalSGA') },

      { type: 'space', label: '', getPlan: () => 0, getActual: () => 0 },

      // ── Below-GP ─────────────────────────────────────────────
      { type: 'data', label: 'กำไรจากกิจกรรมดำเนินงาน (EBITDA)', bold: true,
        getPlan: planVal('ebitda'), getActual: actualMetric('ebitda') },
      { type: 'data', label: 'ค่าเสื่อมราคา (D&A)', bold: true, shaded: true, isCost: true,
        getPlan: planVal('depreciation'), getActual: actualMetric('depreciation') },
      { type: 'data', label: 'กำไรก่อนหักดอกเบี้ยและภาษีเงินได้ (EBIT)', bold: true, shaded: true,
        getPlan: planVal('ebit'), getActual: actualMetric('ebit') },
      { type: 'data', label: 'ต้นทุนทางการเงิน (Interest)', bold: true, shaded: true, isCost: true,
        getPlan: planVal('financeCost'), getActual: actualMetric('financeCost') },
      { type: 'data', label: 'กำไรก่อนภาษีเงินได้ (EBT)', bold: true, shaded: true,
        getPlan: planVal('ebt'), getActual: (m) => a?.ebt?.monthly?.[m] ?? 0 },
      { type: 'data', label: 'ค่าใช้จ่ายภาษีเงินได้ (Tax)', bold: true, shaded: true, isCost: true,
        getPlan: planVal('tax'), getActual: (m) => a?.tax?.monthly?.[m] ?? 0 },
      { type: 'data', label: 'กำไรสุทธิ (Net Profit)', bold: true,
        getPlan: planVal('netProfit'), getActual: actualMetric('netProfit') },
    ] as PLRow[];
  }, [data]);

  // KPI summary for selected quarter
  const kpis = useMemo(() => {
    if (!data?.actual) return null;
    const a = data.actual;
    const p = data.plan;
    const qMonths = [...months];
    const rev    = sumMonths(a.totalRevenue.monthly, qMonths);
    const sga    = sumMonths(a.totalSGA.monthly, qMonths);
    const ebitda = sumMonths(a.ebitda.monthly, qMonths);
    const net    = sumMonths(a.netProfit.monthly, qMonths);
    const planSGA = p?.totalSGA?.monthly?.plan
      ? qMonths.reduce((s, m) => s + (p.totalSGA!.monthly.plan[m] ?? 0), 0)
      : 0;
    const planRev = p?.totalRevenue?.monthly?.plan
      ? qMonths.reduce((s, m) => s + (p.totalRevenue.monthly.plan[m] ?? 0), 0)
      : 0;
    return {
      rev, sga, ebitda, net, planSGA, planRev,
      sgaVsPlan: planSGA > 0 ? (sga / planSGA) * 100 : null,
      revVsPlan: planRev > 0 ? (rev / planRev) * 100 : null,
      sgaPct: rev > 0 ? (sga / rev) * 100 : 0,
      ebitdaPct: rev > 0 ? (ebitda / rev) * 100 : 0,
      netPct: rev > 0 ? (net / rev) * 100 : 0,
    };
  }, [data, months]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-emma-grey font-inter">
        <p className="text-sm">No data — upload a P&L file to get started.</p>
      </div>
    );
  }

  return (
    <motion.div {...fadeUp} transition={{ duration: 0.3 }} className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-playfair text-2xl text-emma-black">SG&A</h1>
          <p className="text-xs text-emma-grey font-inter mt-0.5">
            Selling, General & Administrative Expenses
            {selectedYear ? ` — ${selectedYear}` : ''}
          </p>
        </div>
        <div className="flex gap-1.5 bg-emma-nude/40 rounded-lg p-1 border border-emma-border">
          {(['Q1','Q2','Q3','Q4'] as Quarter[]).map(q => (
            <button
              key={q}
              onClick={() => setSelectedQ(q)}
              className={`px-4 py-1.5 rounded text-xs font-inter font-medium transition-all ${
                selectedQ === q
                  ? 'bg-emma-gold text-emma-black shadow-sm'
                  : 'text-emma-grey hover:text-emma-black'
              }`}
            >{q}</button>
          ))}
        </div>
      </div>

      {/* KPI Summary */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Revenue', value: kpis.rev, sub: kpis.revVsPlan != null ? formatVsPlan(kpis.rev, kpis.planRev, 'of Plan').label : null, good: (kpis.revVsPlan ?? 100) >= 100, isCost: false },
            { label: 'Total SG&A', value: kpis.sga, sub: kpis.sgaVsPlan != null ? formatVsPlan(kpis.sga, kpis.planSGA, 'of Plan').label : null, good: (kpis.sgaVsPlan ?? 100) <= 100, isCost: true },
            { label: 'SG&A / Revenue', value: null, sub: formatPercent(kpis.sgaPct), good: kpis.sgaPct < 40, isCost: true },
            { label: 'EBITDA', value: kpis.ebitda, sub: `${formatPercent(kpis.ebitdaPct)} margin`, good: kpis.ebitdaPct >= 10, isCost: false },
            { label: 'Net Profit', value: kpis.net, sub: `${formatPercent(kpis.netPct)} margin`, good: kpis.netPct >= 5, isCost: false },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-emma-border p-4 shadow-sm">
              <p className="text-[10px] text-emma-grey font-inter uppercase tracking-wide">{kpi.label}</p>
              {kpi.value != null && (
                <p className="font-playfair text-xl text-emma-black mt-1">
                  {formatCurrency(kpi.value, true)}
                </p>
              )}
              {kpi.sub && (
                <p className={`text-xs font-inter mt-1 ${kpi.good ? 'text-emerald-600' : 'text-red-500'}`}>
                  {kpi.sub}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* P&L Table */}
      <div className="bg-white rounded-xl border border-emma-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-inter" style={{ minWidth: 860 }}>
            <thead>
              <tr className="bg-emma-black text-emma-white">
                <th className="text-left px-4 py-3 font-semibold" style={{ width: 200 }} rowSpan={2}>
                  งบกำไรขาดทุน
                </th>
                {months.map(m => (
                  <th key={m} colSpan={3} className="text-center px-2 py-2.5 border-l border-white/20 font-medium tracking-wide">
                    {MONTH_LABELS[m]}{yearSuffix}
                  </th>
                ))}
                <th colSpan={3} className="text-center px-2 py-2.5 border-l border-white/20 font-medium bg-emma-gold/30">
                  {selectedQ} Total
                </th>
              </tr>
              <tr className="bg-emma-grey-dark/10 border-b border-emma-border text-emma-grey">
                {[...months, -1].map((_, gi) => (
                  <React.Fragment key={gi}>
                    <th className={`text-right py-2 px-2 font-medium ${gi === 0 ? 'border-l border-emma-border' : 'border-l border-emma-border/30'}`}>Plan</th>
                    <th className="text-right py-2 px-2 font-medium">Actual</th>
                    <th className="text-right py-2 px-2 pr-3 font-medium">Ach%</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                if (row.type === 'space') {
                  return (
                    <tr key={ri}>
                      <td colSpan={1 + 3 * (months.length + 1)} className="py-1 bg-emma-nude/5" />
                    </tr>
                  );
                }
                if (row.type === 'section') {
                  return (
                    <tr key={ri} className="bg-emma-nude/30">
                      <td
                        colSpan={1 + 3 * (months.length + 1)}
                        className="px-4 py-2 font-semibold text-emma-black text-[11px] uppercase tracking-wider"
                      >
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'sub') {
                  const qAct = months.reduce((s, m) => s + row.getActual(m), 0);
                  return (
                    <tr key={ri} className="group border-b border-emma-border/30 transition-all duration-200 hover:bg-emma-grey-dark/10 hover:[&_td]:scale-[1.15]">
                      <td className="py-2 px-4 pl-9 text-emma-black/60 italic transition-all duration-200 group-hover:bg-emma-grey-dark/10">{row.label}</td>
                      {months.map(m => {
                        const act = row.getActual(m);
                        return (
                          <React.Fragment key={m}>
                            <td className="py-2 px-2 text-right text-emma-grey border-l border-emma-border/20 transition-all duration-200 group-hover:bg-emma-grey-dark/10">—</td>
                            <td className={`py-2 px-2 text-right transition-all duration-200 group-hover:bg-emma-grey-dark/10 ${act !== 0 ? 'text-emma-black' : 'text-emma-grey'}`}>{fmtM(act)}</td>
                            <td className="py-2 px-2 text-right pr-3 text-emma-grey transition-all duration-200 group-hover:bg-emma-grey-dark/10">—</td>
                          </React.Fragment>
                        );
                      })}
                      <td className="py-2 px-2 text-right border-l border-emma-border/20 bg-emma-nude/20 text-emma-grey transition-all duration-200 group-hover:bg-emma-grey-dark/12">—</td>
                      <td className={`py-2 px-2 text-right bg-emma-nude/20 transition-all duration-200 group-hover:bg-emma-grey-dark/12 ${qAct !== 0 ? 'font-medium text-emma-black' : 'text-emma-grey'}`}>{fmtM(qAct)}</td>
                      <td className="py-2 px-2 text-right pr-3 bg-emma-nude/20 text-emma-grey transition-all duration-200 group-hover:bg-emma-grey-dark/12">—</td>
                    </tr>
                  );
                }

                // data row
                const qPlan = months.reduce((s, m) => s + row.getPlan(m), 0);
                const qAct  = months.reduce((s, m) => s + row.getActual(m), 0);
                const qPct  = qPlan !== 0 ? (qAct / qPlan) * 100 : 0;

                return (
                  <tr
                    key={ri}
                    className={`group border-b border-emma-border/30 transition-all duration-200 hover:[&_td]:scale-[1.15] ${
                      row.shaded
                        ? 'bg-emma-grey-dark/14 hover:bg-emma-grey-dark/22'
                        : row.bold
                          ? 'bg-emma-nude/5 hover:bg-emma-grey-dark/12'
                          : 'hover:bg-emma-grey-dark/10'
                    }`}
                  >
                    <td className={`py-2.5 px-4 transition-all duration-200 ${row.bold ? 'font-semibold text-emma-black' : 'text-emma-black/75'}`}>
                      {row.label}
                    </td>
                    {months.map(m => {
                      const pl  = row.getPlan(m);
                      const act = row.getActual(m);
                      const pct = pl !== 0 ? (act / pl) * 100 : 0;
                        return (
                          <React.Fragment key={m}>
                            <td className="py-2.5 px-2 text-right text-emma-grey border-l border-emma-border/20 transition-all duration-200">
                              {pl !== 0 ? fmtM(pl) : '—'}
                            </td>
                            <td className={`py-2.5 px-2 text-right transition-all duration-200 ${row.bold ? 'font-semibold text-emma-black' : 'text-emma-black'}`}>
                              {act !== 0 ? fmtM(act) : '—'}
                            </td>
                            <td className={`py-2.5 px-2 text-right pr-3 transition-all duration-200 ${pl !== 0 && act !== 0 ? pctColor(pct, !!row.isCost) : 'text-emma-grey'}`}>
                              {pl !== 0 ? formatPercent(pct) : '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    {/* Quarter total */}
                    <td className="py-2.5 px-2 text-right border-l border-emma-border/20 bg-emma-nude/20 text-emma-grey transition-all duration-200 group-hover:bg-emma-grey-dark/12">
                      {qPlan !== 0 ? fmtM(qPlan) : '—'}
                    </td>
                    <td className={`py-2.5 px-2 text-right bg-emma-nude/20 transition-all duration-200 group-hover:bg-emma-grey-dark/12 ${row.bold ? 'font-semibold text-emma-black' : 'text-emma-black'}`}>
                      {qAct !== 0 ? fmtM(qAct) : '—'}
                    </td>
                    <td className={`py-2.5 px-2 text-right pr-3 bg-emma-nude/20 transition-all duration-200 group-hover:bg-emma-grey-dark/12 ${qPlan !== 0 ? pctColor(qPct, !!row.isCost) : 'text-emma-grey'}`}>
                      {qPlan !== 0 ? formatPercent(qPct) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-emma-nude/20 border-t border-emma-border text-[10px] text-emma-grey font-inter flex items-center justify-between">
          <span>Numbers in ฿M (millions of baht) · % = Actual ÷ Plan · Green ≥100% revenue, ≤100% cost</span>
          <span className="italic">Re-upload the P&L file to populate Plan columns with extended metrics</span>
        </div>
      </div>
    </motion.div>
  );
}
