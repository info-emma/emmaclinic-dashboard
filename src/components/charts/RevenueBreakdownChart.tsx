import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

interface BreakdownItem {
  label: string;
  value: number;
}

interface RevenueBreakdownChartProps {
  data: BreakdownItem[];
  title?: string;
  horizontal?: boolean;
}

const GOLD_PALETTE = [
  '#C9A870', '#A8875A', '#E5D4B0', '#D4BA8C', '#BFA078',
  '#8A7B70', '#D6CDC6', '#5C5048', '#EBE3DB', '#F2E8DE',
  '#C9A870', '#A8875A',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-emma-border rounded-2xl shadow-emma-md p-3">
      <p className="font-inter text-xs font-semibold text-emma-black mb-1">{label}</p>
      <p className="font-inter text-xs text-emma-grey">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
};

export default function RevenueBreakdownChart({ data, horizontal = true }: RevenueBreakdownChartProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={sorted}
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#EBE3DB" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => formatCurrency(v, true)}
            tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[0, 2, 2, 0]} maxBarSize={20}>
            {sorted.map((_, index) => (
              <Cell key={index} fill={GOLD_PALETTE[index % GOLD_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sorted} margin={{ top: 0, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBE3DB" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048', angle: -35, textAnchor: 'end' } as any}
          axisLine={{ stroke: '#EBE3DB' }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={(v) => formatCurrency(v, true)}
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={40}>
          {sorted.map((_, index) => (
            <Cell key={index} fill={GOLD_PALETTE[index % GOLD_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
