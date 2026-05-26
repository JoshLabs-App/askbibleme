import type { GoldenVerseFontFamilyV1, GoldenVerseTextEffectV1 } from "@/lib/home-prayer-pools/types";
import {
  normalizeGoldenVerseFontFamily,
  normalizeGoldenVerseTextEffect,
} from "@/lib/home-prayer-pools/golden-verse-normalize";

const STORAGE_KEY = "askbible-nature-home-verse-appearance-v1";
const STORAGE_KEY_LEGACY = "selah-nature-home-verse-appearance-v1";

/** 同标签页内自然首页经文外观变更（字体 / 字面） */
export const NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT = "selah:nature-home-verse-appearance-updated";

/** 金句字面 id + 自然首页专有「早期首页原版」 */
export type NatureHomeVerseTextEffectV1 = GoldenVerseTextEffectV1 | "classic";

export type NatureHomeVerseAppearanceV1 = {
  version: 1;
  fontFamily: GoldenVerseFontFamilyV1;
  textEffect: NatureHomeVerseTextEffectV1;
};

export function normalizeNatureHomeVerseTextEffect(raw: unknown): NatureHomeVerseTextEffectV1 {
  if (raw === "classic") return "classic";
  return normalizeGoldenVerseTextEffect(raw);
}

/** 首页金句固定：无衬线 + 铅印轻压；不在设置中切换 */
export const DEFAULT_NATURE_HOME_VERSE_APPEARANCE: NatureHomeVerseAppearanceV1 = {
  version: 1,
  fontFamily: "sans",
  textEffect: "letterpress",
};

export function readNatureHomeVerseAppearance(): NatureHomeVerseAppearanceV1 {
  if (typeof window === "undefined") return DEFAULT_NATURE_HOME_VERSE_APPEARANCE;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw?.trim()) return DEFAULT_NATURE_HOME_VERSE_APPEARANCE;
    const p = JSON.parse(raw) as Partial<NatureHomeVerseAppearanceV1>;
    if (p?.version !== 1) return DEFAULT_NATURE_HOME_VERSE_APPEARANCE;
    return {
      version: 1,
      fontFamily: "sans",
      textEffect: "letterpress",
    };
  } catch {
    return DEFAULT_NATURE_HOME_VERSE_APPEARANCE;
  }
}

export function writeNatureHomeVerseAppearance(next: NatureHomeVerseAppearanceV1): void {
  if (typeof window === "undefined") return;
  try {
    const normalized: NatureHomeVerseAppearanceV1 = {
      version: 1,
      fontFamily: "sans",
      textEffect: "letterpress",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.removeItem(STORAGE_KEY_LEGACY);
    window.dispatchEvent(new Event(NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}
