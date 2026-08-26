"use client";

import { normalizeScripturePlaybackRate } from "@/lib/read/scripture-playback-rate-web";

const SPEED_ICONS: Record<string, string> = {
  "0.75": "0.75×",
  "1": "1×",
  "1.25": "1.25×",
  "1.5": "1.5×",
  "1.75": "1.75×",
  "2": "2×",
};

type Props = {
  rate: number;
  className?: string;
};

export function ScriptureSpeedRateIcon({ rate, className }: Props) {
  const key = normalizeScripturePlaybackRate(rate);
  const label = SPEED_ICONS[String(key)] ?? `${key}×`;
  return (
    <span className={["text-[13px] font-semibold tabular-nums leading-none", className].filter(Boolean).join(" ")}>
      {label}
    </span>
  );
}
