"use client";

import { useEffect } from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import { buildReadingPlanChapterQueue } from "@/lib/read/reading-plan-chapter-queue";
import type { TodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";

type Args = {
  payload: TodayReadingPlanPayload | null;
  defaultTranslationId: string | null;
};

/** 读经首页：同步今日读经是否可点壳层播放。 */
export function useReadHomeScripturePlaybackReady({ payload, defaultTranslationId }: Args) {
  const { setReadHomeScripturePlaybackReady } = useMusicShellPlayback();

  useEffect(() => {
    const readings = payload?.day?.readings ?? [];
    const queue = readings.length ? buildReadingPlanChapterQueue(readings) : [];
    const tid = defaultTranslationId?.trim() ?? "";
    const ready =
      queue.length > 0 && Boolean(tid) && translationSupportsChapterAudio(tid);
    setReadHomeScripturePlaybackReady(ready);
    return () => setReadHomeScripturePlaybackReady(false);
  }, [defaultTranslationId, payload, setReadHomeScripturePlaybackReady]);
}
