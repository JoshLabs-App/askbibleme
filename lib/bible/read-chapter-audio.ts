import {
  resolveCuvChapterAudioPlayableSrc,
  translationSupportsCuvChapterAudio,
} from "@/lib/bible/cuv-chapter-audio";
import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import {
  resolveYouVersionChapterAudioPlayableSrc,
  translationHasVerifiedYouVersionChapterAudio,
} from "@/lib/bible/youversion-chapter-audio";
import {
  resolveWebChapterAudioPlayableSrc,
  translationUsesWebChapterAudio,
} from "@/lib/bible/web-chapter-audio";

export function translationSupportsChapterAudio(translationId: string): boolean {
  return (
    translationSupportsCuvChapterAudio(translationId) ||
    translationUsesWebChapterAudio(translationId) ||
    translationHasVerifiedYouVersionChapterAudio(translationId)
  );
}

export async function resolveChapterAudioPlayableSrc(args: {
  translationId: string;
  bookName: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  if (translationUsesWebChapterAudio(args.translationId)) {
    return resolveWebChapterAudioPlayableSrc({
      bookId: args.bookId,
      chapter: args.chapter,
      translationId: args.translationId,
    });
  }
  if (translationHasVerifiedYouVersionChapterAudio(args.translationId)) {
    return resolveYouVersionChapterAudioPlayableSrc({
      translationId: args.translationId,
      bookId: args.bookId,
      chapter: args.chapter,
    });
  }
  if (translationSupportsCuvChapterAudio(args.translationId)) {
    return resolveCuvChapterAudioPlayableSrc({
      bookName: args.bookName,
      bookId: args.bookId,
      chapter: args.chapter,
      voiceId: args.voiceId,
    });
  }
  return { ok: false };
}
