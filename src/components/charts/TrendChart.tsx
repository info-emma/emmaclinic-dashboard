import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';
import { MONTHS } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { CHART_SERIES_COLORS, getStandardSeriesColor } from '../../utils/chartColors';

interface TrendChartProps {
  actual: number[];
  plan?: number[];
  target?: number[];
  threshold?: number[];
  thresholdLabel?: string;
  selectedMonths: number[];
  title?: string;
  showBars?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-emma-border rounded-2xl shadow-emma-md p-3 min-w-[160px]">
      <p className="font-inter text-xs font-semibold text-emma-black mb-2">{label}</p>
      {payload.map((entry: any) => {
        const seriesColor = entry.color || entry.stroke || entry.fill || getStandardSeriesColor(entry.name);
        return (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-xs font-inter mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: seriesColor }} />
              <span className="text-emma-grey">{entry.name}</span>
            </span>
            <span className="font-medium text-emma-black">{formatCurrency(entry.value, true)}</span>
          </div>
        );
      })}
    </div>
  );
};

function ThresholdLineLabel({ x, y, value, index, lastIndex }: any) {
  if (index !== lastIndex || value == null || x == null || y == null) return null;

  return (
    <text x={x + 8} y={y - 8} fill={CHART_SERIES_COLORS.threshold} fontSize={10} fontFamily="Inter" fontWeight={600}>
      {formatCurrency(value, true)}
    </text>
  );
}

export default function TrendChart({
  actual, plan, target, threshold, thresholdLabel = 'Threshold', selectedMonths, showBars = false
}: TrendChartProps) {
  const data = MONTHS.map((month, i) => ({
    month,
    Actual: actual[i] ?? 0,
    Plan: plan?.[i] ?? undefined,
    Target: target?.[i] ?? undefined,
    [thresholdLabel]: threshold?.[i] ?? undefined,
    active: selectedMonths.includes(i),
  }));

  const yFormatter = (v: number) => formatCurrency(v, true);
  const thresholdPoints = threshold ? [...threshold].map((value, index) => ({ value, index })).filter(item => item.value != null) : [];
  const lastThresholdIndex = thresholdPoints.length > 0 ? thresholdPoints[thresholdPoints.length - 1].index : -1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBE3DB" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
          axisLine={{ stroke: '#EBE3DB' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={yFormatter}
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 13, fontFamily: 'Inter', paddingTop: 8 }}
        />

        {plan && (
          <Line
            type="monotone"
            dataKey="Plan"
            stroke={CHART_SERIES_COLORS.plan}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
        )}

        {showBars && (
          <Bar
            dataKey="Actual"
            fill={CHART_SERIES_COLORS.actual}
            radius={[2, 2, 0, 0]}
            maxBarSize={32}
          />
        )}

        {!showBars && (
          <Line
            type="monotone"
            dataKey="Actual"
            stroke={CHART_SERIES_COLORS.actual}
            strokeWidth={2.5}
            dot={{ fill: CHART_SERIES_COLORS.actual, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: CHART_SERIES_COLORS.actual }}
          />
        )}

        {target && (
          <Line
            type="monotone"
            dataKey="Target"
            stroke="#5C5048"
            strokeWidth={1.5}
            strokeDasharray="2 3"
            dot={false}
          />
        )}

        {threshold && (
          <Line
            type="monotone"
            dataKey={thresholdLabel}
            stroke={CHART_SERIES_COLORS.threshold}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
          >
            <LabelList content={<ThresholdLineLabel lastIndex={lastThresholdIndex} />} />
          </Line>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
