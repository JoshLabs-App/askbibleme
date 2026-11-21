"use client";

import { normalizeScripturePlaybackRate } from "@/lib/read/scripture-playback-rate-web";

const SPEED_LABELS: Record<string, string> = {
  "0.75": "0.75x",
  "1": "1.0x",
  "1.25": "1.25x",
  "1.5": "1.5x",
  "1.75": "1.75x",
  "2": "2.0x",
};

type Props = {
  rate: number;
  className?: string;
};

/** 圆角线框倍速徽章：与搜索、循环、跳章保持同一描边粗细与视觉高度，告别裸露杂乱的纯文字 1×。 */
export function ScriptureSpeedRateIcon({ rate, className }: Props) {
  const key = normalizeScripturePlaybackRate(rate);
  const label = SPEED_LABELS[String(key)] ?? `${key}x`;
  const active = Math.abs(key - 1) > 0.01;
  return (
    <span
      className={[
        "inline-flex h-[22px] min-w-[38px] items-center justify-center rounded-[7px] border-[1.6px] px-1.5 text-[11px] font-bold tracking-tight tabular-nums leading-none transition",
        active
          ? "border-[#C1660B] bg-[#C1660B]/15 text-[#C1660B] dark:border-[#E2A84B] dark:bg-[#E2A84B]/15 dark:text-[#E2A84B]"
          : "border-[#3d2e24]/55 text-[#3d2e24] dark:border-[#EDE2CF]/55 dark:text-[#EDE2CF]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </span>
  );
}
