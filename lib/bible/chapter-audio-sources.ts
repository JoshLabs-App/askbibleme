/**
 * 圣经整章朗读音源策略（Web + 移动端共享逻辑）。
 *
 * - 经文音频：默认对接原始公开站点（FHL / theaudiopower / ebible / TSTSCC）。
 * - 本站 `/audio/*` 仅作可选自托管回退（Render 不必同步 MP3）。
 * - 移动端「下载包」优先从 external 拉取，落盘后本地播放。
 */

import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import { effectiveVoiceForBook } from "@/lib/bible/cuv-chapter-audio-voices";
import {
  buildExternalCuvChapterAudioUrl,
  buildLocalCuvChapterAudioUrl,
  isCuvChapterAudioSelfHosted,
  translationSupportsCuvChapterAudio,
} from "@/lib/bible/cuv-chapter-audio";
import {
  buildExternalTeochewNtChapterAudioUrl,
  buildLocalTeochewNtChapterAudioUrl,
  teochewNtVoiceActive,
} from "@/lib/bible/teochew-nt-audio";
import {
  buildExternalWebChapterAudioUrl,
  buildLocalWebChapterAudioUrl,
  isWebChapterAudioSelfHosted,
  translationUsesKjvChapterAudio,
  translationUsesWebChapterAudio,
} from "@/lib/bible/web-chapter-audio";

export type ChapterAudioSourceKind = "external" | "self-hosted";

export function chapterAudioRequiresSelfHostedOnly(args: {
  translationId: string;
  voiceId?: CuvChapterAudioVoiceId;
}): boolean {
  if (teochewNtVoiceActive(args.voiceId ?? "mandarin")) {
    return isCuvChapterAudioSelfHosted();
  }
  if (translationUsesKjvChapterAudio(args.translationId)) return false;
  if (translationUsesWebChapterAudio(args.translationId)) {
    return isWebChapterAudioSelfHosted();
  }
  if (translationSupportsCuvChapterAudio(args.translationId)) {
    return isCuvChapterAudioSelfHosted();
  }
  return false;
}

/** 原始公开站点 URL（无则空串）。 */
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

/** 本站相对路径（自托管 `/audio/...`）。 */
export function resolveChapterAudioSelfHostedPath(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): string {
  const voice = effectiveVoiceForBook(args.voiceId ?? "mandarin", args.bookId);
  if (teochewNtVoiceActive(voice)) {
    return buildLocalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
  }
  if (translationUsesWebChapterAudio(args.translationId)) {
    return buildLocalWebChapterAudioUrl(args.bookId, args.chapter, args.translationId);
  }
  if (translationSupportsCuvChapterAudio(args.translationId)) {
    return buildLocalCuvChapterAudioUrl(args.bookId, args.chapter);
  }
  return "";
}

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

/**
 * 下载候选 URL：默认 external 优先，其次 askbible.me / 本机 base。
 */
export function buildChapterAudioDownloadCandidates(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
  siteBaseUrl?: string;
  /** @default true */
  preferExternalFirst?: boolean;
}): string[] {
  const external = resolveChapterAudioExternalUrl(args);
  const selfPath = resolveChapterAudioSelfHostedPath(args);
  const selfPrimary = toAbsoluteSiteUrl(args.siteBaseUrl, selfPath);
  const selfFallback = toAbsoluteSiteUrl("https://askbible.me", selfPath);
  const preferExternal = args.preferExternalFirst !== false;

  if (preferExternal) {
    return uniqueNonEmpty([external, selfPrimary, selfFallback]);
  }
  return uniqueNonEmpty([selfPrimary, selfFallback, external]);
}

/**
 * Web 播放：默认 external；`NEXT_PUBLIC_*_SELF_HOSTED=1` 时仅自托管。
 */
export function resolveChapterAudioWebPlayableUrl(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
  /** 相对路径转绝对 URL，用于自托管回退探测 */
  toAbsolute?: (relPath: string) => string;
}): string {
  const selfOnly = chapterAudioRequiresSelfHostedOnly(args);
  const external = resolveChapterAudioExternalUrl(args);
  const selfPath = resolveChapterAudioSelfHostedPath(args);
  const toAbs = args.toAbsolute ?? ((p: string) => p);

  if (selfOnly) {
    return selfPath ? toAbs(selfPath) : "";
  }
  if (external) return external;
  return selfPath ? toAbs(selfPath) : "";
}
