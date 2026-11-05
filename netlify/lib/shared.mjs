// Shared helpers for the Permission Signals Detector functions.
import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';

// Stored jobs live here: the submitted text (only until the background job picks it up),
// then the finished result or error (only until the page collects it).
export function jobStore() {
  return getStore({ name: 'psd-jobs', consistency: 'strong' });
}

export const VALID_CONTEXTS = ['Business', 'Sales', 'Personal'];

// Job IDs come from crypto.randomUUID(). Reject anything else before touching storage.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidJobId(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

export function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Checks the member password against the PSD_PASSWORD environment variable set in Netlify.
// Returns null when it matches, or a Response to send back when it doesn't.
export function checkPassword(supplied) {
  const expected = process.env.PSD_PASSWORD;
  if (!expected) {
    console.error('PSD_PASSWORD is not set in Netlify environment variables');
    return json(500, { error: 'The tool is not set up correctly. Please let Liz know.' });
  }
  const a = Buffer.from(String(supplied ?? '').trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return json(401, { error: "That password doesn't match." });
  }
  return null;
}

export async function readJsonBody(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
