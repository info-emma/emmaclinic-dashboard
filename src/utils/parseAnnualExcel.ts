import * as XLSX from 'xlsx';
import type { AnnualMetrics } from '../store/useCompareStore';

interface ParseResult {
  year: number;
  quarter?: number;
  metrics: AnnualMetrics;
}

interface SheetParseResult {
  found: Partial<AnnualMetrics>;
  matchedCount: number;
  year: number;
}

interface ColumnRange {
  from: number;
  to: number;
  preferredValueCols?: number[];
}

interface YearGroup {
  year: number;
  rawYear: number;
  from: number;
  to: number;
}

const METRIC_KEYWORDS: Array<{ key: keyof AnnualMetrics; keywords: string[] }> = [
  { key: 'mainRevenue', keywords: ['รายได้หลัก', 'รายได้จากการขาย', 'รายได้จากการให้บริการ', 'revenue from sales', 'service revenue', 'operating revenue'] },
  { key: 'revenue', keywords: ['รวมรายได้กิจการ', 'รวมรายได้', 'รายได้รวม', 'total revenue', 'total revenues'] },
  { key: 'operatingCost', keywords: ['ต้นทุนขาย', 'ต้นทุนการขาย', 'ต้นทุนในการประกอบกิจการ', 'ต้นทุนในการประกอบ', 'cost of sales', 'cost of service', 'cost of revenue'] },
  { key: 'grossProfit', keywords: ['กำไรขั้นต้น', 'กำไร ขาดทุน ขั้นต้น', 'กำไรก่อนค่าใช้จ่าย', 'gross profit'] },
  { key: 'sellingExpenses', keywords: ['ค่าใช้จ่ายในการขาย', 'ค่าใช้จ่ายการขาย', 'selling expenses', 'selling expense'] },
  { key: 'adminExpenses', keywords: ['ค่าใช้จ่ายในการบริหาร', 'ค่าใช้จ่ายบริหาร', 'administration expenses', 'administrative expenses', 'admin expenses'] },
  { key: 'totalSGA', keywords: ['ค่าใช้จ่ายในการขายและบริหาร', 'รวมค่าใช้จ่ายในการขายและบริหาร', 'selling and administrative expenses', 'sg&a', 'sga'] },
  { key: 'operatingProfit', keywords: ['กำไรจากกิจกรรมดำเนินงาน', 'กำไรจากการดำเนินงาน', 'operating profit', 'ebitda'] },
  { key: 'depreciation', keywords: ['ค่าเสื่อมราคา', 'depreciation', 'd&a'] },
  { key: 'ebit', keywords: ['กำไรก่อนหักดอกเบี้ยและภาษีเงินได้', 'กำไรก่อนดอกเบี้ยและภาษี', 'ebit', 'earnings before interest and tax'] },
  { key: 'financeCost', keywords: ['ต้นทุนทางการเงิน', 'ดอกเบี้ยจ่าย', 'ค่าใช้จ่ายทางการเงิน', 'finance cost', 'financial cost', 'interest expense'] },
  { key: 'ebt', keywords: ['กำไรก่อนภาษีเงินได้', 'กำไรก่อนภาษี', 'profit before tax', 'ebt'] },
  { key: 'tax', keywords: ['ค่าใช้จ่ายภาษีเงินได้', 'ภาษีเงินได้', 'income tax', 'tax expense'] },
  { key: 'netProfit', keywords: ['กำไรสุทธิ', 'กำไร ขาดทุน สุทธิ', 'net profit', 'net income', 'profit for the year'] },
];

function normalizeLabel(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[_\-:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCellText(cell: XLSX.CellObject | null | undefined): string {
  if (!cell) return '';
  if (cell.w) return String(cell.w);
  if (cell.v != null) return String(cell.v);
  return '';
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const cleaned = value
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/[()]/g, '');

  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSheetRows(sheet: XLSX.WorkSheet): Array<Array<XLSX.CellObject | null>> {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const rows: Array<Array<XLSX.CellObject | null>> = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: Array<XLSX.CellObject | null> = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push((sheet[addr] as XLSX.CellObject | undefined) ?? null);
    }
    rows.push(row);
  }

  return rows;
}

function normalizeDetectedYear(rawYear: number): number {
  return rawYear > 2500 ? rawYear - 543 : rawYear;
}

function getCandidateYearsFromText(text: string): number[] {
  const matches = text.match(/\b(20\d{2}|25\d{2})\b/g) ?? [];
  return matches
    .map(match => parseInt(match, 10))
    .map(normalizeDetectedYear)
    .filter(year => year >= 2020 && year <= 2035);
}

function findYearGroups(rows: Array<Array<XLSX.CellObject | null>>): YearGroup[] {
  const headerRows = rows.slice(0, Math.min(12, rows.length));
  const yearCells: Array<{ year: number; rawYear: number; col: number }> = [];

  for (const row of headerRows) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;

      const text = getCellText(cell).trim();
      const rawMatches = text.match(/\b(20\d{2}|25\d{2})\b/g) ?? [];
      for (const rawMatch of rawMatches) {
        const rawYear = parseInt(rawMatch, 10);
        const year = normalizeDetectedYear(rawYear);
        if (year >= 2020 && year <= 2035) {
          yearCells.push({ year, rawYear, col: c });
        }
      }

      if (typeof cell.v === 'number') {
        const rawYear = cell.v;
        const year = normalizeDetectedYear(rawYear);
        if (year >= 2020 && year <= 2035) {
          yearCells.push({ year, rawYear, col: c });
        }
      }
    }
  }

  const unique = [...new Map(yearCells.map(item => [`${item.year}-${item.col}`, item])).values()]
    .sort((a, b) => a.col - b.col);

  return unique.map((cell, idx) => ({
    year: cell.year,
    rawYear: cell.rawYear,
    from: cell.col,
    to: (unique[idx + 1]?.col ?? Number.MAX_SAFE_INTEGER) - 1,
  }));
}

function detectYear(sheetName: string, rows: Array<Array<XLSX.CellObject | null>>): number {
  const groups = findYearGroups(rows);
  if (groups.length > 0) {
    return Math.max(...groups.map(group => group.year));
  }

  const candidateYears = getCandidateYearsFromText(sheetName);
  if (candidateYears.length > 0) {
    return Math.max(...candidateYears);
  }

  return new Date().getFullYear();
}

function findTargetYearRanges(rows: Array<Array<XLSX.CellObject | null>>, year: number): ColumnRange[] {
  return findYearGroups(rows)
    .filter(group => group.year === year)
    .map(group => {
      const preferredValueCols: number[] = [];

      for (let r = 0; r < Math.min(12, rows.length); r++) {
        for (let c = group.from; c <= Math.min(group.to, rows[r].length - 1); c++) {
          const text = normalizeLabel(getCellText(rows[r][c]));
          if (
            text.includes('จำนวนเงิน') ||
            text.includes('amount') ||
            text === 'บาท' ||
            text.includes('value')
          ) {
            preferredValueCols.push(c);
          }
        }
      }

      return {
        from: group.from,
        to: group.to,
        preferredValueCols: [...new Set(preferredValueCols)].sort((a, b) => a - b),
      };
    });
}

function extractMetricValue(
  row: Array<XLSX.CellObject | null>,
  startColIdx: number,
  preferredRanges: ColumnRange[]
): number | null {
  const effectiveRanges = preferredRanges
    .map(range => ({ from: Math.max(range.from, startColIdx + 1), to: Math.min(range.to, row.length - 1) }))
    .filter(range => range.from <= range.to);

  for (let i = 0; i < effectiveRanges.length; i++) {
    const range = effectiveRanges[i];
    const sourceRange = preferredRanges[i];

    if (sourceRange.preferredValueCols && sourceRange.preferredValueCols.length > 0) {
      for (const preferredCol of sourceRange.preferredValueCols) {
        if (preferredCol < range.from || preferredCol > range.to) continue;
        const cell = row[preferredCol];
        if (!cell) continue;
        const parsed = parseNumber(cell.v ?? cell.w);
        if (parsed !== null) return parsed;
      }
    }

    const rangeCandidates: number[] = [];
    for (let c = range.from; c <= range.to; c++) {
      const cell = row[c];
      if (!cell) continue;
      const parsed = parseNumber(cell.v ?? cell.w);
      if (parsed === null) continue;
      rangeCandidates.push(parsed);
    }

    const meaningful = rangeCandidates.filter(value => Math.abs(value) > 1 && !(value >= 2020 && value <= 2035) && !(value >= 2500 && value <= 2600));
    if (meaningful.length > 0) return meaningful[0];
    if (rangeCandidates.length > 0) return rangeCandidates[0];
  }

  const candidates: number[] = [];

  for (let c = startColIdx + 1; c < row.length; c++) {
    const cell = row[c];
    if (!cell) continue;
    const parsed = parseNumber(cell.v ?? cell.w);
    if (parsed === null) continue;
    candidates.push(parsed);
  }

  if (candidates.length === 0) return null;

  // Bias toward the first meaningful amount column, but skip obvious year-like values.
  const meaningful = candidates.filter(value => Math.abs(value) > 1 && !(value >= 2020 && value <= 2035));
  if (meaningful.length > 0) return meaningful[0];

  return candidates[0];
}

function getRowLabel(row: Array<XLSX.CellObject | null>) {
  const textCells = row
    .map((cell, idx) => ({ text: normalizeLabel(getCellText(cell)), idx }))
    .filter(({ text }) => text.length > 0)
    .filter(({ text }) => /[a-z\u0E00-\u0E7F]/i.test(text))
    .slice(0, 8);

  if (textCells.length === 0) {
    return { label: '', lastTextColIdx: -1 };
  }

  return {
    label: textCells.map(({ text }) => text).join(' '),
    lastTextColIdx: textCells[textCells.length - 1].idx,
  };
}

function parseSheetMetrics(sheetName: string, sheet: XLSX.WorkSheet): SheetParseResult {
  const rows = getSheetRows(sheet);
  const year = detectYear(sheetName, rows);
  const targetYearRanges = findTargetYearRanges(rows, year);
  const found: Partial<AnnualMetrics> = {};

  for (const row of rows) {
    const { label, lastTextColIdx } = getRowLabel(row);
    if (!label) continue;

    for (const { key, keywords } of METRIC_KEYWORDS) {
      if (found[key] !== undefined) continue;

      const matched = keywords.some(keyword => label.includes(normalizeLabel(keyword)));
      if (!matched) continue;

      const num = extractMetricValue(row, Math.max(lastTextColIdx, 0), targetYearRanges);
      if (num !== null) found[key] = num;
      break;
    }
  }

  return {
    found,
    matchedCount: Object.keys(found).length,
    year,
  };
}

function emptyMetrics(): AnnualMetrics {
  return {
    mainRevenue: 0,
    revenue: 0,
    operatingCost: 0,
    grossProfit: 0,
    sellingExpenses: 0,
    adminExpenses: 0,
    totalSGA: 0,
    operatingProfit: 0,
    depreciation: 0,
    ebit: 0,
    financeCost: 0,
    ebt: 0,
    tax: 0,
    netProfit: 0,
  };
}

// Fill in metrics that can be derived from the ones already found.
function deriveMetrics(input: Partial<AnnualMetrics>): AnnualMetrics {
  const found = { ...input };

  if (found.totalSGA == null && (found.sellingExpenses != null || found.adminExpenses != null)) {
    found.totalSGA = (found.sellingExpenses ?? 0) + (found.adminExpenses ?? 0);
  }
  if ((found.mainRevenue == null || found.mainRevenue === 0) && found.revenue != null) {
    found.mainRevenue = found.revenue;
  }
  if ((found.revenue == null || found.revenue === 0) && found.mainRevenue != null) {
    found.revenue = found.mainRevenue;
  }
  if (found.grossProfit == null && found.revenue != null && found.operatingCost != null) {
    found.grossProfit = found.revenue - found.operatingCost;
  }
  if (found.operatingProfit == null && found.grossProfit != null && found.totalSGA != null) {
    found.operatingProfit = found.grossProfit - found.totalSGA;
  }
  if (found.ebit == null && found.operatingProfit != null && found.depreciation != null) {
    found.ebit = found.operatingProfit - found.depreciation;
  }
  if (found.financeCost == null && found.ebit != null && found.ebt != null) {
    found.financeCost = found.ebit - found.ebt;
  }
  const derivedEbtFromNet = found.netProfit != null && found.tax != null
    ? found.netProfit + found.tax
    : null;

  if ((found.ebt == null || found.ebt === 0) && derivedEbtFromNet != null && derivedEbtFromNet !== 0) {
    found.ebt = derivedEbtFromNet;
  }
  if (found.ebt == null && found.netProfit != null && found.tax != null) {
    found.ebt = found.netProfit + found.tax;
  }
  if (found.ebt == null && found.ebit != null && found.financeCost != null) {
    found.ebt = found.ebit - found.financeCost;
  }
  if (found.netProfit == null && found.ebt != null && found.tax != null) {
    found.netProfit = found.ebt - found.tax;
  }

  return { ...emptyMetrics(), ...found };
}

// ---------------------------------------------------------------------------
// EMMA management "PL for dashboard" format
// Monthly P&L: header row is "… Jan % Feb % … Dec % Total %"; labels sit in a
// text column and the year-to-date figure lives in the "Total" column.
// ---------------------------------------------------------------------------

const MONTH_TOKENS = new Set(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']);

// Exact (normalized) subtotal labels. Exact matching avoids false positives from
// the many detail rows that share keyword substrings — e.g. the withholding-tax
// line "ค่าภาษีเงินได้หัก ณ ที่จ่าย" must NOT be picked up as income-tax expense.
const EMMA_MONTHLY_LABELS: Array<{ key: keyof AnnualMetrics; labels: string[]; cost?: boolean }> = [
  { key: 'mainRevenue',     labels: ['รายได้จากการประกอบกิจการ'] },
  { key: 'revenue',         labels: ['รวมรายได้กิจการ'] },
  { key: 'operatingCost',   labels: ['รวมต้นทุนกิจการ', 'ต้นทุนในการประกอบกิจการ'], cost: true },
  { key: 'grossProfit',     labels: ['กำไรก่อนค่าใช้จ่าย'] },
  { key: 'sellingExpenses', labels: ['ค่าใช้จ่ายในการขาย'], cost: true },
  { key: 'adminExpenses',   labels: ['ค่าใช้จ่ายในการบริหาร'], cost: true },
  { key: 'totalSGA',        labels: ['รวมค่าใช้จ่ายในการขายและบริหาร'], cost: true },
  { key: 'operatingProfit', labels: ['กำไรจากกิจกรรมดำเนินงาน'] },
  { key: 'depreciation',    labels: ['ค่าเสื่อมราคา'], cost: true },
  { key: 'ebit',            labels: ['กำไรก่อนหักดอกเบี้ยและภาษีเงินได้'] },
  { key: 'financeCost',     labels: ['ต้นทุนทางการเงิน'], cost: true },
  { key: 'ebt',             labels: ['กำไรก่อนภาษีเงินได้'] },
  { key: 'tax',             labels: ['ค่าใช้จ่ายภาษีเงินได้'], cost: true },
  { key: 'netProfit',       labels: ['กำไรสุทธิ'] },
];

interface MonthlyLayout {
  totalCol: number;
  monthCols: number[];   // left-to-right = Jan..Dec
  firstDataCol: number;  // leftmost month column — labels live to the left of it
}

function detectEmmaMonthlyLayout(rows: Array<Array<XLSX.CellObject | null>>): MonthlyLayout | null {
  const scan = Math.min(8, rows.length);
  for (let r = 0; r < scan; r++) {
    const row = rows[r];
    let totalCol = -1;
    const monthCols: number[] = [];
    for (let c = 0; c < row.length; c++) {
      const text = getCellText(row[c]).trim().toLowerCase();
      if (!text) continue;
      if (text === 'total') totalCol = c;
      else if (MONTH_TOKENS.has(text)) monthCols.push(c);
    }
    if (totalCol >= 0 && monthCols.length >= 2) {
      return { totalCol, monthCols, firstDataCol: Math.min(...monthCols) };
    }
  }
  return null;
}

// Build a row label from the text cells LEFT of the data columns only. The
// month/% region can contain "#DIV/0!" error strings (empty months) which would
// otherwise pollute the label and break exact matching.
function getMonthlyRowLabel(row: Array<XLSX.CellObject | null>, firstDataCol: number): string {
  const parts: string[] = [];
  for (let c = 0; c < Math.min(firstDataCol, row.length); c++) {
    const text = normalizeLabel(getCellText(row[c]));
    if (text && /[a-z฀-๿]/i.test(text)) parts.push(text);
  }
  return parts.join(' ');
}

// Read a numeric value preferring the raw cell value (which preserves the sign
// of accounting-parenthesised losses); fall back to parsing the formatted text.
function readCellNumber(cell: XLSX.CellObject | null | undefined): number | null {
  if (!cell) return null;
  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) return cell.v;
  const text = typeof cell.w === 'string' ? cell.w : cell.v != null ? String(cell.v) : '';
  const negative = /\(.+\)/.test(text);
  const cleaned = text.replace(/,/g, '').replace(/\s/g, '').replace(/[()]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function parseEmmaMonthly(
  sheetName: string,
  rows: Array<Array<XLSX.CellObject | null>>,
  layout: MonthlyLayout
): ParseResult {
  // Collect the source row for each metric (exact label match).
  const metricRows = new Map<keyof AnnualMetrics, { row: Array<XLSX.CellObject | null>; cost: boolean }>();
  let revenueRow: Array<XLSX.CellObject | null> | null = null;

  for (const row of rows) {
    const label = getMonthlyRowLabel(row, layout.firstDataCol);
    if (!label) continue;

    for (const { key, labels, cost } of EMMA_MONTHLY_LABELS) {
      if (metricRows.has(key)) continue;
      if (!labels.some(l => label === normalizeLabel(l))) continue;
      metricRows.set(key, { row, cost: !!cost });
      if (key === 'revenue') revenueRow = row;
      break;
    }
  }

  // Standard calendar quarters: Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec.
  // The sheet may carry all 12 month columns but only the elapsed months hold data,
  // so completeness is judged by which months actually contain revenue figures.
  const monthsWithData = new Set<number>();
  if (revenueRow) {
    layout.monthCols.forEach((col, idx) => {
      const v = readCellNumber(revenueRow![col]);
      if (v !== null && Math.abs(v) > 0) monthsWithData.add(idx + 1);
    });
  }
  // Cut off at the latest quarter whose 3 months all have data (drops a part-quarter).
  let quarter: number | undefined;
  for (let q = 4; q >= 1; q--) {
    if ([q * 3 - 2, q * 3 - 1, q * 3].every(m => monthsWithData.has(m))) { quarter = q; break; }
  }

  // Clearly an EMMA monthly sheet (labels matched) but no quarter is complete yet —
  // fail loudly instead of falling through to the generic parser and reading garbage.
  if (!quarter && metricRows.size >= 5) {
    throw new Error('ไฟล์นี้ยังไม่มีไตรมาสที่ครบ 3 เดือน (ต้องมีข้อมูลครบทั้งไตรมาส)');
  }

  // Value = sum of the 3 month columns of that quarter (NOT the YTD Total column),
  // so figures stay correct when the sheet spans more than one quarter.
  const found: Partial<AnnualMetrics> = {};
  if (quarter) {
    const quarterCols = layout.monthCols.slice((quarter - 1) * 3, (quarter - 1) * 3 + 3);
    for (const [key, { row, cost }] of metricRows) {
      const sum = quarterCols.reduce((acc, col) => acc + (readCellNumber(row[col]) ?? 0), 0);
      found[key] = cost ? Math.abs(sum) : sum;
    }
  }

  return { year: detectYear(sheetName, rows), quarter, metrics: deriveMetrics(found) };
}

// ---------------------------------------------------------------------------
// EMMA branch P&L format ("งบกำไรขาดทุน (สาขา)")
// One sheet per branch — the workbook total is the sum across every branch
// sheet. Month columns are headed with Thai month names; figures are cut off at
// the latest COMPLETE calendar quarter (a quarter counts only when all 3 of its
// months are present in the report — e.g. a Jan–Apr file yields Q1, dropping Apr).
// ---------------------------------------------------------------------------

const THAI_MONTH_NAMES: Record<string, number> = {
  'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6,
  'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
};

// Exact subtotal labels for the branch P&L. mainRevenue / sellingExpenses /
// adminExpenses / financeCost are not broken out and are derived afterwards.
const BRANCH_LABELS: Array<{ key: keyof AnnualMetrics; labels: string[]; cost?: boolean }> = [
  { key: 'revenue',         labels: ['รวมรายได้กิจการ'] },
  { key: 'operatingCost',   labels: ['รวมต้นทุนกิจการ'], cost: true },
  { key: 'grossProfit',     labels: ['กำไรก่อนค่าใช้จ่าย'] },
  { key: 'totalSGA',        labels: ['รวมค่าใช้จ่ายในการขายและบริหาร'], cost: true },
  { key: 'operatingProfit', labels: ['กำไรจากกิจกรรมดำเนินงาน'] },
  { key: 'depreciation',    labels: ['รวมค่าเสื่อมราคา'], cost: true },
  { key: 'ebit',            labels: ['กำไรก่อนหักดอกเบี้ยและภาษีเงินได้'] },
  { key: 'ebt',             labels: ['กำไรก่อนภาษีเงินได้'] },
  { key: 'tax',             labels: ['ค่าใช้จ่ายภาษีเงินได้'], cost: true },
  { key: 'netProfit',       labels: ['กำไรสุทธิ'] },
];

interface BranchLayout {
  months: Array<{ month: number; col: number }>; // calendar order
  firstDataCol: number;
}

function detectBranchLayout(rows: Array<Array<XLSX.CellObject | null>>): BranchLayout | null {
  const scan = Math.min(8, rows.length);
  for (let r = 0; r < scan; r++) {
    const months: Array<{ month: number; col: number }> = [];
    for (let c = 0; c < rows[r].length; c++) {
      const month = THAI_MONTH_NAMES[getCellText(rows[r][c]).trim()];
      if (month) months.push({ month, col: c });
    }
    if (months.length >= 2) {
      months.sort((a, b) => a.month - b.month);
      return { months, firstDataCol: Math.min(...months.map(m => m.col)) };
    }
  }
  return null;
}

// Value columns of the latest fully-present calendar quarter, or null if none
// of the four quarters has all three of its months in the report.
function latestCompleteQuarter(layout: BranchLayout): { quarter: number; cols: number[] } | null {
  const colByMonth = new Map(layout.months.map(m => [m.month, m.col]));
  for (let q = 4; q >= 1; q--) {
    const monthsOfQ = [q * 3 - 2, q * 3 - 1, q * 3];
    if (monthsOfQ.every(m => colByMonth.has(m))) {
      return { quarter: q, cols: monthsOfQ.map(m => colByMonth.get(m)!) };
    }
  }
  return null;
}

function parseBranchSheet(
  rows: Array<Array<XLSX.CellObject | null>>,
  firstDataCol: number,
  cols: number[]
): Partial<AnnualMetrics> {
  const found: Partial<AnnualMetrics> = {};
  for (const row of rows) {
    const label = getMonthlyRowLabel(row, firstDataCol);
    if (!label) continue;
    for (const { key, labels, cost } of BRANCH_LABELS) {
      if (found[key] !== undefined) continue;
      if (!labels.some(l => label === normalizeLabel(l))) continue;
      const sum = cols.reduce((acc, col) => acc + (readCellNumber(row[col]) ?? 0), 0);
      found[key] = cost ? Math.abs(sum) : sum;
      break;
    }
  }
  return found;
}

function parseBranchWorkbook(workbook: XLSX.WorkBook): ParseResult | null {
  const firstRows = getSheetRows(workbook.Sheets[workbook.SheetNames[0]]);
  if (!detectBranchLayout(firstRows)) return null;

  const total: Partial<AnnualMetrics> = {};
  let quarter: number | undefined;
  let year = new Date().getFullYear();

  for (const sheetName of workbook.SheetNames) {
    const rows = getSheetRows(workbook.Sheets[sheetName]);
    const layout = detectBranchLayout(rows);
    if (!layout) continue;
    const q = latestCompleteQuarter(layout);
    if (!q) continue;
    quarter = q.quarter;
    year = detectYear(sheetName, rows);

    const found = parseBranchSheet(rows, layout.firstDataCol, q.cols);
    for (const key of Object.keys(found) as Array<keyof AnnualMetrics>) {
      total[key] = (total[key] ?? 0) + (found[key] ?? 0);
    }
  }

  if (quarter == null) {
    throw new Error('ไฟล์นี้ยังไม่มีไตรมาสที่ครบ 3 เดือน (ต้องมีข้อมูลครบทั้งไตรมาส)');
  }
  return { year, quarter, metrics: deriveMetrics(total) };
}

export async function parseAnnualExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: false });

  // --- EMMA branch P&L format ("งบกำไรขาดทุน (สาขา)") — sum across all branches ---
  const branch = parseBranchWorkbook(workbook);
  if (branch) {
    const matched = Object.values(branch.metrics).filter(v => v !== 0).length;
    if (matched >= 5) return branch;
  }

  // --- EMMA management "PL for dashboard" monthly format (read Total column) ---
  for (const sheetName of workbook.SheetNames) {
    const rows = getSheetRows(workbook.Sheets[sheetName]);
    const layout = detectEmmaMonthlyLayout(rows);
    if (!layout) continue;
    const result = parseEmmaMonthly(sheetName, rows, layout);
    const matched = Object.values(result.metrics).filter(v => v !== 0).length;
    if (matched >= 5) return result;
  }

  const parsedSheets = workbook.SheetNames.map((sheetName) => ({
    sheetName,
    ...parseSheetMetrics(sheetName, workbook.Sheets[sheetName]),
  }));

  const bestSheet = [...parsedSheets].sort((a, b) => {
    if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
    return (b.found.revenue ?? 0) - (a.found.revenue ?? 0);
  })[0];

  if (!bestSheet || bestSheet.matchedCount === 0) {
    throw new Error(`ไม่พบหัวข้องบการเงินที่รองรับในไฟล์นี้ (${workbook.SheetNames.join(', ')})`);
  }

  return {
    year: bestSheet.year,
    metrics: deriveMetrics(bestSheet.found),
  };
}
