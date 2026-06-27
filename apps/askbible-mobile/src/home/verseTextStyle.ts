import { Platform, type TextStyle } from "react-native";
import { parchmentSans, parchmentSerif } from "../fonts/parchmentType";
import type { NatureHomeVerseAppearance, NatureHomeVerseTextEffect } from "./natureHomePrefs";

type Tier = "body" | "ref";

const VIDEO_BODY_COLOR = "#FFFFFF";
const VIDEO_REF_COLOR = "#FFFFFF";

/**
 * 网站 `HomeVerseRotator` nhLegacyDefault（classic / flat）：
 * `0 1px 2px rgba(0,0,0,0.38), 0 2px 14px rgba(0,0,0,0.22)`。
 * RN 仅一层：用贴字、小 radius 模拟第一层，避免大 radius 在 iOS 上变成「黑条底衬」。
 */
function natureHomeClassicOnVideoShadow(tier: Tier): TextStyle {
  if (tier === "ref") {
    return {
      textShadowColor: "rgba(0,0,0,0.4)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    };
  }
  return {
    textShadowColor: "rgba(0,0,0,0.42)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  };
}

/** 对齐 `goldenVerseTextShadowValue` letterpress（铅印轻压，非光晕底衬） */
function letterpressOnVideoShadow(tier: Tier): TextStyle {
  if (tier === "ref") {
    return {
      textShadowColor: "rgba(62,28,0,0.3)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    };
  }
  return {
    textShadowColor: "rgba(62,28,0,0.34)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1,
  };
}

/** 设置里图标预览：与视频上正文同套阴影 */
export function verseEffectOnVideoPreviewStyle(effect: NatureHomeVerseTextEffect): TextStyle {
  const barStripPreview =
    effect === "barStrip"
      ? {
          backgroundColor: "rgba(0,0,0,0.34)",
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderRadius: 3,
          overflow: "hidden" as const,
        }
      : null;
  return {
    fontSize: 15,
    lineHeight: 18,
    color: VIDEO_BODY_COLOR,
    ...androidBoldFallback(700, parchmentSans(700)),
    ...(effect === "bold" ? { fontWeight: "900" as const } : null),
    ...(barStripPreview ?? null),
    ...effectShadow(effect, "body"),
  };
}

function effectShadow(effect: NatureHomeVerseTextEffect, tier: Tier): TextStyle {
  switch (effect) {
    case "bold":
      return natureHomeClassicOnVideoShadow(tier);
    case "barStrip":
      return natureHomeClassicOnVideoShadow(tier);
    case "flat":
    case "classic":
      return natureHomeClassicOnVideoShadow(tier);
    case "letterpress":
      return letterpressOnVideoShadow(tier);
    case "engraved":
      return {
        textShadowColor: "rgba(0,0,0,0.55)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: tier === "body" ? 8 : 2,
      };
    case "softBloom":
      return {
        textShadowColor: "rgba(0,0,0,0.48)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
      };
    case "insetCarved":
    default:
      return {
        textShadowColor: "rgba(0,0,0,0.62)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: tier === "body" ? 10 : 2,
      };
  }
}

function homeVerseFont(
  kind: NatureHomeVerseAppearance["fontFamily"],
  weight: 500 | 600 | 700,
): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  if (kind === "serif" && Platform.OS !== "android") {
    return { fontFamily: "Georgia", fontWeight: String(weight) as TextStyle["fontWeight"] };
  }
  if (kind === "serif") {
    const base = parchmentSerif(weight === 700 ? 600 : (weight as 500 | 600));
    return androidBoldFallback(weight, base);
  }
  return androidBoldFallback(weight, parchmentSans(weight));
}

/** Android 仅加载 Regular/Medium 时，用合成粗体贴近 iOS / Web `font-bold` */
function androidBoldFallback(
  weight: 500 | 600 | 700,
  base: Pick<TextStyle, "fontFamily" | "fontWeight">,
): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  if (Platform.OS === "android" && weight >= 600) {
    return { ...base, fontWeight: "700" };
  }
  return base;
}

export function verseTypography(
  appearance: NatureHomeVerseAppearance,
  scale: number,
  variant: "onVideo" | "onLight" = "onVideo",
): { body: TextStyle; ref: TextStyle } {
  const baseSize = Math.round(18 * scale);
  const refSize = Math.round(13 * scale);
  const onLight = variant === "onLight";
  const onVideo = !onLight;
  /** 与网站 `HomeVerseRotator` 自然首页 `font-bold` 一致 */
  const bodyFont = homeVerseFont(appearance.fontFamily, 700);
  const refFont = homeVerseFont(appearance.fontFamily, 700);
  const boldFx = appearance.textEffect === "bold";

  return {
    body: {
      fontSize: baseSize,
      lineHeight: Math.round(baseSize * 1.55),
      color: onLight
        ? "rgba(30, 41, 59, 0.94)"
        : VIDEO_BODY_COLOR,
      textAlign: "center",
      letterSpacing: onVideo ? 0 : 0,
      ...bodyFont,
      ...(boldFx ? { fontWeight: "900" } : null),
      ...(onLight
        ? { textShadowColor: "transparent", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0 }
        : effectShadow(appearance.textEffect, "body")),
    },
    ref: {
      fontSize: refSize,
      lineHeight: Math.round(refSize * 1.45),
      color: onLight
        ? "rgba(51, 65, 85, 0.82)"
        : VIDEO_REF_COLOR,
      textAlign: "center",
      marginTop: Math.round(12 * scale),
      letterSpacing: onVideo ? 0 : 0.1,
      ...refFont,
      ...(boldFx ? { fontWeight: "900" } : null),
      ...(onLight
        ? { textShadowColor: "transparent", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0 }
        : effectShadow(appearance.textEffect, "ref")),
    },
  };
}
