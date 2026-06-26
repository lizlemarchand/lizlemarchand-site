exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { context, text } = body;
  if (!context || !text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing context or text' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const prompt = `You are a coach specializing in helping women identify "permission signals" — subtle language patterns that unconsciously signal low confidence, self-doubt, or a need for external validation before taking up space. These include apologetic phrasing, excessive hedging, minimizing language, over-explaining, unsolicited discounting of one's own value, and fear-based qualifiers.

Context: ${context}

Analyze the following text and return a JSON object with exactly this structure:
{
  "score": <integer 0-10, where 0 = no permission signals at all, 10 = saturated with permission-seeking language>,
  "score_label": <short phrase like "Rooted" / "Slightly Hedged" / "Seeking Permission" / "Highly Apologetic">,
  "score_description": <1-2 sentences explaining what the score means for this specific text>,
  "signals": [
    { "phrase": <the exact phrase or pattern from the text>, "explanation": <why this is a permission signal and what it signals to the reader> }
  ],
  "rewrites": [
    { "label": <e.g. "Direct & Grounded">, "text": <rewritten version, rooted and confident> },
    { "label": <e.g. "Warm & Clear">, "text": <warmer tone but no hedging> },
    { "label": <e.g. "Bold & Specific">, "text": <bolder version that owns the value completely> }
  ],
  "reflection": <a single, personalized, empathetic paragraph (3-5 sentences) written directly to the user — acknowledge what the text is trying to do, name the underlying fear gently, and offer one grounding truth about their worth>
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.

Text to analyze:
"""
${text}
"""`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: err?.error?.message || `Anthropic API error ${res.status}` }),
      };
    }

    const data = await res.json();
    const raw = data.content[0].text.trim();
    const parsed = JSON.parse(raw);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
