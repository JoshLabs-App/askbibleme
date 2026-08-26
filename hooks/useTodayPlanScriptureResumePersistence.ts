import { useEffect, useRef } from "react";
import { isCuvChapterAudioEffectiveSrc, tryParseCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import { flushTodayPlanScriptureResume } from "@/lib/read/flush-today-plan-scripture-resume";
import { readPlanFlowActive } from "@/lib/read/plan-flow-session";

const FLUSH_INTERVAL_MS = 4000;

type Args = {
  playing: boolean;
  effectiveSrc: string;
  currentSec: number;
  durationSec: number;
};

/** 今日 planFlow 经文：定期与切后台时持久化播放位置（对齐 App）。 */
export function useTodayPlanScriptureResumePersistence({
  playing,
  effectiveSrc,
  currentSec,
  durationSec,
}: Args): void {
  const durationRef = useRef(durationSec);
  durationRef.current = durationSec;
  const currentSecRef = useRef(currentSec);
  currentSecRef.current = currentSec;
  const effectiveSrcRef = useRef(effectiveSrc);
  effectiveSrcRef.current = effectiveSrc;

  useEffect(() => {
    const shouldTrack = () =>
      readPlanFlowActive() && isCuvChapterAudioEffectiveSrc(effectiveSrcRef.current);

    const flush = () => {
      if (!shouldTrack()) return;
      const parsed = tryParseCuvChapterAudioEffectiveSrc(effectiveSrcRef.current.trim());
      if (!parsed) return;
      flushTodayPlanScriptureResume({
        bookId: parsed.bookId,
        chapter: parsed.chapter,
        positionSec: currentSecRef.current,
        durationSec: durationRef.current,
      });
    };

    if (!playing || !shouldTrack()) return;

    flush();
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, effectiveSrc]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (!readPlanFlowActive() || !isCuvChapterAudioEffectiveSrc(effectiveSrcRef.current)) return;
      const parsed = tryParseCuvChapterAudioEffectiveSrc(effectiveSrcRef.current.trim());
      if (!parsed) return;
      flushTodayPlanScriptureResume({
        bookId: parsed.bookId,
        chapter: parsed.chapter,
        positionSec: currentSecRef.current,
        durationSec: durationRef.current,
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}
