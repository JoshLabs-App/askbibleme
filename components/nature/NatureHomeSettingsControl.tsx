"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HomeSleepTimerControl } from "@/components/home/HomeSleepTimerControl";
import type { NatureVerseTextScaleDockProps } from "@/components/home/HomePrayerVerseDockSettings";
import { NatureHomeVerseAppearancePanel } from "@/components/nature/NatureHomeVerseAppearancePanel";

const TOP_BAR_BTN =
  "touch-manipulation inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-none border-0 bg-transparent p-0 text-white/[0.9] transition hover:text-white active:scale-[0.97]";

/** 单屏、无滚动；内容靠紧凑行距塞入一卡 */
const PANEL_SHELL =
  "pointer-events-auto absolute right-full top-0 z-[60] mr-2 w-[11.25rem] shrink-0 overflow-hidden rounded-xl border border-white/18 bg-black/58 px-2 py-2 text-left shadow-[0_8px_32px_-10px_rgba(0,0,0,0.55)] backdrop-blur-xl";

const DIVIDER = "my-1.5 border-t border-white/10";

const ROW = "flex min-h-[32px] items-center justify-between gap-2";

const MICRO = "w-7 shrink-0 text-[10px] text-white/50";

const RANGE = "h-1 min-w-0 flex-1 accent-white";

const SEGMENT_WRAP = "flex rounded-md bg-white/[0.06] p-0.5";

const SEGMENT_BTN =
  "min-h-[28px] flex-1 rounded-[5px] px-2 text-[11px] font-medium transition active:scale-[0.98]";

function IconSettings(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.41.57.94.6 1.51V11a2 2 0 0 1 0 4h-.09c-.03.57-.24 1.1-.6 1.51Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type NatureHomeSettingsControlProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasNatureVisual: boolean;
  activeSceneHas1080: boolean;
  background1080: boolean;
  onBackground1080Toggle: () => void;
  showFullscreenBtn: boolean;
  docElementFullscreen: boolean;
  onFullscreenClick: () => void;
  softFocusDraftOpacity: number;
  softFocusDraftBlur: number;
  natureBgSoftFocus: boolean;
  onSoftFocusOpacityChange: (value: number) => void;
  onSoftFocusBlurChange: (value: number) => void;
  onSoftFocusClear: () => void;
  natureVerseTextScale: NatureVerseTextScaleDockProps;
};

/**
 * 自然首页右上：单一设置入口；极简单卡，一屏内展示全部项。
 */
export function NatureHomeSettingsControl({
  open,
  onOpenChange,
  hasNatureVisual,
  activeSceneHas1080,
  background1080,
  onBackground1080Toggle,
  showFullscreenBtn,
  docElementFullscreen,
  onFullscreenClick,
  softFocusDraftOpacity,
  softFocusDraftBlur,
  natureBgSoftFocus,
  onSoftFocusOpacityChange,
  onSoftFocusBlurChange,
  onSoftFocusClear,
  natureVerseTextScale,
}: NatureHomeSettingsControlProps) {
  const { t } = useLocale();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const w = wrapRef.current;
      if (!w || w.contains(e.target as Node)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={wrapRef} className="relative isolate shrink-0">
      {open ? (
        <div
          id="nature-home-settings-panel"
          role="region"
          aria-label={t("nature.homeSettings.panelTitle")}
          className={PANEL_SHELL}
        >
          {hasNatureVisual && activeSceneHas1080 ? (
            <div className={SEGMENT_WRAP} role="group" aria-label={t("nature.homeSettings.qualitySection")}>
              <button
                type="button"
                aria-pressed={!background1080}
                onClick={() => {
                  if (background1080) onBackground1080Toggle();
                }}
                className={[
                  SEGMENT_BTN,
                  !background1080 ? "bg-white/18 text-white" : "text-white/60 hover:text-white/85",
                ].join(" ")}
              >
                720
              </button>
              <button
                type="button"
                aria-pressed={background1080}
                onClick={() => {
                  if (!background1080) onBackground1080Toggle();
                }}
                className={[
                  SEGMENT_BTN,
                  background1080 ? "bg-sky-500/80 text-white" : "text-white/60 hover:text-white/85",
                ].join(" ")}
              >
                1080
              </button>
            </div>
          ) : null}

          {hasNatureVisual ? (
            <>
              {activeSceneHas1080 ? <div className={DIVIDER} aria-hidden /> : null}
              <div className="space-y-1">
                <div className={`${ROW} gap-1.5`}>
                  <span className={MICRO}>{t("nature.homeSettings.softFocusShort")}</span>
                  <label className="sr-only" htmlFor="nature-home-settings-soft-focus-overlay">
                    {t("nature.bgSoftFocusOverlayLabel")}
                  </label>
                  <input
                    id="nature-home-settings-soft-focus-overlay"
                    type="range"
                    min={0.08}
                    max={0.82}
                    step={0.01}
                    value={softFocusDraftOpacity}
                    className={RANGE}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      onSoftFocusOpacityChange(v);
                    }}
                  />
                </div>
                <div className={`${ROW} gap-1.5`}>
                  <span className={MICRO}>{t("nature.homeSettings.softBlurShort")}</span>
                  <label className="sr-only" htmlFor="nature-home-settings-soft-focus-blur">
                    {t("nature.bgSoftFocusBlurLabel")}
                  </label>
                  <input
                    id="nature-home-settings-soft-focus-blur"
                    type="range"
                    min={2}
                    max={48}
                    step={1}
                    value={softFocusDraftBlur}
                    className={RANGE}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      onSoftFocusBlurChange(Math.round(v));
                    }}
                  />
                </div>
                {natureBgSoftFocus ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="px-1 py-0.5 text-[10px] text-white/55 transition hover:text-white/85"
                      onClick={onSoftFocusClear}
                    >
                      {t("nature.homeSettings.softFocusOff")}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div className={DIVIDER} aria-hidden />

          <NatureHomeVerseAppearancePanel compact natureVerseTextScale={natureVerseTextScale} />

          <div className={DIVIDER} aria-hidden />

          <HomeSleepTimerControl embedded compact />

          {showFullscreenBtn ? (
            <>
              <div className={DIVIDER} aria-hidden />
              <button
                type="button"
                aria-pressed={docElementFullscreen}
                aria-label={docElementFullscreen ? t("nature.fullscreenExitAria") : t("nature.fullscreenEnterAria")}
                onClick={onFullscreenClick}
                className={`${ROW} w-full rounded-md px-1 text-[11px] text-white/82 transition hover:bg-white/[0.06] hover:text-white`}
              >
                <span>{t("nature.homeSettings.fullscreenShort")}</span>
                <span className="text-white/45">{docElementFullscreen ? "▢" : "⤢"}</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={open ? "nature-home-settings-panel" : undefined}
        aria-label={open ? t("nature.homeSettings.closeAria") : t("nature.homeSettings.openAria")}
        className={[
          TOP_BAR_BTN,
          open ? "text-white [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.85))]" : "",
        ].join(" ")}
      >
        <IconSettings className="h-[1.25rem] w-[1.25rem] opacity-90" />
      </button>
    </div>
  );
}
