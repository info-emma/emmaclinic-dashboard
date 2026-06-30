import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  momChange?: { value: number; label: string; positive: boolean };
  vsPlan?: { value: number; label: string; positive: boolean };
  icon?: ReactNode;
  accent?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  valueClassName?: string;
  subValueClassName?: string;
  remark?: string;
}

export default function KPICard({
  label,
  value,
  subValue,
  momChange,
  vsPlan,
  icon,
  accent = false,
  valueClassName,
  subValueClassName,
  remark,
}: KPICardProps) {
  const valueColorClass = valueClassName ?? (accent ? 'text-emma-white' : 'text-emma-black');
  const subValueColorClass = subValueClassName ?? (accent ? 'text-emma-grey-light' : 'text-emma-grey-dark');

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-emma-md
      ${accent ? 'bg-emma-black border-emma-grey-dark' : 'bg-white border-emma-border shadow-emma'} group`}
      title={remark}
    >
      {/* Circle motif */}
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full border-2 opacity-10 pointer-events-none
        ${accent ? 'border-emma-gold' : 'border-emma-gold-light'}`} />
      <div className={`absolute -right-2 -bottom-2 w-12 h-12 rounded-full border opacity-10 pointer-events-none
        ${accent ? 'border-emma-gold' : 'border-emma-gold'}`} />

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <p className={`text-sm font-inter font-medium uppercase tracking-wider leading-tight
          ${accent ? 'text-emma-grey-light' : 'text-emma-grey-dark'}`}
        >
          {label}
        </p>
        {icon && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center
            ${accent ? 'bg-emma-gold/20 text-emma-gold' : 'bg-emma-nude text-emma-gold-dark'}`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Main value */}
      <p className={`font-playfair font-semibold text-xl sm:text-2xl leading-tight ${valueColorClass}`}>
        {value}
      </p>

      {subValue && (
        <p className={`text-base font-inter mt-0.5 ${subValueColorClass}`}>
          {subValue}
        </p>
      )}

      {/* Bottom: MoM + vs Plan */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {momChange && (
          <div className={`flex items-center gap-1 text-xs font-inter
            ${momChange.positive ? 'text-acc-positive' : 'text-acc-negative'}`}
          >
            {momChange.value > 0.5 ? (
              <TrendingUp size={12} />
            ) : momChange.value < -0.5 ? (
              <TrendingDown size={12} />
            ) : (
              <Minus size={12} />
            )}
            <span>{momChange.label}</span>
          </div>
        )}

        {vsPlan && (
          <div className={`text-xs font-inter px-2 py-0.5 rounded-full
            ${vsPlan.positive
              ? 'bg-acc-positive/10 text-acc-positive'
              : 'bg-acc-negative/10 text-acc-negative'
            }`}
          >
            {vsPlan.label}
          </div>
        )}
      </div>

      {remark && (
        <div className={`pointer-events-none absolute left-4 right-4 z-10 rounded-xl border px-3 py-2 text-[11px] font-inter leading-relaxed opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 translate-y-2
          ${accent
            ? 'bottom-4 border-emma-gold/30 bg-emma-black/95 text-emma-grey-light'
            : 'bottom-4 border-emma-border bg-white/95 text-emma-grey-dark'
          }`}
        >
          {remark}
        </div>
      )}
    </div>
  );
}
