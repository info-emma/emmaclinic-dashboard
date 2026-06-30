import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { MONTHS } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { CHART_SERIES_COLORS, getStandardSeriesColor } from '../../utils/chartColors';

interface PlanActualChartProps {
  actual: number[];
  plan: number[];
  target?: number[];
  showTarget: boolean;
  selectedMonths: number[];
  label?: string;
  achievementThreshold?: number[];
  achievementThresholdLabel?: string;
}

const CustomTooltip = ({ active, payload, label, thresholdLabel }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-emma-border rounded-2xl shadow-emma-md p-3 min-w-[180px]">
      <p className="font-inter text-xs font-semibold text-emma-black mb-2">{label}</p>
      {payload.map((entry: any) => {
        const isPercentMetric = typeof entry.value === 'number' && (
          entry.name === 'Achievement %' ||
          entry.dataKey === 'achievement' ||
          entry.yAxisId === 'right' ||
          entry.name === thresholdLabel ||
          entry.dataKey === thresholdLabel
        );
        const seriesColor = entry.color || entry.stroke || entry.fill || getStandardSeriesColor(entry.name);
        return (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-xs font-inter mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: seriesColor }} />
              <span className="text-emma-grey">{entry.name}</span>
            </span>
            <span className="font-medium text-emma-black">
              {isPercentMetric ? `${entry.value?.toFixed(1)}%` : formatCurrency(entry.value, true)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

function ThresholdPercentLabel({ x, y, value, index, lastIndex }: any) {
  if (index !== lastIndex || value == null || x == null || y == null) return null;

  return (
    <text x={x + 8} y={y - 8} fill={CHART_SERIES_COLORS.threshold} fontSize={10} fontFamily="Inter" fontWeight={600}>
      {`${value.toFixed(1)}%`}
    </text>
  );
}

export default function PlanActualChart({
  actual,
  plan,
  target,
  showTarget,
  selectedMonths,
  achievementThreshold,
  achievementThresholdLabel = 'Threshold %',
}: PlanActualChartProps) {
  const comparator = showTarget ? target : plan;
  const planKey = showTarget ? 'Target' : 'Plan';

  const data = MONTHS.map((month, i) => {
    const a = actual[i] ?? 0;
    const p = comparator?.[i] ?? 0;
    const isSelected = selectedMonths.includes(i);
    // Achievement %: only show for selected months with non-zero plan
    const achievement = isSelected && p !== 0 ? (a / p) * 100 : null;
    return {
      month,
      Actual: a,
      [planKey]: p,
      active: isSelected,
      achievement,
      [achievementThresholdLabel]: achievementThreshold?.[i] ?? null,
    };
  });

  // Check if any values are negative → use auto domain so negatives render properly
  const hasNegative = data.some(d => d.Actual < 0 || (d[planKey] as number) < 0);
  const thresholdPoints = achievementThreshold?.map((value, index) => ({ value, index }))
    .filter(item => item.value != null) ?? [];
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
          yAxisId="left"
          tickFormatter={(v) => formatCurrency(v, true)}
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
          axisLine={false}
          tickLine={false}
          width={64}
          domain={hasNegative ? ['auto', 'auto'] : [0, 'auto']}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(v) => `${v.toFixed(0)}%`}
          tick={{ fontSize: 13, fontFamily: 'Inter', fill: '#5C5048' }}
          axisLine={false}
          tickLine={false}
          domain={['auto', 'auto']}
          width={40}
        />
        <Tooltip content={<CustomTooltip thresholdLabel={achievementThresholdLabel} />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 13, fontFamily: 'Inter', paddingTop: 8 }}
        />

        <Bar
          yAxisId="left"
          dataKey={planKey}
          fill={CHART_SERIES_COLORS.plan}
          radius={[2, 2, 0, 0]}
          maxBarSize={24}
          stroke={CHART_SERIES_COLORS.plan}
          strokeWidth={1.25}
          legendType="rect"
        />

        <Bar yAxisId="left" dataKey="Actual" radius={[2, 2, 0, 0]} maxBarSize={24} fill={CHART_SERIES_COLORS.actual}>
          {data.map((entry, index) => {
            const isNeg = entry.Actual < 0;
            if (!entry.active) return <Cell key={index} fill={isNeg ? CHART_SERIES_COLORS.negativeActualMuted : CHART_SERIES_COLORS.actualMuted} />;
            return <Cell key={index} fill={isNeg ? CHART_SERIES_COLORS.negativeActual : CHART_SERIES_COLORS.actual} />;
          })}
        </Bar>

        <Line
          yAxisId="right"
          type="monotone"
          dataKey="achievement"
          stroke={CHART_SERIES_COLORS.achievement}
          strokeWidth={1.5}
          dot={{ fill: CHART_SERIES_COLORS.achievement, r: 3 }}
          name="Achievement %"
          strokeDasharray="4 3"
          connectNulls={false}
        />

        {achievementThreshold?.length ? (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={achievementThresholdLabel}
            stroke={CHART_SERIES_COLORS.threshold}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="3 3"
          >
            <LabelList content={<ThresholdPercentLabel lastIndex={lastThresholdIndex} />} />
          </Line>
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
