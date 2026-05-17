import type { GoldenVerseFontFamilyV1, GoldenVerseTextEffectV1 } from "@/lib/home-prayer-pools/types";

export function normalizeGoldenVerseFontFamily(raw: unknown): GoldenVerseFontFamilyV1 {
  return raw === "serif" ? "serif" : "sans";
}

const GOLDEN_TEXT_EFFECT_IDS: GoldenVerseTextEffectV1[] = [
  "engraved",
  "insetCarved",
  "flat",
  "letterpress",
  "softBloom",
];

export function normalizeGoldenVerseTextEffect(raw: unknown): GoldenVerseTextEffectV1 {
  return GOLDEN_TEXT_EFFECT_IDS.includes(raw as GoldenVerseTextEffectV1) ? (raw as GoldenVerseTextEffectV1) : "insetCarved";
}
