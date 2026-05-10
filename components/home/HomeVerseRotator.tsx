"use client";

import { useEffect, useState } from "react";
import { HOME_VERSE_FADE_MS, HOME_VERSE_STABLE_MS, HOME_VERSES } from "@/components/home/home-verse-constants";

type Props = {
  /** 深色底（音乐首页）或浅色底（旧首页氛围） */
  variant?: "dark" | "light";
  /** default：中部轮播；hero：音乐播放首页主标题区大字 */
  prominence?: "default" | "hero";
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
  const isDark = variant === "dark";
  const isHero = prominence === "hero";
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
  }, [prefersReducedMotion]);

  const lineClass = (() => {
    if (isHero) {
      return isDark
        ? "m-0 font-serif text-[clamp(1.35rem,3.8vw+0.35rem,2.35rem)] font-medium leading-[1.2] tracking-[0.03em] text-white/[0.92] drop-shadow-sm transition-colors duration-200 group-hover:text-white/[0.96]"
        : "m-0 font-serif text-[clamp(1.35rem,3.8vw+0.35rem,2.35rem)] font-medium leading-[1.2] tracking-[0.03em] text-ink/88 transition-colors duration-200 group-hover:text-ink/92";
    }
    return isDark
      ? "m-0 font-serif text-[clamp(0.95rem,3.2vw,1.18rem)] font-normal leading-[1.55] tracking-[0.02em] text-white/[0.88] drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
      : "m-0 font-serif text-[clamp(0.98rem,3.4vw,1.22rem)] font-normal leading-[1.55] tracking-[0.02em] text-ink/86";
  })();

  const refClass = (() => {
    if (isHero) {
      return isDark
        ? "mt-4 text-[11px] font-medium tracking-[0.18em] text-white/48"
        : "mt-4 text-[11px] font-medium tracking-[0.2em] text-muted";
    }
    return isDark
      ? "mt-2.5 text-[9px] font-medium tracking-[0.2em] text-white/42"
      : "mt-3 text-[9px] font-medium tracking-[0.22em] text-muted";
  })();

  const shellWidth = isHero
    ? "max-w-[min(92vw,42rem)] sm:max-w-3xl lg:max-w-[48rem] xl:max-w-5xl 2xl:max-w-6xl"
    : "max-w-[19rem] sm:max-w-[21.5rem]";

  return (
    <div
      className={`mx-auto w-full ${shellWidth} text-center ${className}`.trim()}
      aria-live="polite"
      aria-atomic="true"
    >
      <blockquote
        className={`m-0 text-center transition-opacity ease-in-out motion-reduce:transition-none ${isHero ? "space-y-2" : "space-y-1"}`}
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
