"use client";

import { useEffect, useMemo, useState } from "react";
import { HOME_VERSE_FADE_MS, HOME_VERSE_STABLE_MS } from "@/components/home/home-verse-constants";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HOME_VERSES_BY_LOCALE } from "@/lib/i18n/home-verses";

type Props = {
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
  variant = "dark",
  prominence = "default",
  className = "",
}: Props) {
  const { locale } = useLocale();
  const HOME_VERSES = useMemo(() => HOME_VERSES_BY_LOCALE[locale], [locale]);
  const isDark = variant === "dark";
  const isHero = prominence === "hero";
  const isRelax = prominence === "relax";
  const isNature = prominence === "nature";
  const [homeVerseIndex, setHomeVerseIndex] = useState(0);
  const [homeVerseVisible, setHomeVerseVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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
  }, [prefersReducedMotion, locale, HOME_VERSES.length]);

  useEffect(() => {
    setHomeVerseIndex(0);
    setHomeVerseVisible(true);
  }, [locale]);

  const lineClass = (() => {
    if (isHero) {
      return isDark
        ? "m-0 font-serif text-[clamp(1.12rem,2.85vw+0.22rem,1.82rem)] font-medium leading-[1.22] tracking-[0.028em] text-white/[0.92] drop-shadow-sm transition-colors duration-200 group-hover:text-white/[0.96]"
        : "m-0 font-serif text-[clamp(1.12rem,2.85vw+0.22rem,1.82rem)] font-medium leading-[1.22] tracking-[0.028em] text-ink/88 transition-colors duration-200 group-hover:text-ink/92";
    }
    if (isNature) {
      return isDark
        ? "m-0 font-sans text-[clamp(1.04rem,3.85vw+0.16rem,1.34rem)] font-medium leading-[1.46] tracking-[0.018em] text-white/[0.96] [text-shadow:0_1px_2px_rgba(0,0,0,0.38),0_2px_14px_rgba(0,0,0,0.22)] [@media(max-height:500px)]:text-[clamp(0.95rem,3.2vw+0.12rem,1.12rem)] [@media(max-height:500px)]:leading-[1.4]"
        : "m-0 font-sans text-[clamp(1.02rem,3.6vw+0.14rem,1.28rem)] font-medium leading-[1.46] tracking-[0.02em] text-ink/90";
    }
    if (isRelax) {
      return isDark
        ? "m-0 font-serif text-[clamp(1.02rem,3.6vw+0.15rem,1.32rem)] font-normal leading-[1.68] tracking-[0.032em] text-white/[0.9] drop-shadow-[0_2px_12px_rgba(0,0,0,0.42)]"
        : "m-0 font-serif text-[clamp(1.02rem,3.6vw+0.15rem,1.32rem)] font-normal leading-[1.68] tracking-[0.026em] text-ink/85";
    }
    return isDark
      ? "m-0 font-serif text-[clamp(0.95rem,3.2vw,1.18rem)] font-normal leading-[1.55] tracking-[0.02em] text-white/[0.88] drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
      : "m-0 font-serif text-[clamp(0.98rem,3.4vw,1.22rem)] font-normal leading-[1.55] tracking-[0.02em] text-ink/86";
  })();

  const refClass = (() => {
    if (isHero) {
      return isDark
        ? "mt-3 text-[10px] font-medium tracking-[0.16em] text-white/46 sm:mt-3.5 sm:text-[11px] sm:tracking-[0.18em]"
        : "mt-3 text-[10px] font-medium tracking-[0.18em] text-muted sm:mt-3.5 sm:text-[11px]";
    }
    if (isNature) {
      return isDark
        ? "mt-3 font-sans text-[12px] font-semibold tracking-[0.14em] text-white/[0.78] sm:mt-3.5 sm:text-[13px] sm:tracking-[0.16em] [text-shadow:0_1px_1px_rgba(0,0,0,0.36),0_1px_10px_rgba(0,0,0,0.22)] [@media(max-height:500px)]:mt-2 [@media(max-height:500px)]:text-[11px]"
        : "mt-3 font-sans text-[13px] font-semibold tracking-[0.16em] text-ink/80 sm:text-[14px]";
    }
    if (isRelax) {
      return isDark
        ? "mt-5 text-[10px] font-medium tracking-[0.26em] text-white/46 sm:text-[11px] sm:tracking-[0.28em]"
        : "mt-5 text-[10px] font-medium tracking-[0.22em] text-muted sm:text-[11px]";
    }
    return isDark
      ? "mt-2.5 text-[9px] font-medium tracking-[0.2em] text-white/42"
      : "mt-3 text-[9px] font-medium tracking-[0.22em] text-muted";
  })();

  const shellWidth = isHero
    ? "max-w-[min(96vw,34rem)] sm:max-w-[36rem] lg:max-w-[38rem]"
    : isRelax || isNature
      ? "max-w-[min(96vw,26rem)] sm:max-w-[28rem]"
      : "max-w-[19rem] sm:max-w-[21.5rem]";

  return (
    <div
      className={`mx-auto w-full ${shellWidth} text-center ${className}`.trim()}
      aria-live="polite"
      aria-atomic="true"
    >
      <blockquote
        className={`m-0 text-center transition-opacity ease-in-out motion-reduce:transition-none ${isHero ? "space-y-2" : isRelax ? "space-y-2 sm:space-y-2.5" : isNature ? "space-y-1.5 sm:space-y-2 [@media(max-height:500px)]:space-y-1" : "space-y-1"}`}
        style={{
          opacity: homeVerseVisible ? 1 : 0,
          transitionDuration: prefersReducedMotion ? "0ms" : `${HOME_VERSE_FADE_MS}ms`,
        }}
      >
        {(HOME_VERSES[homeVerseIndex]?.lines ?? []).map((line, i) => (
          <p key={`${homeVerseIndex}-${i}`} className={lineClass}>
            {line}
          </p>
        ))}
        <footer className={refClass}>{HOME_VERSES[homeVerseIndex]?.ref ?? ""}</footer>
      </blockquote>
    </div>
  );
}
