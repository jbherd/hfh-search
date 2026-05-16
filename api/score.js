export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  try {
    const { pdfData, jobContext, criteriaDesc, scoreKeys } = req.body;
    if (!pdfData) return res.status(400).json({ error: 'No PDF data provided' });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfData } },
          { type: 'text', text: 'You are an expert executive recruiter. Score this candidate against the following criteria.\n\n' + jobContext + '\n\nScoring criteria (score each 0-100):\n' + criteriaDesc + '\n\nReply ONLY with valid JSON, no markdown backticks:\n{' + scoreKeys + ',"Rationale":"2-3 sentence summary of key strengths and gaps for this specific role"}' }
        ]}]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    const raw = data.content && data.content.find(b => b.type === 'text');
    const scores = JSON.parse(((raw && raw.text) || '{}').replace(/```json|```/g, '').trim());
    return res.status(200).json(scores);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}