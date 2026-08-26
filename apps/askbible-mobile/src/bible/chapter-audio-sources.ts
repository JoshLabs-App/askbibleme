/**
 * 移动端圣经整章朗读音源（与 lib/bible/chapter-audio-sources 对齐）。
 * 允许：本地包 / FHL / WEB / YouVersion / 潮语 / 主站 `/audio` 语音包。
 * 自然/音乐等内容库不走这里。
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
  teochewNtVoiceActive,
} from "./teochew-nt-audio";
import {
  buildExternalWebChapterAudioUrl,
  buildLocalWebChapterAudioUrl,
  translationUsesWebChapterAudio,
} from "./web-chapter-audio";
import { absoluteSelfHostedChapterAudioUrl } from "./chapter-audio-url";

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
  if (!base) return "";
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

/** 主站或本机自托管 `/audio/...`（圣经音频白名单）。 */
export function resolveSelfHostedChapterAudioPlayableUrl(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
  siteBaseUrl?: string;
}): string | null {
  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);
  // 潮语只引用 TSTSCC，不走本站 /audio/teochew-nt
  if (teochewNtVoiceActive(voice)) return null;
  let relPath = "";
  if (translationUsesWebChapterAudio(args.translationId)) {
    relPath = buildLocalWebChapterAudioUrl(args.bookId, args.chapter, args.translationId);
  } else if (translationSupportsCuvChapterAudio(args.translationId)) {
    relPath = buildLocalCuvChapterAudioUrl(args.bookId, args.chapter);
  }
  if (!relPath) return null;
  const base = String(args.siteBaseUrl || "").trim().replace(/\/$/, "");
  if (!base) return null;
  return absoluteSelfHostedChapterAudioUrl(base, relPath);
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
  if (teochewNtVoiceActive(voice)) {
    return uniqueNonEmpty([external]);
  }
  let selfPath = "";
  if (translationUsesWebChapterAudio(args.translationId)) {
    selfPath = buildLocalWebChapterAudioUrl(args.bookId, args.chapter, args.translationId);
  } else if (translationSupportsCuvChapterAudio(args.translationId)) {
    selfPath = buildLocalCuvChapterAudioUrl(args.bookId, args.chapter);
  }
  const selfPrimary = toAbsoluteSiteUrl(args.siteBaseUrl, selfPath);
  return uniqueNonEmpty([external, selfPrimary]);
}
