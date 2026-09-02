import manifest from "../../assets/bible/teochew-nt-audio-manifest.json";
import { isMobileScriptureAudioStreamAllowed } from "../config/mobileBundledOnly";
import type { CuvChapterAudioVoiceId } from "./cuv-chapter-audio-voices";
import { voiceSupportsBook } from "./cuv-chapter-audio-voices";

export type TeochewNtAudioManifestEntry = {
  bookId: string;
  chapter: number;
  tstsccSlug: string;
  remotePath: string;
  remoteUrl: string;
  localFilename: string;
};

type ManifestShape = {
  version: number;
  attribution: string;
  entries: TeochewNtAudioManifestEntry[];
};

const MANIFEST = manifest as ManifestShape;

const BY_KEY = new Map<string, TeochewNtAudioManifestEntry>();
for (const e of MANIFEST.entries) {
  BY_KEY.set(`${e.bookId}:${e.chapter}`, e);
}

export function getTeochewNtManifestEntry(
  bookId: string,
  chapter: number,
): TeochewNtAudioManifestEntry | null {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return null;
  return BY_KEY.get(`${id}:${chapter}`) ?? null;
}

/** 众生命堂 TSTSCC 原始公开 URL（唯一音源）。 */
export function buildExternalTeochewNtChapterAudioUrl(bookId: string, chapter: number): string {
  const entry = getTeochewNtManifestEntry(bookId, chapter);
  return entry?.remoteUrl?.trim() ?? "";
}

export function teochewNtVoiceActive(voiceId: CuvChapterAudioVoiceId): boolean {
  return voiceId === "teochew-nt";
}

export function teochewNtVoiceSupportsBook(bookId: string): boolean {
  return voiceSupportsBook("teochew-nt", bookId);
}

/** 潮语新约：只引用 TSTSCC，不走 askbible.me，不打进安装包。 */
export async function resolveTeochewNtChapterAudioPlayableSrc(args: {
  bookId: string;
  chapter: number;
  baseUrl?: string;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  void args.baseUrl;
  if (!voiceSupportsBook("teochew-nt", args.bookId)) return { ok: false };
  if (!getTeochewNtManifestEntry(args.bookId, args.chapter)) return { ok: false };
  if (!isMobileScriptureAudioStreamAllowed()) return { ok: false };

  const external = buildExternalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
  if (external) return { ok: true, src: external };
  return { ok: false };
}
