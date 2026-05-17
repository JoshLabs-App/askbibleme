import { scriptureBooks, testamentForBookNumber } from "@/lib/bible/scripture-books";

export type CuvChapterAudioVoiceId = "mandarin" | "teochew-nt";

export const CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY = "selah-cuv-chapter-audio-voice-v1";

export type CuvChapterAudioVoice = {
  id: CuvChapterAudioVoiceId;
  labelKey: string;
  /** mandarin: full Bible audio when hosted; teochew-nt: NT only */
  scope: "all" | "new-testament";
};

export const CUV_CHAPTER_AUDIO_VOICES: CuvChapterAudioVoice[] = [
  { id: "mandarin", labelKey: "pages.read.chapterAudioVoiceMandarin", scope: "all" },
  { id: "teochew-nt", labelKey: "pages.read.chapterAudioVoiceTeochewNt", scope: "new-testament" },
];

export function isCuvChapterAudioVoiceId(v: string): v is CuvChapterAudioVoiceId {
  return v === "mandarin" || v === "teochew-nt";
}

export function readStoredCuvChapterAudioVoice(): CuvChapterAudioVoiceId {
  if (typeof window === "undefined") return "mandarin";
  try {
    const raw = localStorage.getItem(CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY)?.trim();
    if (raw && isCuvChapterAudioVoiceId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "mandarin";
}

export function writeStoredCuvChapterAudioVoice(voiceId: CuvChapterAudioVoiceId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY, voiceId);
  } catch {
    /* ignore */
  }
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
