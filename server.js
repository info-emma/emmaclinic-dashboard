import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, __dirname),
  filename: (req, file, cb) => cb(null, 'dashboard-data.xlsx'),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  },
});

// ─── Excel Parsing ────────────────────────────────────────────────────────────

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseY2026Sheet(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // For each named metric, extract 12 monthly values + total
  function getMonthlyValues(rowIdx) {
    if (rowIdx < 0 || rowIdx >= data.length) return { monthly: Array(12).fill(0), total: 0 };
    const row = data[rowIdx];
    const monthly = MONTHS.map((_, m) => safeNum(row[2 + m * 2]));
    const total = safeNum(row[26]);
    return { monthly, total };
  }

  const totalRevenueRow = findRowByLabel(data, 'รวมรายได้กิจการ');
  const operatingCostRow = findRowByLabel(data, 'รวมต้นทุนกิจการ');
  const grossProfitRow = findRowByLabel(data, 'กำไรก่อนค่าใช้จ่าย');
  const totalSGARow = findRowByLabel(data, 'รวมค่าใช้จ่ายในการขายและบริหาร');
  const ebitdaRows = findAllRowsByLabel(data, 'กำไรจากกิจกรรมดำเนินงาน');
  const ebitdaRow = ebitdaRows.length > 0 ? ebitdaRows[0] : -1;
  const depreciationRows = findAllRowsByLabel(data, 'ค่าเสื่อมราคา');
  // pick the row closer to index 200 if multiple
  let depreciationRow = -1;
  if (depreciationRows.length > 0) {
    depreciationRow = depreciationRows.reduce((best, cur) =>
      Math.abs(cur - 206) < Math.abs(best - 206) ? cur : best, depreciationRows[0]);
  }
  const ebitRow = findRowByLabel(data, 'กำไรก่อนหักดอกเบี้ย');
  const financeCostRow = findRowByLabel(data, 'ต้นทุนทางการเงิน');
  const netProfitRow = findRowByLabel(data, 'กำไรสุทธิ');

  // Revenue breakdown items
  const revenueItems = [
    { key: 'noseClose', label: 'Nose (Close)', search: 'ศัลยกรรม-จมูก (Close)' },
    { key: 'noseOpen', label: 'Nose (Open)', search: 'ศัลยกรรม-จมูก (Open)' },
    { key: 'chin', label: 'Chin', search: 'ศัลยกรรม-คาง' },
    { key: 'eyes', label: 'Eyes', search: 'ศัลยกรรม-ตา' },
    { key: 'lips', label: 'Lips', search: 'ศัลยกรรม-ปาก' },
    { key: 'breast', label: 'Breast', search: 'ศัลยกรรม-หน้าอก' },
    { key: 'facelift', label: 'Facelift', search: 'ศัลยกรรม-Facelift' },
    { key: 'endotine', label: 'Endotine', search: 'Endotine' },
    { key: 'contouring', label: 'Contouring', search: 'ปรับรูปหน้า' },
    { key: 'lifting', label: 'Lifting', search: 'ยกกระชับ' },
    { key: 'skinTreatment', label: 'Skin Treatment', search: 'งานผิว' },
    { key: 'otherRevenue', label: 'Other Revenue', search: 'รายได้อื่น' },
  ];

  const revenueBreakdown = {};
  for (const item of revenueItems) {
    const rowIdx = findRowByLabel(data, item.search);
    revenueBreakdown[item.key] = { label: item.label, ...getMonthlyValues(rowIdx) };
  }

  // Marketing channels
  const marketingItems = [
    { key: 'facebook', label: 'Facebook', search: 'Facebook' },
    { key: 'line', label: 'Line', search: 'Line' },
    { key: 'google', label: 'Google', search: 'Google' },
    { key: 'tiktok', label: 'TikTok', search: 'Tiktok' },
    { key: 'billboard', label: 'Billboard', search: 'ป้ายบิลบอร์ด' },
    { key: 'otherAds', label: 'Other Ads', search: 'ค่าโฆษณา - อื่น' },
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

function parsePlanSheet(ws, sheetName) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Auto-detect label column
  let labelCol = 1;
  for (const colIdx of [1, 2, 0]) {
    const found = data.some(r => {
      const cell = r[colIdx];
      return typeof cell === 'string' && cell.includes('รายได้');
    });
    if (found) { labelCol = colIdx; break; }
  }

  // Auto-detect plan start column
  const revenueRowForDetect = findRowByLabel(data, 'รวมรายได้กิจการ', labelCol);
  let planColIdx = labelCol + 1;
  if (revenueRowForDetect >= 0) {
    const row = data[revenueRowForDetect];
    for (let c = labelCol + 1; c < row.length; c++) {
      if (safeNum(row[c]) > 1_000_000) { planColIdx = c; break; }
    }
  }

  const monthSteps = [0, 6, 12, 24, 30, 36, 48, 54, 60, 72, 78, 84];
  const quarterlySteps = { Q1: 18, Q2: 42, Q3: 66, Q4: 90 };

  function getValues(rowIdx) {
    if (rowIdx < 0 || rowIdx >= data.length) {
      return { monthly: { plan: [], actual: [], diff: [] }, quarterly: {}, annual: {} };
    }
    const row = data[rowIdx];
    const plans   = monthSteps.map(s => safeNum(row[planColIdx + s]));
    const actuals = monthSteps.map(s => safeNum(row[planColIdx + s + 2]));
    const diffs   = monthSteps.map(s => safeNum(row[planColIdx + s + 4]));
    const quarterly = {};
    for (const [q, s] of Object.entries(quarterlySteps)) {
      quarterly[q] = { plan: safeNum(row[planColIdx + s]), actual: safeNum(row[planColIdx + s + 2]), diff: safeNum(row[planColIdx + s + 4]) };
    }
    const annualOffset = planColIdx + 96;
    const annual = { plan: safeNum(row[annualOffset]), actual: safeNum(row[annualOffset + 2]), diff: safeNum(row[annualOffset + 4]) };
    return { monthly: { plan: plans, actual: actuals, diff: diffs }, quarterly, annual };
  }

  function findRow(search, exact = false) {
    return findRowByLabel(data, search, labelCol, exact);
  }

  const totalRevenueRow = findRow('รวมรายได้กิจการ');
  const netProfitRow = findRow('กำไรสุทธิ');
  const grossProfitRow = findRow('กำไรก่อนค่าใช้จ่าย');
  const ebitdaRows = findAllRowsByLabel(data, 'กำไรจากกิจกรรมดำเนินงาน', labelCol);
  const ebitdaRow = ebitdaRows.length > 0 ? ebitdaRows[0] : -1;
  const ebitdaSummaryRows = findAllRowsByLabel(data, 'EBITDA', labelCol);
  const ebitdaSummaryRow = ebitdaSummaryRows.length > 0 ? ebitdaSummaryRows[0] : -1;

  return {
    totalRevenue: getValues(totalRevenueRow),
    netProfit: getValues(netProfitRow),
    grossProfit: getValues(grossProfitRow),
    ebitda: getValues(ebitdaRow),
    ebitdaSummary: getValues(ebitdaSummaryRow),
  };
}

let cachedData = null;
let lastUpdated = null;

function parseExcelFile() {
  const filePath = path.join(__dirname, 'dashboard-data.xlsx');
  if (!existsSync(filePath)) {
    return { error: 'Excel file not found', actual: null, plan: null, target: null };
  }

  try {
    const buffer = readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const y2026Sheet = workbook.Sheets['Y2026'];
    const planSheet = workbook.Sheets['2026Plan V1.0'];
    const targetSheet = workbook.Sheets['2026Target V1.0'];

    const actual = y2026Sheet ? parseY2026Sheet(y2026Sheet) : null;
    const plan = planSheet ? parsePlanSheet(planSheet, '2026Plan V1.0') : null;
    const target = targetSheet ? parsePlanSheet(targetSheet, '2026Target V1.0') : null;

    lastUpdated = new Date().toISOString();
    cachedData = { actual, plan, target, lastUpdated, fileName: 'dashboard-data.xlsx' };
    return cachedData;
  } catch (err) {
    console.error('Excel parse error:', err);
    return { error: err.message, actual: null, plan: null, target: null };
  }
}

// Initialize cache on startup
parseExcelFile();

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/data', (req, res) => {
  if (!cachedData) parseExcelFile();
  res.json(cachedData || { error: 'No data available' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const freshData = parseExcelFile();
  res.json(freshData);
});

function buildSystemPrompt(language, dataContext) {
  const isThai = language === 'th';
  return isThai
    ? `คุณคือผู้ช่วย AI สำหรับผู้บริหาร EMMA Clinic คลินิกความงามระดับพรีเมียมในประเทศไทย
คุณช่วยวิเคราะห์ผลประกอบการทางการเงิน แนวโน้ม และข้อมูลเชิงลึกจากแดชบอร์ด P&L

ข้อมูลแดชบอร์ดปัจจุบัน:
${dataContext || 'ไม่มีข้อมูล'}

การนำทาง: เมื่อผู้ใช้ต้องการดูหน้าใด ให้ใส่ [NAVIGATE:overview], [NAVIGATE:revenue], [NAVIGATE:cost] หรือ [NAVIGATE:plan] ในคำตอบ

แนวทาง:
- ตอบเป็นภาษาไทย กระชับ เป็นมืออาชีพ และให้ข้อมูลเชิงลึก
- แสดงตัวเลขเป็นบาทพร้อมจุลภาค เช่น ฿1,234,567 หรือ ฿12.5M
- ชี้ให้เห็นแนวโน้ม ความผิดปกติ และโอกาส
- ตอบสั้นกระชับ ไม่เกิน 200 คำ`
    : `You are an intelligent executive assistant for EMMA Clinic, a premium aesthetic medicine clinic in Thailand.
You help executives understand financial performance, trends, and insights from the P&L dashboard.

Current Dashboard Data:
${dataContext || 'No context provided'}

Navigation: When the user asks to see a page or chart, include [NAVIGATE:overview], [NAVIGATE:revenue], [NAVIGATE:cost], or [NAVIGATE:plan] in your response.

Guidelines:
- Reply in English, be concise, professional, and insightful
- Format numbers in Thai Baht (e.g., ฿1,234,567 or ฿12.5M)
- Highlight trends, anomalies, and opportunities
- Keep responses under 200 words unless detailed analysis is requested`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, dataContext, language = 'en', systemPrompt: providedPrompt, maxTokens = 1024 } = req.body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: providedPrompt || buildSystemPrompt(language, dataContext),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    res.json({ content: response.content[0].text });
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: err.message || 'AI request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`EMMA Dashboard server running on http://localhost:${PORT}`);
});
