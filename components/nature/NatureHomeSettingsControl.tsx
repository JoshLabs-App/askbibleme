"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { NatureHomeLevelSegment } from "@/components/nature/NatureHomeLevelSegment";
import { NatureHomeSleepTimerSection } from "@/components/nature/NatureHomeSleepTimerSection";
import { NatureHomeTextScaleRow } from "@/components/nature/NatureHomeTextScaleRow";
import { NatureHomeTtsSettingsSection } from "@/components/nature/NatureHomeTtsSettingsSection";
import { NatureHomeTranslationSettings } from "@/components/nature/NatureHomeTranslationSettings";
import { NatureHomeVerseEffectPicker } from "@/components/nature/NatureHomeVerseEffectPicker";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import {
  readNatureHomeVerseAppearance,
  writeNatureHomeVerseAppearance,
  type NatureHomeVerseAppearanceV1,
} from "@/lib/home/nature-home-verse-appearance-prefs";
import {
  SHELL_CHROME_HIT_PX,
  SHELL_SETTINGS_ICON_SIZE_PX,
} from "@/lib/shell/shell-chrome-icons";
import type { NatureVisualLevel } from "@/lib/nature/nature-visual-level-prefs";
import {
  getHomeTtsExperimentEnabled,
  subscribeHomeTtsExperiment,
} from "@/lib/home/home-experimental-features";

const DIM_LEVEL_ICONS: Record<NatureVisualLevel, string> = {
  0: "brightness_low",
  1: "brightness_5",
  2: "tonality",
  3: "brightness_high",
};

const BLUR_LEVEL_ICONS: Record<NatureVisualLevel, string> = {
  0: "blur_off",
  1: "blur_circular",
  2: "blur_linear",
  3: "blur_on",
};

const SETTINGS_BTN =
  "touch-manipulation inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-white transition active:scale-[0.97]";

const SHEET =
  "pointer-events-auto relative z-10 flex flex-col gap-1.5 overflow-visible rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-left shadow-[0_8px_32px_-10px_rgba(0,0,0,0.55)]";

const ROW = "flex w-max max-w-full min-h-[34px] items-center gap-2";

const ROW_ICON = "flex w-[26px] shrink-0 items-center justify-center";

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
        <ShellMaterialIcon name={icon} size={18} color="rgba(255,255,255,0.5)" />
      </div>
      <div className="w-max max-w-full shrink-0">{children}</div>
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
  const { t } = useLocale();
  const [portalReady, setPortalReady] = useState(false);
  const [verseAppearance, setVerseAppearance] = useState<NatureHomeVerseAppearanceV1>(() =>
    readNatureHomeVerseAppearance(),
  );
  const [showTtsControls, setShowTtsControls] = useState(false);

  useEffect(() => {
    setShowTtsControls(getHomeTtsExperimentEnabled());
    return subscribeHomeTtsExperiment(() => setShowTtsControls(getHomeTtsExperimentEnabled()));
  }, []);

  useEffect(() => {
    setPortalReady(true);
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
              className={`${SHEET} w-max max-w-[min(calc(100vw-1.5rem),20rem)] shrink-0`}
              style={{
                marginTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
                marginRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
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
                    />
                  </IconSettingRow>
                  <IconSettingRow icon="blur_on" ariaLabel={t("nature.homeSettings.blurSection")}>
                    <NatureHomeLevelSegment
                      selected={blurLevel}
                      onSelect={onBlurLevelChange}
                      iconForLevel={(level) => BLUR_LEVEL_ICONS[level]}
                      ariaLabel={t("nature.homeSettings.blurSection")}
                    />
                  </IconSettingRow>
                </>
              ) : null}

              <IconSettingRow icon="timer" ariaLabel={t("nature.homeSettings.sleepSection")}>
                <NatureHomeSleepTimerSection />
              </IconSettingRow>

              {showTtsControls ? <NatureHomeTtsSettingsSection onPrefsChanged={onPrefsChanged} /> : null}

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

              <div className={`${ROW} items-start`}>
                <div className={`${ROW_ICON} pt-2`} aria-hidden>
                  <ShellMaterialIcon name="menu_book" size={18} color="rgba(255,255,255,0.5)" />
                </div>
                <div className="w-max max-w-full shrink-0">
                  <NatureHomeTranslationSettings onPrefsChanged={onPrefsChanged} />
                </div>
              </div>

              <IconSettingRow icon="smartphone" ariaLabel={t("install.menuAction")}>
                <Link
                  href="/install"
                  className="text-[13px] leading-snug text-white/78 underline decoration-white/25 underline-offset-[3px] transition hover:text-white/92"
                  onClick={() => onOpenChange(false)}
                >
                  {t("install.menuAction")}
                </Link>
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
          width: SHELL_CHROME_HIT_PX,
          height: SHELL_CHROME_HIT_PX,
          opacity: open ? 0.72 : 0.5,
        }}
      >
        <ShellMaterialIcon
          name="settings"
          size={SHELL_SETTINGS_ICON_SIZE_PX}
          color="#FFFFFF"
          legibilityShadow
        />
      </button>
    </>
  );
}
