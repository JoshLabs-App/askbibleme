import "server-only";
import { ingestTelemetryEventsDisk } from "@/lib/telemetry/disk-store";
import { isTelemetryWritableDiskAvailable } from "@/lib/telemetry/disk-path";
import type { TelemetryIngestBody } from "@/lib/telemetry/types";

export type TelemetryIngestResult =
  | { ok: true; accepted: number; skipped: number; storage: "disk" }
  | { ok: false; error: string; status: number };

export async function ingestTelemetryEvents(body: TelemetryIngestBody): Promise<TelemetryIngestResult> {
  if (isTelemetryWritableDiskAvailable()) {
    const disk = ingestTelemetryEventsDisk(body);
    if (disk.ok) {
      return { ...disk, storage: "disk" };
    }
    return { ok: false, error: disk.error, status: 500 };
  }

  return { ok: false, error: "Telemetry disk storage not configured", status: 503 };
}
