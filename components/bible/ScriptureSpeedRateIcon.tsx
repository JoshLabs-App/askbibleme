"use client";

import type { CSSProperties } from "react";
import { normalizeScripturePlaybackRate } from "@/lib/read/scripture-playback-rate-web";

const SPEED_ASSET_KEYS: Record<string, string> = {
  "0.75": "075",
  "1": "1",
  "1.25": "125",
  "1.5": "15",
  "1.75": "175",
  "2": "2",
};

type Props = {
  rate: number;
  className?: string;
};

/** 对齐安卓 `PlaybackDock.kt` 的 `SpeedRateImage`：使用同源预渲染 `scripture-speed-*.png`（56×22），随 `currentColor` 着色。 */
export function ScriptureSpeedRateIcon({ rate, className }: Props) {
  const normalized = normalizeScripturePlaybackRate(rate);
  const key = SPEED_ASSET_KEYS[String(normalized)] ?? "1";
  const url = `url(/images/scripture-speed-${key}.png)`;
  const maskStyle: CSSProperties = {
    width: 56,
    height: 22,
    backgroundColor: "currentColor",
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };
  return (
    <span
      className={["inline-block shrink-0 select-none", className].filter(Boolean).join(" ")}
      style={maskStyle}
      aria-hidden
    />
  );
}
