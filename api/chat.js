import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { messages, systemPrompt, language = 'en', dataContext, maxTokens = 1024 } = req.body;

  function buildDefaultSystemPrompt() {
    return language === 'th'
      ? `คุณคือผู้ช่วย AI สำหรับผู้บริหาร EMMA Clinic คลินิกความงามระดับพรีเมียมในประเทศไทย\n\nข้อมูล: ${dataContext || 'ไม่มีข้อมูล'}\n\nตอบกระชับ ไม่เกิน 200 คำ`
      : `You are an executive assistant for EMMA Clinic, a premium aesthetic clinic in Thailand.\n\nData: ${dataContext || 'No data provided'}\n\nBe concise, professional. Under 200 words.`;
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt || buildDefaultSystemPrompt(),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    res.json({ content: response.content[0].text });
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: err.message || 'AI request failed' });
  }
}
