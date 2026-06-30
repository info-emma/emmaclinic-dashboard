import * as XLSX from 'xlsx';

function safeNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function findRowByLabel(rows, searchStr, colIdx = 1, exact = false) {
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i][colIdx];
    if (cell === null || cell === undefined) continue;
    const s = String(cell).trim();
    if (exact ? s === searchStr : s.includes(searchStr)) return i;
  }
  return -1;
}

function findAllRowsByLabel(rows, searchStr, colIdx = 1) {
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i][colIdx];
    if (cell && String(cell).trim().includes(searchStr)) result.push(i);
  }
  return result;
}

export function parseY2026Sheet(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  function getMonthlyValues(rowIdx) {
    if (rowIdx < 0 || rowIdx >= data.length) return { monthly: Array(12).fill(0), total: 0 };
    const row = data[rowIdx];
    const monthly = Array.from({ length: 12 }, (_, m) => safeNum(row[2 + m * 2]));
    const total = safeNum(row[26]);
    return { monthly, total };
  }

  const totalRevenueRow  = findRowByLabel(data, 'รวมรายได้กิจการ');
  const operatingCostRow = findRowByLabel(data, 'รวมต้นทุนกิจการ');
  const grossProfitRow   = findRowByLabel(data, 'กำไรก่อนค่าใช้จ่าย');
  const totalSGARow      = findRowByLabel(data, 'รวมค่าใช้จ่ายในการขายและบริหาร');
  const ebitdaRows       = findAllRowsByLabel(data, 'กำไรจากกิจกรรมดำเนินงาน');
  const ebitdaRow        = ebitdaRows.length > 0 ? ebitdaRows[0] : -1;
  const depreciationRows = findAllRowsByLabel(data, 'ค่าเสื่อมราคา');
  let depreciationRow    = -1;
  if (depreciationRows.length > 0) {
    depreciationRow = depreciationRows.reduce((best, cur) =>
      Math.abs(cur - 206) < Math.abs(best - 206) ? cur : best, depreciationRows[0]);
  }
  const ebitRow        = findRowByLabel(data, 'กำไรก่อนหักดอกเบี้ย');
  const financeCostRow = findRowByLabel(data, 'ต้นทุนทางการเงิน');
  const netProfitRow   = findRowByLabel(data, 'กำไรสุทธิ');

  const revenueItems = [
    { key: 'noseClose',   label: 'Nose (Close)',    search: 'ศัลยกรรม-จมูก (Close)' },
    { key: 'noseOpen',    label: 'Nose (Open)',     search: 'ศัลยกรรม-จมูก (Open)' },
    { key: 'chin',        label: 'Chin',            search: 'ศัลยกรรม-คาง' },
    { key: 'eyes',        label: 'Eyes',            search: 'ศัลยกรรม-ตา' },
    { key: 'lips',        label: 'Lips',            search: 'ศัลยกรรม-ปาก' },
    { key: 'breast',      label: 'Breast',          search: 'ศัลยกรรม-หน้าอก' },
    { key: 'facelift',    label: 'Facelift',        search: 'ศัลยกรรม-Facelift' },
    { key: 'endotine',    label: 'Endotine',        search: 'Endotine' },
    { key: 'contouring',  label: 'Contouring',      search: 'ปรับรูปหน้า' },
    { key: 'lifting',     label: 'Lifting',         search: 'ยกกระชับ' },
    { key: 'skinTreatment', label: 'Skin Treatment', search: 'งานผิว' },
    { key: 'otherRevenue',  label: 'Other Revenue', search: 'รายได้อื่น' },
  ];
  const revenueBreakdown = {};
  for (const item of revenueItems) {
    const rowIdx = findRowByLabel(data, item.search);
    revenueBreakdown[item.key] = { label: item.label, ...getMonthlyValues(rowIdx) };
  }

  const marketingItems = [
    { key: 'facebook',  label: 'Facebook',  search: 'Facebook' },
    { key: 'line',      label: 'Line',      search: 'Line' },
    { key: 'google',    label: 'Google',    search: 'Google' },
    { key: 'tiktok',    label: 'TikTok',    search: 'Tiktok' },
    { key: 'billboard', label: 'Billboard', search: 'ป้ายบิลบอร์ด' },
    { key: 'otherAds',  label: 'Other Ads', search: 'ค่าโฆษณา - อื่น' },
  ];
  const marketingBreakdown = {};
  for (const item of marketingItems) {
    const rowIdx = findRowByLabel(data, item.search);
    marketingBreakdown[item.key] = { label: item.label, ...getMonthlyValues(rowIdx) };
  }

  return {
    totalRevenue: getMonthlyValues(totalRevenueRow),
    operatingCost: getMonthlyValues(operatingCostRow),
    grossProfit: getMonthlyValues(grossProfitRow),
    totalSGA: getMonthlyValues(totalSGARow),
    ebitda: getMonthlyValues(ebitdaRow),
    depreciation: getMonthlyValues(depreciationRow),
    ebit: getMonthlyValues(ebitRow),
    financeCost: getMonthlyValues(financeCostRow),
    netProfit: getMonthlyValues(netProfitRow),
    revenueBreakdown,
    marketingBreakdown,
  };
}

export function parsePlanSheet(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  function getValues(rowIdx) {
    if (rowIdx < 0 || rowIdx >= data.length)
      return { monthly: { plan: [], actual: [], diff: [] }, quarterly: {}, annual: {} };
    const row = data[rowIdx];
    const monthOffsets = [1, 7, 13, 25, 31, 37, 49, 55, 61, 73, 79, 85];
    const plans   = monthOffsets.map(o => safeNum(row[o]));
    const actuals = monthOffsets.map(o => safeNum(row[o + 2]));
    const diffs   = monthOffsets.map(o => safeNum(row[o + 4]));
    const quarterlyOffsets = { Q1: 19, Q2: 43, Q3: 67, Q4: 91 };
    const quarterly = {};
    for (const [q, o] of Object.entries(quarterlyOffsets)) {
      quarterly[q] = { plan: safeNum(row[o]), actual: safeNum(row[o + 2]), diff: safeNum(row[o + 4]) };
    }
    const annual = { plan: safeNum(row[97]), actual: safeNum(row[99]), diff: safeNum(row[101]) };
    return { monthly: { plan: plans, actual: actuals, diff: diffs }, quarterly, annual };
  }

  function findRow(search) { return findRowByLabel(data, search, 0); }
  function findAllRows(search) { return findAllRowsByLabel(data, search, 0); }

  const totalRevenueRow = findRow('รวมรายได้กิจการ');
  const netProfitRow    = findRow('กำไรสุทธิ');
  const grossProfitRow  = findRow('กำไรก่อนค่าใช้จ่าย');
  const ebitdaRows      = findAllRows('กำไรจากกิจกรรมดำเนินงาน');
  const ebitdaRow       = ebitdaRows.length > 0 ? ebitdaRows[0] : -1;
  const ebitdaSumRows   = findAllRows('EBITDA');
  const ebitdaSummaryRow = ebitdaSumRows.length > 0 ? ebitdaSumRows[0] : -1;

  return {
    totalRevenue: getValues(totalRevenueRow),
    netProfit:    getValues(netProfitRow),
    grossProfit:  getValues(grossProfitRow),
    ebitda:       getValues(ebitdaRow),
    ebitdaSummary: getValues(ebitdaSummaryRow),
  };
}

export function parseBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const y2026Sheet  = workbook.Sheets['Y2026'];
  const planSheet   = workbook.Sheets['2026Plan V1.0'];
  const targetSheet = workbook.Sheets['2026Target V1.0'];
  return {
    actual:      y2026Sheet  ? parseY2026Sheet(y2026Sheet)  : null,
    plan:        planSheet   ? parsePlanSheet(planSheet)    : null,
    target:      targetSheet ? parsePlanSheet(targetSheet)  : null,
    lastUpdated: new Date().toISOString(),
    fileName:    'PL 2026 for dashboard.xlsx',
  };
}
