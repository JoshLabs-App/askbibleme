/** 全站读经计划固定历元：2026 年复活节（公历）为第 1 天（与 AskBible 一致，不随用户改）。 */
export const READING_PLAN_EASTER_EPOCH_DATE = "2026-04-05";

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return new Date(y, mo - 1, da);
}

function localDaysBetween(from: string, to: string): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  if (!a || !b) return 0;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

/**
 * 自复活节历元起算的第几天（1-based）。历元前亦按第 1 天计。
 */
export function getReadingPlanDaySinceEpoch(now = new Date()): number {
  const today = toLocalDateString(now);
  const offset = localDaysBetween(READING_PLAN_EASTER_EPOCH_DATE, today);
  return Math.max(1, offset + 1);
}
