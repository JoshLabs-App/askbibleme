"use client";

import { HOME_VERSE_DEFAULT_STABLE_SEC } from "@/lib/home-prayer-pools/constants";

/**
 * 金句不朗读时每句停多久。固定 10 秒，和安卓 `HomeVerseController.ROTATION_MS` 一致（DECISIONS D-18）：
 * 网页原来的「停留时间」设置已撤，浏览器里存着的旧值不再读。
 */
export function useHomeVerseStableMs(): number {
  return HOME_VERSE_DEFAULT_STABLE_SEC * 1000;
}
