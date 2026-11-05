// Start endpoint: checks the password, validates the input, saves the job and
// hands it to the background function. Returns the job ID straight away.
import { randomUUID } from 'node:crypto';
import { jobStore, VALID_CONTEXTS, json, checkPassword, readJsonBody } from '../lib/shared.mjs';

const MAX_CHARS = 20000; // hard server-side cap; the page shows a friendlier word limit

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const body = await readJsonBody(req);
  if (!body) return json(400, { error: 'Invalid request.' });

  const denied = checkPassword(body.password);
  if (denied) return denied;

  // The password gate on the page calls this with check: true just to confirm the password.
  if (body.check === true) return json(200, { ok: true });

  const { context: ctx, text } = body;
  if (!VALID_CONTEXTS.includes(ctx)) return json(400, { error: 'Please choose a context.' });
  if (typeof text !== 'string' || !text.trim()) {
    return json(400, { error: 'Please paste some text to analyze.' });
  }
  if (text.length > MAX_CHARS) {
    return json(400, { error: 'This one is quite long. Please paste a shorter section.' });
  }

  // Test hook so the error message and retry button can be checked. Never active on the live site.
  const isProduction = context?.deploy?.context === 'production';
  const simulateError = !isProduction && body.simulateError === true;

  const jobId = randomUUID();
  const store = jobStore();
  await store.setJSON(
    jobId,
    { status: 'queued', context: ctx, text, simulateError },
    { metadata: { createdAt: Date.now() } }
  );

  // Trigger the background function on this same deploy. It replies 202 immediately.
  const origin = new URL(req.url).origin;
  try {
    const res = await fetch(`${origin}/.netlify/functions/analyze-background`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    if (res.status !== 202 && !res.ok) throw new Error(`status ${res.status}`);
  } catch (e) {
    console.error('Could not start background analysis:', e.message);
    await store.delete(jobId);
    return json(502, { error: "We couldn't start the analysis. Please try again." });
  }

  return json(202, { jobId });
};
