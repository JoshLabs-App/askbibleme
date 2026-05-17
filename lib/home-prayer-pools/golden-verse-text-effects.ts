import type { GoldenVerseTextEffectV1 } from "@/lib/home-prayer-pools/types";

const MR = "motion-reduce:[text-shadow:none]";

export type GoldenVerseTextShadowTier = "primary" | "secondary" | "ref";

/**
 * 金句字面 `text-shadow` 原值（供内联 style；不依赖 Tailwind 扫描 `lib/`）。
 * `flat` 返回 `undefined`。
 */
export function goldenVerseTextShadowValue(
  effect: GoldenVerseTextEffectV1,
  tier: GoldenVerseTextShadowTier,
): string | undefined {
  switch (effect) {
    case "flat":
      return undefined;
    case "engraved":
      if (tier === "ref") {
        return "0 0.05em 0 rgba(255,238,215,0.45), 0 -0.035em 0.06em rgba(42,20,0,0.3)";
      }
      if (tier === "secondary") {
        return "0 0.06em 0 rgba(255,238,215,0.5), 0 -0.04em 0.07em rgba(42,20,0,0.32), 0 0.08em 0.16em rgba(42,20,0,0.11)";
      }
      return "0 0.06em 0 rgba(255,238,215,0.52), 0 -0.045em 0.08em rgba(42,20,0,0.34), 0 0.1em 0.2em rgba(42,20,0,0.12)";
    case "insetCarved":
      if (tier === "ref") {
        return "0 0.04em 0 rgba(255,248,235,0.55), 0 -0.04em 0.1em rgba(18,6,0,0.48), 0 0.06em 0.1em rgba(55,26,0,0.22), 0 0 2px rgba(62,28,0,0.28)";
      }
      if (tier === "secondary") {
        return "0 0.055em 0 rgba(255,245,228,0.5), 0 -0.05em 0.11em rgba(22,8,0,0.5), 0 0.08em 0.14em rgba(48,22,0,0.2), 0 0 3px rgba(62,28,0,0.22)";
      }
      return "0 0.065em 0 rgba(255,245,228,0.58), 0 -0.055em 0.12em rgba(20,7,0,0.56), 0 0.1em 0.16em rgba(50,22,0,0.2), 0 0 4px rgba(62,28,0,0.26)";
    case "letterpress":
      if (tier === "ref") {
        return "0 1px 0 rgba(255,248,236,0.42), 0 1px 1px rgba(62,28,0,0.28)";
      }
      if (tier === "secondary") {
        return "0 1px 0 rgba(255,248,236,0.46), 0 1px 1px rgba(62,28,0,0.3)";
      }
      return "0 1px 0 rgba(255,248,236,0.5), 0 2px 1px rgba(62,28,0,0.32)";
    case "softBloom":
      if (tier === "ref") {
        return "0 0 0.35em rgba(139,90,43,0.14), 0 0.05em 0.12em rgba(62,28,0,0.1)";
      }
      if (tier === "secondary") {
        return "0 0 0.45em rgba(139,90,43,0.15), 0 0.06em 0.16em rgba(62,28,0,0.11)";
      }
      return "0 0 0.55em rgba(139,90,43,0.16), 0 0.08em 0.2em rgba(62,28,0,0.12)";
    default:
      return goldenVerseTextShadowValue("insetCarved", tier);
  }
}

/**
 * 金句专页字效：以多层 `text-shadow` 模拟阳刻、阴刻内凹、铅印等。
 * 优先用 `goldenVerseTextShadowValue` + 内联 style；本函数保留给自然首页等仍走 class 的路径。
 */
export function goldenVerseTextShadowClass(effect: GoldenVerseTextEffectV1, tier: GoldenVerseTextShadowTier): string {
  const value = goldenVerseTextShadowValue(effect, tier);
  if (!value) return MR;
  const escaped = value.replace(/ /g, "_");
  return `[text-shadow:${escaped}] ${MR}`;
}
