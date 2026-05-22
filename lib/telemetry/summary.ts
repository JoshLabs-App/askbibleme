import "server-only";
import { fetchTelemetrySummaryDisk } from "@/lib/telemetry/disk-store";
import { isTelemetryWritableDiskAvailable, telemetryStorageLabel } from "@/lib/telemetry/disk-path";
import type { TelemetrySummary } from "@/lib/telemetry/summary-types";

export type { TelemetrySummary } from "@/lib/telemetry/summary-types";

export async function fetchTelemetrySummary(days = 30, cwd = process.cwd()): Promise<TelemetrySummary> {
  const empty: TelemetrySummary = {
    configured: false,
    days,
    dau: [],
    topScreens: [],
    topTaps: [],
    topScenes: [],
  };

  if (isTelemetryWritableDiskAvailable(cwd)) {
    const disk = fetchTelemetrySummaryDisk(days, cwd);
    if (disk) {
      return { ...disk, storageHint: telemetryStorageLabel(cwd) };
    }
  }

  return empty;
}
