// Background function: does the actual analysis with the Anthropic API.
// Netlify lets background functions run for up to 15 minutes, so long messages no longer time out.
// It only acts on a job ID that the start endpoint created, so calling it directly does nothing.
import { jobStore, isValidJobId, readJsonBody } from '../lib/shared.mjs';

// Errors whose message is safe and kind to show to members.
function friendly(message) {
  const e = new Error(message);
  e.friendly = true;
  return e;
}

function parseClaudeJSON(raw) {
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Attempt 1: direct parse on cleaned string
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Attempt 2: extract substring between first { and last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {}
  }

  throw friendly('We had trouble reading the analysis. Please try again.');
}

function buildPrompt(context, text) {
  return `You are a coach specializing in helping women identify "permission signals" — subtle language patterns that unconsciously signal low confidence, self-doubt, or a need for external validation before taking up space. These include apologetic phrasing, excessive hedging, minimizing language, over-explaining, unsolicited discounting of one's own value, and fear-based qualifiers.

Context: ${context}

Analyze the following text and return a JSON object with exactly this structure:
{
  "selfLedScore": <integer 1-10, where 1-3 = highly apologetic / saturated with permission-seeking language, 4-6 = some hedging present, 7-10 = mostly direct / fully self-led. Higher = better, more confident, more self-led.>,
  "score_label": <short phrase matching the score band: for 1-3 use "Highly Apologetic" or "Heavily Permission-Seeking"; for 4-6 use "Some Hedging"; for 7-10 use "Mostly Direct", "Grounded & Clear", or "Fully Self-Led">,
  "score_description": <1-2 sentences explaining what the score means for this specific text — frame it from the self-led direction, e.g. "Your writing is mostly direct, with a few places where hedging softens your authority.">,
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

IMPORTANT: Your entire response must be a single valid JSON object and nothing else. Do not wrap it in markdown code fences. Do not include any text, explanation, or formatting before or after the JSON. Begin your response with { and end it with }.

Text to analyze:
"""
${text}
"""`;
}

// Turns an Anthropic API failure into a message that's kind and clear for members.
function friendlyApiError(status) {
  if (status === 429 || status === 529 || status === 503) {
    return 'The analysis service is very busy right now. Please wait a moment and try again.';
  }
  return 'Something went wrong while analyzing your message. Please try again.';
}

async function runAnalysis(context, text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    throw friendly('The tool is not set up correctly. Please let Liz know.');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: buildPrompt(context, text) }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Log the status and error type only, never the submitted text.
    console.error(`Anthropic API error ${res.status}: ${err?.error?.type || 'unknown'}`);
    throw friendly(friendlyApiError(res.status));
  }

  const data = await res.json();
  if (data.stop_reason === 'max_tokens') {
    console.error('Anthropic response hit max_tokens');
  }
  const raw = data.content[0].text.trim();
  return parseClaudeJSON(raw);
}

export default async (req) => {
  const body = await readJsonBody(req);
  const jobId = body?.jobId;
  if (!isValidJobId(jobId)) return;

  const store = jobStore();
  const job = await store.get(jobId, { type: 'json' });
  if (!job || job.status !== 'queued') return; // unknown job, or already picked up

  const meta = { metadata: { createdAt: Date.now() } };

  // Take the text out of storage straight away. Only the result is kept from here on.
  await store.setJSON(jobId, { status: 'working' }, meta);

  try {
    if (job.simulateError) {
      throw friendly('This is a test error. Please try again.');
    }
    const result = await runAnalysis(job.context, job.text);
    await store.setJSON(jobId, { status: 'done', result }, meta);
  } catch (e) {
    if (!e.friendly) console.error('Analysis failed:', e.name);
    const error = e.friendly ? e.message : 'Something went wrong while analyzing your message. Please try again.';
    await store.setJSON(jobId, { status: 'error', error }, meta);
  }
};
