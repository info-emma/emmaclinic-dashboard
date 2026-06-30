import { useState } from 'react';
import { motion } from 'framer-motion';
import { ListOrdered } from 'lucide-react';
import { useT } from '../i18n/useT';
import { useDataStore } from '../store/useDataStore';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

// ─── Types & Data ─────────────────────────────────────────────────────────────

type ViewKey = 'th' | 'global';

interface ProcedureItem {
  rank: number;
  name: string;
  sub: string;
  icon: string;
  score: number;
  detail: string;
}

const RANKING_DATA: Record<'en' | 'th', Record<ViewKey, { label: string; items: ProcedureItem[] }>> = {
  en: {
    th: {
      label: 'Thai Market 2025',
      items: [
        { rank: 1, name: 'Rhinoplasty',    sub: 'Close + Open',        icon: 'N', score: 96, detail: '#1 all-time in Thailand — highest mention on every platform' },
        { rank: 2, name: 'Double Eyelid',  sub: 'Blepharoplasty',      icon: 'E', score: 82, detail: '#1 global 2024, top trend Gen Z Thailand' },
        { rank: 3, name: 'Breast Aug.',    sub: 'Breast augmentation', icon: 'B', score: 74, detail: 'Consistent top 3 in Thailand, high search volume' },
        { rank: 4, name: 'Face shaping',   sub: 'Contouring / Chin',   icon: 'F', score: 68, detail: 'Rapidly growing trend in 2024–25' },
        { rank: 5, name: 'Chin Aug.',      sub: 'Chin augmentation',   icon: 'C', score: 61, detail: 'Often paired with rhinoplasty, high mention' },
        { rank: 6, name: 'Facelift',       sub: 'Face lifting',        icon: 'L', score: 38, detail: 'Growing 35+ segment' },
        { rank: 7, name: 'Endotine',       sub: 'Brow / Forehead lift',icon: 'D', score: 28, detail: 'Niche, lower mention volume' },
        { rank: 8, name: 'Lip surgery',    sub: 'Lip surgery',         icon: 'P', score: 22, detail: 'Non-surgical filler dominates; surgical is rare' },
      ],
    },
    global: {
      label: 'Global ISAPS 2024',
      items: [
        { rank: 1, name: 'Eyelid surgery', sub: '2.1M procedures',     icon: 'E', score: 100, detail: '#1 for first time in ISAPS history, +13.4%' },
        { rank: 2, name: 'Liposuction',    sub: 'Body contouring',     icon: 'L', score: 90,  detail: '#1 women, 2.2M+ procedures' },
        { rank: 3, name: 'Breast Aug.',    sub: 'Breast augmentation', icon: 'B', score: 80,  detail: 'Top 3 every year, 3.9M procedures' },
        { rank: 4, name: 'Scar revision',  sub: 'Scar correction',     icon: 'S', score: 58,  detail: 'Entered top 5 for the first time' },
        { rank: 5, name: 'Rhinoplasty',    sub: 'Rhinoplasty',         icon: 'N', score: 52,  detail: '1M procedures, down 10% from prior year' },
        { rank: 6, name: 'Facelift',       sub: 'Face lifting',        icon: 'F', score: 40,  detail: 'Growing 35+ segment' },
        { rank: 7, name: 'Chin Aug.',      sub: 'Chin augmentation',   icon: 'C', score: 30,  detail: 'Steady demand' },
        { rank: 8, name: 'Endotine / Brow',sub: 'Brow lift',           icon: 'D', score: 18,  detail: 'Niche procedure' },
      ],
    },
  },
  th: {
    th: {
      label: 'ตลาดไทย 2025',
      items: [
        { rank: 1, name: 'เสริมจมูก',   sub: 'Close + Open',        icon: 'N', score: 96, detail: '#1 ตลอดกาลในไทย — mention สูงสุดทุก platform' },
        { rank: 2, name: 'ทำตา 2 ชั้น', sub: 'Blepharoplasty',      icon: 'E', score: 82, detail: '#1 global 2024, ยอดฮิต Gen Z ไทย' },
        { rank: 3, name: 'เสริมหน้าอก', sub: 'Breast augmentation', icon: 'B', score: 74, detail: 'Top 3 ไทยต่อเนื่อง, search volume สูง' },
        { rank: 4, name: 'Face shaping', sub: 'ปรับรูปหน้า / คาง',  icon: 'F', score: 68, detail: 'เทรนด์สูงขึ้นมากใน 2024–25' },
        { rank: 5, name: 'เสริมคาง',    sub: 'Chin augmentation',   icon: 'C', score: 61, detail: 'มักทำคู่กับจมูก, mention สูง' },
        { rank: 6, name: 'Facelift',     sub: 'ดึงหน้า',             icon: 'L', score: 38, detail: 'กลุ่ม 35+ growing segment' },
        { rank: 7, name: 'Endotine',     sub: 'ยกคิ้ว / หน้าผาก',   icon: 'D', score: 28, detail: 'Niche, mention น้อยกว่า' },
        { rank: 8, name: 'ปาก / Lip',   sub: 'Lip surgery',         icon: 'P', score: 22, detail: 'Non-surgical filler ครอง, surgical น้อย' },
      ],
    },
    global: {
      label: 'Global ISAPS 2024',
      items: [
        { rank: 1, name: 'ตา (Eyelid)',     sub: '2.1M procedures',     icon: 'E', score: 100, detail: '#1 ครั้งแรกในประวัติศาสตร์ ISAPS, +13.4%' },
        { rank: 2, name: 'Liposuction',     sub: 'Body contouring',     icon: 'L', score: 90,  detail: '#1 women, 2.2M+ procedures' },
        { rank: 3, name: 'เสริมหน้าอก',    sub: 'Breast augmentation', icon: 'B', score: 80,  detail: 'Top 3 ทุกปี, 3.9M procedures' },
        { rank: 4, name: 'Scar revision',   sub: 'แก้แผลเป็น',          icon: 'S', score: 58,  detail: 'เข้า top 5 ครั้งแรก' },
        { rank: 5, name: 'เสริมจมูก',      sub: 'Rhinoplasty',         icon: 'N', score: 52,  detail: '1M procedures, ลด 10% จากปีก่อน' },
        { rank: 6, name: 'Facelift',        sub: 'Face lifting',        icon: 'F', score: 40,  detail: 'Growing 35+ segment' },
        { rank: 7, name: 'เสริมคาง',       sub: 'Chin augmentation',   icon: 'C', score: 30,  detail: 'Steady demand' },
        { rank: 8, name: 'Endotine / Brow', sub: 'Brow lift',           icon: 'D', score: 18,  detail: 'Niche procedure' },
      ],
    },
  },
};

const PODIUM_COLORS = [
  { bar: '#BA7517', base: '#854F0B', label: '1st' },
  { bar: '#444441', base: '#2C2C2A', label: '2nd' },
  { bar: '#993C1D', base: '#712B13', label: '3rd' },
];

const DATA_SIGNALS = [
  'Social mention volume (TH)',
  'Google search trend',
  'HDmall listing count',
  'Pantip / Wongnai reviews',
  'ISAPS 2024 global data',
  'Clinic portfolio emphasis',
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function IconCircle({ letter, size = 'md', color = '#C9A96E' }: { letter: string; size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const dim = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-sm';
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-playfair font-bold text-white flex-shrink-0`}
      style={{ background: color }}
    >
      {letter}
    </div>
  );
}

const MAX_BAR_H = 160; // px — height for score=100

function PodiumColumn({ item, colors, maxScore }: {
  item: ProcedureItem;
  colors: typeof PODIUM_COLORS[0];
  maxScore: number;
}) {
  const barH = Math.round((item.score / maxScore) * MAX_BAR_H);
  return (
    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 140 }}>
      {/* Name + sub */}
      <div className="text-center mb-2 px-1">
        <p className="text-xs font-inter font-semibold text-emma-black leading-tight">{item.name}</p>
        <p className="text-xs font-inter text-emma-grey-dark mt-0.5 leading-tight">{item.sub}</p>
      </div>
      {/* Icon */}
      <IconCircle letter={item.icon} size="lg" color={colors.bar} />
      {/* Bar */}
      <div
        className="w-full mt-2 flex flex-col items-center justify-center rounded-t-md"
        style={{ height: barH, background: colors.bar }}
      >
        <span className="text-white font-inter font-bold text-sm">#{item.rank}</span>
        <span className="text-white/80 font-inter text-[10px]">{item.score}/100</span>
      </div>
      {/* Base */}
      <div
        className="w-full flex items-center justify-center py-1.5 rounded-b-sm"
        style={{ background: colors.base }}
      >
        <span className="text-white font-inter text-[11px] font-semibold">{colors.label}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ProcedureRankingProps {
  defaultView?: ViewKey;
}

export default function ProcedureRanking({ defaultView = 'th' }: ProcedureRankingProps) {
  const t = useT();
  const language = useDataStore(s => s.language);
  const [view, setView] = useState<ViewKey>(defaultView);

  const dataset = RANKING_DATA[language][view];
  const top3 = dataset.items.slice(0, 3);
  const rest = dataset.items.slice(3);
  const maxScore = dataset.items[0].score;

  // Podium order: #2 left, #1 centre, #3 right
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const podiumColors = [PODIUM_COLORS[1], PODIUM_COLORS[0], PODIUM_COLORS[2]];

  return (
    <div className="space-y-6">

      {/* Header */}
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <h2 className="font-playfair text-xl text-emma-black">{t.pageProcedure}</h2>
        <p className="text-xs font-inter text-emma-grey-dark mt-1">
          {t.procedureRevenueDesc}
        </p>
      </motion.div>

      {/* Revenue ranking (existing placeholder kept) */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="emma-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="emma-label">{t.procedureRevenueTitle}</h3>
            <span className="text-xs font-inter text-emma-grey-dark bg-emma-nude/60 px-2 py-1 rounded">
              {t.uploadToActivate}
            </span>
          </div>
          <div className="space-y-2">
            {['Nose (Close)', 'Nose (Open)', 'Eyes', 'Chin', 'Breast', 'Facelift', 'Skin Treatment', 'Lifting'].map((proc, i) => (
              <div key={proc} className="flex items-center gap-3 opacity-30">
                <span className="w-6 text-xs font-inter font-semibold text-emma-grey-dark text-right flex-shrink-0">{i + 1}</span>
                <div className="flex-1 h-7 bg-emma-nude/60 rounded flex items-center px-3">
                  <span className="text-xs font-inter text-emma-black">{proc}</span>
                </div>
                <span className="text-xs font-inter text-emma-grey-dark w-16 text-right">—</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-center gap-2 py-4 border-t border-emma-border">
            <ListOrdered size={20} className="text-emma-grey" />
            <p className="text-xs font-inter text-emma-grey-dark text-center">
              {t.procedureRevenueDesc}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Market Demand Ranking ─────────────────────────────────────────── */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="emma-card space-y-6">

          {/* Section header + toggle */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="emma-label">{t.marketDemandRanking}</h3>
            <div className="flex gap-1.5">
              {(['th', 'global'] as ViewKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => setView(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-inter font-medium border transition-colors
                    ${view === k
                      ? 'bg-emma-gold text-white border-emma-gold'
                      : 'border-emma-border text-emma-grey hover:border-emma-gold-light'}`}
                >
                  {RANKING_DATA[language][k].label}
                </button>
              ))}
            </div>
          </div>

          {/* Podium */}
          <div className="flex items-end justify-center gap-3 pb-2">
            {podiumOrder.map((item, i) => (
              <PodiumColumn
                key={item.rank}
                item={item}
                colors={podiumColors[i]}
                maxScore={maxScore}
              />
            ))}
          </div>

          {/* Ranked list 4–8 */}
          <div className="space-y-3 pt-2 border-t border-emma-border">
            {rest.map(item => (
              <div key={item.rank} className="flex items-center gap-3">
                <span className="w-5 text-xs font-inter font-semibold text-emma-grey-dark text-right flex-shrink-0">
                  {item.rank}
                </span>
                <IconCircle letter={item.icon} size="sm" color="#9CA3AF" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-inter font-semibold text-emma-black">{item.name}</span>
                    <span className="text-xs font-inter text-emma-grey-dark truncate">{item.detail}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-emma-nude rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(item.score / maxScore) * 100}%`, background: '#C9A96E' }}
                    />
                  </div>
                </div>
                <span className="text-xs font-inter text-emma-grey-dark flex-shrink-0 w-12 text-right">
                  {item.score}/100
                </span>
              </div>
            ))}
          </div>

          {/* Data signal chips */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-emma-border">
            <span className="text-xs font-inter text-emma-grey-dark mr-1 self-center">{t.dataSignalsLabel}</span>
            {DATA_SIGNALS.map(s => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-full bg-emma-nude text-[10px] font-inter text-emma-grey-dark border border-emma-border"
              >
                {s}
              </span>
            ))}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-emma-grey-dark font-inter italic">
            {t.rankingDisclaimer}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
