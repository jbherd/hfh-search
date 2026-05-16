export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { pdfData, text } = req.body;
    const prompt = 'You are an executive search consultant. Read this job description and identify the 4 most important technical scoring criteria for evaluating candidates. Each criterion should be scoreable 0-100 from a resume or LinkedIn profile.\n\nReply ONLY with a valid JSON array, no markdown backticks:\n[{"key":"c1","label":"Short 3-4 word label","weight":35,"description":"What specifically to look for in resume to score this"},{"key":"c2","label":"...","weight":25,"description":"..."},{"key":"c3","label":"...","weight":25,"description":"..."},{"key":"c4","label":"...","weight":15,"description":"..."}]\n\nWeights must sum to 100. Keys must be c1,c2,c3,c4.';

    const messages = pdfData ? [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfData } },
        { type: 'text', text: prompt }
      ]
    }] : [{ role: 'user', content: (text || '').substring(0, 3000) + '\n\n' + prompt }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, messages })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });

    const raw = data.content && data.content.find(b => b.type === 'text');
    const criteria = JSON.parse(((raw && raw.text) || '[]').replace(/```json|```/g, '').trim());
    return res.status(200).json(criteria);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
