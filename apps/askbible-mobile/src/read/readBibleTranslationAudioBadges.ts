
type TranslationAudioMeta = {
  id: string;
  language?: string;
};


export type TranslationAudioBadgeKind = "chapter" | "goldenVerse";
const GOLDEN_VERSE_AUDIO_TRANSLATION_IDS = new Set(["cuv-simp", "cuv-trad", "web-en"]);

export function translationSupportsGoldenVerseAudio(meta: TranslationAudioMeta): boolean {
  const id = String(meta.id || "").trim().toLowerCase();
  if (GOLDEN_VERSE_AUDIO_TRANSLATION_IDS.has(id)) return true;
  return false;
}
