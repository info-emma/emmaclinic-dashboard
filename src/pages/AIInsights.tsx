import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Sparkles, Database, BarChart2, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useDataStore } from '../store/useDataStore';
import { useCompareStore } from '../store/useCompareStore';
import { useT } from '../i18n/useT';
import { supabase } from '../lib/supabase';
import type { DashboardData } from '../types';
import { formatYearDataContext } from '../utils/dashboardTextContext';

interface Msg { role: 'user' | 'assistant'; content: string; }

const QUICK_PROMPTS = [
  { label: 'Revenue vs Plan YTD', prompt: 'Compare actual revenue vs plan YTD. What is the achievement rate and trend?' },
  { label: 'GP & Net Profit Summary', prompt: 'Summarise gross profit margin and net profit margin YTD. How do they compare to benchmarks?' },
  { label: 'Cross-source Analysis', prompt: 'Compare EMMA Clinic P&L performance against the uploaded competitor data. Where does EMMA stand in terms of margins and revenue?' },
  { label: 'Cost Drivers', prompt: 'What are the top cost drivers this year? Which cost categories grew the most?' },
  { label: 'EBITDA Trend', prompt: 'Analyse the EBITDA trend month by month. Are there any anomalies or improvement opportunities?' },
  { label: 'Top Revenue Procedures', prompt: 'Which procedures contribute the most to revenue? Rank the top 5 by total YTD revenue.' },
];


function buildSystemPrompt(language: string, dataContext: string) {
  return language === 'th'
    ? `คุณคือนักวิเคราะห์ AI ระดับสูงสำหรับ EMMA Clinic คลินิกความงามระดับพรีเมียมในประเทศไทย
คุณมีความสามารถในการวิเคราะห์ข้ามแหล่งข้อมูล (Cross-source Analytics) เชื่อมโยงข้อมูลจากหลายแหล่งเพื่อให้ข้อมูลเชิงลึกที่ครอบคลุม

แหล่งข้อมูลที่เข้าถึงได้:
${dataContext || 'ยังไม่มีข้อมูล กรุณาอัปโหลดไฟล์ข้อมูล'}

แนวทาง:
- ตอบเป็นภาษาไทย ชัดเจน มีหลักการ
- เชื่อมโยงข้อมูลจากหลายแหล่งเพื่อการวิเคราะห์ที่ครอบคลุม
- แสดงตัวเลขเป็นบาท เช่น ฿1,234,567 หรือ ฿12.5M
- ชี้ให้เห็นโอกาส ความเสี่ยง และแนวโน้ม
- สามารถตอบได้ยาวกว่าปกติเพื่อการวิเคราะห์เชิงลึก`
    : `You are a senior AI analyst for EMMA Clinic, a premium aesthetic medicine clinic in Thailand.
You specialise in Cross-source Analytics — connecting and synthesising data from multiple sources to deliver comprehensive, evidence-backed insights.

Data sources available:
${dataContext || 'No data loaded yet. Please upload data files first.'}

Guidelines:
- Reply in English, structured and professional
- Always cite which data source supports each insight
- Format numbers as ฿1,234,567 or ฿12.5M
- Connect data across sources to surface insights not visible in a single source
- Highlight opportunities, risks, and anomalies
- Responses can be detailed and thorough — executives need depth here`;
}

export default function AIInsights() {
  const t = useT();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: `## Welcome to AI Insights\n\nI have access to all your uploaded data sources and can perform **cross-source analytics** — connecting P&L data, competitor comparisons, revenue breakdowns, and more.\n\nUse the quick prompts below or ask me anything.`,
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const data = useDataStore(s => s.data);
  const language = useDataStore(s => s.language);
  const compareCompanies = useCompareStore(s => s.companies);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg: Msg = { role: 'user', content: msg };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);
    try {
      // Fetch all years from Supabase
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
      // Fallback to store data
      if (!yearsContext && data) yearsContext = JSON.stringify(data).slice(0, 6000);
      if (yearsContext.length > 8000) yearsContext = yearsContext.slice(0, 8000);

      const compareContext = Object.entries(compareCompanies)
        .filter(([, v]) => v !== null)
        .map(([, v]) => `${v!.name} (${v!.year}): ${JSON.stringify(v!.metrics)}`)
        .join('\n');
      const dataContext = [
        yearsContext || '[EMMA Clinic P&L Data: not loaded]',
        compareContext ? `\n\nIndustry Compare:\n${compareContext}` : '',
      ].join('');
      const systemPrompt = buildSystemPrompt(language, dataContext);

      const res = await fetch('https://thesbbois.app.n8n.cloud/webhook/emma-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, systemPrompt, maxTokens: 2048 }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const text = await res.text();
      if (!text || text.trim() === '') throw new Error('Empty response from server');
      let json: Record<string, string>;
      try { json = JSON.parse(text); } catch { throw new Error(`Invalid response: ${text.slice(0, 80)}`); }
      const raw = (json.reply || json.content || json.output || 'No response.').replace(/\\n/g, '\n');

      setMessages(prev => [...prev, { role: 'assistant', content: raw }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const dataSourceCount = [
    data ? 1 : 0,
    Object.values(compareCompanies).filter(Boolean).length,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <h2 className="font-playfair text-xl text-emma-black flex items-center gap-2">
            <Sparkles size={18} className="text-emma-gold" />
            {t.pageAIInsights}
          </h2>
          <p className="text-xs font-inter text-emma-grey mt-1">
            Cross-source analytics — synthesises data from all uploaded sources
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-inter">
          <div className="flex items-center gap-1.5 text-emma-grey">
            <Database size={12} />
            <span>{dataSourceCount} source{dataSourceCount !== 1 ? 's' : ''} loaded</span>
          </div>
          {data && (
            <div className="flex items-center gap-1.5 text-acc-positive">
              <TrendingUp size={12} />
              <span>P&L Data</span>
            </div>
          )}
          {Object.values(compareCompanies).filter(Boolean).length > 0 && (
            <div className="flex items-center gap-1.5 text-acc-positive">
              <BarChart2 size={12} />
              <span>{Object.values(compareCompanies).filter(Boolean).length} Competitor{Object.values(compareCompanies).filter(Boolean).length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick prompts */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex flex-wrap gap-2"
      >
        {QUICK_PROMPTS.map(p => (
          <button
            key={p.label}
            onClick={() => send(p.prompt)}
            disabled={loading}
            className="text-xs font-inter px-3 py-1.5 rounded-full border border-emma-border bg-white hover:bg-emma-nude/40 hover:border-emma-gold-light text-emma-grey-light hover:text-emma-black transition-all duration-200 disabled:opacity-40"
          >
            {p.label}
          </button>
        ))}
      </motion.div>

      {/* Chat area */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="flex-1 emma-card flex flex-col overflow-hidden p-0"
      >
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-emma-gold/20 border border-emma-gold/30 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                  <Sparkles size={11} className="text-emma-gold" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm font-inter leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-emma-black text-white rounded-br-sm'
                  : 'bg-emma-nude/30 border border-emma-border text-emma-black rounded-bl-sm'}`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-emma-black">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      h2: ({ children }) => <p className="font-playfair text-base font-semibold text-emma-black mb-2 mt-3 first:mt-0">{children}</p>,
                      h3: ({ children }) => <p className="font-inter font-semibold text-emma-black mb-1 mt-2">{children}</p>,
                      table: ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border-collapse">{children}</table></div>,
                      th: ({ children }) => <th className="border border-emma-border px-2 py-1.5 bg-emma-nude text-left font-semibold">{children}</th>,
                      td: ({ children }) => <td className="border border-emma-border px-2 py-1.5">{children}</td>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-full bg-emma-gold/20 border border-emma-gold/30 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                <Sparkles size={11} className="text-emma-gold" />
              </div>
              <div className="bg-emma-nude/30 border border-emma-border rounded-lg rounded-bl-sm px-4 py-3">
                <Loader2 size={16} className="text-emma-gold animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-emma-border p-4 flex gap-3 bg-white">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask for cross-source analysis, trends, comparisons…"
            rows={2}
            className="flex-1 resize-none text-sm font-inter text-emma-black placeholder-emma-grey border border-emma-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-emma-gold-light transition-colors"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-emma-gold flex items-center justify-center text-white disabled:opacity-40 hover:bg-emma-gold-dark transition-colors flex-shrink-0 self-end"
          >
            <Send size={15} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
