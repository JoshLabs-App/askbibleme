import {
  READ_PARCHMENT_BG_IMAGE_CSS_VAR,
  readParchmentBgImageCssValue,
} from "@/lib/read/read-parchment-background";
import {
  SCRIPTURE_PARCHMENT_WIDE_DATASET_KEY,
  SCRIPTURE_PARCHMENT_WIDE_DATASET_VALUE,
  SCRIPTURE_PARCHMENT_WIDE_MEDIA,
} from "@/lib/read/scripture-parchment-shell";
import { isNarrowParchmentPath } from "@/lib/shell/narrow-parchment-shell";

/** 与 `read-parchment-shell-chrome.css` 宽屏规则一致：宽 ≥ 高且足够宽 */
export const READ_PARCHMENT_WIDE_MIN_WIDTH_PX = 480;

/** 与 `useReadChapterSpreadLayout` / 章页双栏一致 */
export const READ_CHAPTER_SPREAD_MIN_WIDTH_PX = 1024;

export const READ_PARCHMENT_WIDE_MEDIA = SCRIPTURE_PARCHMENT_WIDE_MEDIA;

export function isReadChapterPath(pathname: string): boolean {
  return /^\/read\/[^/]+\/\d+\/?$/.test(pathname);
}

export function isReadParchmentWideViewport(
  width = typeof window !== "undefined" ? window.innerWidth : 0,
  height = typeof window !== "undefined" ? window.innerHeight : 0,
): boolean {
  return width >= READ_PARCHMENT_WIDE_MIN_WIDTH_PX && width >= height && height > 0;
}

/** 读经章双栏（≥1024px）用横卷底图，避免竖图被拉满宽屏 */
export function shouldUseReadParchmentWideBackground(
  width = typeof window !== "undefined" ? window.innerWidth : 0,
  height = typeof window !== "undefined" ? window.innerHeight : 0,
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (isNarrowParchmentPath(p)) return false;
  if (isReadChapterPath(pathname) && width >= READ_CHAPTER_SPREAD_MIN_WIDTH_PX) {
    return true;
  }
  return isReadParchmentWideViewport(width, height);
}

export function clearReadParchmentWideDataset(root: HTMLElement = document.documentElement): void {
  Reflect.deleteProperty(root.dataset, SCRIPTURE_PARCHMENT_WIDE_DATASET_KEY);
  root.style.removeProperty(READ_PARCHMENT_BG_IMAGE_CSS_VAR);
}

export function syncReadParchmentWideDataset(root: HTMLElement = document.documentElement): void {
  if (shouldUseReadParchmentWideBackground()) {
    root.dataset[SCRIPTURE_PARCHMENT_WIDE_DATASET_KEY] = SCRIPTURE_PARCHMENT_WIDE_DATASET_VALUE;
    root.style.setProperty(READ_PARCHMENT_BG_IMAGE_CSS_VAR, readParchmentBgImageCssValue(true));
  } else {
    clearReadParchmentWideDataset(root);
  }
}

export function subscribeReadParchmentWideViewport(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(READ_PARCHMENT_WIDE_MEDIA);
  const onMq = () => onChange();
  if (mq.addEventListener) mq.addEventListener("change", onMq);
  else mq.addListener(onMq);
  window.addEventListener("resize", onMq);
  window.visualViewport?.addEventListener("resize", onMq);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener("change", onMq);
    else mq.removeListener(onMq);
    window.removeEventListener("resize", onMq);
    window.visualViewport?.removeEventListener("resize", onMq);
  };
}
