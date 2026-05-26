const STORAGE_KEY = "askbible-golden-verse-text-scale-v1";
const STORAGE_KEY_LEGACY = "selah-golden-verse-text-scale-v1";
const STORAGE_SCHEMA_V1 = 1 as const;

/** 金句专页经文 `zoom`：比自然首页更宽（约 0.35×–10×） */
function buildGoldenVerseTextScaleSteps(): readonly number[] {
  const raw: number[] = [];
  for (let x = 35; x <= 100; x += 5) raw.push(x / 100);
  for (let x = 108; x <= 200; x += 6) raw.push(Math.round(x) / 100);
  for (let x = 21; x <= 40; x += 1) raw.push(x / 10);
  for (let x = 42; x <= 70; x += 2) raw.push(x / 10);
  for (let x = 72; x <= 100; x += 2) raw.push(x / 10);
  const sorted = [...new Set(raw.map((n) => Math.round(n * 1000) / 1000))].sort((a, b) => a - b);
  return sorted as readonly number[];
}

export const GOLDEN_VERSE_TEXT_SCALE_STEPS = buildGoldenVerseTextScaleSteps();

export type GoldenVerseTextScaleStep = (typeof GOLDEN_VERSE_TEXT_SCALE_STEPS)[number];

export const GOLDEN_VERSE_TEXT_SCALE_DEFAULT_STEP_INDEX = Math.max(
  0,
  GOLDEN_VERSE_TEXT_SCALE_STEPS.findIndex((s) => s === 1),
);

export const GOLDEN_VERSE_TEXT_SCALE_UPDATED_EVENT = "selah:golden-verse-text-scale-updated";

function clampStepIndex(n: number): number {
  if (!Number.isFinite(n)) return GOLDEN_VERSE_TEXT_SCALE_DEFAULT_STEP_INDEX;
  const i = Math.round(n);
  return Math.min(GOLDEN_VERSE_TEXT_SCALE_STEPS.length - 1, Math.max(0, i));
}

export function readGoldenVerseTextScaleStepIndex(): number {
  if (typeof window === "undefined") return GOLDEN_VERSE_TEXT_SCALE_DEFAULT_STEP_INDEX;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw?.trim()) return GOLDEN_VERSE_TEXT_SCALE_DEFAULT_STEP_INDEX;
    const p = JSON.parse(raw) as { v?: unknown; stepIndex?: unknown };
    if (p?.v !== STORAGE_SCHEMA_V1 || typeof p.stepIndex !== "number") {
      return GOLDEN_VERSE_TEXT_SCALE_DEFAULT_STEP_INDEX;
    }
    return clampStepIndex(p.stepIndex);
  } catch {
    return GOLDEN_VERSE_TEXT_SCALE_DEFAULT_STEP_INDEX;
  }
}

export function writeGoldenVerseTextScaleStepIndex(stepIndex: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: STORAGE_SCHEMA_V1, stepIndex: clampStepIndex(stepIndex) }),
    );
    localStorage.removeItem(STORAGE_KEY_LEGACY);
    window.dispatchEvent(new Event(GOLDEN_VERSE_TEXT_SCALE_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function goldenVerseTextScaleAtStep(stepIndex: number): GoldenVerseTextScaleStep {
  return GOLDEN_VERSE_TEXT_SCALE_STEPS[clampStepIndex(stepIndex)] ?? 1;
}

export function subscribeGoldenVerseTextScale(onStoreChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === STORAGE_KEY_LEGACY) onStoreChange();
  };
  window.addEventListener(GOLDEN_VERSE_TEXT_SCALE_UPDATED_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(GOLDEN_VERSE_TEXT_SCALE_UPDATED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getGoldenVerseTextScaleClientSnapshot(): number {
  return readGoldenVerseTextScaleStepIndex();
}

export function getGoldenVerseTextScaleServerSnapshot(): number {
  return GOLDEN_VERSE_TEXT_SCALE_DEFAULT_STEP_INDEX;
}
