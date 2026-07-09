"use client";

import { useEffect, useState } from "react";
import { HOME_VERSE_FADE_MS } from "@/components/home/home-verse-constants";
import { useHomeVerseStableMs } from "@/components/home/useHomeVerseStableMs";

type Args = {
  enabled: boolean;
  nVerses: number;
  /** 语言或双语切换时重置到首节 */
  resetKey: string;
};

/**
 * 与 `HomePrayerVerseFeedProviderInner` 同节奏：稳定展示 → 淡出 → 换下一句 → 淡入。
 * 仅用于「独立经文列表」场景（如 `/read` 论圣经经文），与全站祷告经文池进度无关。
 */
export function useStandaloneVerseCarousel({ enabled, nVerses, resetKey }: Args) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [homeVerseVisible, setHomeVerseVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const homeVerseStableMs = useHomeVerseStableMs();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setActiveIndex(0);
    setHomeVerseVisible(true);
  }, [enabled, resetKey]);

  useEffect(() => {
    if (!enabled) return;
    setActiveIndex((i) => Math.min(i, Math.max(0, nVerses - 1)));
  }, [enabled, nVerses]);

  useEffect(() => {
    if (!enabled) return;
    if (nVerses <= 1) return;

    let cancelled = false;
    let tid: number | undefined;
    const fadeMs = prefersReducedMotion ? Math.min(800, HOME_VERSE_FADE_MS) : HOME_VERSE_FADE_MS;

    const step = () => {
      tid = window.setTimeout(() => {
        if (cancelled) return;
        setHomeVerseVisible(false);
        tid = window.setTimeout(() => {
          if (cancelled) return;
          setActiveIndex((i) => (i + 1) % nVerses);
          requestAnimationFrame(() => setHomeVerseVisible(true));
          tid = window.setTimeout(step, fadeMs + homeVerseStableMs);
        }, fadeMs);
      }, homeVerseStableMs);
    };

    step();
    return () => {
      cancelled = true;
      if (tid !== undefined) window.clearTimeout(tid);
    };
  }, [enabled, prefersReducedMotion, nVerses, resetKey, homeVerseStableMs]);

  return { activeIndex, homeVerseVisible };
}
