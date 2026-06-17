import * as Speech from "expo-speech";
import { useEffect, useState } from "react";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import {
  readNatureHomeTtsPrefs,
  writeNatureHomeTtsPrefs,
  type NatureHomeTtsLevel,
} from "../home/natureHomePrefs";
import {
  filterTtsVoicesForLocale,
  inferTtsVoiceGender,
  sanitizeTtsVoiceId,
} from "../home/natureHomeTtsVoices";
import { compactVoiceName, type ShellNavDrawerDeviceVoice } from "./shellNavDrawerVoiceHelpers";

export function useShellNavDrawerTtsState(
  open: boolean,
  homeTtsExperimentEnabled: boolean,
  locale: AppLocale,
) {
  const [ttsRateLevel, setTtsRateLevel] = useState<NatureHomeTtsLevel>(2);
  const [ttsPitchLevel, setTtsPitchLevel] = useState<NatureHomeTtsLevel>(2);
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [ttsVoices, setTtsVoices] = useState<ShellNavDrawerDeviceVoice[]>([]);

  useEffect(() => {
    if (!open || !homeTtsExperimentEnabled) return;
    let alive = true;
    void (async () => {
      const prefs = await readNatureHomeTtsPrefs();
      const voicesRaw = (await Speech.getAvailableVoicesAsync().catch(() => [])) as ShellNavDrawerDeviceVoice[];
      if (!alive) return;
      const langPrefix = locale === "en" ? "en" : "zh";
      const filteredVoices = filterTtsVoicesForLocale(voicesRaw, langPrefix);
      const safeVoiceId = sanitizeTtsVoiceId(filteredVoices, prefs.voiceId, langPrefix);
      setTtsVoices(filteredVoices);
      setTtsRateLevel(prefs.rateLevel);
      setTtsPitchLevel(prefs.pitchLevel);
      setTtsVoiceId(safeVoiceId);
      if (safeVoiceId !== prefs.voiceId) {
        void writeNatureHomeTtsPrefs({
          rateLevel: prefs.rateLevel,
          pitchLevel: prefs.pitchLevel,
          voiceId: safeVoiceId,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, homeTtsExperimentEnabled, locale]);

  const persistTtsPrefs = (next: {
    rateLevel: NatureHomeTtsLevel;
    pitchLevel: NatureHomeTtsLevel;
    voiceId: string;
  }) => {
    setTtsRateLevel(next.rateLevel);
    setTtsPitchLevel(next.pitchLevel);
    setTtsVoiceId(next.voiceId);
    void writeNatureHomeTtsPrefs(next);
  };

  const rateLabels = (
    locale === "en"
      ? (["Very slow", "Slow", "Normal", "Fast", "Very fast"] as const)
      : (["很慢", "偏慢", "标准", "偏快", "很快"] as const).map((label) => resolveUiText(locale, label, label))
  ) as readonly string[];
  const pitchLabels = (
    locale === "en"
      ? (["Very low", "Low", "Normal", "High", "Very high"] as const)
      : (["很低", "偏低", "标准", "偏高", "很高"] as const).map((label) => resolveUiText(locale, label, label))
  ) as readonly string[];
  const rateLabel = rateLabels[ttsRateLevel] ?? rateLabels[2];
  const pitchLabel = pitchLabels[ttsPitchLevel] ?? pitchLabels[2];
  const voiceOptions = [
    ...ttsVoices.map((voice) => ({
      id: voice.identifier,
      label: compactVoiceName(voice),
      gender: inferTtsVoiceGender(voice),
    })),
  ];

  return {
    ttsRateLevel,
    ttsPitchLevel,
    ttsVoiceId,
    persistTtsPrefs,
    rateLabels,
    pitchLabels,
    rateLabel,
    pitchLabel,
    voiceOptions,
  };
}
