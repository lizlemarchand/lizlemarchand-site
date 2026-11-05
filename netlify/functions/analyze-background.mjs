// Background function: does the actual analysis with the Anthropic API.
// Netlify lets background functions run for up to 15 minutes, so long messages no longer time out.
// It only acts on a job ID that the start endpoint created, so calling it directly does nothing.
import { jobStore, isValidJobId, readJsonBody, countWords, LONG_MESSAGE_WORDS } from '../lib/shared.mjs';

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

// Rewrite section for messages over LONG_MESSAGE_WORDS: one full rewrite, then three
// variations of each flagged sentence or passage instead of three full rewrites.
const LONG_REWRITES = `  "fullRewrite": { "label": "Self-Led Rewrite", "text": <one full rewrite of the whole message, rooted and confident, keeping its purpose, key content and structure> },
  "passages": [
    {
      "original": <an exact sentence or short passage from the text that contains one or more of the signals above, in the order they appear>,
      "variations": [
        { "label": "Direct & Warm", "text": <rewrite of this passage only: direct, with warmth> },
        { "label": "Confident & Clear", "text": <rewrite of this passage only: confident and clear> },
        { "label": "Decisive & Grounded", "text": <rewrite of this passage only: decisive and grounded> }
      ]
    }
  ],`;

const LONG_GUIDANCE = `
For the rewrites: giving the recipient genuine autonomy is not the same as the writer hedging. If the recipient should have a real choice (for example whether to go ahead, or a clear way to say no), keep that choice and state it plainly. Remove the writer's own hedging, apologizing and self-minimizing. Do not add escape-hatch language such as "no pressure", "only if it works for you" or "feel free to ignore this". Include one entry in "passages" for every sentence or short passage that contains a signal; if several signals sit in the same sentence, group them into one entry.
`;

const SHORT_REWRITES = `  "rewrites": [
    { "label": <e.g. "Direct & Grounded">, "text": <rewritten version, rooted and confident> },
    { "label": <e.g. "Warm & Clear">, "text": <warmer tone but no hedging> },
    { "label": <e.g. "Bold & Specific">, "text": <bolder version that owns the value completely> }
  ],`;

function buildPrompt(context, text, isLong) {
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
${isLong ? LONG_REWRITES : SHORT_REWRITES}
  "reflection": <a single, personalized, empathetic paragraph (3-5 sentences) written directly to the user — acknowledge what the text is trying to do, name the underlying fear gently, and offer one grounding truth about their worth>
}
${isLong ? LONG_GUIDANCE : ''}
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
  const isLong = countWords(text) > LONG_MESSAGE_WORDS;
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
      // Long messages get a full rewrite plus three variations per flagged passage, so they need more room.
      max_tokens: isLong ? 8192 : 4096,
      messages: [{ role: "user", content: buildPrompt(context, text, isLong) }],
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
  const result = parseClaudeJSON(raw);
  result.mode = isLong ? "long" : "short";
  return result;
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
