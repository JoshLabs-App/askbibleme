"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HOME_VERSE_FADE_MS, HOME_VERSE_STABLE_MS } from "@/components/home/home-verse-constants";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import type { GoldenVerseFontFamilyV1, GoldenVerseTextEffectV1 } from "@/lib/home-prayer-pools/types";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { goldenVerseTextShadowClass } from "@/lib/home-prayer-pools/golden-verse-text-effects";
import { HOME_VERSES_BY_LOCALE } from "@/lib/i18n/home-verses";

const GOLDEN_WIDE_FIT_MQ = "(min-width: 1024px)";

function clearGoldenWideFitStyles(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-golden-fit]").forEach((el) => {
    el.style.removeProperty("font-size");
    el.style.removeProperty("white-space");
  });
}

function applyGoldenWideFit(root: HTMLElement) {
  if (typeof window === "undefined") return;
  if (!window.matchMedia(GOLDEN_WIDE_FIT_MQ).matches) {
    clearGoldenWideFitStyles(root);
    return;
  }
  const blockquote = root.querySelector("blockquote");
  if (!blockquote) return;
  const lines = [
    ...blockquote.querySelectorAll<HTMLElement>('p[data-golden-fit="line"], p[data-golden-fit="secondary"]'),
  ];
  if (lines.length === 0) return;
  const maxW = blockquote.clientWidth;
  if (maxW < 40) return;

  const MIN_PX = 14;
  const MAX_PX = 220;
  let unit = MAX_PX;
  let measured = false;

  for (const el of lines) {
    const t = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!t) continue;
    measured = true;
    el.style.removeProperty("font-size");
    el.style.whiteSpace = "nowrap";
    let lo = MIN_PX;
    let hi = MAX_PX;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      void el.offsetWidth;
      if (el.scrollWidth <= maxW + 1) lo = mid;
      else hi = mid;
    }
    unit = Math.min(unit, lo);
  }

  if (!measured) {
    clearGoldenWideFitStyles(root);
    return;
  }

  const u = Math.max(MIN_PX, Math.min(MAX_PX, unit));
  for (const el of lines) {
    el.style.fontSize = `${u}px`;
    el.style.whiteSpace = "nowrap";
  }

  blockquote.querySelectorAll<HTMLElement>('footer[data-golden-fit="ref"]').forEach((footer) => {
    const fr = Math.max(11, Math.min(40, Math.round(u * 0.38)));
    footer.style.fontSize = `${fr}px`;
    footer.style.whiteSpace = "normal";
  });
}

type Props = {
  /**
   * 若由服务端从译本解析好，则优先使用（按界面语言切换）；
   * 未传时回落到 `HOME_VERSES_BY_LOCALE` 硬编码。
   */
  entriesByLocale?: Record<AppLocale, HomeVerseEntry[]>;
  /** 与 `entriesByLocale` 同索引展示另一语（须两语数组对齐） */
  bilingual?: boolean;
  /** 与 `entriesByLocale` 对齐；用于经句轮播进度写入 */
  verseKeys?: string[];
  onVerseCommitted?: (verseKey: string) => void;
  onNearEnd?: (index: number, total: number) => void;
  /** 深色底（音乐首页）或浅色底（旧首页氛围） */
  variant?: "dark" | "light";
  /** default：中部轮播；hero：音乐播放首页主标题区大字；relax：放松页较大读经区；nature：自然页全屏视频上，对比更强 */
  prominence?: "default" | "hero" | "relax" | "nature";
  className?: string;
  /**
   * 为 true 时不自动轮播、不淡出；由 `verseIndex` 控制当前节（金句页手动翻句）。
   * 此时 `onVerseCommitted` 应由父级在换句时调用，本组件内不再随下标自动写入。
   */
  paused?: boolean;
  /** `paused` 时有效：当前经句下标。 */
  verseIndex?: number;
  /**
   * 金句专页：独立排版（`#5F2E00`）、字面阴影由 `goldenVerseTextEffect` 控制；`motion-reduce` 下无阴影。
   * 仅在与 `prominence="nature"` 同用时生效。
   */
  verseStyle?: "default" | "goldenVerses";
  /** 金句排版用字体；与 `verseStyle="goldenVerses"` 同用时由父级从偏好注入 */
  goldenVerseFontFamily?: GoldenVerseFontFamilyV1;
  /** 金句字面阴影预设；与 `verseStyle="goldenVerses"` 同用时由父级从偏好注入 */
  goldenVerseTextEffect?: GoldenVerseTextEffectV1;
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
  paused = false,
  verseIndex: verseIndexProp = 0,
  verseStyle = "default",
  goldenVerseFontFamily = "sans",
  goldenVerseTextEffect = "engraved",
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
  const secondaryList = useMemo(() => {
    if (!bilingual || !secondaryLocale || !entriesByLocale) return null;
    return entriesByLocale[secondaryLocale] ?? null;
  }, [bilingual, entriesByLocale, secondaryLocale]);
  const isDark = variant === "dark";
  const isGoldenVerses = verseStyle === "goldenVerses" && prominence === "nature";
  const isHero = prominence === "hero";
  const isRelax = prominence === "relax";
  const isNature = prominence === "nature";
  const [homeVerseIndex, setHomeVerseIndex] = useState(0);
  const [homeVerseVisible, setHomeVerseVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const lastCommittedIndex = useRef(-1);
  const goldenShellRef = useRef<HTMLDivElement | null>(null);
  const goldenFitRafRef = useRef<number | null>(null);
  const verseKeysSig = verseKeys?.join("\u0001") ?? "";

  const nVerses = HOME_VERSES.length;
  const activeIndex = paused
    ? Math.min(Math.max(0, verseIndexProp), Math.max(0, nVerses - 1))
    : homeVerseIndex;
  const showVerse = nVerses > 0;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (paused) return;
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
  }, [paused, prefersReducedMotion, locale, bilingual, HOME_VERSES.length, entriesByLocale]);

  useEffect(() => {
    if (paused) return;
    setHomeVerseIndex(0);
    setHomeVerseVisible(true);
    lastCommittedIndex.current = -1;
  }, [paused, locale, verseKeysSig, bilingual]);

  useEffect(() => {
    if (paused) return;
    if (!verseKeys?.length || !onVerseCommitted) return;
    const prev = lastCommittedIndex.current;
    if (prev >= 0 && prev !== homeVerseIndex) {
      const k = verseKeys[prev];
      if (k) onVerseCommitted(k);
    }
    lastCommittedIndex.current = homeVerseIndex;
  }, [paused, homeVerseIndex, verseKeys, onVerseCommitted]);

  useEffect(() => {
    onNearEnd?.(activeIndex, HOME_VERSES.length);
  }, [activeIndex, HOME_VERSES.length, onNearEnd]);

  useLayoutEffect(() => {
    if (!isGoldenVerses) return;
    const root = goldenShellRef.current;
    if (!root) return;

    const schedule = () => {
      if (goldenFitRafRef.current != null) cancelAnimationFrame(goldenFitRafRef.current);
      goldenFitRafRef.current = requestAnimationFrame(() => {
        goldenFitRafRef.current = null;
        applyGoldenWideFit(root);
      });
    };

    const mq = window.matchMedia(GOLDEN_WIDE_FIT_MQ);
    const onMq = () => schedule();
    mq.addEventListener("change", onMq);
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    schedule();

    return () => {
      mq.removeEventListener("change", onMq);
      ro.disconnect();
      if (goldenFitRafRef.current != null) cancelAnimationFrame(goldenFitRafRef.current);
      goldenFitRafRef.current = null;
      clearGoldenWideFitStyles(root);
    };
  }, [isGoldenVerses, activeIndex, bilingual, verseKeysSig, HOME_VERSES, secondaryList, goldenVerseFontFamily, goldenVerseTextEffect]);

  const lineClass = (() => {
    /** 双语时英文主文：行距空隙减半 `1 + (L-1)/2` */
    const L = (loose: number, tight: string) => (bilingual ? tight : `leading-[${loose}]`);
    if (isGoldenVerses) {
      const face = goldenVerseFontFamily === "serif" ? "font-serif" : "font-sans";
      const fx = goldenVerseTextShadowClass(goldenVerseTextEffect, "primary");
      return `m-0 ${face} text-[clamp(2.04rem,7.2vw+0.28rem,2.56rem)] font-bold ${L(1.46, "leading-[1.23]")} tracking-[0.018em] text-[#5F2E00] ${fx} [@media(max-height:500px)_and_(orientation:portrait)]:text-[clamp(1.92rem,6.5vw+0.2rem,2.28rem)] [@media(max-height:500px)_and_(orientation:portrait)]:${L(1.4, "leading-[1.2]")}`;
    }
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
    if (isGoldenVerses) {
      const face = goldenVerseFontFamily === "serif" ? "font-serif" : "font-sans";
      const fx = goldenVerseTextShadowClass(goldenVerseTextEffect, "secondary");
      return `m-0 ${face} text-[clamp(1.76rem,6vw+0.2rem,2.08rem)] font-bold ${S("leading-[1.26]", "leading-[1.42]")} tracking-[0.015em] text-[#5F2E00] ${fx}`;
    }
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
    if (isGoldenVerses) {
      const face = goldenVerseFontFamily === "serif" ? "font-serif" : "font-sans";
      const fx = goldenVerseTextShadowClass(goldenVerseTextEffect, "ref");
      if (bilingual) {
        return `mt-2 ${face} text-[26px] font-bold tracking-[0.15em] text-[#5F2E00] sm:mt-2.5 sm:text-[28px] sm:tracking-[0.16em] [@media(max-height:500px)_and_(orientation:portrait)]:mt-1.5 [@media(max-height:500px)_and_(orientation:portrait)]:text-[24px] ${fx}`;
      }
      return `mt-3 ${face} text-[26px] font-bold tracking-[0.15em] text-[#5F2E00] sm:mt-3.5 sm:text-[28px] [@media(max-height:500px)_and_(orientation:portrait)]:mt-2 [@media(max-height:500px)_and_(orientation:portrait)]:text-[24px] ${fx}`;
    }
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
    if (isGoldenVerses) {
      const face = goldenVerseFontFamily === "serif" ? "font-serif" : "font-sans";
      const fx = goldenVerseTextShadowClass(goldenVerseTextEffect, "ref");
      return `${bilingual ? "mt-1" : "mt-1.5"} ${face} text-[22px] font-bold tracking-[0.13em] text-[#5F2E00] sm:text-[24px] [@media(max-height:500px)_and_(orientation:portrait)]:text-[20px] ${fx}`;
    }
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
    : isGoldenVerses
      ? "max-w-[min(96vw,40rem)] sm:max-w-[42rem] md:max-w-[44rem] landscape:max-w-[80vw]"
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

  const sec = secondaryList?.[activeIndex];
  const showSecondary = Boolean(bilingual && sec?.lines?.length);

  if (!showVerse) {
    return null;
  }

  return (
    <div
      ref={goldenShellRef}
      className={`mx-auto w-full ${shellWidth} text-center ${className}`.trim()}
      aria-live="polite"
      aria-atomic="true"
    >
      <blockquote
        className={`m-0 text-center transition-opacity ease-in-out motion-reduce:transition-none ${blockquoteStack}`}
        style={{
          opacity: paused || homeVerseVisible ? 1 : 0,
          transitionDuration: paused || prefersReducedMotion ? "0ms" : `${HOME_VERSE_FADE_MS}ms`,
        }}
      >
        {(HOME_VERSES[activeIndex]?.lines ?? []).map((line, i) => (
          <p
            key={`${activeIndex}-p-${i}`}
            className={lineClass}
            data-golden-fit={isGoldenVerses ? "line" : undefined}
          >
            {line}
          </p>
        ))}
        <footer className={refClass} data-golden-fit={isGoldenVerses ? "ref" : undefined}>
          {HOME_VERSES[activeIndex]?.ref ?? ""}
        </footer>
        {showSecondary ? (
          <div className={secondaryBlockMargin}>
            {(sec?.lines ?? []).map((line, i) => (
              <p
                key={`${activeIndex}-s-${i}`}
                className={secondaryLineClass}
                data-golden-fit={isGoldenVerses ? "secondary" : undefined}
              >
                {line}
              </p>
            ))}
            {sec?.ref ? (
              <footer className={secondaryRefClass} data-golden-fit={isGoldenVerses ? "ref" : undefined}>
                {sec.ref}
              </footer>
            ) : null}
          </div>
        ) : null}
      </blockquote>
    </div>
  );
}
