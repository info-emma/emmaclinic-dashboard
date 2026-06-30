import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Upload, CheckCircle2, Circle, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import { useCompareStore } from '../store/useCompareStore';
import type { AnnualMetrics, CompanyData } from '../store/useCompareStore';
import { parseAnnualExcel } from '../utils/parseAnnualExcel';
import { parseCompetitorExcel } from '../utils/parseCompetitorExcel';
import { useT } from '../i18n/useT';
import { formatCurrency, formatMillions, formatPercent, roundToDecimals } from '../utils/formatters';
import { getFloorPercentStatus, getPositiveStatus, getStatusTextClass } from '../utils/metricStatus';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

const COMPANY_META: Array<{ id: string; name: string; shortName: string; color: string }> = [
  { id: 'emma',        name: 'EMMA CLINIC (FDGT Co.,Ltd.)',                          shortName: 'EMMA',        color: '#C9A870' },
  { id: 'klinique',    name: 'THE KLINIQUE (THE KLINIQUE HOSPITAL Co.,Ltd.)',        shortName: 'KLINIQUE',    color: '#5B8DB8' },
  { id: 'masterpiece', name: 'MASTERPIECE (MASTER STYLE Pcl)',                       shortName: 'MASTERPIECE', color: '#7B6D8D' },
  { id: 'teeraporn',   name: 'TEERAPORN CLINIC (AESTHETIC CONNECT Pcl)',             shortName: 'TEERAPORN',   color: '#4A9B7F' },
];

interface MetricRow {
  key: string;
  label: string;
  getValue: (metrics: AnnualMetrics) => number;
  getTooltip?: (metrics: AnnualMetrics) => string | null;
  kind?: 'positive' | 'cost' | 'margin';
  highlight?: boolean;
}

const SEP = '─────────────────────────';

const METRIC_ROWS: MetricRow[] = [
  {
    key: 'mainRevenue', label: 'รายได้หลัก',
    getValue: m => m.mainRevenue, kind: 'positive',
    getTooltip: m => m.mainRevenue === 0 ? 'ไม่มีข้อมูลจากไฟล์' : 'มาจากไฟล์โดยตรง',
  },
  {
    key: 'revenue', label: 'รายได้รวม',
    getValue: m => m.revenue, kind: 'positive',
    getTooltip: m => m.revenue === 0 ? 'ไม่มีข้อมูลจากไฟล์' : 'มาจากไฟล์โดยตรง',
  },
  {
    key: 'operatingCost', label: 'ต้นทุนขาย',
    getValue: m => m.operatingCost, kind: 'cost',
    getTooltip: m => m.operatingCost === 0 ? 'ไม่มีข้อมูลจากไฟล์' : 'มาจากไฟล์โดยตรง',
  },
  {
    key: 'grossProfit', label: 'กำไร(ขาดทุน) ขั้นต้น',
    getValue: m => m.grossProfit, kind: 'margin', highlight: true,
    getTooltip: m => m.grossProfit === 0 ? 'ไม่มีข้อมูลจากไฟล์' : 'มาจากไฟล์โดยตรง',
  },
  {
    key: 'totalSGA', label: 'ค่าใช้จ่ายในการขายและบริหาร',
    getValue: m => m.totalSGA, kind: 'cost',
    getTooltip: m => {
      if (m.sellingExpenses === 0 && m.adminExpenses === 0) return 'ไม่มีข้อมูลจากไฟล์';
      const lines = ['คำนวณ (derive) จาก:'];
      if (m.sellingExpenses > 0) lines.push(`  ค่าใช้จ่ายในการขาย  = ${formatCurrency(m.sellingExpenses, true)}`);
      if (m.adminExpenses > 0) lines.push(`  ค่าใช้จ่ายในการบริหาร = ${formatCurrency(m.adminExpenses, true)}`);
      lines.push(SEP);
      lines.push(`  รวม SGA = ${formatCurrency(m.totalSGA, true)}`);
      return lines.join('\n');
    },
  },
  {
    key: 'totalExpense', label: 'รายจ่ายรวม',
    getValue: m => m.operatingCost + m.totalSGA, kind: 'cost',
    getTooltip: m => {
      const total = m.operatingCost + m.totalSGA;
      return [
        'คำนวณ (derive) จาก:',
        `  ต้นทุนขาย      = ${formatCurrency(m.operatingCost, true)}`,
        `  ค่าใช้จ่าย SGA   = ${formatCurrency(m.totalSGA, true)}`,
        SEP,
        `  รายจ่ายรวม = ${formatCurrency(total, true)}`,
      ].join('\n');
    },
  },
  {
    key: 'financeCost', label: 'ดอกเบี้ยจ่าย (ต้นทุนทางการเงิน)',
    getValue: m => m.financeCost, kind: 'cost',
    getTooltip: m => m.financeCost === 0 ? 'ไม่มีข้อมูลจากไฟล์' : 'มาจากไฟล์โดยตรง',
  },
  {
    key: 'ebt', label: 'กำไร(ขาดทุน) ก่อนภาษี',
    getValue: m => m.ebt, kind: 'margin', highlight: true,
    getTooltip: m => m.ebt === 0 ? 'ไม่มีข้อมูลจากไฟล์' : 'มาจากไฟล์โดยตรง',
  },
  {
    key: 'tax', label: 'ภาษีเงินได้',
    getValue: m => m.tax, kind: 'cost',
    getTooltip: m => m.tax === 0 ? 'ไม่มีข้อมูลจากไฟล์' : 'มาจากไฟล์โดยตรง',
  },
  {
    key: 'netProfit', label: 'กำไร(ขาดทุน) สุทธิ',
    getValue: m => m.netProfit, kind: 'margin', highlight: true,
    getTooltip: m => m.netProfit === 0 ? 'ไม่มีข้อมูลจากไฟล์' : 'มาจากไฟล์โดยตรง',
  },
];

function pct(value: number, revenue: number): string {
  if (revenue === 0) return '—';
  return formatPercent((value / revenue) * 100);
}

function periodLabel(data: { year: number; quarter?: number }): string {
  if (!data.quarter) return String(data.year);
  return `Q${data.quarter} ${data.year}`;
}

function formatCompareChartValue(value: number | null | undefined, unit: string): string {
  if (typeof value !== 'number') return '—';
  return unit === '%' ? formatPercent(value) : `฿${formatMillions(value * 1_000_000)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div className="bg-emma-black border border-emma-border rounded px-3 py-2 text-xs font-inter shadow-lg">
      <p className="text-emma-grey-light mb-1 font-medium">{label}</p>
      <p style={{ color: payload[0]?.fill }}>
        {formatCompareChartValue(v, unit)}
      </p>
    </div>
  );
}

function CompareBarChart({ title, data, unit = '' }: { title: string; data: { name: string; shortName: string; value: number | null; color: string }[]; unit?: string }) {
  const chartData = data.map(d => ({ name: d.shortName, value: d.value, color: d.color }));
  return (
    <div className="emma-card">
      <h3 className="emma-label mb-3">{title}</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }} axisLine={false} tickLine={false} width={36} unit={unit} />
            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={52}>
              <LabelList dataKey="value" position="top" formatter={(v: number | null) => v === null ? '' : formatCompareChartValue(v, unit)} style={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }} />
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={entry.value === null ? 0.2 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CellTooltip({ children, text }: { children: React.ReactNode; text: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);

  if (!text) return <>{children}</>;

  return (
    <div
      ref={ref}
      className="w-full cursor-help"
      onMouseEnter={() => {
        if (ref.current) setTooltipRect(ref.current.getBoundingClientRect());
      }}
      onMouseLeave={() => setTooltipRect(null)}
    >
      {children}
      {tooltipRect && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none bg-emma-black text-white
                     font-inter text-[11px] leading-relaxed rounded-lg shadow-xl px-3 py-2 whitespace-pre"
          style={{
            left: `${tooltipRect.left + tooltipRect.width / 2}px`,
            top: `${tooltipRect.top}px`,
            transform: 'translate(-50%, calc(-100% - 8px))',
          }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-emma-black" />
        </div>,
        document.body
      )}
    </div>
  );
}

interface UploadCardProps {
  id: string;
  name: string;
  color: string;
  competitor?: boolean;
}

function UploadCard({ id, name, color, competitor = false }: UploadCardProps) {
  const t = useT();
  const companies = useCompareStore(s => s.companies);
  const saveCompany = useCompareStore(s => s.saveCompany);
  const clearCompany = useCompareStore(s => s.clearCompany);
  const inputRef = useRef<HTMLInputElement>(null);
  const data = companies[id] ?? null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = competitor
        ? await parseCompetitorExcel(file)
        : await parseAnnualExcel(file);
      await saveCompany(id, {
        name,
        year: result.year,
        quarter: result.quarter,
        metrics: result.metrics,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to parse Excel:', err);
    }
    // Reset input so the same file can be re-uploaded
    e.target.value = '';
  }

  const gpMargin = data && data.metrics.revenue > 0
    ? (data.metrics.grossProfit / data.metrics.revenue) * 100
    : null;
  const npMargin = data && data.metrics.revenue > 0
    ? (data.metrics.netProfit / data.metrics.revenue) * 100
    : null;

  return (
    <div className="emma-card flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <p className="font-inter text-xs font-semibold text-emma-black leading-tight truncate" title={name}>
            {name}
          </p>
        </div>
        {data ? (
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            <CheckCircle2 size={14} className="text-acc-positive" />
            <button
              onClick={() => clearCompany(id)}
              className="text-emma-grey hover:text-red-400 transition-colors"
              title="Remove uploaded file"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <Circle size={14} className="text-emma-grey flex-shrink-0 mt-0.5" />
        )}
      </div>

      {/* Data preview */}
      {data ? (
        <div className="space-y-1.5">
          <p className="text-xs font-inter text-emma-grey">
            {t.cmpYear}: <span className="text-emma-black font-semibold">{periodLabel(data)}</span>
          </p>
          <p className="text-xs font-inter text-emma-grey-dark truncate" title={data.fileName}>
            {data.fileName}
          </p>
          <div className="grid grid-cols-3 gap-1 pt-1">
            <div className="bg-emma-nude/60 rounded px-2 py-1.5 text-center">
              <p className="text-xs font-inter text-emma-grey-dark leading-tight">Revenue</p>
              <p className={`text-xs font-inter font-semibold mt-0.5 ${getStatusTextClass(getPositiveStatus(data.metrics.revenue))}`}>
                {formatCurrency(data.metrics.revenue, true)}
              </p>
            </div>
            <div className="bg-emma-nude/60 rounded px-2 py-1.5 text-center">
              <p className="text-xs font-inter text-emma-grey-dark leading-tight">GP%</p>
              <p className={`text-xs font-inter font-semibold mt-0.5 ${gpMargin !== null ? getStatusTextClass(getFloorPercentStatus(gpMargin, 50, 5)) : 'text-emma-black'}`}>
                {gpMargin !== null ? formatPercent(gpMargin) : '—'}
              </p>
            </div>
            <div className="bg-emma-nude/60 rounded px-2 py-1.5 text-center">
              <p className="text-xs font-inter text-emma-grey-dark leading-tight">Net Profit</p>
              <p className={`text-xs font-inter font-semibold mt-0.5 ${getStatusTextClass(getPositiveStatus(data.metrics.netProfit))}`}>
                {formatCurrency(data.metrics.netProfit, true)}
              </p>
            </div>
          </div>
          {npMargin !== null && (
            <p className={`text-xs font-inter text-center ${getStatusTextClass(getPositiveStatus(npMargin, 5))}`}>
              NP Margin: {formatPercent(npMargin)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs font-inter text-emma-grey">{t.cmpNoData}</p>
      )}

      {/* Upload button */}
      <button
        onClick={() => inputRef.current?.click()}
        className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded border text-xs font-inter font-medium transition-all duration-200"
        style={{
          borderColor: color + '66',
          color,
          backgroundColor: color + '14',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = color + '28'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = color + '14'; }}
      >
        <Upload size={12} />
        {t.cmpUpload}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

export default function Compare() {
  const t = useT();
  const companies = useCompareStore(s => s.companies);

  const filterYear = useCompareStore(s => s.filterYear);
  const filterQuarter = useCompareStore(s => s.filterQuarter);

  function passesFilter(d: CompanyData): boolean {
    if (filterYear !== 'all' && d.year !== filterYear) return false;
    if (filterQuarter !== 'all' && d.quarter !== filterQuarter) return false;
    return true;
  }

  function makeChartData(fn: (m: AnnualMetrics, rev: number) => number) {
    return COMPANY_META.map(({ id, name, shortName, color }) => {
      const d = companies[id];
      const value = d && passesFilter(d) ? fn(d.metrics, d.metrics.revenue) : null;
      return { name, shortName, value, color };
    });
  }

  const revData    = makeChartData(m => roundToDecimals(m.revenue / 1_000_000));
  const gpData     = makeChartData((m, r) => r > 0 ? roundToDecimals((m.grossProfit / r) * 100) : 0);
  const ebitdaData = makeChartData((m, r) => r > 0 ? roundToDecimals(((m.operatingProfit + m.depreciation) / r) * 100) : 0);
  const npData     = makeChartData((m, r) => r > 0 ? roundToDecimals((m.netProfit / r) * 100) : 0);

  const hasAnyData = COMPANY_META.some(({ id }) => companies[id] !== null);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <h2 className="font-playfair text-xl text-emma-black">{t.pageCompare}</h2>
      </motion.div>

      {/* Section A: Upload cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
        {...fadeUp}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        {COMPANY_META.map(({ id, name, color }) => (
          <UploadCard key={id} id={id} name={name} color={color} competitor={id !== 'emma'} />
        ))}
      </motion.div>

      {/* Section B: Comparison Table */}
      <motion.div
        className="emma-card overflow-x-auto"
        {...fadeUp}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <h3 className="emma-label mb-4">P&amp;L Comparison</h3>
        <table className="w-full text-sm font-inter min-w-[540px]">
          <thead>
            <tr className="border-b border-emma-border">
              <th className="text-left py-2 pr-4 text-emma-black font-semibold w-40">Metric</th>
              {COMPANY_META.map(({ id, name, color }) => (
                <th key={id} className="text-right py-2 px-3 font-medium min-w-[110px]">
                  <span style={{ color }}>{name}</span>
                  {companies[id] && (
                    <span className="block text-emma-grey-dark font-normal text-xs">
                      {periodLabel(companies[id]!)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasAnyData && (
              <tr className="border-b border-emma-border bg-emma-nude/40">
                <td className="py-2 pr-4 text-xs font-inter font-semibold text-emma-grey-dark">
                  Reporting Period
                </td>
                {COMPANY_META.map(({ id, color }) => {
                  const d = companies[id];
                  const visible = d && passesFilter(d);
                  return (
                    <td key={id} className="text-right py-2 px-3">
                      {visible ? (
                        <span className="text-xs font-inter font-semibold" style={{ color }}>
                          {periodLabel(d)}
                        </span>
                      ) : d ? (
                        <span className="text-xs font-inter text-emma-grey line-through">{periodLabel(d)}</span>
                      ) : (
                        <span className="text-xs font-inter text-emma-grey">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
            {METRIC_ROWS.map(({ key, label, getValue, getTooltip, kind = 'positive', highlight }) => (
              <tr
                key={key}
                className={`border-b border-emma-border/40 ${highlight ? 'bg-emma-gold/8' : ''}`}
              >
                <td className={`py-2 pr-4 font-semibold ${highlight ? 'text-emma-black' : 'text-emma-grey-dark'}`}>
                  {label}
                </td>
                {COMPANY_META.map(({ id }) => {
                  const d = companies[id];
                  if (!d || !passesFilter(d)) {
                    return (
                      <td key={id} className="text-right py-2 px-3 text-emma-grey">—</td>
                    );
                  }
                  const val = getValue(d.metrics);
                  const rev = d.metrics.revenue;
                  const displayVal = kind === 'cost' ? -Math.abs(val) : val;
                  const valueStatus = kind === 'cost'
                    ? getPositiveStatus(-val)
                    : getPositiveStatus(val);
                  const ratioStatus = kind === 'margin'
                    ? getFloorPercentStatus(rev > 0 ? (val / rev) * 100 : 0, 50, 5)
                    : kind === 'cost'
                      ? getPositiveStatus(-(rev > 0 ? (val / rev) * 100 : 0))
                      : getPositiveStatus(rev > 0 ? (val / rev) * 100 : 0);
                  const tooltipText = getTooltip ? getTooltip(d.metrics) : null;
                  return (
                    <td key={id} className="text-right py-2 px-3">
                      <CellTooltip text={tooltipText}>
                        <span className={`block font-semibold ${getStatusTextClass(valueStatus)}`}>
                          {formatCurrency(displayVal, true)}
                        </span>
                        {key !== 'mainRevenue' && key !== 'revenue' && (
                          <span className={`block text-xs mt-0.5 ${getStatusTextClass(ratioStatus)}`}>
                            {pct(displayVal, rev)}
                          </span>
                        )}
                      </CellTooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!hasAnyData && (
          <p className="text-center text-emma-grey text-xs font-inter py-6">
            Upload annual reports above to populate the comparison table.
          </p>
        )}
        {hasAnyData && (
          <div className="mt-4 pt-3 border-t border-emma-border/60 space-y-1.5">
            <div className="flex items-start gap-2 text-xs font-inter text-emma-grey-dark">
              <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-emma-gold flex-shrink-0" />
              <p>
                `%` ในแต่ละ row หมายถึงสัดส่วนของรายการนั้นเมื่อเทียบกับ <span className="font-semibold text-emma-black">รายได้รวม (Total Revenue)</span> ของบริษัทเดียวกัน
              </p>
            </div>
            <div className="flex items-start gap-2 text-xs font-inter text-emma-grey-dark">
              <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-emma-black flex-shrink-0" />
              <p>
                ตัวอย่าง: ถ้า `ต้นทุนขาย = 45%` แปลว่าต้นทุนขายคิดเป็น 45% ของรายได้รวม และถ้า `กำไรสุทธิ = 8%` แปลว่ากำไรสุทธิคิดเป็น 8% ของรายได้รวม
              </p>
            </div>
            <div className="flex items-start gap-2 text-xs font-inter text-amber-600">
              <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <p>
                ตัวเลข<span className="font-semibold">สีเหลือง</span>ที่แสดง <span className="font-semibold">฿0.00M</span> หมายถึง <span className="font-semibold">ไม่พบข้อมูลรายการนี้ในไฟล์ที่อัปโหลด</span> (ระบบดึงค่าไม่ได้ หรือไฟล์ไม่ได้แยกรายการนี้ไว้) — ไม่ได้แปลว่ามูลค่าจริงเป็นศูนย์ กรุณาตรวจสอบไฟล์ต้นทาง
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Section C: Key Metrics Charts */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
        {...fadeUp}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <CompareBarChart title={`${t.cmpRevenue} (฿M)`}       data={revData}    unit="" />
        <CompareBarChart title="Gross Profit Margin (%)"       data={gpData}     unit="%" />
        <CompareBarChart title="EBITDA Margin (%)"             data={ebitdaData} unit="%" />
        <CompareBarChart title="Net Profit Margin (%)"         data={npData}     unit="%" />
      </motion.div>
    </div>
  );
}
