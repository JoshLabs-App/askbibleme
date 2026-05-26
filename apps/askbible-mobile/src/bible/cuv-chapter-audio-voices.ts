import { scriptureBooks, testamentForBookNumber } from "./scripture-books";

export type CuvChapterAudioVoiceId = "mandarin" | "teochew-nt";

export const CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY = "askbible-cuv-chapter-audio-voice-v1";
export const CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY = "selah-cuv-chapter-audio-voice-v1";

export const CUV_CHAPTER_AUDIO_VOICES = [
  { id: "mandarin" as const, labelKey: "pages.read.chapterAudioVoiceMandarin" },
  { id: "teochew-nt" as const, labelKey: "pages.read.chapterAudioVoiceTeochewNt" },
];

export function isCuvChapterAudioVoiceId(v: string): v is CuvChapterAudioVoiceId {
  return v === "mandarin" || v === "teochew-nt";
}

export function voiceSupportsBook(voiceId: CuvChapterAudioVoiceId, bookId: string): boolean {
  if (voiceId === "mandarin") return true;
  const meta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!meta) return false;
  return testamentForBookNumber(meta.bookNumber) === "new";
}

export function effectiveVoiceForBook(
  preferred: CuvChapterAudioVoiceId,
  bookId: string,
): CuvChapterAudioVoiceId {
  if (voiceSupportsBook(preferred, bookId)) return preferred;
  return "mandarin";
}
