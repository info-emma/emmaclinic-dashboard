import { CHART_SERIES_COLORS } from '../../utils/chartColors';

interface ThresholdLegendProps {
  thresholdLabel: string;
  thresholdDescription: string;
  achievementDescription?: string;
}

export default function ThresholdLegend({
  thresholdLabel,
  thresholdDescription,
  achievementDescription,
}: ThresholdLegendProps) {
  return (
    <div className="mt-3 rounded-xl border border-emma-border bg-emma-nude/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-inter text-emma-black">
        <span className="inline-block h-0.5 w-6" style={{ background: CHART_SERIES_COLORS.threshold }} />
        <span className="font-semibold">{thresholdLabel}</span>
      </div>
      <p className="mt-1 text-[11px] font-inter leading-relaxed text-emma-grey">
        {thresholdDescription}
      </p>
      {achievementDescription && (
        <p className="mt-1 text-[11px] font-inter leading-relaxed text-emma-grey">
          {achievementDescription}
        </p>
      )}
    </div>
  );
}
