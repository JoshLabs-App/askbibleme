import { Platform } from "react-native";
import { useMemo } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";

/** 手机单列版心（与网站 `28rem` / 448px 对齐） */
export const PARCHMENT_COLUMN_MAX_WIDTH_PHONE = 448;

/** 目录/卡片略窄 */
export const PARCHMENT_CATALOG_MAX_WIDTH_PHONE = 380;

/** 平板短边下限：iPad 及同类设备铺满可用宽度 */
export const PARCHMENT_TABLET_MIN_SHORT_EDGE = 600;

/** @deprecated 使用 `PARCHMENT_COLUMN_MAX_WIDTH_PHONE` */
export const READ_PARCHMENT_PAGE_MAX_WIDTH = PARCHMENT_COLUMN_MAX_WIDTH_PHONE;

export function isParchmentFullWidthLayout(width: number, height: number): boolean {
  if (Platform.OS === "ios" && Platform.isPad) return true;
  if (width <= 0 || height <= 0) return false;
  return Math.min(width, height) >= PARCHMENT_TABLET_MIN_SHORT_EDGE;
}

export function parchmentColumnMaxWidth(
  width: number,
  height: number,
  phoneMax = PARCHMENT_COLUMN_MAX_WIDTH_PHONE,
): number | undefined {
  if (isParchmentFullWidthLayout(width, height)) return undefined;
  return phoneMax;
}

export function useParchmentColumnMaxWidth(
  phoneMax = PARCHMENT_COLUMN_MAX_WIDTH_PHONE,
): number | undefined {
  const { width, height } = useWindowDimensions();
  return useMemo(
    () => parchmentColumnMaxWidth(width, height, phoneMax),
    [width, height, phoneMax],
  );
}

export function parchmentColumnContentStyle(
  maxWidth: number | undefined,
  base: ViewStyle,
): ViewStyle {
  if (maxWidth == null) return base;
  return { ...base, maxWidth };
}
