import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ReferenceLine, ResponsiveContainer
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

interface WaterfallItem {
  label: string;
  value: number;
  isTotal?: boolean;
  isNegative?: boolean;
}

interface WaterfallChartProps {
  items: WaterfallItem[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.payload?.displayValue ?? payload[0]?.value ?? 0;
  return (
    <div className="bg-white border border-emma-border rounded-2xl shadow-emma-md p-3">
      <p className="font-inter text-xs font-semibold text-emma-black mb-1">{label}</p>
      <p className={`font-inter text-xs font-medium ${v < 0 ? 'text-acc-negative' : 'text-acc-positive'}`}>
        {formatCurrency(v)}
      </p>
    </div>
  );
};

export default function WaterfallChart({ items }: WaterfallChartProps) {
  // Build waterfall data: each bar starts at cumulative base
  let running = 0;
  const chartData = items.map((item) => {
    if (item.isTotal) {
      const val = item.value;
      const base = 0;
      return {
        label: item.label,
        base,
        barValue: val,
        displayValue: val,
        isTotal: true,
        isNegative: val < 0,
      };
    }

    const base = item.isNegative ? running + item.value : running;
    const barValue = Math.abs(item.value);
    const prev = running;
    running += item.value;

    return {
      label: item.label,
      base,
      barValue,
      displayValue: item.value,
      isTotal: false,
      isNegative: item.isNegative || item.value < 0,
      prev,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBE3DB" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048', angle: -30, textAnchor: 'end' } as any}
          axisLine={{ stroke: '#EBE3DB' }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={(v) => formatCurrency(v, true)}
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#EBE3DB" />

        {/* Invisible base bar (transparent) to create stacked effect */}
        <Bar dataKey="base" stackId="waterfall" fill="transparent" />

        {/* Visible bar */}
        <Bar dataKey="barValue" stackId="waterfall" radius={[2, 2, 0, 0]} maxBarSize={40}>
          {chartData.map((entry, index) => {
            let color = '#C9A870'; // default gold
            if (entry.isTotal) color = entry.isNegative ? '#C0392B' : '#2E7D52';
            else if (entry.isNegative) color = '#C0392B';
            return <Cell key={index} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
