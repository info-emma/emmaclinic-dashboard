import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LabelList, ResponsiveContainer
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

interface PLItem {
  label: string;
  value: number;
}

interface PLSummaryChartProps {
  items: PLItem[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="bg-white border border-emma-border rounded-2xl shadow-emma-md p-3">
      <p className="font-inter text-xs font-semibold text-emma-black mb-1">{label}</p>
      <p className={`font-inter text-xs font-medium ${v < 0 ? 'text-acc-negative' : 'text-acc-positive'}`}>
        {formatCurrency(v)}
      </p>
    </div>
  );
};

export default function PLSummaryChart({ items }: PLSummaryChartProps) {
  const chartData = items;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 24, right: 8, left: 0, bottom: 8 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#EBE3DB" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
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
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={56}>
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => formatCurrency(v, true)}
            style={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
          />
          {chartData.map((entry, i) => {
            let color = '#C9A870';
            if (i === 0) color = '#C9A870';
            else if (entry.value < 0) color = '#C0392B';
            else color = '#2E7D52';
            return <Cell key={i} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
