import type { GoldenVerseTextEffectV1 } from "@/lib/home-prayer-pools/types";

const MR = "motion-reduce:[text-shadow:none]";

/**
 * 金句专页字效：以多层 `text-shadow` 模拟阳刻、阴刻内凹、铅印等（CSS 无真 inset text-shadow）。
 * `ref` / `secondary` 用略弱的一层，避免脚注过重。
 */
export function goldenVerseTextShadowClass(effect: GoldenVerseTextEffectV1, tier: "primary" | "secondary" | "ref"): string {
  switch (effect) {
    case "flat":
      return MR;
    case "engraved":
      if (tier === "ref") {
        return `[text-shadow:0_0.05em_0_rgba(255,238,215,0.45),0_-0.035em_0.06em_rgba(42,20,0,0.3)] ${MR}`;
      }
      if (tier === "secondary") {
        return `[text-shadow:0_0.06em_0_rgba(255,238,215,0.5),0_-0.04em_0.07em_rgba(42,20,0,0.32),0_0.08em_0.16em_rgba(42,20,0,0.11)] ${MR}`;
      }
      return `[text-shadow:0_0.06em_0_rgba(255,238,215,0.52),0_-0.045em_0.08em_rgba(42,20,0,0.34),0_0.1em_0.2em_rgba(42,20,0,0.12)] ${MR}`;
    case "insetCarved": {
      /** 阴刻内凹：顶缘高光 + 字形内上沿深色「吃进去」+ 底缘轻托起 */
      if (tier === "ref") {
        return `[text-shadow:0_0.04em_0_rgba(255,248,235,0.55),0_-0.04em_0.1em_rgba(18,6,0,0.48),0_0.06em_0.1em_rgba(55,26,0,0.22),0_0_2px_rgba(62,28,0,0.28)] ${MR}`;
      }
      if (tier === "secondary") {
        return `[text-shadow:0_0.055em_0_rgba(255,245,228,0.5),0_-0.05em_0.11em_rgba(22,8,0,0.5),0_0.08em_0.14em_rgba(48,22,0,0.2),0_0_3px_rgba(62,28,0,0.22)] ${MR}`;
      }
      return `[text-shadow:0_0.065em_0_rgba(255,245,228,0.58),0_-0.055em_0.12em_rgba(20,7,0,0.56),0_0.1em_0.16em_rgba(50,22,0,0.2),0_0_4px_rgba(62,28,0,0.26)] ${MR}`;
    }
    case "letterpress":
      if (tier === "ref") {
        return `[text-shadow:0_1px_0_rgba(255,248,236,0.42),0_1px_1px_rgba(62,28,0,0.28)] ${MR}`;
      }
      if (tier === "secondary") {
        return `[text-shadow:0_1px_0_rgba(255,248,236,0.46),0_1px_1px_rgba(62,28,0,0.3)] ${MR}`;
      }
      return `[text-shadow:0_1px_0_rgba(255,248,236,0.5),0_2px_1px_rgba(62,28,0,0.32)] ${MR}`;
    case "softBloom":
      if (tier === "ref") {
        return `[text-shadow:0_0_0.35em_rgba(139,90,43,0.14),0_0.05em_0.12em_rgba(62,28,0,0.1)] ${MR}`;
      }
      if (tier === "secondary") {
        return `[text-shadow:0_0_0.45em_rgba(139,90,43,0.15),0_0.06em_0.16em_rgba(62,28,0,0.11)] ${MR}`;
      }
      return `[text-shadow:0_0_0.55em_rgba(139,90,43,0.16),0_0.08em_0.2em_rgba(62,28,0,0.12)] ${MR}`;
    default:
      return goldenVerseTextShadowClass("engraved", tier);
  }
}
