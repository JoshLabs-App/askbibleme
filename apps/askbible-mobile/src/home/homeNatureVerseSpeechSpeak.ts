import * as Speech from "expo-speech";
import type { AppLocale } from "../i18n/config";
import { t } from "../i18n/site-copy";
import { ttsPitchFromLevel, ttsRateFromLevel, type NatureHomeTtsPrefs } from "./natureHomePrefs";
import { resolveMaleTtsVoiceId, type NatureHomeTtsDeviceVoice } from "./natureHomeTtsVoices";
import type { DisplayedVerseAudioTarget } from "./homeNatureVerseSpeechTypes";
import {
  HOME_VOICE_NEXT_DELAY_MS,
  HOME_VOICE_REFERENCE_DELAY_MS,
  HOME_VOICE_TEXT_APPEAR_DELAY_MS,
} from "./homeNatureScreenConstants";

type SpeakContext = {
  sessionId: number;
  homeVoiceSessionIdRef: React.MutableRefObject<number>;
  ttsPrefsRef: React.MutableRefObject<NatureHomeTtsPrefs>;
  ttsVoiceCatalogRef: React.MutableRefObject<NatureHomeTtsDeviceVoice[]>;
  displayedVerseAudioTargetRef: React.MutableRefObject<DisplayedVerseAudioTarget | null>;
  advanceVerseRef: React.MutableRefObject<(() => Promise<void>) | null>;
  setVoiceSpeaking: (speaking: boolean) => void;
  setVoiceHint: (hint: string | null) => void;
};

export function speakHomeVerseTarget(
  target: DisplayedVerseAudioTarget,
  ctx: SpeakContext,
): void {
  const { sessionId, homeVoiceSessionIdRef } = ctx;
  if (sessionId !== homeVoiceSessionIdRef.current) return;
  const mainText = target.speechMain.trim();
  if (!mainText) {
    ctx.setVoiceSpeaking(false);
    ctx.setVoiceHint(t("nature.homeVoice.noVerse"));
    return;
  }
  const language =
    target.speechLocale === "en" ? "en-US" : target.speechLocale === "zh-TW" ? "zh-TW" : "zh-CN";
  const activeTtsPrefs = ctx.ttsPrefsRef.current;
  const selectedVoiceId = String(activeTtsPrefs.voiceId || "").trim();
  const expectedPrefix = target.speechLocale === "en" ? "en" : "zh";
  const safeVoice = resolveMaleTtsVoiceId(ctx.ttsVoiceCatalogRef.current, {
    preferredId: selectedVoiceId,
    langPrefix: expectedPrefix,
  });

  const proceedToNextVerse = () => {
    if (sessionId !== homeVoiceSessionIdRef.current) return;
    const advanceNow = ctx.advanceVerseRef.current;
    if (!advanceNow) {
      ctx.setVoiceSpeaking(false);
      return;
    }
    const prevVerseKey = target.verseKey;
    setTimeout(() => {
      if (sessionId !== homeVoiceSessionIdRef.current) return;
      void advanceNow()
        .then(() => {
          const waitStart = Date.now();
          const waitForNext = () => {
            if (sessionId !== homeVoiceSessionIdRef.current) return;
            const next = ctx.displayedVerseAudioTargetRef.current;
            if (next && next.verseKey !== prevVerseKey) {
              speakHomeVerseTarget(next, ctx);
              return;
            }
            if (Date.now() - waitStart > 5200) {
              ctx.setVoiceSpeaking(false);
              return;
            }
            setTimeout(waitForNext, 180);
          };
          setTimeout(waitForNext, 180);
        })
        .catch(() => {
          ctx.setVoiceSpeaking(false);
        });
    }, HOME_VOICE_NEXT_DELAY_MS);
  };

  const speakReferenceThenContinue = () => {
    const refText = target.speechReference.trim();
    if (!refText) {
      proceedToNextVerse();
      return;
    }
    setTimeout(() => {
      if (sessionId !== homeVoiceSessionIdRef.current) return;
      Speech.speak(refText, {
        language,
        rate: ttsRateFromLevel(activeTtsPrefs.rateLevel),
        pitch: ttsPitchFromLevel(activeTtsPrefs.pitchLevel),
        voice: safeVoice,
        onDone: () => {
          proceedToNextVerse();
        },
        onStopped: () => {
          if (sessionId !== homeVoiceSessionIdRef.current) return;
          ctx.setVoiceSpeaking(false);
        },
        onError: () => {
          if (sessionId !== homeVoiceSessionIdRef.current) return;
          ctx.setVoiceSpeaking(false);
          ctx.setVoiceHint(t("nature.homeVoice.audioUnavailable"));
        },
      });
    }, HOME_VOICE_REFERENCE_DELAY_MS);
  };

  setTimeout(() => {
    if (sessionId !== homeVoiceSessionIdRef.current) return;
    Speech.speak(mainText, {
      language,
      rate: ttsRateFromLevel(activeTtsPrefs.rateLevel),
      pitch: ttsPitchFromLevel(activeTtsPrefs.pitchLevel),
      voice: safeVoice,
      onDone: () => {
        speakReferenceThenContinue();
      },
      onStopped: () => {
        if (sessionId !== homeVoiceSessionIdRef.current) return;
        ctx.setVoiceSpeaking(false);
      },
      onError: () => {
        if (sessionId !== homeVoiceSessionIdRef.current) return;
        ctx.setVoiceSpeaking(false);
        ctx.setVoiceHint(t("nature.homeVoice.audioUnavailable"));
      },
    });
  }, HOME_VOICE_TEXT_APPEAR_DELAY_MS);
}
