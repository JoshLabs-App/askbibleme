"use client";

import { useSyncExternalStore } from "react";

/** 读经章「书页」双栏：仅网站版章页，宽屏左经文 / 右讲解+发现 */
export const READ_CHAPTER_SPREAD_MEDIA = "(min-width: 1024px)";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(READ_CHAPTER_SPREAD_MEDIA);
  const onMq = () => onStoreChange();
  if (mq.addEventListener) mq.addEventListener("change", onMq);
  else mq.addListener(onMq);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener("change", onMq);
    else mq.removeListener(onMq);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(READ_CHAPTER_SPREAD_MEDIA).matches;
}

export function useReadChapterSpreadLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
