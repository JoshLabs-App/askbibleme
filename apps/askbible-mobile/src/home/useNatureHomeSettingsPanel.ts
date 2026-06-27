import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, Linking } from "react-native";
import { getLocale } from "../i18n/locale-store";
import {
  DEFAULT_HOME_VERSE_ROTATION_SEC,
  readHomeVerseRotationSec,
} from "./homeVerseRotationPrefs";
import {
  DEFAULT_BLUR_LEVEL,
  DEFAULT_DIM_LEVEL,
  platformDefaultTextScaleIndex,
  DEFAULT_VERSE_APPEARANCE,
  readNatureHomeTextScaleIndex,
  readNatureHomeTtsPrefs,
  readNatureHomeVerseAppearance,
  readNatureSoftFocusBlurLevel,
  readNatureSoftFocusDimLevel,
  writeNatureHomeTtsPrefs,
  type NatureHomeTtsLevel,
  type NatureHomeVerseAppearance,
  type NatureVisualLevel,
} from "./natureHomePrefs";
import { filterTtsVoicesForLocale, sanitizeTtsVoiceId } from "./natureHomeTtsVoices";
import type { DeviceVoice } from "./natureHomeSettingsPanelConstants";
import { ttsPrefsEqual } from "./natureHomeSettingsPanelHelpers";

type Args = {
  visible: boolean;
  showTtsControls: boolean;
  onPrefsChanged: () => void;
};

export function useNatureHomeSettingsPanel({ visible, showTtsControls, onPrefsChanged }: Args) {
  const [scaleIndex, setScaleIndex] = useState(platformDefaultTextScaleIndex);
  const [verseAppearance, setVerseAppearance] = useState<NatureHomeVerseAppearance>(
    DEFAULT_VERSE_APPEARANCE,
  );
  const [dimLevel, setDimLevel] = useState<NatureVisualLevel>(DEFAULT_DIM_LEVEL);
  const [blurLevel, setBlurLevel] = useState<NatureVisualLevel>(DEFAULT_BLUR_LEVEL);
  const [ttsRateLevel, setTtsRateLevel] = useState<NatureHomeTtsLevel>(2);
  const [ttsPitchLevel, setTtsPitchLevel] = useState<NatureHomeTtsLevel>(2);
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [verseRotationSec, setVerseRotationSec] = useState(DEFAULT_HOME_VERSE_ROTATION_SEC);
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoice[]>([]);
  const lastSavedTtsRef = useRef<{
    rateLevel: NatureHomeTtsLevel;
    pitchLevel: NatureHomeTtsLevel;
    voiceId: string;
  } | null>(null);
  const ttsHydratedRef = useRef(false);

  const load = useCallback(async () => {
    const [scale, appearance, dim, blur, rotationSec] = await Promise.all([
      readNatureHomeTextScaleIndex(),
      readNatureHomeVerseAppearance(),
      readNatureSoftFocusDimLevel(),
      readNatureSoftFocusBlurLevel(),
      readHomeVerseRotationSec(),
    ]);
    setScaleIndex(scale);
    setVerseAppearance(appearance);
    setDimLevel(dim);
    setBlurLevel(blur);
    setVerseRotationSec(rotationSec);
    if (showTtsControls) {
      const tts = await readNatureHomeTtsPrefs();
      setTtsRateLevel(tts.rateLevel);
      setTtsPitchLevel(tts.pitchLevel);
      setTtsVoiceId(tts.voiceId);
      lastSavedTtsRef.current = {
        rateLevel: tts.rateLevel,
        pitchLevel: tts.pitchLevel,
        voiceId: tts.voiceId,
      };
      ttsHydratedRef.current = true;
    } else {
      ttsHydratedRef.current = false;
      setDeviceVoices([]);
    }
    return { dim, blur };
  }, [showTtsControls]);

  const loadDeviceVoices = useCallback(async () => {
    if (!showTtsControls) {
      setDeviceVoices([]);
      return;
    }
    try {
      const locale = getLocale();
      const voicesRaw = (await Speech.getAvailableVoicesAsync()) as DeviceVoice[];
      const langPrefix = locale === "en" ? "en" : "zh";
      const filtered = filterTtsVoicesForLocale(voicesRaw, langPrefix);
      setDeviceVoices(filtered);
      setTtsVoiceId((current) => {
        const safe = sanitizeTtsVoiceId(filtered, current, langPrefix);
        if (safe !== current) {
          lastSavedTtsRef.current = {
            rateLevel: lastSavedTtsRef.current?.rateLevel ?? ttsRateLevel,
            pitchLevel: lastSavedTtsRef.current?.pitchLevel ?? ttsPitchLevel,
            voiceId: safe,
          };
        }
        return safe;
      });
    } catch {
      setDeviceVoices([]);
    }
  }, [showTtsControls]);

  const openSystemVoiceSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  useEffect(() => {
    if (!visible) return;
    ttsHydratedRef.current = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void load().then(() => {
        onPrefsChanged();
      });
      void loadDeviceVoices();
    });
    return () => task.cancel();
  }, [visible, load, loadDeviceVoices, onPrefsChanged]);

  useEffect(() => {
    if (!visible) return;
    if (!showTtsControls) return;
    if (!ttsHydratedRef.current) return;
    const next = {
      rateLevel: ttsRateLevel,
      pitchLevel: ttsPitchLevel,
      voiceId: ttsVoiceId,
    };
    if (lastSavedTtsRef.current && ttsPrefsEqual(lastSavedTtsRef.current, next)) return;
    const timer = setTimeout(() => {
      void writeNatureHomeTtsPrefs(next).then(() => {
        lastSavedTtsRef.current = next;
        onPrefsChanged();
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [visible, showTtsControls, ttsRateLevel, ttsPitchLevel, ttsVoiceId, onPrefsChanged]);

  return {
    scaleIndex,
    setScaleIndex,
    verseAppearance,
    setVerseAppearance,
    dimLevel,
    setDimLevel,
    blurLevel,
    setBlurLevel,
    ttsRateLevel,
    setTtsRateLevel,
    ttsPitchLevel,
    setTtsPitchLevel,
    ttsVoiceId,
    setTtsVoiceId,
    deviceVoices,
    openSystemVoiceSettings,
    verseRotationSec,
    setVerseRotationSec,
  };
}
