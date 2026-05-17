"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  GOLDEN_VERSE_TEXT_SCALE_STEPS,
  getGoldenVerseTextScaleClientSnapshot,
  getGoldenVerseTextScaleServerSnapshot,
  goldenVerseTextScaleAtStep,
  readGoldenVerseTextScaleStepIndex,
  subscribeGoldenVerseTextScale,
  writeGoldenVerseTextScaleStepIndex,
} from "@/lib/verse/golden-verse-text-scale-prefs";

export function useGoldenVerseTextScale() {
  const stepIndex = useSyncExternalStore(
    subscribeGoldenVerseTextScale,
    getGoldenVerseTextScaleClientSnapshot,
    getGoldenVerseTextScaleServerSnapshot,
  );

  const zoom = goldenVerseTextScaleAtStep(stepIndex);
  const atMin = stepIndex <= 0;
  const atMax = stepIndex >= GOLDEN_VERSE_TEXT_SCALE_STEPS.length - 1;

  const bump = useCallback((delta: 1 | -1) => {
    const current = readGoldenVerseTextScaleStepIndex();
    const next = Math.min(GOLDEN_VERSE_TEXT_SCALE_STEPS.length - 1, Math.max(0, current + delta));
    if (next !== current) writeGoldenVerseTextScaleStepIndex(next);
  }, []);

  return {
    stepIndex,
    zoom,
    atMin,
    atMax,
    onSmaller: () => bump(-1),
    onLarger: () => bump(1),
  };
}
