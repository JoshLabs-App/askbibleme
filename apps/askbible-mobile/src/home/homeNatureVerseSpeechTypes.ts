import type { AppLocale } from "../i18n/config";

export type DisplayedVerseAudioTarget = {
  verseKey: string;
  translationId: string;
  speechMain: string;
  speechReference: string;
  speechLocale: AppLocale;
};
