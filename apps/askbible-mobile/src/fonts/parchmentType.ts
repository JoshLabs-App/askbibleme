import type { TextStyle } from "react-native";

/** 与 iOS / 网站样式表一致的逻辑字重 */
export type ParchmentLogicalWeight = 400 | 500 | 600 | 700;

/**
 * 羊皮卷 / 读经 UI：
 * - 为避免个别汉字在 Android 自带字库中缺失，统一交给系统字体回退链
 * - 各平台都仅使用逻辑字重，不再锁定单一 fontFamily
 */
export function parchmentSans(weight: ParchmentLogicalWeight = 500): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  const w = String(weight) as TextStyle["fontWeight"];
  return { fontWeight: w };
}

/** 首页经文衬线选项等 */
export function parchmentSerif(weight: ParchmentLogicalWeight = 500): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  const w = String(weight) as TextStyle["fontWeight"];
  return { fontWeight: w };
}
