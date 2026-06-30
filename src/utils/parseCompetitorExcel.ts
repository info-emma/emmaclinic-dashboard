import * as XLSX from 'xlsx';
import type { AnnualMetrics } from '../store/useCompareStore';

interface ParseResult {
  year: number;
  quarter?: number;
  metrics: AnnualMetrics;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCellText(cell: XLSX.CellObject | null | undefined): string {
  if (!cell) return '';
  if (cell.w) return String(cell.w);
  if (cell.v != null) return String(cell.v);
  return '';
}

function normalizeLabel(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[_\-:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').replace(/\s/g, '').replace(/[()]/g, '');
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

function normalizeYear(raw: number): number {
  return raw > 2500 ? raw - 543 : raw;
}

// ---------------------------------------------------------------------------
// Unit detection — scans for "พันบาท" → multiplier = 1000
// ---------------------------------------------------------------------------

function detectUnitMultiplier(rows: Array<Array<XLSX.CellObject | null>>): number {
  for (const row of rows.slice(0, 15)) {
    for (const cell of row) {
      if (!cell) continue;
      const text = getCellText(cell).toLowerCase();
      if (text.includes('พันบาท') || text.includes('thousand')) return 1000;
    }
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Column detection — finds the consolidated current-year value column
// ---------------------------------------------------------------------------

interface ColCandidate {
  col: number;
  year: number;
  isConsolidated: boolean;
}

function detectValueColumn(rows: Array<Array<XLSX.CellObject | null>>): { col: number; year: number } {
  const headerRows = rows.slice(0, Math.min(15, rows.length));
  const candidates: ColCandidate[] = [];

  // Track columns that are under งบการเงินรวม (consolidated) header
  const consolidatedColStart = new Set<number>();
  const standaloneColStart = new Set<number>();

  for (const row of headerRows) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const text = getCellText(cell).trim();
      if (text.includes('งบการเงินรวม') || text.toLowerCase().includes('consolidated')) {
        consolidatedColStart.add(c);
      }
      if (text.includes('งบการเงินเฉพาะ') || text.toLowerCase().includes('separate') || text.toLowerCase().includes('standalone')) {
        standaloneColStart.add(c);
      }
    }
  }

  // Collect all year-labelled cells
  for (const row of headerRows) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const text = getCellText(cell).trim();

      // Match patterns: "ปี 2569", "2569", "31 มีนาคม 2569", "2024", etc.
      const match = text.match(/\b(25[6-9]\d|20[2-3]\d)\b/);
      if (!match) continue;

      // Skip cells where the year is embedded in a long sentence (e.g. "ณ วันที่ 31 มีนาคม 2569")
      // Valid year-header cells are short: "2569", "ปี 2569", "31 มีนาคม 2569"
      const textWithoutYear = text.replace(/\b(25[6-9]\d|20[2-3]\d)\b/g, '').trim();
      if (textWithoutYear.length > 15) continue;

      const rawYear = parseInt(match[1], 10);
      const year = normalizeYear(rawYear);
      if (year < 2020 || year > 2035) continue;

      // Determine if this column falls within a consolidated section
      // A column is consolidated if:
      // - no consolidated section headers were found at all (single-section file), OR
      // - it is at or after a งบการเงินรวม header and before any standalone header to its right
      let isConsolidated = consolidatedColStart.size === 0;
      if (!isConsolidated) {
        // Find nearest consolidated header to the left of or at column c
        let nearestConsolidated = -1;
        let nearestStandalone = -1;
        for (const sc of consolidatedColStart) {
          if (sc <= c && sc > nearestConsolidated) nearestConsolidated = sc;
        }
        for (const ss of standaloneColStart) {
          if (ss <= c && ss > nearestStandalone) nearestStandalone = ss;
        }
        // Column is consolidated if a consolidated header is closer (or equal) to it than any standalone header
        isConsolidated = nearestConsolidated >= 0 && nearestConsolidated >= nearestStandalone;
      }

      candidates.push({ col: c, year, isConsolidated });
    }
  }

  if (candidates.length === 0) {
    return { col: -1, year: new Date().getFullYear() };
  }

  // Find the most recent year
  const maxYear = Math.max(...candidates.map(c => c.year));

  // Among candidates for maxYear, prefer consolidated; fallback to first
  const forMaxYear = candidates.filter(c => c.year === maxYear);
  const consolidated = forMaxYear.filter(c => c.isConsolidated);
  const chosen = consolidated[0] ?? forMaxYear[0];

  return { col: chosen.col, year: maxYear };
}

// ---------------------------------------------------------------------------
// Metric keywords — ordered; 'sign' controls sign normalization
// ---------------------------------------------------------------------------

interface MetricDef {
  key: keyof AnnualMetrics;
  keywords: string[];
  sign: 'keep' | 'abs';
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: 'mainRevenue',
    sign: 'keep',
    keywords: [
      'รายได้จากการให้บริการ',
      'รายได้จากการประกอบกิจการ',
      'รายได้จากการขายและการให้บริการ',
      'รายได้จากการขายสินค้าและการให้บริการ',
      'รายได้จากการขาย',
      'รายได้หลัก',
    ],
  },
  {
    key: 'revenue',
    sign: 'keep',
    keywords: ['รวมรายได้', 'รายได้รวม', 'total revenue', 'total revenues'],
  },
  {
    key: 'operatingCost',
    sign: 'abs',
    keywords: [
      'ต้นทุนการให้บริการ',
      'ต้นทุนในการประกอบกิจการ',
      'ต้นทุนขายและต้นทุนการให้บริการ',
      'ต้นทุนการขายและการให้บริการ',
      'ต้นทุนขาย',
      'ต้นทุนการขาย',
      'cost of sales',
      'cost of service',
    ],
  },
  {
    key: 'grossProfit',
    sign: 'keep',
    keywords: ['กำไรขั้นต้น', 'กำไร ขาดทุน ขั้นต้น', 'gross profit'],
  },
  // sellingExpenses MUST come before totalSGA — KLINIQUE's "ค่าใช้จ่ายในการขายและบริหาร"
  // row should map to sellingExpenses (admin is a separate row below it)
  {
    key: 'sellingExpenses',
    sign: 'abs',
    keywords: [
      'ต้นทุนในการจัดจำหน่าย',
      'ค่าใช้จ่ายในการขายและบริหาร',
      'ค่าใช้จ่ายในการขาย',
      'selling expenses',
      'selling and administrative expenses',
    ],
  },
  {
    key: 'adminExpenses',
    sign: 'abs',
    keywords: [
      'ค่าใช้จ่ายในการบริหาร',
      'administration expenses',
      'administrative expenses',
      'admin expenses',
    ],
  },
  {
    key: 'operatingProfit',
    sign: 'keep',
    keywords: [
      'กำไรจากกิจกรรมดำเนินงาน',
      'กำไรจากการดำเนินงาน',
      'operating profit',
    ],
  },
  {
    key: 'depreciation',
    sign: 'abs',
    keywords: [
      'ค่าเสื่อมราคาและค่าตัดจำหน่าย',
      'ค่าเสื่อมราคา',
      'depreciation and amortization',
      'depreciation',
    ],
  },
  {
    key: 'financeCost',
    sign: 'abs',
    keywords: [
      'ต้นทุนทางการเงิน',
      'ค่าใช้จ่ายทางการเงิน',
      'finance cost',
      'financial cost',
      'interest expense',
    ],
  },
  {
    key: 'ebt',
    sign: 'keep',
    keywords: [
      'กำไรก่อนภาษีเงินได้',
      'กำไรก่อนค่าใช้จ่ายภาษี',
      'กำไรก่อนภาษี',
      'profit before tax',
      'ebt',
    ],
  },
  {
    key: 'tax',
    sign: 'abs',
    keywords: ['ค่าใช้จ่ายภาษีเงินได้', 'ภาษีเงินได้', 'income tax', 'tax expense'],
  },
  {
    key: 'netProfit',
    sign: 'keep',
    keywords: [
      'กำไรสุทธิ',
      'กำไรสำหรับงวด',
      'net profit',
      'net income',
      'profit for the year',
    ],
  },
];

// ---------------------------------------------------------------------------
// Extract metrics from a set of rows given a value column
// ---------------------------------------------------------------------------

function extractFromRows(
  rows: Array<Array<XLSX.CellObject | null>>,
  valueCol: number,
  multiplier: number,
  found: Partial<AnnualMetrics>
): void {
  for (const row of rows) {
    // Build row label from first two columns (some files indent labels into col B)
    const labelParts: string[] = [];
    for (let c = 0; c <= Math.min(2, row.length - 1); c++) {
      const text = getCellText(row[c]).trim();
      if (text && /[฀-๿a-z]/i.test(text)) labelParts.push(text);
    }
    if (labelParts.length === 0) continue;
    const label = normalizeLabel(labelParts.join(' '));

    for (const def of METRIC_DEFS) {
      if (found[def.key] !== undefined) continue;

      const matched = def.keywords.some(kw => label.includes(normalizeLabel(kw)));
      if (!matched) continue;

      // Try the detected value column first, then adjacent columns ±1
      let num: number | null = null;
      for (const offset of [0, 1, -1, 2]) {
        const c = valueCol + offset;
        if (c < 0 || c >= row.length) continue;
        const cell = row[c];
        if (!cell) continue;
        const parsed = parseNumber(cell.v ?? cell.w);
        if (parsed === null) continue;
        // Reject year-like values
        const absVal = Math.abs(parsed);
        if (absVal >= 2020 && absVal <= 2035) continue;
        if (absVal >= 2500 && absVal <= 2600) continue;
        num = parsed;
        break;
      }

      if (num === null) break;

      const value = (def.sign === 'abs' ? Math.abs(num) : num) * multiplier;
      found[def.key] = value;
      break; // each row matches at most one metric
    }
  }
}

// ---------------------------------------------------------------------------
// Find a sheet by sheet-name pattern or header content
// ---------------------------------------------------------------------------

function findSheet(
  workbook: XLSX.WorkBook,
  namePatterns: string[],
  headerPattern: string
): XLSX.WorkSheet | null {
  // 1. Try sheet name match
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase();
    if (namePatterns.some(p => lower.includes(p.toLowerCase()))) {
      return workbook.Sheets[name];
    }
  }
  // 2. Scan first 6 rows of each sheet for header pattern
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr] as XLSX.CellObject | undefined;
        if (!cell) continue;
        const text = getCellText(cell).toLowerCase();
        if (text.includes(headerPattern.toLowerCase())) return ws;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Detect where the cash flow section starts within a sheet (for combined P&L+CF)
// ---------------------------------------------------------------------------

function findCashFlowStartRow(rows: Array<Array<XLSX.CellObject | null>>): number {
  for (let r = 0; r < rows.length; r++) {
    for (const cell of rows[r]) {
      if (!cell) continue;
      const text = getCellText(cell).toLowerCase();
      if (text.includes('กระแสเงินสด') || text.includes('cash flow')) return r;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Quarter detection — returns 1-4 if quarterly period is detected, else undefined
// ---------------------------------------------------------------------------

function detectQuarter(rows: Array<Array<XLSX.CellObject | null>>): number | undefined {
  const THAI_MONTHS: Array<[string, number]> = [
    ['มกราคม', 1], ['กุมภาพันธ์', 2], ['มีนาคม', 3],
    ['เมษายน', 4], ['พฤษภาคม', 5], ['มิถุนายน', 6],
    ['กรกฎาคม', 7], ['สิงหาคม', 8], ['กันยายน', 9],
    ['ตุลาคม', 10], ['พฤศจิกายน', 11], ['ธันวาคม', 12],
  ];

  const scanRows = rows.slice(0, Math.min(35, rows.length));

  // Join all non-empty cells within each row into one string.
  // This handles the common case where "สำหรับงวดสามเดือนสิ้นสุดวันที่" is in cell A
  // and "31 มีนาคม 2569" is in cell B of the same row.
  const rowTexts = scanRows
    .map(row => row.map(cell => getCellText(cell).trim()).filter(Boolean).join(' '))
    .filter(Boolean);

  let periodMonths: number | undefined;
  let endMonthAny: number | undefined;   // captures all months including December (Q4)
  let endMonthNonDec: number | undefined; // captures only non-December (for weak-signal fallback)
  let hasNonAnnualPeriodWord = false;
  let isAnnual = false;

  for (const text of rowTexts) {
    // Explicit Thai quarter: "ไตรมาสที่ 1", "ไตรมาส 2"
    const tqMatch = text.match(/ไตรมาส(?:ที่)?\s*([1-4])/);
    if (tqMatch) return parseInt(tqMatch[1], 10);

    // Explicit English: "Q1", "Q2" etc.
    const qMatch = text.match(/\bQ([1-4])\b/);
    if (qMatch) return parseInt(qMatch[1], 10);

    // Annual indicators — overridden if an explicit short period is also found
    if (/หนึ่งปี|สิบสองเดือน|12[\s-]*เดือน|ปีสิ้นสุด|for the year ended|for the year\b/i.test(text)) {
      isAnnual = true;
    }

    // Explicit period length keywords
    if (/สามเดือน|สาม\s+เดือน|3[\s-]*เดือน|three[\s-]*month/i.test(text)) {
      periodMonths = 3;
    } else if (/หกเดือน|หก\s+เดือน|6[\s-]*เดือน|six[\s-]*month/i.test(text)) {
      periodMonths = 6;
    } else if (/เก้าเดือน|เก้า\s+เดือน|9[\s-]*เดือน|nine[\s-]*month/i.test(text)) {
      periodMonths = 9;
    }

    // "งวด" = period word used in non-annual context
    if (/งวด/.test(text) && !/หนึ่งปี|ปีสิ้น/.test(text)) hasNonAnnualPeriodWord = true;

    // End month detection
    for (const [thaiMonth, month] of THAI_MONTHS) {
      if (text.includes(thaiMonth)) {
        endMonthAny = month;
        if (month !== 12) endMonthNonDec = month;
      }
    }
  }

  // Annual flag only suppresses quarterly detection when NO explicit short period is found.
  // e.g. "สำหรับงวดสามเดือนสิ้นสุด..." overrides any stray "ปีสิ้นสุด" mention.
  if (isAnnual && !periodMonths) return undefined;

  // Strong signal: explicit period length + any end month
  // December end month = Q4 when the file explicitly states a 3-month (or 6/9-month) period.
  if (periodMonths !== undefined && endMonthAny !== undefined) {
    return Math.ceil(endMonthAny / 3);
  }

  // Weaker signal: non-annual "งวด" keyword + non-December end month
  if (hasNonAnnualPeriodWord && endMonthNonDec !== undefined) {
    return Math.ceil(endMonthNonDec / 3);
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function parseCompetitorExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: false });

  // --- Find income statement sheet ---
  const plSheet =
    findSheet(workbook, ['กำไรขาดทุน', 'pl&cf', 'pl_cf', 'p&l'], 'งบกำไรขาดทุน') ??
    workbook.Sheets[workbook.SheetNames[0]];

  const plRows = getSheetRows(plSheet);

  // --- Unit multiplier ---
  const multiplier = detectUnitMultiplier(plRows);

  // --- Detect value column from P&L sheet header ---
  const { col: valueCol, year } = detectValueColumn(plRows);
  if (valueCol < 0) throw new Error('ไม่พบคอลัมน์ปีในไฟล์นี้');

  // --- Find the income statement rows (stop before cash flow section) ---
  const cfStartRow = findCashFlowStartRow(plRows);
  const plOnlyRows = cfStartRow > 0 ? plRows.slice(0, cfStartRow) : plRows;

  // --- Find cash flow section rows ---
  // Could be the same sheet (MASTERPIECE) or a separate sheet (TEERAPORN, KLINIQUE)
  let cfRows: Array<Array<XLSX.CellObject | null>> = [];
  if (cfStartRow > 0) {
    // CF is in the same sheet, after the P&L section
    cfRows = plRows.slice(cfStartRow);
  } else {
    const cfSheet = findSheet(
      workbook,
      ['กระแสเงินสด', 'cashflow', 'cash flow', '7-8', '6-8', 'cf'],
      'งบกระแสเงินสด'
    );
    if (cfSheet) {
      cfRows = getSheetRows(cfSheet);
    }
  }

  // --- Extract metrics ---
  const found: Partial<AnnualMetrics> = {};

  // Income statement rows (P&L only)
  extractFromRows(plOnlyRows, valueCol, multiplier, found);

  // Cash flow rows — only for depreciation (other metrics already found from P&L)
  if (cfRows.length > 0) {
    // Detect CF section value column (may differ in the CF sheet)
    const cfValueColInfo = detectValueColumn(cfRows);
    const cfValueCol = cfValueColInfo.col >= 0 ? cfValueColInfo.col : valueCol;
    const cfMultiplier = detectUnitMultiplier(cfRows);
    extractFromRows(cfRows, cfValueCol, cfMultiplier, found);
  }

  // --- Derived / computed values ---

  // Revenue fallback: if no "รวมรายได้" row, use mainRevenue.
  // Also fix false-positive: "รวมรายได้อื่น" (other income subtotal) may match the
  // "รวมรายได้" keyword. If the matched revenue is much smaller than mainRevenue, override.
  if ((found.revenue == null || found.revenue === 0) && found.mainRevenue != null) {
    found.revenue = found.mainRevenue;
  }
  if (found.mainRevenue != null && found.revenue != null && found.revenue < found.mainRevenue * 0.5) {
    found.revenue = found.mainRevenue;
  }
  if ((found.mainRevenue == null || found.mainRevenue === 0) && found.revenue != null) {
    found.mainRevenue = found.revenue;
  }

  // operatingCost: derive if not found (KLINIQUE has explicit gross profit)
  if (found.operatingCost == null && found.revenue != null && found.grossProfit != null) {
    found.operatingCost = found.revenue - found.grossProfit;
  }

  // totalSGA: always derive from selling + admin (avoids format-specific totalSGA confusion)
  if (found.sellingExpenses != null || found.adminExpenses != null) {
    found.totalSGA = (found.sellingExpenses ?? 0) + (found.adminExpenses ?? 0);
  }

  // ebt: derive if missing
  if (found.ebt == null && found.netProfit != null && found.tax != null) {
    found.ebt = found.netProfit + found.tax;
  }
  if (found.ebt == null && found.operatingProfit != null && found.financeCost != null) {
    found.ebt = found.operatingProfit - found.financeCost;
  }

  // netProfit: derive if missing
  if (found.netProfit == null && found.ebt != null && found.tax != null) {
    found.netProfit = found.ebt - found.tax;
  }

  // ebit: derive if missing
  if (found.ebit == null && found.operatingProfit != null && found.depreciation != null) {
    found.ebit = found.operatingProfit - found.depreciation;
  }

  const metrics: AnnualMetrics = {
    mainRevenue: found.mainRevenue ?? 0,
    revenue: found.revenue ?? 0,
    operatingCost: found.operatingCost ?? 0,
    grossProfit: found.grossProfit ?? 0,
    sellingExpenses: found.sellingExpenses ?? 0,
    adminExpenses: found.adminExpenses ?? 0,
    totalSGA: found.totalSGA ?? 0,
    operatingProfit: found.operatingProfit ?? 0,
    depreciation: found.depreciation ?? 0,
    ebit: found.ebit ?? 0,
    financeCost: found.financeCost ?? 0,
    ebt: found.ebt ?? 0,
    tax: found.tax ?? 0,
    netProfit: found.netProfit ?? 0,
  };

  const matched = Object.values(metrics).filter(v => v !== 0).length;
  if (matched < 3) {
    throw new Error(
      `ไม่พบข้อมูลงบกำไรขาดทุนในไฟล์นี้ (พบ ${matched} รายการ) กรุณาตรวจสอบโครงสร้างไฟล์`
    );
  }

  return { year, quarter: detectQuarter(plRows), metrics };
}
