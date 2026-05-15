const STORAGE_KEY = "selah-nature-home-text-scale-v1";
const STORAGE_SCHEMA_V2 = 2 as const;
const STORAGE_SCHEMA_V3 = 3 as const;

/** 自然首页轮播经文区域的显示比例（仅包在 `HomeVerseRotator` 外层的 `zoom`） */
export const NATURE_HOME_TEXT_SCALE_STEPS = [
  0.5, 0.54, 0.58, 0.62, 0.66, 0.7, 0.74, 0.78, 0.82, 0.86, 0.91, 0.96, 1, 1.05, 1.1, 1.15, 1.22, 1.29, 1.36, 1.44, 1.54,
  1.64, 1.75, 1.86, 2, 2.12, 2.25, 2.38, 2.55, 2.72, 2.9, 3.1, 3.35, 3.6,
] as const;

export type NatureHomeTextScaleStep = (typeof NATURE_HOME_TEXT_SCALE_STEPS)[number];

/** 对应比例 `1`（默认不缩放） */
export const NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX = 12;

/** 上一版 `v:2` 的 15 档；读入旧索引时先还原比例再映射到当前表，避免扩档后档位漂移 */
const PREV_V2_TEXT_SCALE_STEPS = [0.62, 0.68, 0.74, 0.82, 0.91, 1, 1.1, 1.22, 1.36, 1.54, 1.75, 2, 2.28, 2.55, 2.85] as const;

/** 写入 `v1` 存储前的 5 档比例；无 `v` 的旧 JSON 仍按此表解释 `stepIndex`，再映射到新档位 */
const LEGACY_NATURE_HOME_TEXT_SCALE_STEPS = [0.82, 0.91, 1, 1.1, 1.22] as const;

function closestStepIndex(scale: number): number {
  let best = 0;
  let bestD = Infinity;
  NATURE_HOME_TEXT_SCALE_STEPS.forEach((s, i) => {
    const d = Math.abs(s - scale);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function migrateLegacyStepIndex(legacyIdx: number): number {
  const li = Math.min(
    LEGACY_NATURE_HOME_TEXT_SCALE_STEPS.length - 1,
    Math.max(0, Math.round(legacyIdx)),
  );
  const scale = LEGACY_NATURE_HOME_TEXT_SCALE_STEPS[li] ?? 1;
  return closestStepIndex(scale);
}

function migratePrevV2StepIndex(v2Idx: number): number {
  const i = Math.min(PREV_V2_TEXT_SCALE_STEPS.length - 1, Math.max(0, Math.round(v2Idx)));
  const scale = PREV_V2_TEXT_SCALE_STEPS[i] ?? 1;
  return closestStepIndex(scale);
}

function clampStepIndex(n: number): number {
  if (!Number.isFinite(n)) return NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX;
  const i = Math.round(n);
  return Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, Math.max(0, i));
}

export function readNatureHomeTextScaleStepIndex(): number {
  if (typeof window === "undefined") return NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX;
    const parsed = JSON.parse(raw) as { stepIndex?: unknown; v?: unknown } | unknown;
    const stepIndex =
      typeof parsed === "object" && parsed !== null && "stepIndex" in parsed
        ? (parsed as { stepIndex: unknown }).stepIndex
        : typeof parsed === "number"
          ? parsed
          : undefined;
    if (typeof stepIndex !== "number" || !Number.isFinite(stepIndex)) {
      return NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX;
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      (parsed as { v: unknown }).v === STORAGE_SCHEMA_V3
    ) {
      return clampStepIndex(stepIndex);
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      (parsed as { v: unknown }).v === STORAGE_SCHEMA_V2
    ) {
      const migrated = migratePrevV2StepIndex(stepIndex);
      writeNatureHomeTextScaleStepIndex(migrated);
      return migrated;
    }
    const migrated = migrateLegacyStepIndex(stepIndex);
    writeNatureHomeTextScaleStepIndex(migrated);
    return migrated;
  } catch {
    return NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX;
  }
}

export function writeNatureHomeTextScaleStepIndex(stepIndex: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: STORAGE_SCHEMA_V3, stepIndex: clampStepIndex(stepIndex) }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function natureHomeTextScaleAtStep(stepIndex: number): NatureHomeTextScaleStep {
  return NATURE_HOME_TEXT_SCALE_STEPS[clampStepIndex(stepIndex)] ?? 1;
}
