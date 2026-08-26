export type ReadingPlanPrefsMergeValue = {
  version: 1;
  planId: string;
  anchor: "from-today" | "calendar-jan1" | "calendar-easter";
  startedOn?: string;
  dayCount?: number;
  aheadDays?: number;
  ntDeepRepeatPace?: number;
  chosen?: true;
  selectedAt?: string;
};

const DEFAULT_READING_PLAN_ID = "triple-loop";
const DEFAULT_READING_PLAN_ANCHOR = "calendar-easter";
const READING_PLAN_EASTER_EPOCH_DATE = "2026-04-05";
const NT_DEEP_REPEAT_PLAN_ID = "nt-deep-repeat";
const NT_DEEP_REPEAT_DEFAULT_PACE = 7;

function readAheadDays(prefs: ReadingPlanPrefsMergeValue): number {
  const n = prefs.aheadDays;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function earlierFromTodayStartedOn(
  left: ReadingPlanPrefsMergeValue,
  right: ReadingPlanPrefsMergeValue,
  planId: string,
): string | undefined {
  const candidates: { startedOn: string; ms: number }[] = [];
  for (const p of [left, right]) {
    if (p.anchor !== "from-today" || p.planId !== planId) continue;
    const s = p.startedOn?.trim();
    if (!s) continue;
    const ms = Date.parse(s);
    if (Number.isFinite(ms)) candidates.push({ startedOn: s, ms });
  }
  if (!candidates.length) return undefined;
  candidates.sort((x, y) => x.ms - y.ms);
  return candidates[0].startedOn;
}

function isUnchosenProductDefaultReadingPlanPrefs(prefs: ReadingPlanPrefsMergeValue): boolean {
  if (prefs.chosen === true) return false;
  if (readAheadDays(prefs) > 0) return false;
  if (prefs.planId === NT_DEEP_REPEAT_PLAN_ID && prefs.anchor === "from-today") {
    const pace = prefs.ntDeepRepeatPace;
    return pace == null || pace === NT_DEEP_REPEAT_DEFAULT_PACE;
  }
  if (prefs.planId !== DEFAULT_READING_PLAN_ID) return false;
  if (prefs.anchor !== DEFAULT_READING_PLAN_ANCHOR) return false;
  if (prefs.ntDeepRepeatPace != null) return false;
  if (prefs.anchor === "calendar-easter") {
    const started = prefs.startedOn?.trim();
    if (started && started !== READING_PLAN_EASTER_EPOCH_DATE) return false;
  }
  return true;
}

/** 用户选过的计划应上传；产品隐式默认不上传，避免重装盖掉云端选择。 */
export function shouldSyncReadingPlanPrefs(
  prefs: ReadingPlanPrefsMergeValue | null | undefined,
): boolean {
  if (!prefs || prefs.version !== 1 || !prefs.planId?.trim()) return false;
  if (prefs.chosen === true) return true;
  return !isUnchosenProductDefaultReadingPlanPrefs(prefs);
}

function readSelectedAtMs(prefs: ReadingPlanPrefsMergeValue): number {
  const raw = prefs.selectedAt?.trim();
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function prefsWithAhead(
  prefs: ReadingPlanPrefsMergeValue,
  other?: ReadingPlanPrefsMergeValue,
): ReadingPlanPrefsMergeValue {
  const samePlan = Boolean(other && other.version === 1 && other.planId === prefs.planId);
  const ahead = samePlan
    ? Math.max(readAheadDays(prefs), readAheadDays(other!))
    : readAheadDays(prefs);
  return {
    ...prefs,
    aheadDays: ahead > 0 ? ahead : undefined,
  };
}

export function mergeReadingPlanPrefsValue(a: unknown, b: unknown): ReadingPlanPrefsMergeValue | unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const left = a as ReadingPlanPrefsMergeValue;
  const right = b as ReadingPlanPrefsMergeValue;
  if (
    isUnchosenProductDefaultReadingPlanPrefs(right) &&
    left.planId !== right.planId &&
    left.version === 1
  ) {
    return prefsWithAhead(left, right);
  }

  const leftChosen = left.chosen === true;
  const rightChosen = right.chosen === true;
  if (leftChosen !== rightChosen) {
    return prefsWithAhead(leftChosen ? left : right, leftChosen ? right : left);
  }

  const leftSelectedMs = readSelectedAtMs(left);
  const rightSelectedMs = readSelectedAtMs(right);
  // 切换计划是特别动作：只认 selectedAt 较新的一侧。其它设备仍登着旧计划再同步，不得靠 blob 时间戳盖回去。
  if (left.planId !== right.planId) {
    if (leftSelectedMs !== rightSelectedMs) {
      return prefsWithAhead(leftSelectedMs > rightSelectedMs ? left : right);
    }
    return prefsWithAhead(left, right);
  }

  const newer = right.version === 1 ? right : left.version === 1 ? left : right;
  const older = newer === right ? left : right;
  const merged: ReadingPlanPrefsMergeValue = prefsWithAhead(newer, older);

  if (merged.anchor === "from-today" && left.planId === right.planId) {
    const earliest = earlierFromTodayStartedOn(left, right, merged.planId);
    if (earliest) merged.startedOn = earliest;
  }

  return merged;
}
