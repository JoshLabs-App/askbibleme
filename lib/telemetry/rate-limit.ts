/** 简易内存 rate limit（单实例）；多实例部署时仍靠事件白名单与批量上限防刷 */

const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_DEVICE_PER_WINDOW = 120;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

function pruneOld(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (now - b.windowStart > WINDOW_MS * 2) buckets.delete(key);
  }
}

export function checkTelemetryRateLimit(deviceId: string, eventCount: number): boolean {
  const now = Date.now();
  pruneOld(now);
  const key = deviceId;
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { count: 0, windowStart: now };
    buckets.set(key, b);
  }
  if (b.count + eventCount > MAX_EVENTS_PER_DEVICE_PER_WINDOW) {
    return false;
  }
  b.count += eventCount;
  return true;
}
