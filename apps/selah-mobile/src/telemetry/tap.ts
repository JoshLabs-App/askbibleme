import type { TelemetryTapTarget } from "../../../../lib/telemetry/event-catalog";
import { trackTelemetry } from "./client";

export function trackTap(target: TelemetryTapTarget): void {
  trackTelemetry("tap", { target });
}
