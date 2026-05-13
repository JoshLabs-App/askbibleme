"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HOME_VERSE_FADE_MS, HOME_VERSE_STABLE_MS } from "@/components/home/home-verse-constants";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { HOME_VERSES_BY_LOCALE } from "@/lib/i18n/home-verses";

type Props = {
  /**
   * 若由服务端从译本解析好，则优先使用（按界面语言切换）；
   * 未传时回落到 `HOME_VERSES_BY_LOCALE` 硬编码。
   */
  entriesByLocale?: Record<AppLocale, HomeVerseEntry[]>;
  /** 与 `entriesByLocale` 同索引展示另一语（须两语数组对齐） */
  bilingual?: boolean;
  /** 与 `entriesByLocale` 对齐；用于复习进度写入 */
  verseKeys?: string[];
  onVerseCommitted?: (verseKey: string) => void;
  onNearEnd?: (index: number, total: number) => void;
  /** 深色底（音乐首页）或浅色底（旧首页氛围） */
  variant?: "dark" | "light";
  /** default：中部轮播；hero：音乐播放首页主标题区大字；relax：放松页较大读经区；nature：自然页全屏视频上，对比更强 */
  prominence?: "default" | "hero" | "relax" | "nature";
  className?: string;
};

/**
 * 首页经文轮播：与原先 `HomeDashboard` 同节奏与淡出逻辑。
 */
export function HomeVerseRotator({
  entriesByLocale,
  bilingual = false,
  verseKeys,
  onVerseCommitted,
  onNearEnd,
  variant = "dark",
  prominence = "default",
  className = "",
}: Props) {
  const { locale } = useLocale();
  /** 双语时固定「英文大在上、中文小在下」；单语时随界面语言。 */
  const primaryLocale: AppLocale = bilingual ? "en" : locale;
  const secondaryLocale: AppLocale | null = bilingual ? "zh-CN" : null;
  const HOME_VERSES = useMemo(() => {
    const fromServer = entriesByLocale?.[primaryLocale];
    if (fromServer && fromServer.length > 0) return fromServer;
    return HOME_VERSES_BY_LOCALE[primaryLocale];
  }, [entriesByLocale, primaryLocale]);
  const SECONDARY_VERSES = useMemo(() => {
    if (!secondaryLocale || !entriesByLocale) return null;
    const o = entriesByLocale[secondaryLocale];
    return o && o.length === HOME_VERSES.length ? o : null;
  }, [bilingual, entriesByLocale, secondaryLocale, HOME_VERSES.length]);
  const isDark = variant === "dark";
  const isHero = prominence === "hero";
  const isRelax = prominence === "relax";
  const isNature = prominence === "nature";
  const [homeVerseIndex, setHomeVerseIndex] = useState(0);
  const [homeVerseVisible, setHomeVerseVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const lastCommittedIndex = useRef(-1);
  const verseKeysSig = verseKeys?.join("\u0001") ?? "";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const n = HOME_VERSES.length;
    if (n <= 1) return;

    if (prefersReducedMotion) {
      const id = window.setInterval(() => {
        setHomeVerseIndex((i) => (i + 1) % n);
      }, HOME_VERSE_STABLE_MS);
      return () => window.clearInterval(id);
    }

    let cancelled = false;
    let tid: number | undefined;

    const step = () => {
      tid = window.setTimeout(() => {
        if (cancelled) return;
        setHomeVerseVisible(false);
        tid = window.setTimeout(() => {
          if (cancelled) return;
          setHomeVerseIndex((i) => (i + 1) % n);
          requestAnimationFrame(() => setHomeVerseVisible(true));
          tid = window.setTimeout(step, HOME_VERSE_FADE_MS + HOME_VERSE_STABLE_MS);
        }, HOME_VERSE_FADE_MS);
      }, HOME_VERSE_STABLE_MS);
    };

    step();
    return () => {
      cancelled = true;
      if (tid !== undefined) window.clearTimeout(tid);
    };
  }, [prefersReducedMotion, locale, bilingual, HOME_VERSES.length, entriesByLocale]);

  useEffect(() => {
    setHomeVerseIndex(0);
    setHomeVerseVisible(true);
    lastCommittedIndex.current = -1;
  }, [locale, verseKeysSig, bilingual]);

  useEffect(() => {
    if (!verseKeys?.length || !onVerseCommitted) return;
    const prev = lastCommittedIndex.current;
    if (prev >= 0 && prev !== homeVerseIndex) {
      const k = verseKeys[prev];
      if (k) onVerseCommitted(k);
    }
    lastCommittedIndex.current = homeVerseIndex;
  }, [homeVerseIndex, verseKeys, onVerseCommitted]);

  useEffect(() => {
    onNearEnd?.(homeVerseIndex, HOME_VERSES.length);
  }, [homeVerseIndex, HOME_VERSES.length, onNearEnd]);

  const lineClass = (() => {
    /** 双语时英文主文：行距空隙减半 `1 + (L-1)/2` */
    const L = (loose: number, tight: string) => (bilingual ? tight : `leading-[${loose}]`);
    if (isHero) {
      return isDark
        ? `m-0 font-serif text-[clamp(1.12rem,2.85vw+0.22rem,1.82rem)] font-medium ${L(1.22, "leading-[1.11]")} tracking-[0.028em] text-white/[0.92] drop-shadow-sm transition-colors duration-200 group-hover:text-white/[0.96]`
        : `m-0 font-serif text-[clamp(1.12rem,2.85vw+0.22rem,1.82rem)] font-medium ${L(1.22, "leading-[1.11]")} tracking-[0.028em] text-ink/88 transition-colors duration-200 group-hover:text-ink/92`;
    }
    if (isNature) {
      return isDark
        ? `m-0 font-sans text-[clamp(1.04rem,3.85vw+0.16rem,1.34rem)] font-medium ${L(1.46, "leading-[1.23]")} tracking-[0.018em] text-white/[0.96] [text-shadow:0_1px_2px_rgba(0,0,0,0.38),0_2px_14px_rgba(0,0,0,0.22)] [@media(max-height:500px)_and_(orientation:portrait)]:text-[clamp(0.95rem,3.2vw+0.12rem,1.12rem)] [@media(max-height:500px)_and_(orientation:portrait)]:${L(1.4, "leading-[1.2]")}`
        : `m-0 font-sans text-[clamp(1.02rem,3.6vw+0.14rem,1.28rem)] font-medium ${L(1.46, "leading-[1.23]")} tracking-[0.02em] text-ink/90`;
    }
    if (isRelax) {
      return isDark
        ? `m-0 font-serif text-[clamp(1.02rem,3.6vw+0.15rem,1.32rem)] font-medium ${L(1.68, "leading-[1.34]")} tracking-[0.032em] text-white/[0.9] drop-shadow-[0_2px_12px_rgba(0,0,0,0.42)]`
        : `m-0 font-serif text-[clamp(1.02rem,3.6vw+0.15rem,1.32rem)] font-medium ${L(1.68, "leading-[1.34]")} tracking-[0.026em] text-ink/85`;
    }
    return isDark
      ? `m-0 font-serif text-[clamp(0.95rem,3.2vw,1.18rem)] font-medium ${L(1.55, "leading-[1.275]")} tracking-[0.02em] text-white/[0.88] drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]`
      : `m-0 font-serif text-[clamp(0.98rem,3.4vw,1.22rem)] font-medium ${L(1.55, "leading-[1.275]")} tracking-[0.02em] text-ink/86`;
  })();

  const secondaryLineClass = (() => {
    const S = (tight: string, normal: string) => (bilingual ? tight : normal);
    if (isNature) {
      return isDark
        ? `m-0 font-sans text-[clamp(0.88rem,3.1vw+0.1rem,1.05rem)] font-semibold ${S("leading-[1.26]", "leading-[1.42]")} tracking-[0.015em] text-white/[0.88] [text-shadow:0_1px_2px_rgba(0,0,0,0.42),0_1px_10px_rgba(0,0,0,0.22)]`
        : `m-0 font-sans text-[clamp(0.88rem,3vw+0.1rem,1.04rem)] font-semibold ${S("leading-[1.26]", "leading-[1.42]")} text-ink/80`;
    }
    if (isRelax) {
      return isDark
        ? `m-0 font-serif text-[clamp(0.9rem,3.1vw+0.08rem,1.08rem)] font-semibold ${S("leading-[1.38]", "leading-[1.58]")} tracking-[0.028em] text-white/[0.86] drop-shadow-[0_1px_8px_rgba(0,0,0,0.38)]`
        : `m-0 font-serif text-[clamp(0.9rem,3.1vw+0.08rem,1.08rem)] font-semibold ${S("leading-[1.38]", "leading-[1.58]")} tracking-[0.026em] text-ink/78`;
    }
    return isDark
      ? `m-0 font-serif text-[clamp(0.86rem,2.9vw,1.02rem)] font-semibold ${S("leading-[1.32]", "leading-[1.5]")} text-white/[0.84] drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]`
      : `m-0 font-serif text-[clamp(0.86rem,2.9vw,1.02rem)] font-semibold ${S("leading-[1.32]", "leading-[1.5]")} text-ink/76`;
  })();

  const refClass = (() => {
    if (isHero) {
      return isDark
        ? "mt-3 text-[10px] font-medium tracking-[0.16em] text-white/46 sm:mt-3.5 sm:text-[11px] sm:tracking-[0.18em]"
        : "mt-3 text-[10px] font-medium tracking-[0.18em] text-muted sm:mt-3.5 sm:text-[11px]";
    }
    if (isNature) {
      if (bilingual) {
        return isDark
          ? "mt-2 font-sans text-[12px] font-semibold tracking-[0.14em] text-white/[0.78] sm:mt-2.5 sm:text-[13px] sm:tracking-[0.16em] [text-shadow:0_1px_1px_rgba(0,0,0,0.36),0_1px_10px_rgba(0,0,0,0.22)] [@media(max-height:500px)_and_(orientation:portrait)]:mt-1.5 [@media(max-height:500px)_and_(orientation:portrait)]:text-[11px]"
          : "mt-2 font-sans text-[13px] font-semibold tracking-[0.16em] text-ink/80 sm:mt-2.5 sm:text-[14px]";
      }
      return isDark
        ? "mt-3 font-sans text-[12px] font-semibold tracking-[0.14em] text-white/[0.78] sm:mt-3.5 sm:text-[13px] sm:tracking-[0.16em] [text-shadow:0_1px_1px_rgba(0,0,0,0.36),0_1px_10px_rgba(0,0,0,0.22)] [@media(max-height:500px)_and_(orientation:portrait)]:mt-2 [@media(max-height:500px)_and_(orientation:portrait)]:text-[11px]"
        : "mt-3 font-sans text-[13px] font-semibold tracking-[0.16em] text-ink/80 sm:text-[14px]";
    }
    if (isRelax) {
      if (bilingual) {
        return isDark
          ? "mt-3 text-[10px] font-medium tracking-[0.26em] text-white/46 sm:mt-3.5 sm:text-[11px] sm:tracking-[0.28em]"
          : "mt-3 text-[10px] font-medium tracking-[0.22em] text-muted sm:mt-3.5 sm:text-[11px]";
      }
      return isDark
        ? "mt-5 text-[10px] font-medium tracking-[0.26em] text-white/46 sm:text-[11px] sm:tracking-[0.28em]"
        : "mt-5 text-[10px] font-medium tracking-[0.22em] text-muted sm:text-[11px]";
    }
    return isDark
      ? "mt-2.5 text-[9px] font-medium tracking-[0.2em] text-white/42"
      : "mt-3 text-[9px] font-medium tracking-[0.22em] text-muted";
  })();

  const secondaryRefClass = (() => {
    if (isNature) {
      return isDark
        ? `${bilingual ? "mt-1" : "mt-1.5"} font-sans text-[10px] font-semibold tracking-[0.12em] text-white/[0.78] [text-shadow:0_1px_1px_rgba(0,0,0,0.36),0_1px_10px_rgba(0,0,0,0.22)] sm:text-[11px] [@media(max-height:500px)_and_(orientation:portrait)]:text-[10px]`
        : `${bilingual ? "mt-1" : "mt-1.5"} font-sans text-[11px] font-semibold tracking-[0.14em] text-ink/80 [text-shadow:0_1px_1px_rgba(255,255,255,0.45),0_1px_8px_rgba(0,0,0,0.08)] sm:text-[12px]`;
    }
    if (isRelax) {
      return isDark
        ? `${bilingual ? "mt-0.5" : "mt-1"} font-serif text-[9px] font-semibold tracking-[0.14em] text-white/[0.72] [text-shadow:0_1px_2px_rgba(0,0,0,0.4),0_1px_8px_rgba(0,0,0,0.2)] sm:text-[10px]`
        : `${bilingual ? "mt-0.5" : "mt-1"} font-serif text-[9px] font-semibold tracking-[0.14em] text-ink/72 [text-shadow:0_1px_1px_rgba(255,255,255,0.5)] sm:text-[10px]`;
    }
    return isDark
      ? "mt-1 text-[9px] font-semibold tracking-[0.14em] text-white/60 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
      : "mt-1 text-[9px] font-semibold tracking-[0.14em] text-ink/70 [text-shadow:0_1px_1px_rgba(255,255,255,0.4)]";
  })();

  const shellWidth = isHero
    ? "max-w-[min(96vw,34rem)] sm:max-w-[36rem] lg:max-w-[38rem]"
    : isRelax || isNature
      ? "max-w-[min(96vw,26rem)] sm:max-w-[28rem] md:max-w-[34rem] lg:max-w-[40rem] landscape:max-w-[min(92vw,44rem)] md:landscape:max-w-[min(86vw,50rem)] lg:landscape:max-w-[min(82vw,56rem)]"
      : "max-w-[19rem] sm:max-w-[21.5rem]";

  const blockquoteStack = (() => {
    if (bilingual) {
      if (isHero) return "space-y-1";
      if (isRelax) return "space-y-1 sm:space-y-1.5";
      if (isNature) return "space-y-1 sm:space-y-1 [@media(max-height:500px)_and_(orientation:portrait)]:space-y-0.5";
      return "space-y-0.5";
    }
    if (isHero) return "space-y-2";
    if (isRelax) return "space-y-2 sm:space-y-2.5";
    if (isNature) return "space-y-1.5 sm:space-y-2 [@media(max-height:500px)]:space-y-1";
    return "space-y-1";
  })();

  const secondaryBlockMargin = bilingual ? (isNature ? "mt-2 sm:mt-2.5" : "mt-2") : isNature ? "mt-4 sm:mt-5" : "mt-4";

  const sec = SECONDARY_VERSES?.[homeVerseIndex];
  const showSecondary = Boolean(bilingual && sec?.lines?.length);

  return (
    <div
      className={`mx-auto w-full ${shellWidth} text-center ${className}`.trim()}
      aria-live="polite"
      aria-atomic="true"
    >
      <blockquote
        className={`m-0 text-center transition-opacity ease-in-out motion-reduce:transition-none ${blockquoteStack}`}
        style={{
          opacity: homeVerseVisible ? 1 : 0,
          transitionDuration: prefersReducedMotion ? "0ms" : `${HOME_VERSE_FADE_MS}ms`,
        }}
      >
        {(HOME_VERSES[homeVerseIndex]?.lines ?? []).map((line, i) => (
          <p key={`${homeVerseIndex}-p-${i}`} className={lineClass}>
            {line}
          </p>
        ))}
        <footer className={refClass}>{HOME_VERSES[homeVerseIndex]?.ref ?? ""}</footer>
        {showSecondary ? (
          <div className={secondaryBlockMargin}>
            {(sec?.lines ?? []).map((line, i) => (
              <p key={`${homeVerseIndex}-s-${i}`} className={secondaryLineClass}>
                {line}
              </p>
            ))}
            {sec?.ref ? <footer className={secondaryRefClass}>{sec.ref}</footer> : null}
          </div>
        ) : null}
      </blockquote>
    </div>
  );
}
