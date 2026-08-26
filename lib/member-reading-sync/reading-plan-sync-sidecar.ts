import type { MemberReadingSyncPushV1 } from "@/lib/member-reading-sync/schema";

function planIdFromValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const planId = (value as { planId?: unknown }).planId;
  return typeof planId === "string" && planId.trim() ? planId.trim() : null;
}

export function localeValueWithReadingPlan(locale: unknown, plan: unknown): Record<string, unknown> {
  const base =
    locale && typeof locale === "object"
      ? { ...(locale as Record<string, unknown>) }
      : { version: 1, locale: "zh-CN" };
  return { ...base, readingPlanPrefs: plan };
}

export function readingPlanFromAppLocale(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  return (value as { readingPlanPrefs?: unknown }).readingPlanPrefs ?? null;
}

export function planIdFromReadingSyncBlobs(
  blobs: MemberReadingSyncPushV1["blobs"] | undefined,
): string | null {
  return (
    planIdFromValue(blobs?.readingPlanPrefs?.value) ||
    planIdFromValue(readingPlanFromAppLocale(blobs?.appLocale?.value))
  );
}
