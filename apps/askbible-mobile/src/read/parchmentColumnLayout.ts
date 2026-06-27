import { Platform } from "react-native";
import { useMemo } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";

/** 手机单列版心（与网站 `28rem` / 448px 对齐） */
export const PARCHMENT_COLUMN_MAX_WIDTH_PHONE = 448;

/** 目录/卡片略窄 */
export const PARCHMENT_CATALOG_MAX_WIDTH_PHONE = 380;

/** 平板短边下限：iPad 及同类设备铺满可用宽度 */
export const PARCHMENT_TABLET_MIN_SHORT_EDGE = 600;

/** 探索 / 章页等内容区横向内边距（手机） */
export const PARCHMENT_CONTENT_PAD_X_PHONE = 22;

/** 读经页 Scroll 横向内边距（手机） */
export const READ_PARCHMENT_PAGE_PAD_X = 20;

/** iPad 竖屏内容区内边距 */
export const PARCHMENT_CONTENT_PAD_X_TABLET = 36;

/** iPad 横屏内容区内边距 */
export const PARCHMENT_CONTENT_PAD_X_TABLET_LANDSCAPE = 48;

/** iPad 横屏宽卷轴底图下限（与网站 `READ_PARCHMENT_WIDE_MIN_WIDTH_PX` 对齐） */
export const READ_PARCHMENT_WIDE_BG_MIN_WIDTH = 768;

/** 读经章「书页」双栏下限（与网站 `useReadChapterSpreadLayout` 一致） */
export const READ_CHAPTER_SPREAD_MIN_WIDTH = 1024;

/** 向导类页面（读经计划等）在 iPad 上的版心上限 */
export const PARCHMENT_WIZARD_MAX_WIDTH_TABLET = 560;

/** @deprecated 使用 `PARCHMENT_COLUMN_MAX_WIDTH_PHONE` */
export const READ_PARCHMENT_PAGE_MAX_WIDTH = PARCHMENT_COLUMN_MAX_WIDTH_PHONE;

export function isParchmentFullWidthLayout(width: number, height: number): boolean {
  if (Platform.OS === "ios" && Platform.isPad) return true;
  if (width <= 0 || height <= 0) return false;
  return Math.min(width, height) >= PARCHMENT_TABLET_MIN_SHORT_EDGE;
}

export function isIpadParchmentLayout(width: number, height: number): boolean {
  return isParchmentFullWidthLayout(width, height);
}

/** 读经首页 iPad：旧约 / 新约并排，替代分页切换 */
export function shouldSplitTestamentCatalog(width: number, height: number): boolean {
  return isParchmentFullWidthLayout(width, height);
}

export function parchmentContentPaddingHorizontal(
  width: number,
  height: number,
  phonePad = PARCHMENT_CONTENT_PAD_X_PHONE,
): number {
  if (!isParchmentFullWidthLayout(width, height)) return phonePad;
  if (width > height && width >= READ_PARCHMENT_WIDE_BG_MIN_WIDTH) {
    return PARCHMENT_CONTENT_PAD_X_TABLET_LANDSCAPE;
  }
  return PARCHMENT_CONTENT_PAD_X_TABLET;
}

export function readPagePaddingHorizontal(width: number, height: number): number {
  if (!isParchmentFullWidthLayout(width, height)) return READ_PARCHMENT_PAGE_PAD_X;
  return parchmentContentPaddingHorizontal(width, height, READ_PARCHMENT_PAGE_PAD_X);
}

export function exploreIconGridColumns(width: number, height: number): number {
  if (!isParchmentFullWidthLayout(width, height)) return 3;
  const padX = parchmentContentPaddingHorizontal(width, height);
  const available = width - padX * 2;
  const gap = 12;
  const targetTile = 108;
  return Math.max(4, Math.min(7, Math.floor((available + gap) / (targetTile + gap))));
}

export function exploreIconGridGap(width: number, height: number): number {
  return isParchmentFullWidthLayout(width, height) ? 12 : 10;
}

export function parchmentWizardMaxWidth(width: number, height: number): number | undefined {
  if (!isParchmentFullWidthLayout(width, height)) return undefined;
  return PARCHMENT_WIZARD_MAX_WIDTH_TABLET;
}

export function shouldUseWideParchmentScrollBackground(width: number, height: number): boolean {
  return (
    isParchmentFullWidthLayout(width, height) &&
    width >= height &&
    width >= READ_PARCHMENT_WIDE_BG_MIN_WIDTH
  );
}

/** 宽屏章页：左经文 / 右讲解（与网站 `.read-chapter-open-book` 一致） */
export function shouldUseReadChapterSpreadLayout(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  if (width >= READ_CHAPTER_SPREAD_MIN_WIDTH) return true;
  if (Platform.OS === "ios" && Platform.isPad && width > height && width >= READ_PARCHMENT_WIDE_BG_MIN_WIDTH) {
    return true;
  }
  return false;
}

export function useReadChapterSpreadLayout(): boolean {
  const { width, height } = useWindowDimensions();
  return useMemo(() => shouldUseReadChapterSpreadLayout(width, height), [width, height]);
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

export function useParchmentContentPadding(
  phonePad = PARCHMENT_CONTENT_PAD_X_PHONE,
): number {
  const { width, height } = useWindowDimensions();
  return useMemo(
    () => parchmentContentPaddingHorizontal(width, height, phonePad),
    [width, height, phonePad],
  );
}

export function useReadPagePaddingHorizontal(): number {
  const { width, height } = useWindowDimensions();
  return useMemo(() => readPagePaddingHorizontal(width, height), [width, height]);
}

export function useExploreIconGridLayout(): {
  padX: number;
  cols: number;
  gap: number;
  tileW: number;
} {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const padX = parchmentContentPaddingHorizontal(width, height);
    const cols = exploreIconGridColumns(width, height);
    const gap = exploreIconGridGap(width, height);
    const contentMaxW = parchmentColumnMaxWidth(width, height, PARCHMENT_COLUMN_MAX_WIDTH_PHONE) ?? width;
    const layoutWidth = Math.min(width, contentMaxW);
    const gridWidth = layoutWidth - padX * 2;
    const tileW = Math.floor((gridWidth - gap * (cols - 1)) / cols);
    return { padX, cols, gap, tileW };
  }, [width, height]);
}
