// Scheduled cleanup: runs every hour and deletes any stored job older than 15 minutes,
// for example when someone closed the page before their result was collected.
import { jobStore } from '../lib/shared.mjs';

const MAX_AGE_MS = 15 * 60 * 1000;

export default async () => {
  const store = jobStore();
  const { blobs } = await store.list();
  const now = Date.now();
  let deleted = 0;

  for (const { key } of blobs) {
    const info = await store.getMetadata(key);
    const createdAt = Number(info?.metadata?.createdAt) || 0;
    if (now - createdAt > MAX_AGE_MS) {
      await store.delete(key);
      deleted++;
    }
  }

  console.log(`Cleanup: checked ${blobs.length}, deleted ${deleted}`);
};

export const config = { schedule: '@hourly' };
