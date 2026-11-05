// Status endpoint: the page asks this every few seconds with its job ID.
// Returns "working", the finished result, or the error. A result is deleted as soon as it's delivered.
import { jobStore, isValidJobId, json, checkPassword, readJsonBody } from '../lib/shared.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const body = await readJsonBody(req);
  if (!body) return json(400, { error: 'Invalid request.' });

  const denied = checkPassword(body.password);
  if (denied) return denied;

  if (!isValidJobId(body.jobId)) return json(400, { error: 'Invalid request.' });

  const store = jobStore();
  const job = await store.get(body.jobId, { type: 'json' });

  if (!job) {
    return json(404, { status: 'missing', error: "We couldn't find this analysis. Please try again." });
  }

  if (job.status === 'done') {
    await store.delete(body.jobId);
    return json(200, { status: 'done', result: job.result });
  }

  if (job.status === 'error') {
    await store.delete(body.jobId);
    return json(200, { status: 'error', error: job.error });
  }

  return json(200, { status: 'working' });
};
