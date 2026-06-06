import type { CSSProperties } from "react";
import type { NatureHomeVerseTextEffectV1 } from "@/lib/home/nature-home-verse-appearance-prefs";

/** 与 App `HomeVerseOverlay` `FADE_IN_MS` / `FADE_OUT_MS` 一致 */
export const NATURE_HOME_VERSE_FADE_MS = 2_000;

export const NATURE_HOME_VERSE_BODY_PX = 18;
export const NATURE_HOME_VERSE_REF_PX = 13;

type Tier = "body" | "ref";

/** 镜像 App `verseTextStyle.ts` `effectShadow` → CSS `text-shadow` */
export function natureHomeVerseVideoTextShadow(
  effect: NatureHomeVerseTextEffectV1,
  tier: Tier,
): string | undefined {
  switch (effect) {
    case "bold":
    case "barStrip":
    case "flat":
    case "classic":
      return tier === "ref" ? "0 1px 2px rgba(0,0,0,0.4)" : "0 1px 2px rgba(0,0,0,0.42)";
    case "letterpress":
      return tier === "ref" ? "0 1px 1px rgba(62,28,0,0.3)" : "0 2px 1px rgba(62,28,0,0.34)";
    case "engraved":
      return tier === "ref" ? "0 2px 2px rgba(0,0,0,0.55)" : "0 2px 8px rgba(0,0,0,0.55)";
    case "softBloom":
      return "0 1px 8px rgba(0,0,0,0.48)";
    case "insetCarved":
    default:
      return tier === "ref" ? "0 2px 2px rgba(0,0,0,0.62)" : "0 2px 10px rgba(0,0,0,0.62)";
  }
}

export function natureHomeVerseShadowStyle(
  effect: NatureHomeVerseTextEffectV1,
  tier: Tier,
  prefersReducedMotion: boolean,
): CSSProperties | undefined {
  if (prefersReducedMotion) return undefined;
  const textShadow = natureHomeVerseVideoTextShadow(effect, tier);
  return textShadow ? { textShadow } : undefined;
}

/** App `verseTypography` onVideo：副文约为正文 88% 字号 */
export function natureHomeVerseContrastStyle(
  effect: NatureHomeVerseTextEffectV1,
  prefersReducedMotion: boolean,
): CSSProperties {
  const bodyLine = Math.round(NATURE_HOME_VERSE_BODY_PX * 1.55);
  return {
    fontSize: Math.max(12, Math.round(NATURE_HOME_VERSE_BODY_PX * 0.88)),
    lineHeight: `${Math.max(16, Math.round(bodyLine * 0.9))}px`,
    color: "#FFFFFF",
    ...natureHomeVerseShadowStyle(effect, "body", prefersReducedMotion),
  };
}
