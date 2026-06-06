/**
 * 移动端圣经整章朗读音源（与 lib/bible/chapter-audio-sources 对齐）。
 */

import type { CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";
import { effectiveVoiceForBook } from "./cuv-chapter-audio-voices";
import {
  buildExternalCuvChapterAudioUrl,
  buildLocalCuvChapterAudioUrl,
  translationSupportsCuvChapterAudio,
} from "./cuv-chapter-audio";
import {
  buildExternalTeochewNtChapterAudioUrl,
  buildLocalTeochewNtChapterAudioUrl,
  teochewNtVoiceActive,
} from "./teochew-nt-audio";
import {
  buildExternalWebChapterAudioUrl,
  buildLocalWebChapterAudioUrl,
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

function toAbsoluteSiteUrl(siteBaseUrl: string | undefined, relPath: string): string {
  const base = String(siteBaseUrl || "").trim().replace(/\/$/, "");
  const rel = String(relPath || "").trim();
  if (!rel) return "";
  if (/^https?:\/\//i.test(rel)) return rel;
  if (!base) return rel.startsWith("/") ? rel : `/${rel}`;
  return `${base}${rel.startsWith("/") ? rel : `/${rel}`}`;
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
  const external = resolveChapterAudioExternalUrl(args);
  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);
  let selfPath = "";
  if (teochewNtVoiceActive(voice)) {
    selfPath = buildLocalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
  } else if (translationUsesWebChapterAudio(args.translationId)) {
    selfPath = buildLocalWebChapterAudioUrl(args.bookId, args.chapter, args.translationId);
  } else if (translationSupportsCuvChapterAudio(args.translationId)) {
    selfPath = buildLocalCuvChapterAudioUrl(args.bookId, args.chapter);
  }
  const selfPrimary = toAbsoluteSiteUrl(args.siteBaseUrl, selfPath);
  const selfFallback = toAbsoluteSiteUrl("https://askbible.me", selfPath);
  return uniqueNonEmpty([external, selfPrimary, selfFallback]);
}
