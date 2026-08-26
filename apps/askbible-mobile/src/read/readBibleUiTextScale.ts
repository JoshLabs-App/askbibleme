import { StyleSheet, type StyleProp, type TextStyle } from "react-native";
import type { ReadBibleTypographyPx } from "./read-bible-typography-prefs";

/** 以读经默认档 `m`（19）为 1.0，跟经文页放大/缩小同步。 */
export function readBibleUiTextScale(px: ReadBibleTypographyPx): number {
  return Math.max(0.85, Math.min(2.8, px.verseFontSize / 19));
}

function scaleMetric(value: number, scale: number): number {
  return Math.max(1, Math.round(value * scale * 10) / 10);
}

/** 缩放样式里的 fontSize / lineHeight（其它属性原样保留）。 */
export function scaleTextStyle(
  style: StyleProp<TextStyle>,
  scale: number,
): StyleProp<TextStyle> {
  if (scale === 1 || style == null || style === false) return style;
  const flat = StyleSheet.flatten(style);
  if (!flat) return style;
  const next: TextStyle = { ...flat };
  if (typeof flat.fontSize === "number") next.fontSize = scaleMetric(flat.fontSize, scale);
  if (typeof flat.lineHeight === "number") next.lineHeight = scaleMetric(flat.lineHeight, scale);
  return next;
}
