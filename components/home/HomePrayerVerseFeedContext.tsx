"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { HOME_VERSE_FADE_MS } from "@/components/home/home-verse-constants";
import {
  getNatureHomeVerseTimingOverride,
  subscribeNatureHomeVerseTimingOverride,
} from "@/lib/home/nature-home-verse-timing-override";
import { useHomePrayerVerseFeed } from "@/components/home/useHomePrayerVerseFeed";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

export type HomePrayerVerseFeedContextValue = {
  entriesByLocale: Record<AppLocale, HomeVerseEntry[]>;
  bilingual: boolean;
  verseKeys: string[] | undefined;
  homeVerseStableMs: number;
  onVerseCommitted: (key: string) => void;
  onVerseAudioCompleted: (key: string, feedIndex: number) => void;
  onNearEnd: (index: number, total: number) => void;
  activeIndex: number;
  homeVerseVisible: boolean;
  verseAudioSequenceActive: boolean;
  setVerseAudioSequenceActive: (active: boolean) => void;
  advanceVerseNow: () => Promise<void>;
  advanceVerseAudioNow: () => void;
};

const HomePrayerVerseFeedContext = createContext<HomePrayerVerseFeedContextValue | null>(null);

export function useHomePrayerVerseFeedContext(): HomePrayerVerseFeedContextValue {
  const v = useContext(HomePrayerVerseFeedContext);
  if (!v) {
    throw new Error("useHomePrayerVerseFeedContext must be used within HomePrayerVerseFeedProvider");
  }
  return v;
}

/** 供 `HomeVerseRotator` 等：在可选「独立经文池」模式下可不依赖全站池上下文。 */
export function useOptionalHomePrayerVerseFeedContext(): HomePrayerVerseFeedContextValue | null {
  return useContext(HomePrayerVerseFeedContext);
}

type ProviderProps = {
  fallbackByLocale: Record<AppLocale, HomeVerseEntry[]>;
  children: ReactNode;
};

/**
 * 全站壳内单一经文池 + 单一轮播进度：子路由切换不另起一套 `useHomePrayerVerseFeed` 或本地下标。
 * 若已在更外层 Provider 内，本层不重复挂载（避免嵌套覆盖进度与 fallback）。
 */
export function HomePrayerVerseFeedProvider({ fallbackByLocale, children }: ProviderProps) {
  const existing = useOptionalHomePrayerVerseFeedContext();
  if (existing) {
    return <>{children}</>;
  }
  return <HomePrayerVerseFeedProviderInner fallbackByLocale={fallbackByLocale}>{children}</HomePrayerVerseFeedProviderInner>;
}

function HomePrayerVerseFeedProviderInner({ fallbackByLocale, children }: ProviderProps) {
  const { locale } = useLocale();
  const { entriesByLocale, bilingual, verseKeys, homeVerseStableMs, onVerseCommitted, onVerseAudioCompleted, onNearEnd } =
    useHomePrayerVerseFeed({
      fallbackByLocale,
      locale,
    });

  const [activeIndex, setActiveIndex] = useState(0);
  const [homeVerseVisible, setHomeVerseVisible] = useState(true);
  const [verseAudioSequenceActive, setVerseAudioSequenceActive] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const natureHomeVerseTimingOverride = useSyncExternalStore(
    subscribeNatureHomeVerseTimingOverride,
    getNatureHomeVerseTimingOverride,
    () => null,
  );
  const lastCommittedIndex = useRef(-1);
  const verseKeysSig = verseKeys?.join("\u0001") ?? "";

  const primaryLocale: AppLocale = bilingual ? "en" : locale;
  const nVerses = useMemo(() => {
    const fromServer = entriesByLocale?.[primaryLocale];
    return fromServer?.length ?? 0;
  }, [entriesByLocale, primaryLocale]);

  const nearEndIndex = Math.min(activeIndex, Math.max(0, nVerses - 1));

  const advanceVerseNow = useCallback(async () => {
    if (nVerses <= 1) return;
    const baseFadeMs = natureHomeVerseTimingOverride?.fadeMs ?? HOME_VERSE_FADE_MS;
    const fadeMs = prefersReducedMotion ? Math.min(800, baseFadeMs) : baseFadeMs;
    setHomeVerseVisible(false);
    await new Promise<void>((resolve) => window.setTimeout(resolve, fadeMs));
    setActiveIndex((i) => (i + 1) % nVerses);
    requestAnimationFrame(() => setHomeVerseVisible(true));
  }, [nVerses, natureHomeVerseTimingOverride?.fadeMs, prefersReducedMotion]);

  /** 连续听读不插入人为停顿；音频结束后立即进入固定流下一节。 */
  const advanceVerseAudioNow = useCallback(() => {
    if (nVerses <= 1) return;
    setActiveIndex((i) => (i + 1) % nVerses);
    setHomeVerseVisible(true);
  }, [nVerses]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (nVerses <= 1 || verseAudioSequenceActive) return;

    let cancelled = false;
    let tid: number | undefined;
    const baseFadeMs = natureHomeVerseTimingOverride?.fadeMs ?? HOME_VERSE_FADE_MS;
    const fadeMs = prefersReducedMotion ? Math.min(800, baseFadeMs) : baseFadeMs;

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
  }, [prefersReducedMotion, locale, bilingual, nVerses, verseKeysSig, natureHomeVerseTimingOverride?.fadeMs, homeVerseStableMs, verseAudioSequenceActive]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, nVerses - 1)));
  }, [nVerses]);

  useEffect(() => {
    setActiveIndex(0);
    setHomeVerseVisible(true);
    lastCommittedIndex.current = -1;
  }, [locale, bilingual, verseKeys?.[0]]);

  useEffect(() => {
    if (!verseKeys?.length) return;
    const prev = lastCommittedIndex.current;
    if (prev >= 0 && prev !== activeIndex) {
      const k = verseKeys[prev];
      if (k) onVerseCommitted(k);
    }
    lastCommittedIndex.current = activeIndex;
  }, [activeIndex, verseKeys, onVerseCommitted]);

  useEffect(() => {
    onNearEnd(nearEndIndex, nVerses);
  }, [nearEndIndex, nVerses, onNearEnd]);

  const value = useMemo(
    () => ({
      entriesByLocale,
      bilingual,
      verseKeys,
      homeVerseStableMs,
      onVerseCommitted,
      onVerseAudioCompleted,
      onNearEnd,
      activeIndex,
      homeVerseVisible,
      verseAudioSequenceActive,
      setVerseAudioSequenceActive,
      advanceVerseNow,
      advanceVerseAudioNow,
    }),
    [
      entriesByLocale,
      bilingual,
      verseKeys,
      homeVerseStableMs,
      onVerseCommitted,
      onVerseAudioCompleted,
      onNearEnd,
      activeIndex,
      homeVerseVisible,
      verseAudioSequenceActive,
      advanceVerseNow,
      advanceVerseAudioNow,
    ],
  );

  return <HomePrayerVerseFeedContext.Provider value={value}>{children}</HomePrayerVerseFeedContext.Provider>;
}
