"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  getHomeTtsExperimentEnabled,
  setHomeTtsExperimentEnabled,
  subscribeHomeTtsExperiment,
} from "@/lib/home/home-experimental-features";

type Props = {
  variant?: "notion" | "parchment";
};

/** 对齐 App 左上抽屉「尝试 TTS 读经文（实验）」开关 */
export function HomeTtsExperimentDrawerSection({ variant = "notion" }: Props) {
  const { locale } = useLocale();
  const zh = locale === "zh-CN" || locale === "zh-TW";
  const enabled = useSyncExternalStore(subscribeHomeTtsExperiment, getHomeTtsExperimentEnabled, () => false);

  if (variant === "parchment") {
    return (
      <div>
        <p className="shell-nav-drawer-section-label">{zh ? "实验功能" : "Experimental features"}</p>
        <button
          type="button"
          className="shell-nav-drawer-compact-row w-full"
          onClick={() => setHomeTtsExperimentEnabled(!enabled)}
        >
          <span className="shell-nav-drawer-compact-label">
            {zh ? "尝试 TTS 读经文（实验）" : "Try TTS verse reading (experimental)"}
          </span>
          <span className="shell-nav-drawer-compact-detail">
            {enabled ? (zh ? "已开启" : "Enabled") : zh ? "已关闭" : "Disabled"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 border-t border-neutral-200/90 pt-2">
      <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#37352f]/45">
        {zh ? "实验功能" : "Experimental features"}
      </p>
      <button
        type="button"
        onClick={() => setHomeTtsExperimentEnabled(!enabled)}
        className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition hover:bg-black/[0.04] active:bg-black/[0.06]"
      >
        <span className="text-[14px] font-medium text-[#37352f]">
          {zh ? "尝试 TTS 读经文（实验）" : "Try TTS verse reading (experimental)"}
        </span>
        <span className="text-[12px] text-[#37352f]/55">
          {enabled ? (zh ? "已开启" : "Enabled") : zh ? "已关闭" : "Disabled"}
        </span>
      </button>
    </div>
  );
}
