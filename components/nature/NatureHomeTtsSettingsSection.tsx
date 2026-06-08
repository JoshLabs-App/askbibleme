"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import {
  DEFAULT_NATURE_HOME_TTS_PREFS,
  readNatureHomeTtsPrefs,
  writeNatureHomeTtsPrefs,
  type NatureHomeTtsLevel,
  type NatureHomeTtsPrefs,
} from "@/lib/home/nature-home-tts-prefs";
import type { AppLocale } from "@/lib/i18n/config";

const TTS_LEVELS: readonly NatureHomeTtsLevel[] = [0, 1, 2, 3, 4];

type DeviceVoice = { id: string; name: string; lang: string };

function labelForTtsRate(level: NatureHomeTtsLevel, t: (key: string) => string): string {
  if (level <= 1) return t("nature.homeSettings.ttsLevelSlow");
  if (level >= 3) return t("nature.homeSettings.ttsLevelFast");
  return t("nature.homeSettings.ttsLevelNormal");
}

function labelForTtsPitch(level: NatureHomeTtsLevel, t: (key: string) => string): string {
  if (level <= 1) return t("nature.homeSettings.ttsLevelLow");
  if (level >= 3) return t("nature.homeSettings.ttsLevelHigh");
  return t("nature.homeSettings.ttsLevelNormal");
}

function compactVoiceName(voice: DeviceVoice, locale: AppLocale): string {
  const raw = (voice.name?.trim() || voice.id || "").trim();
  if (!raw) return locale === "en" ? "Voice" : "声线";
  const normalized = raw.replace(/\s+/g, " ");
  if (locale !== "en" && (voice.lang || "").toLowerCase().startsWith("zh")) {
    return normalized.length > 6 ? normalized.slice(0, 6) : normalized;
  }
  const firstWord = normalized.split(" ")[0]?.trim() || normalized;
  return firstWord.length > 10 ? firstWord.slice(0, 10) : firstWord;
}

function loadDeviceVoices(locale: AppLocale): DeviceVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const langPrefix = locale === "en" ? "en" : "zh";
  const voices = window.speechSynthesis.getVoices();
  const valid = voices
    .filter((v) => v.voiceURI?.trim() || v.name?.trim())
    .map((v) => ({
      id: v.voiceURI || v.name,
      name: v.name,
      lang: v.lang,
    }));
  const preferred = valid.filter((v) => (v.lang || "").toLowerCase().startsWith(langPrefix));
  return preferred.length > 0 ? preferred : valid;
}

type Props = {
  onPrefsChanged?: () => void;
};

/** 对齐 App `NatureHomeSettingsPanel` TTS 行（Web Speech API） */
export function NatureHomeTtsSettingsSection({ onPrefsChanged }: Props) {
  const { locale, t } = useLocale();
  const [prefs, setPrefs] = useState<NatureHomeTtsPrefs>(() => readNatureHomeTtsPrefs());
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoice[]>([]);

  useEffect(() => {
    setPrefs(readNatureHomeTtsPrefs());
    const syncVoices = () => setDeviceVoices(loadDeviceVoices(locale));
    syncVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.addEventListener("voiceschanged", syncVoices);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", syncVoices);
    }
  }, [locale]);

  const persist = useCallback(
    (next: NatureHomeTtsPrefs) => {
      writeNatureHomeTtsPrefs(next);
      setPrefs(next);
      onPrefsChanged?.();
    },
    [onPrefsChanged],
  );

  const rateLabel = useMemo(() => labelForTtsRate(prefs.rateLevel, t), [prefs.rateLevel, t]);
  const pitchLabel = useMemo(() => labelForTtsPitch(prefs.pitchLevel, t), [prefs.pitchLevel, t]);

  const sliderClass =
    "h-[30px] w-full cursor-pointer appearance-none rounded bg-transparent accent-zinc-300 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded [&::-webkit-slider-runnable-track]:bg-zinc-600 [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-200";

  return (
    <>
      <div className="flex w-max max-w-full min-h-[34px] items-start gap-2" aria-label={t("nature.homeSettings.ttsRateSection")}>
        <div className="flex w-[26px] shrink-0 items-center justify-center pt-2" aria-hidden>
          <ShellMaterialIcon name="tune" size={18} color="rgba(255,255,255,0.5)" />
        </div>
        <div className="flex w-max shrink-0 gap-2">
          <div className="w-[5.5rem] shrink-0">
            <div className="mb-1 flex items-center gap-2">
              <ShellMaterialIcon name="speed" size={16} color="rgba(255,255,255,0.5)" />
              <span className="sr-only">{t("nature.homeSettings.ttsRateSection")}</span>
              <span className="text-[11px] text-white/50">{rateLabel}</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={prefs.rateLevel}
              aria-label={rateLabel}
              className={sliderClass}
              onChange={(e) => {
                const next = TTS_LEVELS[Math.round(Number(e.target.value))] ?? 2;
                persist({ ...prefs, rateLevel: next });
              }}
            />
          </div>
          <div className="w-[5.5rem] shrink-0">
            <div className="mb-1 flex items-center gap-2">
              <ShellMaterialIcon name="graphic_eq" size={16} color="rgba(255,255,255,0.5)" />
              <span className="sr-only">{t("nature.homeSettings.ttsPitchSection")}</span>
              <span className="text-[11px] text-white/50">{pitchLabel}</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={prefs.pitchLevel}
              aria-label={pitchLabel}
              className={sliderClass}
              onChange={(e) => {
                const next = TTS_LEVELS[Math.round(Number(e.target.value))] ?? 2;
                persist({ ...prefs, pitchLevel: next });
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex w-max max-w-full min-h-[34px] items-center gap-2" aria-label={t("nature.homeSettings.ttsVoiceSection")}>
        <div className="flex w-[26px] shrink-0 items-center justify-center" aria-hidden>
          <ShellMaterialIcon name="record_voice_over" size={18} color="rgba(255,255,255,0.5)" />
        </div>
        <div className="max-w-[12.5rem] shrink-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className="flex items-center gap-1.5 pr-1">
            <button
              type="button"
              aria-label={t("nature.homeSettings.ttsVoiceDefault")}
              aria-pressed={prefs.voiceId === ""}
              onClick={() => persist({ ...prefs, voiceId: "" })}
              className={[
                "flex h-[30px] min-w-8 shrink-0 items-center justify-center rounded-[7px] border px-0 transition",
                prefs.voiceId === ""
                  ? "border-zinc-500 bg-zinc-600 text-white"
                  : "border-zinc-600 bg-zinc-800 text-white/60 hover:bg-zinc-700/80",
              ].join(" ")}
            >
              <ShellMaterialIcon
                name="radio_button_checked"
                size={16}
                color={prefs.voiceId === "" ? "#fff" : "rgba(255,255,255,0.62)"}
              />
            </button>
            {deviceVoices.length === 0 ? (
              <span className="text-[12px] text-white/52">{t("nature.homeSettings.ttsVoiceUnavailable")}</span>
            ) : (
              deviceVoices.map((voice, idx) => {
                const selected = prefs.voiceId === voice.id;
                const baseLabel = compactVoiceName(voice, locale);
                const duplicateCount = deviceVoices.filter(
                  (v) => compactVoiceName(v, locale).toLowerCase() === baseLabel.toLowerCase(),
                ).length;
                const label = duplicateCount > 1 ? `${baseLabel}${idx + 1}` : baseLabel;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={voice.name || voice.id}
                    onClick={() => persist({ ...prefs, voiceId: voice.id })}
                    className={[
                      "h-[30px] shrink-0 rounded-[7px] border px-2.5 text-[12px] transition",
                      selected
                        ? "border-zinc-500 bg-zinc-600 font-semibold text-white"
                        : "border-zinc-600 bg-zinc-800 font-medium text-white/62 hover:bg-zinc-700/80",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export { DEFAULT_NATURE_HOME_TTS_PREFS };
