"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HomeVersePoolMenuPicker } from "@/components/home/HomeVersePoolMenuPicker";
import { HomeVerseHoldTimeMenuPicker } from "@/components/home/HomeVerseHoldTimeMenuPicker";
import { NatureHomeLevelSegment } from "@/components/nature/NatureHomeLevelSegment";
import { NatureHomeSleepTimerSection } from "@/components/nature/NatureHomeSleepTimerSection";
import { NatureHomeTextScaleRow } from "@/components/nature/NatureHomeTextScaleRow";
import { NatureHomeTranslationSettings } from "@/components/nature/NatureHomeTranslationSettings";
import { NatureHomeGoldenVerseAudioSettings } from "@/components/nature/NatureHomeGoldenVerseAudioSettings";
import { NatureHomeVerseEffectPicker } from "@/components/nature/NatureHomeVerseEffectPicker";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import {
  readNatureHomeVerseAppearance,
  writeNatureHomeVerseAppearance,
  type NatureHomeVerseAppearanceV1,
} from "@/lib/home/nature-home-verse-appearance-prefs";
import {
  getHomeVersePoolScope,
  hydrateHomeVersePoolScope,
  setHomeVersePoolScope,
  subscribeHomeVersePoolScope,
} from "@/lib/home/home-verse-pool-scope-prefs";
import { requestHomePrayerVerseFeedReload } from "@/lib/home-prayer-pools/prefs";
import type { NatureVisualLevel } from "@/lib/nature/nature-visual-level-prefs";
import "@/app/(app-shell)/read/read-parchment-background.css";

const DIM_LEVEL_ICONS: Record<NatureVisualLevel, string> = {
  0: "brightness_low",
  1: "brightness_6",
  2: "brightness_5",
  3: "tonality",
  4: "brightness_high",
};

const BLUR_LEVEL_ICONS: Record<NatureVisualLevel, string> = {
  0: "blur_off",
  1: "blur_circular",
  2: "blur_linear",
  3: "blur_on",
  4: "filter_vintage",
};

const SETTINGS_BTN =
  "touch-manipulation inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-white transition active:scale-[0.97]";

const SHEET =
  "nature-home-settings-sheet read-parchment-modal-surface pointer-events-auto relative z-10 flex flex-col overflow-visible rounded-xl border px-[14px] py-[10px] text-left shadow-[0_2px_8px_rgba(42,24,16,0.06)]";

const ROW = "flex w-full min-h-[38px] items-center gap-[10px]";

const ROW_ICON = "flex h-[38px] w-[34px] shrink-0 items-center justify-center";

function IconSettingRow({
  icon,
  ariaLabel,
  children,
  alignTop = false,
}: {
  icon: string;
  ariaLabel: string;
  children: React.ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div className={`${ROW} ${alignTop ? "items-start" : ""}`.trim()} aria-label={ariaLabel}>
      <div className={`${ROW_ICON} ${alignTop ? "pt-2" : ""}`.trim()} aria-hidden>
        <ShellMaterialIcon name={icon} size={24} color="#6e5240" />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export type NatureHomeSettingsControlProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasNatureVisual: boolean;
  dimLevel: NatureVisualLevel;
  blurLevel: NatureVisualLevel;
  onDimLevelChange: (level: NatureVisualLevel) => void;
  onBlurLevelChange: (level: NatureVisualLevel) => void;
  onPrefsChanged?: () => void;
};

/**
 * 自然首页右上：与 App `NatureHomeSettingsPanel` 同序同项。
 */
export function NatureHomeSettingsControl({
  open,
  onOpenChange,
  hasNatureVisual,
  dimLevel,
  blurLevel,
  onDimLevelChange,
  onBlurLevelChange,
  onPrefsChanged,
}: NatureHomeSettingsControlProps) {
  const { t, locale } = useLocale();
  const [portalReady, setPortalReady] = useState(false);
  const [verseAppearance, setVerseAppearance] = useState<NatureHomeVerseAppearanceV1>(() =>
    readNatureHomeVerseAppearance(),
  );
  const selectedVersePoolScope = useSyncExternalStore(
    subscribeHomeVersePoolScope,
    getHomeVersePoolScope,
    getHomeVersePoolScope,
  );

  useEffect(() => {
    setPortalReady(true);
    hydrateHomeVersePoolScope();
  }, []);

  useEffect(() => {
    if (!open) return;
    setVerseAppearance(readNatureHomeVerseAppearance());
    onPrefsChanged?.();
  }, [open, onPrefsChanged]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const panel =
    open && portalReady
      ? createPortal(
          <div
            className="fixed inset-0 z-[90] pointer-events-none"
            data-shell-swipe-nav-exclude
            role="presentation"
          >
            <button
              type="button"
              className="pointer-events-auto absolute inset-0 z-0 border-0 bg-black/40"
              aria-label={t("nature.homeSettings.closeAria")}
              onClick={() => onOpenChange(false)}
            />
            <div
              className="pointer-events-none absolute inset-0 z-[1] flex items-start justify-end"
            >
            <div
              id="nature-home-settings-panel"
              role="region"
              aria-label={t("nature.homeSettings.panelTitle")}
              className={`${SHEET} w-[356px] max-w-[calc(100vw-1.5rem)] shrink-0`}
              style={{
                marginTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
                marginRight: "max(10px, env(safe-area-inset-right, 0px))",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {hasNatureVisual ? (
                <>
                  <IconSettingRow icon="tonality" ariaLabel={t("nature.homeSettings.dimSection")}>
                    <NatureHomeLevelSegment
                      selected={dimLevel}
                      onSelect={onDimLevelChange}
                      iconForLevel={(level) => DIM_LEVEL_ICONS[level]}
                      ariaLabel={t("nature.homeSettings.dimSection")}
                      allowToggleOff
                    />
                  </IconSettingRow>
                  <IconSettingRow icon="blur_on" ariaLabel={t("nature.homeSettings.blurSection")}>
                    <NatureHomeLevelSegment
                      selected={blurLevel}
                      onSelect={onBlurLevelChange}
                      iconForLevel={(level) => BLUR_LEVEL_ICONS[level]}
                      ariaLabel={t("nature.homeSettings.blurSection")}
                      allowToggleOff
                    />
                  </IconSettingRow>
                </>
              ) : null}

              <IconSettingRow icon="timer" ariaLabel={t("nature.homeSettings.sleepSection")}>
                <NatureHomeSleepTimerSection />
              </IconSettingRow>

              <IconSettingRow
                icon="sync"
                ariaLabel={locale === "en" ? "Hold time" : "停留时间"}
              >
                <HomeVerseHoldTimeMenuPicker variant="settings" onPrefsChanged={onPrefsChanged} />
              </IconSettingRow>

              <IconSettingRow icon="text_fields" ariaLabel={t("nature.homeSettings.verseEffectSection")}>
                <NatureHomeVerseEffectPicker
                  selected={verseAppearance.textEffect}
                  onSelect={(effect) => {
                    const next = { ...verseAppearance, textEffect: effect };
                    setVerseAppearance(next);
                    writeNatureHomeVerseAppearance(next);
                    onPrefsChanged?.();
                  }}
                />
              </IconSettingRow>

              <IconSettingRow icon="format_size" ariaLabel={t("nature.homeSettings.verseSizeSection")}>
                <NatureHomeTextScaleRow panelOpen={open} onPrefsChanged={onPrefsChanged} />
              </IconSettingRow>

              <IconSettingRow
                icon="format_list_bulleted"
                ariaLabel={locale === "en" ? "Home Scripture range" : "首页经文范围"}
              >
                <HomeVersePoolMenuPicker
                  locale={locale}
                  selectedScope={selectedVersePoolScope}
                  poolLabel={locale === "en" ? "Home Scripture range" : "首页经文范围"}
                  currentLabel={locale === "en" ? "Current pool" : "当前池"}
                  variant="settings"
                  showStats={false}
                  onSelectScope={(next) => {
                    setHomeVersePoolScope(next);
                    requestHomePrayerVerseFeedReload();
                    onPrefsChanged?.();
                  }}
                />
              </IconSettingRow>

              <div className="flex w-full max-w-full min-h-[38px] items-start gap-[10px]">
                <div className={`${ROW_ICON} pt-2`} aria-hidden>
                  <ShellMaterialIcon name="menu_book" size={24} color="#6e5240" />
                </div>
                <div className="min-w-0 flex-1">
                  <NatureHomeTranslationSettings onPrefsChanged={onPrefsChanged} />
                </div>
              </div>

              <IconSettingRow
                icon="record_voice_over"
                ariaLabel={locale === "en" ? "Verse audio translation" : "金句朗读版本"}
              >
                <NatureHomeGoldenVerseAudioSettings onPrefsChanged={onPrefsChanged} />
              </IconSettingRow>
            </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {panel}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={open ? "nature-home-settings-panel" : undefined}
        aria-label={open ? t("nature.homeSettings.closeAria") : t("nature.homeSettings.openAria")}
        className={SETTINGS_BTN}
        style={{
          width: 52,
          height: 52,
          opacity: open ? 0.72 : 0.5,
        }}
      >
        <ShellMaterialIcon
          name="settings"
          size={28}
          color="#FFFFFF"
          legibilityShadow
        />
      </button>
    </>
  );
}
