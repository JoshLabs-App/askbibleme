import {
  TELEMETRY_DEVICE_KEY,
  TELEMETRY_FLUSH_BATCH_SIZE,
  TELEMETRY_FLUSH_INTERVAL_MS,
  TELEMETRY_FLUSH_MIN_QUEUE,
  TELEMETRY_QUEUE_KEY,
  TELEMETRY_QUEUE_MAX,
  type TelemetryEventName,
  type TelemetryPlatform,
} from "./event-catalog";
import type { TelemetryEventProperties, TelemetryQueuedEvent } from "./types";

export type TelemetryStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type TelemetryClientConfig = {
  platform: TelemetryPlatform;
  disabled: boolean;
  ingestUrl: string;
  storage: TelemetryStorage;
  getAppVersion: () => string | null;
  getLocale: () => string | null;
  isOnline: () => boolean | Promise<boolean>;
};

function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

async function readQueue(storage: TelemetryStorage): Promise<TelemetryQueuedEvent[]> {
  try {
    const raw = await storage.getItem(TELEMETRY_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TelemetryQueuedEvent[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(storage: TelemetryStorage, queue: TelemetryQueuedEvent[]) {
  const trimmed =
    queue.length > TELEMETRY_QUEUE_MAX ? queue.slice(queue.length - TELEMETRY_QUEUE_MAX) : queue;
  await storage.setItem(TELEMETRY_QUEUE_KEY, JSON.stringify(trimmed));
}

export function createTelemetryClient(config: TelemetryClientConfig) {
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let lastFlushAt = 0;
  let deviceIdPromise: Promise<string> | null = null;

  async function getDeviceId(): Promise<string> {
    if (!deviceIdPromise) {
      deviceIdPromise = (async () => {
        const existing = await config.storage.getItem(TELEMETRY_DEVICE_KEY);
        if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
        const id = newEventId();
        await config.storage.setItem(TELEMETRY_DEVICE_KEY, id);
        return id;
      })();
    }
    return deviceIdPromise;
  }

  async function enqueue(
    eventName: TelemetryEventName,
    properties?: TelemetryEventProperties,
  ): Promise<void> {
    if (config.disabled) return;
    const queue = await readQueue(config.storage);
    queue.push({
      event_id: newEventId(),
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      properties,
    });
    await writeQueue(config.storage, queue);
    if (queue.length >= TELEMETRY_FLUSH_MIN_QUEUE) {
      void flush();
    }
  }

  async function flush(): Promise<void> {
    if (config.disabled) return;
    const online = await config.isOnline();
    if (!online) return;

    const now = Date.now();
    const queue = await readQueue(config.storage);
    if (queue.length === 0) return;
    if (now - lastFlushAt < 5_000 && queue.length < TELEMETRY_FLUSH_MIN_QUEUE) return;

    const batch = queue.slice(0, TELEMETRY_FLUSH_BATCH_SIZE);
    const device_id = await getDeviceId();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const res = await fetch(config.ingestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          device_id,
          platform: config.platform,
          app_version: config.getAppVersion(),
          locale: config.getLocale(),
          events: batch,
        }),
        signal: controller.signal,
      });
      if (!res.ok) return;
      const remaining = queue.slice(batch.length);
      await writeQueue(config.storage, remaining);
      lastFlushAt = Date.now();
      if (remaining.length > 0) {
        void flush();
      }
    } catch {
      /* keep queue */
    } finally {
      clearTimeout(timeout);
    }
  }

  function startPeriodicFlush() {
    if (flushTimer) return;
    flushTimer = setInterval(() => {
      void flush();
    }, TELEMETRY_FLUSH_INTERVAL_MS);
  }

  function stopPeriodicFlush() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  return {
    track: enqueue,
    flush,
    startPeriodicFlush,
    stopPeriodicFlush,
    getDeviceId,
  };
}

export type TelemetryClient = ReturnType<typeof createTelemetryClient>;
