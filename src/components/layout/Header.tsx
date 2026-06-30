import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useBranchStore } from '../../store/useBranchStore';
import { useCompareStore } from '../../store/useCompareStore';
import { useT } from '../../i18n/useT';

interface HeaderProps {
  onMenuClick: () => void;
}

function getFilterSection(pathname: string): 'overview' | 'operation' | 'compare' | 'none' {
  if (pathname.startsWith('/operation')) return 'operation';
  if (pathname === '/ai-insights') return 'none';
  if (pathname === '/excom/compare' || pathname === '/compare') return 'compare';
  return 'overview';
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const t = useT();
  const currentSection = getFilterSection(location.pathname);
  const previousSectionRef = useRef<typeof currentSection | null>(null);

  const pageTitles: Record<string, string> = {
    '/': t.pageOverview,
    '/revenue': t.pageRevenue,
    '/cost': t.pageCost,
    '/plan': t.pagePlan,
    '/excom/revenue': t.pageRevenue,
    '/excom/pl': t.pageCost,
    '/excom/plan': t.pagePlan,
    '/excom/compare': t.pageCompare,
    '/excom/sga': t.navSGA,
    '/operation/cost': t.pageOpCost,
    '/operation/branch': t.navBranch,
    '/operation/pricing': t.pagePricing,
    '/operation/procedure': t.pageProcedure,
    '/ai-insights': t.pageAIInsights,
  };
  const title = pageTitles[location.pathname] || t.pageOverview;

  const selectedMonths = useDataStore(s => s.selectedMonths);
  const toggleMonth = useDataStore(s => s.toggleMonth);
  const selectYTD = useDataStore(s => s.selectYTD);
  const selectAllMonths = useDataStore(s => s.selectAllMonths);
  const showTarget = useDataStore(s => s.showTarget);
  const setShowTarget = useDataStore(s => s.setShowTarget);
  const language = useDataStore(s => s.language);
  const setLanguage = useDataStore(s => s.setLanguage);
  const reports = useDataStore(s => s.reports);
  const selectedYear = useDataStore(s => s.selectedYear);
  const setSelectedYear = useDataStore(s => s.setSelectedYear);
  const operationSelectedMonths = useDataStore(s => s.operationSelectedMonths);
  const operationSelectedYear = useDataStore(s => s.operationSelectedYear);
  const setOperationSelectedYear = useDataStore(s => s.setOperationSelectedYear);
  const toggleOperationMonth = useDataStore(s => s.toggleOperationMonth);
  const selectOperationYTD = useDataStore(s => s.selectOperationYTD);
  const selectOperationAllMonths = useDataStore(s => s.selectOperationAllMonths);
  const resetOverviewFilters = useDataStore(s => s.resetOverviewFilters);
  const resetOperationFilters = useDataStore(s => s.resetOperationFilters);
  const branchAvailableYears = useBranchStore(s => s.availableYears);
  const fetchBranchAvailableYears = useBranchStore(s => s.fetchAvailableYears);

  const compareCompanies = useCompareStore(s => s.companies);
  const compareFilterYear = useCompareStore(s => s.filterYear);
  const compareFilterQuarter = useCompareStore(s => s.filterQuarter);
  const setCompareFilterYear = useCompareStore(s => s.setFilterYear);
  const setCompareFilterQuarter = useCompareStore(s => s.setFilterQuarter);

  const compareAvailableYears = [...new Set(
    Object.values(compareCompanies)
      .map(d => d?.year)
      .filter((y): y is number => y != null),
  )].sort((a, b) => b - a);

  const toCE = (y: number) => y > 2500 ? y - 543 : y;

  const overviewAvailableYears = [...new Map(
    reports
      .map(r => r.year)
      .filter((y): y is number => y != null)
      .map(y => [toCE(y), y])
  ).entries()].sort((a, b) => b[0] - a[0]);

  const operationAvailableYears = [...new Map(
    branchAvailableYears.map(y => [toCE(y), y])
  ).entries()].sort((a, b) => b[0] - a[0]);

  useEffect(() => {
    if (currentSection === 'operation') {
      fetchBranchAvailableYears();
    }
  }, [currentSection, fetchBranchAvailableYears]);

  useEffect(() => {
    const previousSection = previousSectionRef.current;
    if (previousSection && previousSection !== currentSection) {
      if (currentSection === 'overview') resetOverviewFilters();
      if (currentSection === 'operation') resetOperationFilters();
    }
    previousSectionRef.current = currentSection;
  }, [currentSection, resetOperationFilters, resetOverviewFilters]);

  const activeMonths = currentSection === 'operation' ? operationSelectedMonths : selectedMonths;
  const activeYear = currentSection === 'operation' ? operationSelectedYear : selectedYear;
  const availableYears = currentSection === 'operation' ? operationAvailableYears : overviewAvailableYears;
  const filterLabel = currentSection === 'operation' ? 'Operation Filter' : 'Overview Filter';
  const sectionLabel = currentSection === 'operation' ? 'Operation' : 'Overview';
  const QUARTER_OPTS = ['all', 1, 2, 3, 4] as const;

  const activeFilterSummary = useMemo(() => {
    const yearLabel = activeYear ? String(toCE(activeYear)) : 'Latest';
    const ytdLike = activeMonths.length > 0 && activeMonths.every((month, index) => month === index);
    const allMonthsSelected = activeMonths.length === 12;

    let monthLabel = t.all;
    if (allMonthsSelected) {
      monthLabel = t.all;
    } else if (ytdLike) {
      monthLabel = t.ytd;
    } else {
      monthLabel = activeMonths.length === 0
        ? '—'
        : activeMonths.length <= 2
          ? activeMonths.map(month => t.months[month]).join(', ')
          : `${t.months[activeMonths[0]]}–${t.months[activeMonths[activeMonths.length - 1]]}`;
    }

    const basis = currentSection === 'overview' ? ` | Basis: ${showTarget ? t.target : t.plan}` : '';
    return `Year: ${yearLabel} | Months: ${monthLabel}${basis}`;
  }, [activeMonths, activeYear, currentSection, showTarget, t]);

  const handleYearSelect = (rawYear: number) => {
    if (currentSection === 'operation') {
      setOperationSelectedYear(rawYear);
      return;
    }
    setSelectedYear(rawYear);
  };

  const handleToggleMonth = (month: number) => {
    if (currentSection === 'operation') {
      toggleOperationMonth(month);
      return;
    }
    toggleMonth(month);
  };

  const handleSelectYTD = () => {
    if (currentSection === 'operation') {
      selectOperationYTD();
      return;
    }
    selectYTD();
  };

  const handleSelectAll = () => {
    if (currentSection === 'operation') {
      selectOperationAllMonths();
      return;
    }
    selectAllMonths();
  };

  return (
    <header className="bg-emma-white border-b border-emma-border px-4 lg:px-6 py-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="flex-shrink-0 p-1.5 -ml-1 text-emma-grey hover:text-emma-black transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        <h2 className="font-playfair text-base sm:text-xl font-semibold text-emma-black truncate flex-1 min-w-0">{title}</h2>

        <div className="flex-shrink-0 flex items-center gap-0.5 bg-emma-nude rounded p-0.5">
          <button
            onClick={() => setLanguage('en')}
            className={`px-2 py-0.5 text-xs font-inter font-medium rounded transition-all duration-200 ${
              language === 'en' ? 'bg-emma-black text-white' : 'text-emma-grey hover:text-emma-grey-dark'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('th')}
            className={`px-2 py-0.5 text-xs font-inter font-medium rounded transition-all duration-200 ${
              language === 'th' ? 'bg-emma-black text-white' : 'text-emma-grey hover:text-emma-grey-dark'
            }`}
          >
            ไทย
          </button>
        </div>

        {currentSection === 'overview' && (
          <div className="flex-shrink-0 flex items-center gap-0.5 bg-emma-nude rounded p-0.5">
            <button
              onClick={() => setShowTarget(false)}
              className={`px-2 py-0.5 text-xs font-inter font-medium rounded transition-all duration-200 ${
                !showTarget ? 'bg-emma-gold text-white' : 'text-emma-grey hover:text-emma-grey-dark'
              }`}
            >
              {t.vsPlan}
            </button>
            <button
              onClick={() => setShowTarget(true)}
              className={`px-2 py-0.5 text-xs font-inter font-medium rounded transition-all duration-200 ${
                showTarget ? 'bg-emma-gold text-white' : 'text-emma-grey hover:text-emma-grey-dark'
              }`}
            >
              {t.vsTarget}
            </button>
          </div>
        )}
      </div>

      {currentSection === 'compare' && (
        <div className="rounded-2xl border border-emma-border bg-emma-nude/30 px-3 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emma-black text-white px-2.5 py-1 text-[11px] font-inter font-semibold uppercase tracking-wide">
                Compare
              </span>
              <span className="text-xs font-inter font-semibold text-emma-black">Industry Comparison Filter</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* YEAR */}
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-inter font-semibold uppercase tracking-wide text-emma-grey-dark">Year</p>
              <div className="flex gap-1">
                {(['all', ...compareAvailableYears] as Array<'all' | number>).map(y => (
                  <button
                    key={y}
                    onClick={() => setCompareFilterYear(y)}
                    className={`flex-shrink-0 px-2 py-0.5 text-xs font-inter font-medium rounded transition-all duration-150 ${
                      compareFilterYear === y
                        ? 'bg-emma-black text-white'
                        : 'border border-emma-border text-emma-grey hover:border-emma-gold hover:text-emma-gold-dark'
                    }`}
                  >
                    {y === 'all' ? 'All' : String(y)}
                  </button>
                ))}
              </div>
            </div>
            {/* QUARTER */}
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-inter font-semibold uppercase tracking-wide text-emma-grey-dark">Quarter</p>
              <div className="flex gap-1">
                {QUARTER_OPTS.map(q => (
                  <button
                    key={q}
                    onClick={() => setCompareFilterQuarter(q)}
                    className={`flex-shrink-0 px-2 py-0.5 text-xs font-inter font-medium rounded transition-all duration-150 ${
                      compareFilterQuarter === q
                        ? 'bg-emma-gold text-white'
                        : 'border border-emma-border text-emma-grey hover:border-emma-gold hover:text-emma-gold-dark'
                    }`}
                  >
                    {q === 'all' ? 'All' : `Q${q}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentSection !== 'none' && currentSection !== 'compare' && (
        <div className="rounded-2xl border border-emma-border bg-emma-nude/30 px-3 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-emma-black text-white px-2.5 py-1 text-[11px] font-inter font-semibold uppercase tracking-wide">
                {sectionLabel}
              </span>
              <span className="text-xs font-inter font-semibold text-emma-black">{filterLabel}</span>
            </div>
            <span className="text-[11px] font-inter text-emma-grey-dark">
              {activeFilterSummary}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-[11px] font-inter font-semibold uppercase tracking-wide text-emma-grey-dark mb-1">
                Year
              </p>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {availableYears.length > 0 && availableYears.map(([ceYear, rawYear]) => (
                  <button
                    key={ceYear}
                    onClick={() => handleYearSelect(rawYear)}
                    className={`flex-shrink-0 px-2 py-0.5 text-xs font-inter font-medium rounded transition-all duration-150 ${
                      activeYear != null && toCE(activeYear) === ceYear
                        ? 'bg-emma-black text-white'
                        : 'border border-emma-border text-emma-grey hover:border-emma-gold hover:text-emma-gold-dark'
                    }`}
                  >
                    {ceYear}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-inter font-semibold uppercase tracking-wide text-emma-grey-dark mb-1">
                Month
              </p>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <button
                  onClick={handleSelectYTD}
                  className="flex-shrink-0 px-2 py-0.5 text-xs font-inter font-medium border border-emma-gold text-emma-gold-dark rounded hover:bg-emma-gold hover:text-white transition-all duration-150"
                >
                  {t.ytd}
                </button>
                <button
                  onClick={handleSelectAll}
                  className="flex-shrink-0 px-2 py-0.5 text-xs font-inter font-medium border border-emma-border text-emma-grey rounded hover:border-emma-gold hover:text-emma-gold-dark transition-all duration-150"
                >
                  {t.all}
                </button>

                <div className="w-px h-4 bg-emma-border" />

                {t.months.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => handleToggleMonth(i)}
                    className={`flex-shrink-0 px-2 py-0.5 text-xs font-inter font-medium rounded transition-all duration-150 ${
                      activeMonths.includes(i)
                        ? 'bg-emma-gold text-white'
                        : 'border border-emma-border text-emma-grey hover:border-emma-gold-light hover:text-emma-grey-dark'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
