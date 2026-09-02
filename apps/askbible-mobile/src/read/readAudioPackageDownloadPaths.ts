import * as FileSystem from "expo-file-system/legacy";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { translationSupportsCuvChapterAudio } from "../bible/cuv-chapter-audio";
import { buildChapterAudioDownloadCandidates } from "../bible/chapter-audio-sources";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import {
  chapterAudioScopeForTranslation,
  translationUsesWebChapterAudio,
} from "../bible/web-chapter-audio";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import type { AudioPackageSelection } from "./readAudioPackageDownloadStore";

const AUDIO_PACKAGE_ROOT = `${FileSystem.documentDirectory}read-audio-packages`;
// 音频包与 verse-timings 需要同批次更新；升级这里可以让旧下载包失效，避免声音/文字继续串版本。
export const AUDIO_PACKAGE_VERSION = "v2";

export type DownloadChapterRef = {
  refKey: string;
  bookId: string;
  chapter: number;
  candidates: string[];
};

export function packageKeyForSelection(selection: AudioPackageSelection): string {
  return `${packageKeyBaseForSelection(selection)}-${AUDIO_PACKAGE_VERSION}`;
}

export function packageKeyBaseForSelection(
  selection: Pick<AudioPackageSelection, "translationId" | "voiceId">,
): string {
  if (translationUsesWebChapterAudio(selection.translationId)) {
    return chapterAudioScopeForTranslation(selection.translationId);
  }
  if (translationSupportsCuvChapterAudio(selection.translationId)) {
    if (selection.voiceId === "teochew-nt") return "cuv-teochew-nt";
    return "cuv-mandarin";
  }
  // 既不是 web/kjv/blm-es，也不是 cuv 系译本（如 YouVersion 专属音源的译本）：
  // 绝不能落回 "cuv-mandarin"，否则会跟普通话缓存共用同一目录，串播/串写其它译本的音频。
  const id = String(selection.translationId || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `edition-${id || "unknown"}`;
}

export function packageDir(packageKey: string): string {
  return `${AUDIO_PACKAGE_ROOT}/${packageKey}`;
}

export function chapterFileUri(packageKey: string, bookId: string, chapter: number): string {
  return `${packageDir(packageKey)}/${bookId.toUpperCase()}-${chapter}.mp3`;
}

export function chapterRefsForSelection(selection: AudioPackageSelection): DownloadChapterRef[] {
  const baseUrl = getAskBibleBaseUrl();
  const refs: DownloadChapterRef[] = [];
  for (const book of scriptureBooks) {
    for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
      if (
        !translationUsesWebChapterAudio(selection.translationId) &&
        !translationSupportsCuvChapterAudio(selection.translationId)
      ) {
        continue;
      }
      refs.push({
        refKey: `${book.bookId}:${chapter}`,
        bookId: book.bookId,
        chapter,
        candidates: buildChapterAudioDownloadCandidates({
          translationId: selection.translationId,
          bookId: book.bookId,
          chapter,
          voiceId: selection.voiceId,
          siteBaseUrl: baseUrl,
        }),
      });
    }
  }
  return refs.filter((r) => r.candidates.length > 0);
}

export async function isChapterFileReady(packageKey: string, ref: DownloadChapterRef): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(chapterFileUri(packageKey, ref.bookId, ref.chapter));
  return Boolean(info.exists && typeof info.size === "number" && info.size > 0);
}

export async function ensurePackageDir(packageKey: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(packageDir(packageKey), { intermediates: true });
}

export function chapterAudioPackageKey(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
}): string {
  return `${packageKeyBaseForSelection(args)}-${AUDIO_PACKAGE_VERSION}`;
}

export async function resolveDownloadedChapterAudioUri(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
}): Promise<string | null> {
  if (!translationUsesWebChapterAudio(args.translationId) && !translationSupportsCuvChapterAudio(args.translationId)) {
    return null;
  }
  const key = chapterAudioPackageKey({ translationId: args.translationId, voiceId: args.voiceId });
  const uri = chapterFileUri(key, args.bookId, args.chapter);
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof info.size === "number" && info.size > 0) return uri;
  } catch {
    /* ignore */
  }
  // 章页点播 / 今日读经边播边存（10 天保留）；完整语音包优先于流式缓存。
  try {
    const { resolveStreamCachedChapterAudioUri } = await import("./readChapterAudioStreamCache");
    return await resolveStreamCachedChapterAudioUri(args);
  } catch {
    return null;
  }
}

export function chapterCacheKey(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
}): string {
  return `${args.translationId}:${args.voiceId}:${args.bookId.toUpperCase()}:${args.chapter}`;
}
