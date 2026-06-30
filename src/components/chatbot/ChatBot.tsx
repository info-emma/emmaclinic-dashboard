import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useDataStore } from '../../store/useDataStore';
import { useCompareStore } from '../../store/useCompareStore';
import { useT } from '../../i18n/useT';
import { supabase } from '../../lib/supabase';
import type { DashboardData, BranchPLData } from '../../types';
import { formatYearDataContext, formatBranchDataContext } from '../../utils/dashboardTextContext';

interface Msg { role: 'user' | 'assistant'; content: string; }

const NAV_MAP: Record<string, string> = {
  overview: '/',
  revenue: '/excom/revenue',
  cost: '/excom/pl',
  pl: '/excom/pl',
  plan: '/excom/plan',
  compare: '/excom/compare',
  sga: '/excom/sga',
  operation: '/operation/branch',
  branch: '/operation/branch',
  pricing: '/operation/pricing',
  procedure: '/operation/procedure',
  ai: '/ai-insights',
};

function parseNav(text: string): { clean: string; nav?: string } {
  const match = text.match(/\[NAVIGATE:([\w&]+)\]/i);
  if (match) {
    const nav = match[1].toLowerCase().replace(/&/g, '');
    return { clean: text.replace(match[0], '').trim(), nav };
  }
  return { clean: text };
}

function buildSystemPrompt(language: string, dataContext: string) {
  return language === 'th'
    ? `คุณคือผู้ช่วย AI สำหรับผู้บริหาร EMMA Clinic คลินิกความงามระดับพรีเมียมในประเทศไทย
คุณช่วยวิเคราะห์ผลประกอบการทางการเงิน แนวโน้ม และข้อมูลเชิงลึกจากแดชบอร์ด P&L

ข้อมูลแดชบอร์ดปัจจุบัน:
${dataContext || 'ไม่มีข้อมูล'}

การนำทาง: เมื่อผู้ใช้ต้องการดูหน้าใด ให้ใส่ [NAVIGATE:overview], [NAVIGATE:revenue], [NAVIGATE:pl], [NAVIGATE:plan], [NAVIGATE:compare], [NAVIGATE:sga], [NAVIGATE:branch], [NAVIGATE:pricing], [NAVIGATE:procedure] หรือ [NAVIGATE:ai] ในคำตอบ
- [NAVIGATE:branch] = หน้า P&L Branch (กำไรขาดทุนแยกตามสาขา, ต้นทุน operation cost แยกสาขา)
- [NAVIGATE:sga] = หน้า SG&A (ค่าใช้จ่ายในการขายและบริหาร, ค่าโฆษณา, เปรียบแผน SG&A, EBITDA, EBIT)
- คำถามเกี่ยวกับ operation cost, ต้นทุนสาขา, opt cost สาขา → ใช้ [NAVIGATE:branch]
- คำถามเกี่ยวกับ SG&A, ค่าใช้จ่าย, ค่าโฆษณา, ค่าบริหาร → ใช้ [NAVIGATE:sga]

แนวทาง:
- ตอบเป็นภาษาไทย กระชับ เป็นมืออาชีพ
- แสดงตัวเลขเป็นบาท เช่น ฿1,234,567 หรือ ฿12.5M
- ชี้ให้เห็นแนวโน้ม ความผิดปกติ และโอกาส
- ตอบสั้นกระชับ ไม่เกิน 200 คำ`
    : `You are an executive assistant for EMMA Clinic, a premium aesthetic medicine clinic in Thailand.
Help executives understand financial performance from the P&L dashboard.

Current Dashboard Data:
${dataContext || 'No context provided'}

Navigation: Include [NAVIGATE:overview], [NAVIGATE:revenue], [NAVIGATE:pl], [NAVIGATE:plan], [NAVIGATE:compare], [NAVIGATE:sga], [NAVIGATE:branch], [NAVIGATE:pricing], [NAVIGATE:procedure], or [NAVIGATE:ai] when asked to show a page.
- [NAVIGATE:branch] = P&L by Branch page (branch P&L, operation cost by branch, opt cost by branch)
- [NAVIGATE:sga] = SG&A page (selling expenses, admin expenses, marketing breakdown, SG&A plan vs actual, EBITDA, EBIT)

Guidelines:
- Reply in English, concise and professional
- Format numbers as ฿1,234,567 or ฿12.5M
- Highlight trends and opportunities
- Keep responses under 200 words`;
}


export default function ChatBot() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: t.chatWelcome },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const data = useDataStore(s => s.data);
  const language = useDataStore(s => s.language);
  const compareCompanies = useCompareStore(s => s.companies);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: Msg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);
    try {
      // Build multi-year context from Supabase (latest record per year)
      let yearsContext = '';
      if (supabase) {
        const { data: rows } = await supabase
          .from('monthly_reports')
          .select('year, data, uploaded_at')
          .order('uploaded_at', { ascending: false });
        if (rows && rows.length > 0) {
          const yearMap: Record<number, DashboardData> = {};
          for (const row of rows) {
            if (row.year && !yearMap[row.year]) yearMap[row.year] = row.data as DashboardData;
          }
          yearsContext = Object.entries(yearMap)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([yr, d]) => formatYearDataContext(Number(yr), d))
            .join('\n');
        }
      }
      // Fallback: use current store data if Supabase unavailable
      if (!yearsContext && data) yearsContext = JSON.stringify(data).slice(0, 4000);
      // Cap total context to avoid overwhelming n8n agent
      if (yearsContext.length > 5000) yearsContext = yearsContext.slice(0, 5000);

      // Branch P&L context (latest upload per month)
      let branchContext = '';
      if (supabase) {
        const { data: branchRows } = await supabase
          .from('branch_reports')
          .select('month, year, data, uploaded_at')
          .order('uploaded_at', { ascending: false });
        if (branchRows && branchRows.length > 0) {
          const seen = new Set<string>();
          const monthsData: BranchPLData[] = [];
          for (const row of branchRows) {
            const key = `${row.year}-${row.month}`;
            if (!seen.has(key)) {
              seen.add(key);
              monthsData.push(row.data as BranchPLData);
            }
          }
          monthsData.sort((a, b) => a.month - b.month);
          branchContext = formatBranchDataContext(monthsData);
        }
      }

      const compareContext = Object.entries(compareCompanies)
        .filter(([, v]) => v !== null)
        .map(([, v]) => `${v!.name} (${v!.year}): ${JSON.stringify(v!.metrics)}`)
        .join('\n');
      const dataContext = [
        yearsContext,
        branchContext,
        compareContext ? `\n\nIndustry Compare:\n${compareContext}` : '',
      ].join('');
      const systemPrompt = buildSystemPrompt(language, dataContext);
      let raw: string;

      const res = await fetch('https://thesbbois.app.n8n.cloud/webhook/emma-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, systemPrompt, maxTokens: 1024 }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const text = await res.text();
      if (!text || text.trim() === '') throw new Error('Empty response from server');
      let json: Record<string, string>;
      try { json = JSON.parse(text); } catch { throw new Error(`Invalid response: ${text.slice(0, 80)}`); }
      raw = (json.reply || json.content || json.output || 'No response.').replace(/\\n/g, '\n');

      const { clean, nav } = parseNav(raw);
      setMessages(prev => [...prev, { role: 'assistant', content: clean }]);
      if (nav && NAV_MAP[nav]) navigate(NAV_MAP[nav]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally { setLoading(false); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <motion.button onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-40 w-[52px] h-[52px] rounded-full bg-emma-black text-emma-gold shadow-emma-lg flex items-center justify-center hover:bg-emma-grey-dark transition-colors"
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}>
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X size={20} /></motion.span>
            : <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><MessageCircle size={20} /></motion.span>
          }
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={`fixed bottom-[76px] right-6 z-40 bg-white rounded-lg shadow-emma-lg border border-emma-border flex flex-col overflow-hidden ${
              expanded
                ? 'w-[calc(100vw-2rem)] sm:w-[720px] max-w-[720px]'
                : 'w-[340px] sm:w-[380px]'
            }`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
            style={{ maxHeight: 'calc(100vh - 120px)' }}>
            <div className="bg-emma-black px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full border border-emma-gold/40 flex items-center justify-center">
                <span className="text-emma-gold font-playfair text-xs font-semibold">E</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-inter text-xs font-semibold text-white">{t.chatAssistant}</p>
                <p className="font-inter text-[10px] text-emma-grey">{t.chatSubtitle}</p>
              </div>
              <button
                onClick={() => setExpanded(value => !value)}
                className="w-7 h-7 rounded-full border border-emma-gold/25 text-emma-gold flex items-center justify-center hover:bg-white/5 transition-colors"
                aria-label={expanded ? 'Collapse assistant' : 'Expand assistant'}
                title={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-emma-nude/20"
              style={{ minHeight: expanded ? 360 : 240, maxHeight: expanded ? 560 : 360 }}
            >
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-lg px-3 py-2 text-xs font-inter leading-relaxed
                    ${msg.role === 'user' ? 'bg-emma-black text-white rounded-br-sm' : 'bg-white border border-emma-border text-emma-black rounded-bl-sm shadow-emma'}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
                          li: ({ children }) => <li>{children}</li>,
                          h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                          h3: ({ children }) => <p className="font-semibold mb-0.5">{children}</p>,
                          table: ({ children }) => <table className="w-full text-[10px] border-collapse my-1">{children}</table>,
                          th: ({ children }) => <th className="border border-emma-border px-1.5 py-0.5 bg-emma-nude text-left font-semibold">{children}</th>,
                          td: ({ children }) => <td className="border border-emma-border px-1.5 py-0.5">{children}</td>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : msg.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-emma-border rounded-lg rounded-bl-sm px-3 py-2 shadow-emma">
                    <Loader2 size={14} className="text-emma-gold animate-spin" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-emma-border p-3 flex gap-2 bg-white">
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                placeholder={t.chatPlaceholder} rows={1}
                className="flex-1 resize-none text-xs font-inter text-emma-black placeholder-emma-grey border border-emma-border rounded px-3 py-2 focus:outline-none focus:border-emma-gold-light transition-colors" />
              <button onClick={send} disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-full bg-emma-gold flex items-center justify-center text-white disabled:opacity-40 hover:bg-emma-gold-dark transition-colors flex-shrink-0 self-end">
                <Send size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
