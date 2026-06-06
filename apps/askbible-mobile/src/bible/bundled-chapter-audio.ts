import { Asset } from "expo-asset";
import type { CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";
import { effectiveVoiceForBook } from "./cuv-chapter-audio-voices";
import { chapterAudioScopeForTranslation, translationUsesWebChapterAudio } from "./web-chapter-audio";

type ChapterAudioModules = Record<string, number>;

let modules: ChapterAudioModules | null = null;

function loadModules(): ChapterAudioModules {
  if (modules) return modules;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const generated = require("../media/generated/bundled-chapter-audio") as {
      CHAPTER_AUDIO_MODULES?: ChapterAudioModules;
    };
    modules = generated.CHAPTER_AUDIO_MODULES ?? {};
  } catch {
    modules = {};
  }
  return modules;
}

function moduleKey(
  translationId: string,
  bookId: string,
  chapter: number,
  voiceId?: CuvChapterAudioVoiceId,
): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (translationUsesWebChapterAudio(translationId)) {
    return `${chapterAudioScopeForTranslation(translationId)}:${id}-${chapter}`;
  }
  const voice = effectiveVoiceForBook(voiceId ?? "mandarin", id);
  if (voice === "teochew-nt") return `teochew-nt:${id}-${chapter}`;
  return `cuv:${id}-${chapter}`;
}

export function resolveBundledChapterAudioUri(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): string | null {
  const mod = loadModules()[moduleKey(args.translationId, args.bookId, args.chapter, args.voiceId)];
  if (mod == null) return null;
  return Asset.fromModule(mod).uri;
}
