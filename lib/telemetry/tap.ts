import { trackTelemetry } from "@/lib/telemetry/client";
import type { TelemetryTapTarget } from "@/lib/telemetry/event-catalog";

/** Web：白名单 tap */
export function trackTap(target: TelemetryTapTarget): void {
  trackTelemetry("tap", { target });
}
