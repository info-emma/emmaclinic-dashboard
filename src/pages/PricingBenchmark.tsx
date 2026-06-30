import { useState } from 'react';
import { Tag } from 'lucide-react';
import { useT } from '../i18n/useT';
import { useDataStore } from '../store/useDataStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { getCeilingPercentStatus, getStatusBadgeClass, getStatusTextClass, getPositiveStatus } from '../utils/metricStatus';

// ─── Data ────────────────────────────────────────────────────────────────────

interface Competitor { name: string; price: number | null; }
interface ProcedureData {
  label: string;
  labelEn: string;
  emma: number | null;
  market: { min: number; mid: number; max: number };
  competitors: Competitor[];
}

const PRICING_DATA: Record<string, ProcedureData> = {
  nose_close: {
    label: 'จมูก (Close)',
    labelEn: 'Nose (Close)',
    emma: null,
    market: { min: 9900, mid: 35000, max: 80000 },
    competitors: [
      { name: 'The Art Clinic',       price: 25000 },
      { name: 'We Clinic',            price: 25000 },
      { name: 'Masterpiece Hospital', price: 50000 },
      { name: 'Yanhee Hospital',      price: 45000 },
      { name: 'The Klinique',         price: null  },
      { name: 'Teeraporn Clinic',     price: null  },
    ],
  },
  nose_open: {
    label: 'จมูก (Open)',
    labelEn: 'Nose (Open)',
    emma: null,
    market: { min: 50000, mid: 90000, max: 160000 },
    competitors: [
      { name: 'The Art Clinic',       price: null   },
      { name: 'We Clinic',            price: 79000  },
      { name: 'Masterpiece Hospital', price: 100000 },
      { name: 'Yanhee Hospital',      price: null   },
      { name: 'The Klinique',         price: null   },
      { name: 'Teeraporn Clinic',     price: null   },
    ],
  },
  chin: {
    label: 'คาง',
    labelEn: 'Chin',
    emma: null,
    market: { min: 15000, mid: 35000, max: 70000 },
    competitors: [
      { name: 'The Art Clinic',       price: 25000 },
      { name: 'We Clinic',            price: 29000 },
      { name: 'Masterpiece Hospital', price: 35000 },
      { name: 'Yanhee Hospital',      price: 30000 },
      { name: 'The Klinique',         price: null  },
      { name: 'Teeraporn Clinic',     price: null  },
    ],
  },
  eyes: {
    label: 'ตา (2 ชั้น)',
    labelEn: 'Double Eyelid',
    emma: null,
    market: { min: 9900, mid: 25000, max: 60000 },
    competitors: [
      { name: 'The Art Clinic',       price: 25000 },
      { name: 'We Clinic',            price: null  },
      { name: 'Masterpiece Hospital', price: 35000 },
      { name: 'Yanhee Hospital',      price: 28000 },
      { name: 'The Klinique',         price: null  },
      { name: 'Teeraporn Clinic',     price: null  },
    ],
  },
  breast: {
    label: 'หน้าอก',
    labelEn: 'Breast Aug.',
    emma: null,
    market: { min: 69000, mid: 99000, max: 249000 },
    competitors: [
      { name: 'The Art Clinic',       price: 69000 },
      { name: 'We Clinic',            price: null  },
      { name: 'Masterpiece Hospital', price: null  },
      { name: 'Yanhee Hospital',      price: null  },
      { name: 'The Klinique',         price: null  },
      { name: 'Teeraporn Clinic',     price: null  },
    ],
  },
  facelift: {
    label: 'Facelift',
    labelEn: 'Facelift',
    emma: null,
    market: { min: 42000, mid: 120000, max: 253000 },
    competitors: [
      { name: 'The Art Clinic',       price: 150000 },
      { name: 'We Clinic',            price: null   },
      { name: 'Masterpiece Hospital', price: 120000 },
      { name: 'Yanhee Hospital',      price: 100000 },
      { name: 'The Klinique',         price: null   },
      { name: 'Teeraporn Clinic',     price: null   },
    ],
  },
  endotine: {
    label: 'Endotine',
    labelEn: 'Endotine',
    emma: null,
    market: { min: 80000, mid: 150000, max: 250000 },
    competitors: [
      { name: 'The Art Clinic',       price: null },
      { name: 'We Clinic',            price: null },
      { name: 'Masterpiece Hospital', price: null },
      { name: 'Yanhee Hospital',      price: null },
      { name: 'The Klinique',         price: null },
      { name: 'Teeraporn Clinic',     price: null },
    ],
  },
  lip: {
    label: 'ปาก / Lip',
    labelEn: 'Lip',
    emma: null,
    market: { min: 15000, mid: 35000, max: 80000 },
    competitors: [
      { name: 'The Art Clinic',       price: null },
      { name: 'We Clinic',            price: null },
      { name: 'Masterpiece Hospital', price: null },
      { name: 'Yanhee Hospital',      price: null },
      { name: 'The Klinique',         price: null },
      { name: 'Teeraporn Clinic',     price: null },
    ],
  },
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface PricingBenchmarkProps {
  emmaPrices?: Partial<Record<string, number>>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return '฿' + n.toLocaleString('en-US');
}

function diffPct(price: number, mid: number): string {
  const d = ((price - mid) / mid) * 100;
  return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
}

function tierLabel(price: number | null, mid: number): string | null {
  if (price === null) return null;
  const ratio = price / mid;
  if (ratio < 0.7)        return 'Entry';
  if (ratio <= 1.1)       return 'Mid';
  if (ratio <= 1.5)       return 'Mid-High';
  return 'Premium';
}

function tierClass(tier: string | null): string {
  switch (tier) {
    case 'Entry':    return 'bg-blue-100 text-blue-700';
    case 'Mid':      return 'bg-green-100 text-green-700';
    case 'Mid-High': return 'bg-yellow-100 text-yellow-700';
    case 'Premium':  return 'bg-purple-100 text-purple-700';
    default:         return '';
  }
}

function diffClass(price: number, mid: number): string {
  const ratio = price / mid;
  if (ratio >= 0.95 && ratio <= 1.05) return getStatusBadgeClass('warning');
  if (price > mid) return getStatusBadgeClass('bad');
  return getStatusBadgeClass('good');
}

// ─── Component ───────────────────────────────────────────────────────────────

const GOLD = '#C9A96E';
const KEYS = Object.keys(PRICING_DATA);

export default function PricingBenchmark({ emmaPrices }: PricingBenchmarkProps) {
  const t = useT();
  const language = useDataStore(s => s.language);
  const [activeKey, setActiveKey] = useState(KEYS[0]);

  // Merge injected emma prices
  const merged: Record<string, ProcedureData> = Object.fromEntries(
    Object.entries(PRICING_DATA).map(([k, v]) => [
      k,
      { ...v, emma: emmaPrices?.[k] ?? v.emma },
    ]),
  );

  const proc = merged[activeKey];
  const { emma, market, competitors } = proc;
  const getLabel = (p: ProcedureData) => language === 'en' ? p.labelEn : p.label;

  // vs mid
  const vsMid = emma !== null
    ? diffPct(emma, market.mid)
    : null;

  // Bar chart rows
  const maxVal = Math.max(market.max, emma ?? 0, ...competitors.map(c => c.price ?? 0));
  const barData = [
    { name: t.barMin, value: market.min, color: '#A8C5DA' },
    { name: t.barMid, value: market.mid, color: GOLD },
    { name: t.barMax, value: market.max, color: '#7B9EC4' },
    ...(emma !== null ? [{ name: 'EMMA', value: emma, color: '#6BAF9E' }] : []),
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Tag size={18} className="text-emma-gold-dark" />
        <h2 className="font-playfair text-lg font-semibold text-emma-black">
          Pricing Benchmark
        </h2>
      </div>

      {/* Procedure Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {KEYS.map(k => (
          <button
            key={k}
            onClick={() => setActiveKey(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-inter font-medium border transition-colors
              ${activeKey === k
                ? 'bg-emma-gold text-white border-emma-gold'
                : 'border-emma-border text-emma-grey hover:border-emma-gold-light'}`}
          >
            {getLabel(merged[k])}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: t.emmaPrice,       value: fmt(emma),        accent: true },
          { label: t.marketMinPrice,  value: fmt(market.min),  accent: false },
          { label: t.marketMidPrice,  value: fmt(market.mid),  accent: false },
          { label: t.marketMaxPrice,  value: fmt(market.max),  accent: false },
          { label: t.vsMidPrice,      value: vsMid ?? '—',     accent: false },
        ].map(card => (
          <div
            key={card.label}
            className={`emma-card py-3 px-4 ${card.accent ? 'border-emma-gold/40 bg-emma-gold/5' : ''}`}
          >
            <p className="text-xs font-inter text-emma-grey-dark uppercase tracking-wide mb-1">
              {card.label}
            </p>
            <p className={`text-base font-inter font-semibold ${
              card.label === t.vsMidPrice && vsMid !== null
                ? getStatusTextClass(getCeilingPercentStatus(((emma ?? market.mid) / market.mid) * 100, 100, 5))
                : card.label === t.emmaPrice && emma !== null
                  ? getStatusTextClass(getPositiveStatus(emma))
                  : card.accent ? 'text-emma-gold-dark' : 'text-emma-black'
            }`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="emma-card">
        <h3 className="emma-label mb-4">{t.priceRangeTitle} — {getLabel(proc)}</h3>
        {emma === null && (
          <p className="text-xs text-emma-grey-dark font-inter mb-3 italic">
            {t.noEmmaPriceNote}
          </p>
        )}
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
              barSize={22}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, maxVal * 1.1]}
                tickFormatter={v => `฿${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 13, fontFamily: 'Inter, sans-serif', fill: '#5C5048' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 13, fontFamily: 'Noto Sans Thai, sans-serif', fill: '#5C5048' }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                formatter={(value: number) => [fmt(value), 'ราคา']}
                contentStyle={{ borderRadius: 6, border: '1px solid #E8DDD0', fontSize: 13 }}
              />
              <ReferenceLine
                x={market.mid}
                stroke={GOLD}
                strokeDasharray="4 3"
                label={{ value: 'กลาง', position: 'insideTopRight', fontSize: 9, fill: GOLD }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Competitor Table */}
      <div className="emma-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-emma-border">
          <h3 className="emma-label">Competitor Pricing — {getLabel(proc)}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-inter">
            <thead>
              <tr className="border-b border-emma-border bg-emma-nude/40">
                <th className="text-left px-4 py-2.5 text-emma-grey-dark font-medium">{t.competitorCol}</th>
                <th className="text-right px-4 py-2.5 text-emma-grey-dark font-medium">{t.priceCol}</th>
                <th className="text-center px-4 py-2.5 text-emma-grey-dark font-medium">{t.tierCol}</th>
                <th className="text-center px-4 py-2.5 text-emma-grey-dark font-medium">{t.vsMarketCol}</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c, i) => {
                const tier = tierLabel(c.price, market.mid);
                return (
                  <tr
                    key={i}
                    className="border-b border-emma-border last:border-0 hover:bg-emma-nude/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-emma-black">{c.name}</td>
                    <td className="px-4 py-2.5 text-right text-emma-black">
                      {fmt(c.price)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {tier
                        ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${tierClass(tier)}`}>{tier}</span>
                        : <span className="text-emma-grey">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {c.price !== null
                        ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${diffClass(c.price, market.mid)}`}>
                            {diffPct(c.price, market.mid)}
                          </span>
                        : <span className="text-emma-grey">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-emma-grey-dark font-inter italic px-1">
        {t.pricingDisclaimer}
      </p>
    </div>
  );
}
