const DAY_MS = 86_400_000;

/** 自注册日起已走过的整天数（不足一天计为 0）。 */
export function daysSinceMemberJoined(createdAtIso: string, now: Date = new Date()): number | null {
  const start = Date.parse(createdAtIso);
  if (!Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((now.getTime() - start) / DAY_MS));
}

export function formatMemberJourneyDuration(createdAtIso: string, locale: string): string | null {
  const days = daysSinceMemberJoined(createdAtIso);
  if (days == null) return null;
  if (locale === "en") {
    if (days <= 0) return "today";
    if (days === 1) return "1 day";
    return `${days} days`;
  }
  if (days <= 0) return "今天";
  return `${days} 天`;
}
