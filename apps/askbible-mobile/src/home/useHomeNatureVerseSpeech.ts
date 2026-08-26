import { useFocusEffect } from "@react-navigation/native";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { InteractionManager } from "react-native";
import type { AppLocale } from "../i18n/config";
import { t } from "../i18n/site-copy";
import { parseVerseKey } from "../bible/parse-verse-key";
import {
  DEFAULT_NATURE_HOME_TTS_PREFS,
  getNatureHomeTtsPrefsVersion,
  readNatureHomeTtsPrefs,
  subscribeNatureHomeTtsPrefs,
  type NatureHomeTtsPrefs,
} from "./natureHomePrefs";
import { filterNonFemaleTtsVoices, type NatureHomeTtsDeviceVoice } from "./natureHomeTtsVoices";
import {
  getHomeTtsExperimentEnabled,
  subscribeHomeTtsExperiment,
} from "./homeExperimentalFeatures";
import type { DisplayedVerseAudioTarget } from "./homeNatureVerseSpeechTypes";
import { speakHomeVerseTarget } from "./homeNatureVerseSpeechSpeak";

type Args = {
  prefsVersion: number;
  scriptureModeActive: boolean;
  enabled?: boolean;
};

export function useHomeNatureVerseSpeech({ prefsVersion, scriptureModeActive, enabled = true }: Args) {
  const homeTtsExperimentEnabled = useSyncExternalStore(
    subscribeHomeTtsExperiment,
    getHomeTtsExperimentEnabled,
    getHomeTtsExperimentEnabled,
  );
  const ttsPrefsVersion = useSyncExternalStore(
    subscribeNatureHomeTtsPrefs,
    getNatureHomeTtsPrefsVersion,
    getNatureHomeTtsPrefsVersion,
  );

  const [displayedVerseAudioTarget, setDisplayedVerseAudioTarget] = useState<DisplayedVerseAudioTarget | null>(null);
  const [voicePreparing, setVoicePreparing] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [ttsPrefs, setTtsPrefs] = useState<NatureHomeTtsPrefs>(DEFAULT_NATURE_HOME_TTS_PREFS);

  const homeVoiceSessionIdRef = useRef(0);
  const ttsPrefsRef = useRef<NatureHomeTtsPrefs>(DEFAULT_NATURE_HOME_TTS_PREFS);
  const ttsVoiceCatalogRef = useRef<NatureHomeTtsDeviceVoice[]>([]);
  const displayedVerseAudioTargetRef = useRef<DisplayedVerseAudioTarget | null>(null);
  const advanceVerseRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    return () => {
      homeVoiceSessionIdRef.current += 1;
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (!voiceHint) return;
    const timer = setTimeout(() => setVoiceHint(null), 2200);
    return () => clearTimeout(timer);
  }, [voiceHint]);

  useEffect(() => {
    displayedVerseAudioTargetRef.current = displayedVerseAudioTarget;
  }, [displayedVerseAudioTarget]);

  useEffect(() => {
    ttsPrefsRef.current = ttsPrefs;
  }, [ttsPrefs]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readNatureHomeTtsPrefs().then((prefs) => {
        if (!cancelled) setTtsPrefs(prefs);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [enabled, prefsVersion, ttsPrefsVersion]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let cancelled = false;
      let voiceTask: { cancel: () => void } | null = null;
      if (homeTtsExperimentEnabled) {
        voiceTask = InteractionManager.runAfterInteractions(() => {
          void Speech.getAvailableVoicesAsync()
            .then((voices) => {
              if (cancelled) return;
              const catalog = filterNonFemaleTtsVoices(
                voices
                  .map((voice) => ({
                    identifier: String(voice.identifier || "").trim(),
                    name: typeof voice.name === "string" ? voice.name : undefined,
                    language: typeof voice.language === "string" ? voice.language : undefined,
                  }))
                  .filter((voice) => voice.identifier.length > 0),
              );
              ttsVoiceCatalogRef.current = catalog;
            })
            .catch(() => {
              if (!cancelled) {
                ttsVoiceCatalogRef.current = [];
              }
            });
        });
      }
      return () => {
        cancelled = true;
        voiceTask?.cancel();
        homeVoiceSessionIdRef.current += 1;
        void Speech.stop();
        setVoicePreparing(false);
        setVoiceSpeaking(false);
      };
    }, [enabled, homeTtsExperimentEnabled]),
  );

  const onDisplayedVerseChange = useCallback(
    (payload: {
      verseKey: string | null;
      primaryTranslationId: string;
      speechMain: string;
      speechReference: string;
      speechLocale: AppLocale;
    }) => {
      const verseKey = payload.verseKey?.trim() || "";
      if (!verseKey || !parseVerseKey(verseKey)) {
        setDisplayedVerseAudioTarget(null);
        return;
      }
      setDisplayedVerseAudioTarget({
        verseKey,
        translationId: payload.primaryTranslationId || "cuv-simp",
        speechMain: payload.speechMain?.trim() || "",
        speechReference: payload.speechReference?.trim() || "",
        speechLocale: payload.speechLocale,
      });
    },
    [],
  );

  const onAdvanceControllerReady = useCallback((advanceNow: () => Promise<void>) => {
    advanceVerseRef.current = advanceNow;
  }, []);

  const stopHomeVerseSpeech = useCallback(async () => {
    homeVoiceSessionIdRef.current += 1;
    try {
      await Speech.stop();
    } catch {
      // ignore stop errors
    }
    setVoicePreparing(false);
    setVoiceSpeaking(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (homeTtsExperimentEnabled) return;
    setVoiceHint(null);
    void stopHomeVerseSpeech();
  }, [enabled, homeTtsExperimentEnabled, stopHomeVerseSpeech]);

  useEffect(() => {
    if (!enabled) return;
    if (!scriptureModeActive) return;
    void stopHomeVerseSpeech();
  }, [enabled, scriptureModeActive, stopHomeVerseSpeech]);

  const speakCtxRef = useRef({
    homeVoiceSessionIdRef,
    ttsPrefsRef,
    ttsVoiceCatalogRef,
    displayedVerseAudioTargetRef,
    advanceVerseRef,
    setVoiceSpeaking,
    setVoiceHint,
  });
  speakCtxRef.current = {
    homeVoiceSessionIdRef,
    ttsPrefsRef,
    ttsVoiceCatalogRef,
    displayedVerseAudioTargetRef,
    advanceVerseRef,
    setVoiceSpeaking,
    setVoiceHint,
  };

  const onPlayDisplayedVerseVoice = useCallback(async () => {
    if (!homeTtsExperimentEnabled) return;
    if (scriptureModeActive) return;
    if (voicePreparing) return;
    if (voiceSpeaking) {
      await stopHomeVerseSpeech();
      setVoiceHint(t("nature.homeVoice.stopped"));
      return;
    }
    if (!displayedVerseAudioTarget) {
      setVoiceHint(t("nature.homeVoice.noVerse"));
      return;
    }
    const text = displayedVerseAudioTarget.speechMain.trim();
    if (!text) {
      setVoiceHint(t("nature.homeVoice.noVerse"));
      return;
    }
    setVoicePreparing(true);
    homeVoiceSessionIdRef.current += 1;
    const sessionId = homeVoiceSessionIdRef.current;
    try {
      await Speech.stop();
    } catch {
      // ignore stop errors
    } finally {
      setVoicePreparing(false);
    }
    setVoiceSpeaking(true);
    setVoiceHint(t("nature.homeVoice.playingNow"));
    void import("../read/reading-habit-stats")
      .then(({ recordAnyReadingActivityDay }) => recordAnyReadingActivityDay())
      .catch(() => undefined);
    speakHomeVerseTarget(displayedVerseAudioTarget, {
      sessionId,
      ...speakCtxRef.current,
    });
  }, [
    displayedVerseAudioTarget,
    homeTtsExperimentEnabled,
    scriptureModeActive,
    stopHomeVerseSpeech,
    voicePreparing,
    voiceSpeaking,
  ]);

  const voiceActive = voicePreparing || voiceSpeaking;

  return {
    homeTtsExperimentEnabled,
    voicePreparing,
    voiceSpeaking,
    voiceActive,
    voiceHint,
    onDisplayedVerseChange,
    onAdvanceControllerReady,
    onPlayDisplayedVerseVoice,
  };
}
