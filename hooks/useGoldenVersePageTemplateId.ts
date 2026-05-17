"use client";

import { useSyncExternalStore } from "react";
import {
  getGoldenVersePageTemplateClientSnapshot,
  getGoldenVersePageTemplateServerSnapshot,
  subscribeGoldenVersePageTemplate,
} from "@/lib/verse/golden-verse-page-template-prefs";
import type { GoldenVersePageTemplateId } from "@/lib/verse/golden-verse-page-templates";

/** 金句页底图模板 id：SSR / 首帧与默认一致，hydration 后同步本机偏好 */
export function useGoldenVersePageTemplateId(
  customUploadUrl: string | null,
): GoldenVersePageTemplateId {
  return useSyncExternalStore(
    subscribeGoldenVersePageTemplate,
    () => getGoldenVersePageTemplateClientSnapshot(customUploadUrl),
    () => getGoldenVersePageTemplateServerSnapshot(customUploadUrl),
  );
}
