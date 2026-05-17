/**
 * 读经羊皮卷底图 ID（与 `read-parchment-background.css` 中 `data-read-parchment-bg` 一致）
 */
export const READ_PARCHMENT_BACKGROUND_IDS = [1, 2, 3] as const;
export type ReadParchmentBackgroundId = (typeof READ_PARCHMENT_BACKGROUND_IDS)[number];

export const READ_PARCHMENT_BACKGROUND_PATHS: Record<ReadParchmentBackgroundId, string> = {
  1: "/read/parchment-scroll-bg.webp",
  2: "/read/parchment-scroll-bg-2.png",
  3: "/read/parchment-scroll-bg-3.png",
};

/** 宽屏横卷（视口宽≥高时自动切换，非 `data-read-parchment-bg` 选项） */
export const READ_PARCHMENT_BACKGROUND_WIDE_PATH = "/read/parchment-scroll-bg-wide.webp";
export const READ_PARCHMENT_BACKGROUND_WIDE_JPG_PATH = "/read/parchment-scroll-bg-wide.jpg";

/** `html::before` 与 Samsung 兜底层共用；宽屏时由 JS / `data-read-parchment-wide` 写入横图 url() */
export const READ_PARCHMENT_BG_IMAGE_CSS_VAR = "--read-parchment-bg-image";

export const readParchmentBgImageCssValue = (wide: boolean): string =>
  wide
    ? `url("${READ_PARCHMENT_BACKGROUND_WIDE_PATH}")`
    : `url("${READ_PARCHMENT_BACKGROUND_PATHS[READ_PARCHMENT_BACKGROUND_DEFAULT]}")`;

/** 与 CSS `:root` 默认一致；日后设置页可改写入 `document.documentElement.dataset` */
export const READ_PARCHMENT_BACKGROUND_DEFAULT: ReadParchmentBackgroundId = 1;

export const READ_PARCHMENT_BACKGROUND_HTML_ATTR = "data-read-parchment-bg";

export function readParchmentBackgroundDatasetValue(id: ReadParchmentBackgroundId): string {
  return String(id);
}
