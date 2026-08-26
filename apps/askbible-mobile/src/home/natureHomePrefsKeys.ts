export const NATURE_HOME_PREFS_KEYS = {
  verseAppearance: "askbible-nature-home-verse-appearance-v1",
  textScale: "askbible-nature-home-text-scale-v1",
  softFocus: "askbible-nature-soft-focus-v1",
  /** 首页是否播循环视频（关=预烘焙柔焦静帧） */
  liveVideo: "askbible-nature-home-live-video-v1",
  chromeTune: "askbible.shell-template-chrome-tune-v1",
  verseRotationSec: "askbible-home-verse-rotation-sec-v1",
  goldenVerseAudioTranslation: "askbible-home-golden-verse-audio-translation-v1",
  ttsPrefs: "askbible-nature-home-tts-prefs-v1",
} as const;

export const NATURE_HOME_PREFS_LEGACY_KEYS = {
  verseAppearance: "selah-nature-home-verse-appearance-v1",
  textScale: "selah-nature-home-text-scale-v1",
  softFocus: "selah-nature-soft-focus-v1",
  chromeTune: "selah.shell-template-chrome-tune-v1",
  ttsPrefs: "selah-nature-home-tts-prefs-v1",
} as const;
