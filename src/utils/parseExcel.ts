import * as XLSX from 'xlsx';
import type {
  ActualData,
  BranchPLData,
  BranchEntry,
  BranchMetrics,
  BranchRevenueBreakdown,
  DashboardData,
  MonthlyMetric,
  PlanData,
  PlanMetric,
  RevenueItem,
  MarketingItem,
} from '../types';
import { normalizeDashboardData } from './normalizeDashboardData';

function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normRaw(v: unknown): string {
  return String(v ?? '').normalize('NFC').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function findRowRaw(rows: unknown[][], searchStr: string, colIdx = 1): number {
  const search = normRaw(searchStr);
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i][colIdx];
    if (cell === null || cell === undefined) continue;
    if (normRaw(cell).includes(search)) return i;
  }
  return -1;
}

function findRowByLabel(rows: unknown[][], searchStr: string, colIdx = 1, exact = false): number {
  const normalizedSearch = normalizeLabel(searchStr);
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i][colIdx];
    if (cell === null || cell === undefined) continue;
    const s = normalizeLabel(cell);
    if (exact ? s === normalizedSearch : s.includes(normalizedSearch)) return i;
  }
  return -1;
}

function findAllRowsByLabel(rows: unknown[][], searchStr: string, colIdx = 1): number[] {
  const result: number[] = [];
  const normalizedSearch = normalizeLabel(searchStr);
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i][colIdx];
    if (cell && normalizeLabel(cell).includes(normalizedSearch)) result.push(i);
  }
  return result;
}

function findRowByAliases(rows: unknown[][], aliases: string[], colIdx = 1): number {
  for (const alias of aliases) {
    const idx = findRowByLabel(rows, alias, colIdx);
    if (idx >= 0) return idx;
  }
  return -1;
}

function findAllRowsByAliases(rows: unknown[][], aliases: string[], colIdx = 1): number[] {
  const found = new Set<number>();
  for (const alias of aliases) {
    for (const idx of findAllRowsByLabel(rows, alias, colIdx)) found.add(idx);
  }
  return [...found].sort((a, b) => a - b);
}

function parseActualSheet(ws: XLSX.WorkSheet): ActualData {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Auto-detect label column: scan cols 1 and 2 for Thai revenue text
  let labelColIdx = 1;
  for (const colIdx of [1, 2]) {
    const found = data.some(r => {
      const cell = (r as unknown[])[colIdx];
      return typeof cell === 'string' && cell.includes('รายได้');
    });
    if (found) { labelColIdx = colIdx; break; }
  }

  // Auto-detect Jan column: find the total-revenue row, then scan right of label col
  // for the first column with a significant positive number
  const totalRevenueRowForDetect = findRowByLabel(data, 'รวมรายได้กิจการ', labelColIdx);
  let janColIdx = labelColIdx + 1; // fallback: right next to label
  if (totalRevenueRowForDetect >= 0) {
    const row = data[totalRevenueRowForDetect] as unknown[];
    for (let c = labelColIdx + 1; c < row.length; c++) {
      const v = safeNum(row[c]);
      if (v > 1000) { janColIdx = c; break; }
    }
  }
  // Total column = Jan + 12 months * 2 cols each
  const totalColIdx = janColIdx + 24;

  function getMonthlyValues(rowIdx: number) {
    if (rowIdx < 0 || rowIdx >= data.length) return { monthly: Array(12).fill(0), total: 0 };
    const row = data[rowIdx];
    const monthly = Array.from({ length: 12 }, (_, m) => safeNum(row[janColIdx + m * 2]));
    const total = safeNum(row[totalColIdx]);
    return { monthly, total };
  }

  const totalRevenueRow    = findRowByAliases(data, ['รวมรายได้กิจการ', 'รวมรายได้กิจการ (Total Revenue)'], labelColIdx);
  const operatingCostRow   = findRowByAliases(data, ['รวมต้นทุนกิจการ', 'ต้นทุนในการประกอบกิจการ', 'ต้นทุนในการประกอบกิจการ (Operating Expenses)'], labelColIdx);
  const grossProfitRow     = findRowByAliases(data, ['กำไรก่อนค่าใช้จ่าย', 'กำไรก่อนค่าใช้จ่าย (Gross Profit)'], labelColIdx);
  const totalSGARow        = findRowByAliases(data, ['รวมค่าใช้จ่ายในการขายและบริหาร', 'รวมค่าใช้จ่ายในการขายและบริหาร (SG&A Expenses)'], labelColIdx);
  const sellingExpRow      = findRowByAliases(data, ['รวมค่าใช้จ่ายในการขาย', 'ค่าใช้จ่ายในการขาย', 'ค่าใช้จ่ายในการขาย (Selling Expenses)'], labelColIdx);
  // Admin: ranged search between sellingExp and totalSGA to avoid collision
  let adminExpRow = findRowByAliases(data, ['รวมค่าใช้จ่ายในการบริหาร', 'ค่าใช้จ่ายในการบริหาร', 'ค่าใช้จ่ายในการบริหาร (Administration Expenses)'], labelColIdx);
  if (adminExpRow < 0) {
    const start = sellingExpRow >= 0 ? sellingExpRow + 1 : (grossProfitRow >= 0 ? grossProfitRow + 1 : 0);
    const end   = totalSGARow   >= 0 ? totalSGARow : data.length;
    for (let i = start; i < end; i++) {
      const cell = (data[i] as unknown[])[labelColIdx];
      if (cell && normalizeLabel(cell).includes(normalizeLabel('ค่าใช้จ่ายในการบริหาร'))) { adminExpRow = i; break; }
    }
  }
  const ebitdaRows         = findAllRowsByAliases(data, ['กำไรจากกิจกรรมดำเนินงาน', 'กำไรจากกิจกรรมดำเนินงาน (EBITDA)'], labelColIdx);
  const ebitdaRow          = ebitdaRows.length > 0 ? ebitdaRows[0] : -1;
  const depreciationRows   = findAllRowsByAliases(data, ['ค่าเสื่อมราคา', 'ค่าเสื่อมราคา (D&A)'], labelColIdx);
  let depreciationRow      = -1;
  if (depreciationRows.length > 0) {
    depreciationRow = depreciationRows.reduce((best, cur) =>
      Math.abs(cur - 206) < Math.abs(best - 206) ? cur : best, depreciationRows[0]);
  }
  const ebitRow        = findRowByAliases(data, ['กำไรก่อนหักดอกเบี้ย', 'กำไรก่อนหักดอกเบี้ยและภาษีเงินได้', 'กำไรก่อนหักดอกเบี้ยและภาษีเงินได้ (EBIT)'], labelColIdx);
  const financeCostRow = findRowByAliases(data, ['ต้นทุนทางการเงิน', 'ต้นทุนทางการเงิน (Interest)'], labelColIdx);
  const ebtRow         = findRowByAliases(data, ['กำไรก่อนภาษีเงินได้', 'กำไรก่อนภาษีเงินได้ (EBT)'], labelColIdx);
  const taxRow         = findRowByAliases(data, ['ค่าใช้จ่ายภาษีเงินได้', 'ค่าใช้จ่ายภาษีเงินได้ (Tax)'], labelColIdx);
  const netProfitRow   = findRowByAliases(data, ['กำไรสุทธิ', 'กำไรสุทธิ (Net Profit)'], labelColIdx);

  const revenueItems = [
    { key: 'noseClose',     label: 'Nose (Close)',    search: 'รายได้จากการศัลยกรรม-จมูก (Close)' },
    { key: 'noseOpen',      label: 'Nose (Open)',     search: 'รายได้จากการศัลยกรรม-จมูก (Open)' },
    { key: 'chin',          label: 'Chin',            search: 'ศัลยกรรม-คาง' },
    { key: 'eyes',          label: 'Eyes',            search: 'ศัลยกรรม-ตา' },
    { key: 'lips',          label: 'Lips',            search: 'ศัลยกรรม-ปาก' },
    { key: 'breast',        label: 'Breast',          search: 'ศัลยกรรม-หน้าอก' },
    { key: 'facelift',      label: 'Facelift',        search: 'ศัลยกรรม-Facelift' },
    { key: 'endotine',      label: 'Endotine',        search: 'Endotine' },
    { key: 'contouring',    label: 'Contouring',      search: 'ปรับรูปหน้า' },
    { key: 'lifting',       label: 'Lifting',         search: 'ยกกระชับ' },
    { key: 'skinTreatment', label: 'Skin Treatment',  search: 'งานผิว' },
    { key: 'otherRevenue',  label: 'Other Revenue',   search: 'รายได้อื่น' },
  ];
  const revenueBreakdown: Record<string, RevenueItem> = {};
  for (const item of revenueItems) {
    let rowIdx = findRowRaw(data, item.search, labelColIdx);
    if (rowIdx < 0) rowIdx = findRowByAliases(data, [item.search, `${item.search} (${item.label})`], labelColIdx);
    revenueBreakdown[item.key] = { key: item.key, label: item.label, ...getMonthlyValues(rowIdx) };
  }

  const marketingItems = [
    { key: 'facebook',  label: 'Facebook',  search: 'Facebook' },
    { key: 'line',      label: 'Line',      search: 'Line' },
    { key: 'google',    label: 'Google',    search: 'Google' },
    { key: 'tiktok',    label: 'TikTok',    search: 'Tiktok' },
    { key: 'billboard', label: 'Billboard', search: 'ป้ายบิลบอร์ด' },
    { key: 'otherAds',  label: 'Other Ads', search: 'ค่าโฆษณา - อื่น' },
  ];
  const marketingBreakdown: Record<string, MarketingItem> = {};
  for (const item of marketingItems) {
    const rowIdx = findRowByAliases(data, [item.search, `${item.search} (${item.label})`], labelColIdx);
    marketingBreakdown[item.key] = { key: item.key, label: item.label, ...getMonthlyValues(rowIdx) };
  }

  return {
    totalRevenue:    getMonthlyValues(totalRevenueRow),
    operatingCost:   getMonthlyValues(operatingCostRow),
    grossProfit:     getMonthlyValues(grossProfitRow),
    sellingExpenses: getMonthlyValues(sellingExpRow),
    adminExpenses:   getMonthlyValues(adminExpRow),
    totalSGA:        getMonthlyValues(totalSGARow),
    ebitda:          getMonthlyValues(ebitdaRow),
    depreciation:    getMonthlyValues(depreciationRow),
    ebit:            getMonthlyValues(ebitRow),
    financeCost:     getMonthlyValues(financeCostRow),
    ebt:             getMonthlyValues(ebtRow),
    tax:             getMonthlyValues(taxRow),
    netProfit:       getMonthlyValues(netProfitRow),
    revenueBreakdown,
    marketingBreakdown,
  };
}

function emptyPlanMetric(): PlanMetric {
  return {
    monthly: { plan: Array(12).fill(0), actual: Array(12).fill(0), diff: Array(12).fill(0) },
    quarterly: {
      Q1: { plan: 0, actual: 0, diff: 0 },
      Q2: { plan: 0, actual: 0, diff: 0 },
      Q3: { plan: 0, actual: 0, diff: 0 },
      Q4: { plan: 0, actual: 0, diff: 0 },
    },
    annual: { plan: 0, actual: 0, diff: 0 },
  };
}

function parsePlanSheet(ws: XLSX.WorkSheet): PlanData {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Auto-detect label column (same logic as parseActualSheet)
  let labelColIdx = 1;
  for (const colIdx of [1, 2, 0]) {
    const found = data.some(r => {
      const cell = (r as unknown[])[colIdx];
      return typeof cell === 'string' && cell.includes('รายได้');
    });
    if (found) { labelColIdx = colIdx; break; }
  }

  // Auto-detect plan start column: find total-revenue row, scan right for first large number
  const revenueRowForDetect = findRowByLabel(data, 'รวมรายได้กิจการ', labelColIdx);
  let planColIdx = labelColIdx + 1; // fallback
  if (revenueRowForDetect >= 0) {
    const row = data[revenueRowForDetect] as unknown[];
    for (let c = labelColIdx + 1; c < row.length; c++) {
      if (safeNum(row[c]) > 1_000_000) { planColIdx = c; break; }
    }
  }
  // Plan sheet column pattern per month: Plan, ?, Actual, ?, Diff, %, then next month
  // Spacing = 6 cols per month, quarterly block every 3 months adds 6 cols
  // Derived offsets relative to planColIdx: Jan=0, Feb=6, Mar=12, Q1=18, Apr=24...
  const monthSteps  = [0, 6, 12, 24, 30, 36, 48, 54, 60, 72, 78, 84]; // relative to planColIdx
  const quarterlySteps: Record<string, number> = { Q1: 18, Q2: 42, Q3: 66, Q4: 90 };

  function getValues(rowIdx: number) {
    if (rowIdx < 0 || rowIdx >= data.length)
      return emptyPlanMetric();
    const row = data[rowIdx];
    const plans   = monthSteps.map(s => safeNum(row[planColIdx + s]));
    const actuals = monthSteps.map(s => safeNum(row[planColIdx + s + 2]));
    const diffs   = monthSteps.map(s => safeNum(row[planColIdx + s + 4]));
    const quarterly: PlanMetric['quarterly'] = {
      Q1: { plan: 0, actual: 0, diff: 0 },
      Q2: { plan: 0, actual: 0, diff: 0 },
      Q3: { plan: 0, actual: 0, diff: 0 },
      Q4: { plan: 0, actual: 0, diff: 0 },
    };
    for (const [q, s] of Object.entries(quarterlySteps) as Array<[keyof PlanMetric['quarterly'], number]>) {
      quarterly[q] = { plan: safeNum(row[planColIdx + s]), actual: safeNum(row[planColIdx + s + 2]), diff: safeNum(row[planColIdx + s + 4]) };
    }
    const annualOffset = planColIdx + 96;
    const annual = { plan: safeNum(row[annualOffset]), actual: safeNum(row[annualOffset + 2]), diff: safeNum(row[annualOffset + 4]) };
    return { monthly: { plan: plans, actual: actuals, diff: diffs }, quarterly, annual };
  }

  function findRow(...aliases: string[]) { return findRowByAliases(data, aliases, labelColIdx); }
  function findAllRows(...aliases: string[]) { return findAllRowsByAliases(data, aliases, labelColIdx); }

  const totalRevenueRow     = findRow('รวมรายได้กิจการ', 'รวมรายได้กิจการ (Total Revenue)');
  const operatingRevenueRow = findRow('รายได้จากการประกอบกิจการ', 'รายได้จากการประกอบกิจการ (Revenue)');
  const netProfitRow        = findRow('กำไรสุทธิ', 'กำไรสุทธิ (Net Profit)');
  const grossProfitRow      = findRow('กำไรก่อนค่าใช้จ่าย', 'กำไรก่อนค่าใช้จ่าย (Gross Profit)');
  const ebitdaRows          = findAllRows('กำไรจากกิจกรรมดำเนินงาน', 'กำไรจากกิจกรรมดำเนินงาน (EBITDA)');
  const ebitdaRow           = ebitdaRows.length > 0 ? ebitdaRows[0] : -1;
  const ebitdaSumRows       = findAllRows('EBITDA');
  const ebitdaSummaryRow    = ebitdaSumRows.length > 0 ? ebitdaSumRows[0] : -1;
  // Operating cost: plan sheet may label as 'ต้นทุนในการประกอบกิจการ' (no 'รวม' prefix)
  let operatingCostRow = findRow('รวมต้นทุนกิจการ', 'ต้นทุนในการประกอบกิจการ', 'ต้นทุนในการประกอบกิจการ (Operating Expenses)');
  if (operatingCostRow < 0) {
    const opRows = findAllRows('ต้นทุนในการประกอบกิจการ', 'ต้นทุนในการประกอบกิจการ (Operating Expenses)');
    if (opRows.length > 0) operatingCostRow = opRows[opRows.length - 1];
  }
  const totalSGARow = findRow('รวมค่าใช้จ่ายในการขายและบริหาร', 'รวมค่าใช้จ่ายในการขายและบริหาร (SG&A Expenses)');
  // Selling: plan sheet may use 'ค่าใช้จ่ายในการขาย' without 'รวม'
  let sellingExpRow = findRow('รวมค่าใช้จ่ายในการขาย', 'ค่าใช้จ่ายในการขาย', 'ค่าใช้จ่ายในการขาย (Selling Expenses)');
  // Admin: ranged search between sellingExp and totalSGA to avoid collision
  let adminExpRow = findRow('รวมค่าใช้จ่ายในการบริหาร', 'ค่าใช้จ่ายในการบริหาร', 'ค่าใช้จ่ายในการบริหาร (Administration Expenses)');
  if (adminExpRow < 0) {
    const start = sellingExpRow >= 0 ? sellingExpRow + 1 : (grossProfitRow >= 0 ? grossProfitRow + 1 : 0);
    const end   = totalSGARow   >= 0 ? totalSGARow : data.length;
    for (let i = start; i < end; i++) {
      const cell = (data[i] as unknown[])[labelColIdx];
      if (cell && normalizeLabel(cell).includes(normalizeLabel('ค่าใช้จ่ายในการบริหาร'))) { adminExpRow = i; break; }
    }
  }
  const depreciationRows   = findAllRows('ค่าเสื่อมราคา', 'ค่าเสื่อมราคา (D&A)');
  const depreciationRow    = depreciationRows.length > 0 ? depreciationRows[0] : -1;
  const ebitRow            = findRow('กำไรก่อนหักดอกเบี้ย', 'กำไรก่อนหักดอกเบี้ยและภาษีเงินได้', 'กำไรก่อนหักดอกเบี้ยและภาษีเงินได้ (EBIT)');
  const financeCostRow     = findRow('ต้นทุนทางการเงิน', 'ต้นทุนทางการเงิน (Interest)');
  const ebtRow             = findRow('กำไรก่อนภาษีเงินได้', 'กำไรก่อนภาษีเงินได้ (EBT)');
  const taxRow             = findRow('ค่าใช้จ่ายภาษีเงินได้', 'ค่าใช้จ่ายภาษีเงินได้ (Tax)');

  return {
    totalRevenue:    getValues(totalRevenueRow),
    operatingRevenue: getValues(operatingRevenueRow),
    netProfit:       getValues(netProfitRow),
    grossProfit:     getValues(grossProfitRow),
    ebitda:          getValues(ebitdaRow),
    ebitdaSummary:   getValues(ebitdaSummaryRow),
    operatingCost:   getValues(operatingCostRow),
    sellingExpenses: getValues(sellingExpRow),
    adminExpenses:   getValues(adminExpRow),
    totalSGA:        getValues(totalSGARow),
    depreciation:    getValues(depreciationRow),
    ebit:            getValues(ebitRow),
    financeCost:     getValues(financeCostRow),
    ebt:             getValues(ebtRow),
    tax:             getValues(taxRow),
  };
}

export async function parseExcelFile(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false, // use cached values, not formula strings
    cellNF: false,
    cellText: false,
  });
  const sheetNames = workbook.SheetNames;

  // Detect sheets by year pattern — permissive regex to handle spaces/variations
  // e.g. "Y2025", "Y2026", "2025Plan V1.0", "2025 Plan V1.0", "2025Target V1.0"
  const actualSheetName  = sheetNames.find(n => /^Y\d{4}$/i.test(n));
  const planSheetName    = sheetNames.find(n => /^\d{4}\s*Plan/i.test(n));
  const targetSheetName  = sheetNames.find(n => /^\d{4}\s*Target/i.test(n));

  // Extract year from the first matching sheet name; convert BE (พ.ศ. > 2500) to CE
  const yearMatch = actualSheetName?.match(/^Y(\d{4})$/) ?? planSheetName?.match(/^(\d{4})Plan/);
  const rawYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  const detectedYear = rawYear > 2500 ? rawYear - 543 : rawYear;

  if (!actualSheetName && !planSheetName && !targetSheetName) {
    throw new Error(
      `ไม่พบ sheet ที่รองรับ\n` +
      `Sheet ที่พบ: ${sheetNames.join(', ')}\n` +
      `ต้องการ: Y20XX / 20XXPlan / 20XXTarget (ค.ศ. หรือ พ.ศ.)`
    );
  }

  const actualSheet  = actualSheetName  ? workbook.Sheets[actualSheetName]  : null;
  const planSheet    = planSheetName    ? workbook.Sheets[planSheetName]    : null;
  const targetSheet  = targetSheetName  ? workbook.Sheets[targetSheetName]  : null;

  const normalizedData = normalizeDashboardData({
    actual:      actualSheet  ? parseActualSheet(actualSheet)  : null,
    plan:        planSheet    ? parsePlanSheet(planSheet)      : null,
    target:      targetSheet  ? parsePlanSheet(targetSheet)    : null,
    lastUpdated: new Date().toISOString(),
    fileName:    file.name,
  } satisfies DashboardData);

  return {
    ...normalizedData,
    year: detectedYear,
  };
}

// ─── Branch P&L Parser ───────────────────────────────────────────────────────

/** Returns true when the filename looks like a branch P&L monthly file. */
export function isBranchPLFile(fileName: string): boolean {
  // macOS filenames use NFD normalization (ำ → า + ํ), so normalize to NFC first
  const n = fileName.normalize('NFC');
  const hasThaiMarkers = n.includes('\u0E07\u0E1A\u0E01\u0E33\u0E44\u0E23\u0E02\u0E32\u0E14\u0E17\u0E38\u0E19') &&
                         n.includes('\u0E2A\u0E32\u0E02\u0E32');
  // Fallback: numbered file with "(สาขา)" and English month.year (e.g. "1.xxx (สาขา) Jan.2026.xlsx")
  const hasEnglishPattern = /^\d+\..+\([\w\u0E00-\u0E7F]+\)\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.\d{4}\.xlsx$/i.test(fileName);
  return hasThaiMarkers || hasEnglishPattern;
}

const BRANCH_COL_MAP: Record<string, string> = {
  'ขอนแก่น': 'khonkaen',
  'โคราช':   'korat',
  'ชลบุรี':  'chonburi',
  'พระราม 9': 'rama9',
  'พระราม2':  'rama2',
  'พิษณุโลก': 'phitsanulok',
  'แพรกษา':  'praeksa',
  'ภูเก็ต':  'phuket',
  'รังสิต':  'rangsit',
  'ลาดพร้าว': 'ladphrao',
  'อโศก':    'asok',
};

const THAI_MONTH_MAP: Record<string, number> = {
  'มกราคม': 0,   'กุมภาพันธ์': 1, 'มีนาคม': 2,   'เมษายน': 3,
  'พฤษภาคม': 4,  'มิถุนายน': 5,  'กรกฎาคม': 6,  'สิงหาคม': 7,
  'กันยายน': 8,  'ตุลาคม': 9,    'พฤศจิกายน': 10, 'ธันวาคม': 11,
  'jan': 0, 'feb': 1, 'mar': 2,  'apr': 3,
  'may': 4, 'jun': 5, 'jul': 6,  'aug': 7,
  'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
  // Thai abbreviations (new format column headers)
  'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3,
  'พ.ค.': 4, 'มิ.ย.': 5, 'ก.ค.': 6, 'ส.ค.': 7,
  'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
};

function detectMonthFromStr(s: string): number {
  const lower = s.toLowerCase();
  for (const [name, idx] of Object.entries(THAI_MONTH_MAP)) {
    if (lower.includes(name.toLowerCase())) return idx;
  }
  return 0;
}

// Layer 2C: Find month-to-column mapping from header row (new format)
function detectMonthColumnsFromHeader(data: unknown[][]): { monthIdx: number; col: number }[] {
  const HEADER_MAP: Record<string, number> = {
    // Full Thai month names (used in new format column headers)
    'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3,
    'พฤษภาคม': 4, 'มิถุนายน': 5, 'กรกฎาคม': 6, 'สิงหาคม': 7,
    'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11,
    // Thai abbreviations
    'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3,
    'พ.ค.': 4, 'มิ.ย.': 5, 'ก.ค.': 6, 'ส.ค.': 7,
    'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
    // English abbreviations
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3,
    'may': 4, 'jun': 5, 'jul': 6, 'aug': 7,
    'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
  };
  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r] as unknown[];
    const found: { monthIdx: number; col: number }[] = [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const key = String(cell).trim().toLowerCase();
      if (key in HEADER_MAP) found.push({ monthIdx: HEADER_MAP[key], col: c });
    }
    if (found.length >= 1) return found;
  }
  return [];
}

// Layer 2D: Parse a single branch sheet (new format — months as columns, one sheet per branch)
function parseNewBranchSheet(ws: XLSX.WorkSheet): { monthIdx: number; metrics: BranchMetrics }[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const monthCols = detectMonthColumnsFromHeader(data);
  if (monthCols.length === 0) return [];

  function findMetricRow(search: string): number {
    let r = findRowRaw(data, search, 1);
    if (r >= 0) return r;
    r = findRowByLabel(data, search, 1);
    if (r >= 0) return r;
    r = findRowRaw(data, search, 2);
    if (r >= 0) return r;
    return findRowByLabel(data, search, 2);
  }
  function findAllMetricRows(search: string): number[] {
    const r1 = findAllRowsByLabel(data, search, 1);
    if (r1.length > 0) return r1;
    return findAllRowsByLabel(data, search, 2);
  }

  const totalRevenueRow  = findMetricRow('รวมรายได้กิจการ');
  const operatingCostRow = findMetricRow('รวมต้นทุนกิจการ');
  const grossProfitRow   = findMetricRow('กำไรก่อนค่าใช้จ่าย');
  const totalSGARow      = findMetricRow('รวมค่าใช้จ่ายในการขายและบริหาร');
  const ebitdaRow        = findAllMetricRows('กำไรจากกิจกรรมดำเนินงาน')[0] ?? -1;
  const depreciationRow  = findMetricRow('รวมค่าเสื่อมราคา');
  const netProfitRow     = findMetricRow('กำไรสุทธิ');

  const revDefs: { key: keyof BranchRevenueBreakdown; search: string }[] = [
    { key: 'noseClose',     search: 'รายได้จากการศัลยกรรม-จมูก (Close)' },
    { key: 'noseOpen',      search: 'รายได้จากการศัลยกรรม-จมูก (Open)' },
    { key: 'chin',          search: 'รายได้จากการศัลยกรรม-คาง' },
    { key: 'eyes',          search: 'รายได้จากการศัลยกรรม-ตา' },
    { key: 'lips',          search: 'รายได้จากการศัลยกรรม-ปาก' },
    { key: 'breast',        search: 'รายได้จากการศัลยกรรม-หน้าอก' },
    { key: 'endotine',      search: 'Endotine' },
    { key: 'contouring',    search: 'ปรับรูปหน้า' },
    { key: 'lifting',       search: 'ยกกระชับ' },
    { key: 'skinTreatment', search: 'งานผิว' },
  ];
  const revRows: Record<string, number> = {};
  for (const def of revDefs) revRows[def.key] = findMetricRow(def.search);

  function getVal(rowIdx: number, col: number): number {
    if (rowIdx < 0 || rowIdx >= data.length || col < 0) return 0;
    return safeNum((data[rowIdx] as unknown[])[col]);
  }

  function buildMetrics(col: number): BranchMetrics {
    const breakdown = {} as BranchRevenueBreakdown;
    for (const def of revDefs) breakdown[def.key] = getVal(revRows[def.key], col);
    return {
      totalRevenue:  getVal(totalRevenueRow,  col),
      operatingCost: getVal(operatingCostRow, col),
      grossProfit:   getVal(grossProfitRow,   col),
      totalSGA:      getVal(totalSGARow,      col),
      ebitda:        getVal(ebitdaRow,        col),
      depreciation:  getVal(depreciationRow,  col),
      netProfit:     getVal(netProfitRow,     col),
      revenueBreakdown: breakdown,
    };
  }

  return monthCols.map(({ monthIdx, col }) => ({ monthIdx, metrics: buildMetrics(col) }));
}

// Layer 2E: Sum BranchMetrics from all branches to produce grand total
function computeGrandTotal(branches: BranchEntry[]): BranchMetrics {
  const bdKeys: (keyof BranchRevenueBreakdown)[] = [
    'noseClose', 'noseOpen', 'chin', 'eyes', 'lips',
    'breast', 'endotine', 'contouring', 'lifting', 'skinTreatment',
  ];
  const bd: BranchRevenueBreakdown = {
    noseClose: 0, noseOpen: 0, chin: 0, eyes: 0, lips: 0,
    breast: 0, endotine: 0, contouring: 0, lifting: 0, skinTreatment: 0,
  };
  const total: BranchMetrics = {
    totalRevenue: 0, operatingCost: 0, grossProfit: 0,
    totalSGA: 0, ebitda: 0, depreciation: 0, netProfit: 0,
    revenueBreakdown: bd,
  };
  for (const b of branches) {
    total.totalRevenue  += b.metrics.totalRevenue;
    total.operatingCost += b.metrics.operatingCost;
    total.grossProfit   += b.metrics.grossProfit;
    total.totalSGA      += b.metrics.totalSGA;
    total.ebitda        += b.metrics.ebitda;
    total.depreciation  += b.metrics.depreciation;
    total.netProfit     += b.metrics.netProfit;
    for (const k of bdKeys) total.revenueBreakdown[k] += b.metrics.revenueBreakdown[k];
  }
  return total;
}

function parseBranchSheet(ws: XLSX.WorkSheet): {
  branches: BranchEntry[];
  grandTotal: BranchMetrics;
  titleStr: string;
} {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Title is in row 0
  const row0 = (data[0] ?? []) as unknown[];
  const titleStr = row0.map(c => (c != null ? String(c) : '')).join(' ');

  // Find the header row that contains branch names (scan rows 1–12 to handle varying title blocks)
  let headerRow: unknown[] = [];
  for (let r = 1; r <= 12; r++) {
    const row = (data[r] ?? []) as unknown[];
    const hasBranch = row.some(c => {
      if (!c || typeof c !== 'string') return false;
      const norm = c.trim().replace(/ /g, ' '); // normalize non-breaking spaces
      return norm in BRANCH_COL_MAP || norm === 'Grand Total';
    });
    if (hasBranch) { headerRow = row; break; }
  }

  const branchCols: { key: string; name: string; col: number }[] = [];
  let grandTotalCol = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const val = headerRow[c];
    if (!val || typeof val !== 'string') continue;
    const name = val.trim().replace(/ /g, ' '); // normalize non-breaking spaces
    if (name === 'Grand Total') {
      grandTotalCol = c;
    } else if (name in BRANCH_COL_MAP) {
      branchCols.push({ key: BRANCH_COL_MAP[name], name, col: c });
    }
  }
  // Fallback: grand total is 2 cols after the last branch
  if (grandTotalCol < 0 && branchCols.length > 0) {
    grandTotalCol = branchCols[branchCols.length - 1].col + 2;
  }

  function getVal(rowIdx: number, col: number): number {
    if (rowIdx < 0 || rowIdx >= data.length || col < 0) return 0;
    return safeNum((data[rowIdx] as unknown[])[col]);
  }

  // Locate key metric rows — auto-detect label column (1 or 2)
  function findMetricRow(search: string): number {
    let r = findRowRaw(data, search, 1);
    if (r >= 0) return r;
    r = findRowByLabel(data, search, 1);
    if (r >= 0) return r;
    r = findRowRaw(data, search, 2);
    if (r >= 0) return r;
    return findRowByLabel(data, search, 2);
  }
  function findAllMetricRows(search: string): number[] {
    const r1 = findAllRowsByLabel(data, search, 1);
    if (r1.length > 0) return r1;
    return findAllRowsByLabel(data, search, 2);
  }
  const totalRevenueRow  = findMetricRow('รวมรายได้กิจการ');
  const operatingCostRow = findMetricRow('รวมต้นทุนกิจการ');
  const grossProfitRow   = findMetricRow('กำไรก่อนค่าใช้จ่าย');
  const totalSGARow      = findMetricRow('รวมค่าใช้จ่ายในการขายและบริหาร');
  const ebitdaRow        = findAllMetricRows('กำไรจากกิจกรรมดำเนินงาน')[0] ?? -1;
  const depreciationRow  = findAllMetricRows('ค่าเสื่อมราคา')[0] ?? -1;
  const netProfitRow     = findMetricRow('กำไรสุทธิ');

  // Revenue procedure breakdown (revenue rows only — labels start with รายได้จาก)
  const revDefs: { key: keyof BranchRevenueBreakdown; search: string }[] = [
    { key: 'noseClose',    search: 'รายได้จากการศัลยกรรม-จมูก (Close)' },
    { key: 'noseOpen',     search: 'รายได้จากการศัลยกรรม-จมูก (Open)' },
    { key: 'chin',         search: 'รายได้จากการศัลยกรรม-คาง' },
    { key: 'eyes',         search: 'รายได้จากการศัลยกรรม-ตา' },
    { key: 'lips',         search: 'รายได้จากการศัลยกรรม-ปาก' },
    { key: 'breast',       search: 'รายได้จากการศัลยกรรม-หน้าอก' },
    { key: 'endotine',     search: 'Endotine' },
    { key: 'contouring',   search: 'ปรับรูปหน้า' },
    { key: 'lifting',      search: 'ยกกระชับ' },
    { key: 'skinTreatment', search: 'งานผิว' },
  ];
  const revRows: Record<string, number> = {};
  for (const def of revDefs) revRows[def.key] = findMetricRow(def.search);

  function buildMetrics(col: number): BranchMetrics {
    const breakdown = {} as BranchRevenueBreakdown;
    for (const def of revDefs) breakdown[def.key] = getVal(revRows[def.key], col);
    return {
      totalRevenue:  getVal(totalRevenueRow,  col),
      operatingCost: getVal(operatingCostRow, col),
      grossProfit:   getVal(grossProfitRow,   col),
      totalSGA:      getVal(totalSGARow,      col),
      ebitda:        getVal(ebitdaRow,        col),
      depreciation:  getVal(depreciationRow,  col),
      netProfit:     getVal(netProfitRow,     col),
      revenueBreakdown: breakdown,
    };
  }

  const branches: BranchEntry[] = branchCols.map(({ key, name, col }) => ({
    branchKey: key, branchName: name, metrics: buildMetrics(col),
  }));

  return { branches, grandTotal: buildMetrics(grandTotalCol), titleStr };
}

export async function parseBranchPLFile(file: File): Promise<BranchPLData | BranchPLData[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;

  // Detect new format: sheet names match branch keys in BRANCH_COL_MAP
  const branchSheets = sheetNames
    .map(name => {
      const norm = name.normalize('NFC').trim().replace(/ /g, ' ');
      const branchKey = BRANCH_COL_MAP[norm];
      return branchKey !== undefined ? { sheetName: name, branchKey, branchName: norm } : null;
    })
    .filter((s): s is { sheetName: string; branchKey: string; branchName: string } => s !== null);

  if (branchSheets.length > 0) {
    // NEW FORMAT: one sheet per branch, months as columns
    const yearNums = file.name.normalize('NFC').match(/\d{4}/g)?.map(Number) ?? [];
    let year = new Date().getFullYear();
    for (const y of yearNums) {
      if (y > 2500)               { year = y - 543; break; }
      if (y >= 2020 && y <= 2050) { year = y;       break; }
    }

    const monthMap = new Map<number, BranchEntry[]>();
    for (const { sheetName, branchKey, branchName } of branchSheets) {
      const ws = workbook.Sheets[sheetName];
      for (const { monthIdx, metrics } of parseNewBranchSheet(ws)) {
        if (!monthMap.has(monthIdx)) monthMap.set(monthIdx, []);
        monthMap.get(monthIdx)!.push({ branchKey, branchName, metrics });
      }
    }

    if (monthMap.size === 0) {
      throw new Error('ไม่พบข้อมูลเดือนในไฟล์ (format ใหม่) — ตรวจสอบว่าแถวหัวตารางมีชื่อเดือน');
    }

    return [...monthMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([monthIdx, branches]) => ({
        month: monthIdx,
        year,
        fileName: file.name,
        branches,
        grandTotal: computeGrandTotal(branches),
      }));
  }

  // OLD FORMAT: single sheet, branches as columns
  let targetSheetName: string | null = null;
  for (const name of sheetNames) {
    const ws = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    if (rows.length < 2) continue;
    const hasTitleRow = rows.slice(0, 4).some(row =>
      (row as unknown[]).some(c => c && String(c).includes('งบกำไรขาดทุน')),
    );
    const hasBranchRow = rows.slice(1, 13).some(row =>
      (row as unknown[]).some(c => c && typeof c === 'string' && c.trim().replace(/ /g, ' ') in BRANCH_COL_MAP),
    );
    if (hasTitleRow || hasBranchRow) { targetSheetName = name; break; }
  }

  if (!targetSheetName) {
    throw new Error(`ไม่พบ sheet ที่มีข้อมูลสาขา\nSheet ที่พบ: ${sheetNames.join(', ')}`);
  }

  const { branches, grandTotal, titleStr } = parseBranchSheet(workbook.Sheets[targetSheetName]);

  if (branches.length === 0) {
    throw new Error(
      `พบ sheet แต่ไม่พบข้อมูลสาขา\nSheet: ${targetSheetName}\n` +
      `ตรวจสอบว่าชื่อสาขาในไฟล์ตรงกับที่ระบบรองรับ (เช่น พระราม 9, ลาดพร้าว, ชลบุรี ฯลฯ)`
    );
  }

  const combined = titleStr + ' ' + file.name;
  const month = detectMonthFromStr(combined);
  const yearNums = combined.match(/\d{4}/g)?.map(Number) ?? [];
  let year = new Date().getFullYear();
  for (const y of yearNums) {
    if (y > 2500)               { year = y - 543; break; }
    if (y >= 2020 && y <= 2050) { year = y;       break; }
  }

  return { month, year, fileName: file.name, branches, grandTotal };
}
