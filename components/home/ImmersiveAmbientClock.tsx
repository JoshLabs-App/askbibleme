"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  visible: boolean;
};

function formatAmbientTime24(d: Date) {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * 横屏沉浸 / 全屏时：视口水平居中、顶栏下方；较大字号、`font-thin`（100）、略提对比度。
 */
export function ImmersiveAmbientClock({ visible }: Props) {
  const timeRef = useRef<HTMLTimeElement>(null);
  const [fadedIn, setFadedIn] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFadedIn(false);
      return;
    }
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delayMs = reduce ? 0 : 2600;
    const id = window.setTimeout(() => setFadedIn(true), delayMs);
    return () => window.clearTimeout(id);
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible) return;
    const el = timeRef.current;
    if (!el) return;
    const apply = () => {
      const d = new Date();
      el.dateTime = d.toISOString();
      el.textContent = formatAmbientTime24(d);
    };
    apply();

    let intervalId: number | undefined;
    const msToNextMinute = 60000 - (Date.now() % 60000) + 50;
    const kick = window.setTimeout(() => {
      apply();
      intervalId = window.setInterval(apply, 60000);
    }, msToNextMinute);

    return () => {
      window.clearTimeout(kick);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <time
      ref={timeRef}
      aria-hidden
      className={[
        "pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+3.5rem)] z-[52] -translate-x-1/2 select-none font-thin tabular-nums tracking-[0.06em] text-[18px] text-white/[0.26] transition-opacity duration-700 ease-out motion-reduce:transition-none sm:text-[21px] sm:tracking-[0.07em]",
        fadedIn ? "opacity-100" : "opacity-0",
      ].join(" ")}
    />
  );
}
