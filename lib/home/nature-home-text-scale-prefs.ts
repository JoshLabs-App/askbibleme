const STORAGE_KEY = "selah-nature-home-text-scale-v1";

/** 自然首页轮播经文区域的显示比例（仅包在 `HomeVerseRotator` 外层的 `zoom`） */
export const NATURE_HOME_TEXT_SCALE_STEPS = [0.82, 0.91, 1, 1.1, 1.22] as const;

export type NatureHomeTextScaleStep = (typeof NATURE_HOME_TEXT_SCALE_STEPS)[number];

/** 对应比例 `1`（默认不缩放） */
export const NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX = 2;

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
    const parsed = JSON.parse(raw) as { stepIndex?: unknown } | unknown;
    const stepIndex =
      typeof parsed === "object" && parsed !== null && "stepIndex" in parsed
        ? (parsed as { stepIndex: unknown }).stepIndex
        : typeof parsed === "number"
          ? parsed
          : undefined;
    if (typeof stepIndex !== "number" || !Number.isFinite(stepIndex)) return NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX;
    return clampStepIndex(stepIndex);
  } catch {
    return NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX;
  }
}

export function writeNatureHomeTextScaleStepIndex(stepIndex: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ stepIndex: clampStepIndex(stepIndex) }));
  } catch {
    // ignore quota / private mode
  }
}

export function natureHomeTextScaleAtStep(stepIndex: number): NatureHomeTextScaleStep {
  return NATURE_HOME_TEXT_SCALE_STEPS[clampStepIndex(stepIndex)] ?? 1;
}
