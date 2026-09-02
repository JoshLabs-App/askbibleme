/**
 * 移动端圣经整章朗读音源（与 lib/bible/chapter-audio-sources 对齐）。
 * 允许：本地包 / FHL / WEB / YouVersion / 潮语。直连原始公开站点，不经
 * askbible.me 存放/转发。自然/音乐等内容库不走这里。
 */

import type { CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";
import { effectiveVoiceForBook } from "./cuv-chapter-audio-voices";
import {
  buildExternalCuvChapterAudioUrl,
  translationSupportsCuvChapterAudio,
} from "./cuv-chapter-audio";
import {
  buildExternalTeochewNtChapterAudioUrl,
  teochewNtVoiceActive,
} from "./teochew-nt-audio";
import {
  buildExternalWebChapterAudioUrl,
  translationUsesWebChapterAudio,
} from "./web-chapter-audio";

function uniqueNonEmpty(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const s = String(raw || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function resolveChapterAudioExternalUrl(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): string {
  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);
  if (teochewNtVoiceActive(voice)) {
    return buildExternalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
  }
  if (translationUsesWebChapterAudio(args.translationId)) {
    return buildExternalWebChapterAudioUrl(args.bookId, args.chapter, args.translationId);
  }
  if (translationSupportsCuvChapterAudio(args.translationId)) {
    return buildExternalCuvChapterAudioUrl(args.bookId, args.chapter);
  }
  return "";
}

export function buildChapterAudioDownloadCandidates(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
  siteBaseUrl?: string;
}): string[] {
  return uniqueNonEmpty([resolveChapterAudioExternalUrl(args)]);
}
