import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { messages, dataContext } = req.body;

  try {
    const client = new Anthropic({ apiKey });
    const systemPrompt = `You are an intelligent executive assistant for EMMA Clinic, a premium aesthetic medicine clinic in Thailand.
You help executives understand financial performance, trends, and insights from the P&L dashboard.

Current Dashboard Data:
${dataContext || 'No context provided'}

Navigation: When the user asks to see a page or chart, include [NAVIGATE:overview], [NAVIGATE:revenue], [NAVIGATE:cost], or [NAVIGATE:plan] in your response.

Guidelines:
- Be concise, professional, and insightful
- Format numbers in Thai Baht with commas (e.g., ฿1,234,567) or compact (฿12.5M)
- Highlight trends, anomalies, and opportunities
- Keep responses under 200 words unless detailed analysis is requested`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    res.json({ content: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'AI request failed' });
  }
}
