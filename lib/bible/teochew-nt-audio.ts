import manifest from "@/data/bible/teochew-nt-audio-manifest.json";
import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import { voiceSupportsBook } from "@/lib/bible/cuv-chapter-audio-voices";

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

/** 自托管路径：`/audio/teochew-nt/MAT-1.mp3` */
export function buildLocalTeochewNtChapterAudioUrl(bookId: string, chapter: number): string {
  const entry = getTeochewNtManifestEntry(bookId, chapter);
  if (!entry) return "";
  return `/audio/teochew-nt/${entry.localFilename}`;
}

export async function resolveTeochewNtChapterAudioPlayableSrc(args: {
  bookId: string;
  chapter: number;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  if (!voiceSupportsBook("teochew-nt", args.bookId)) return { ok: false };

  const entry = getTeochewNtManifestEntry(args.bookId, args.chapter);
  if (!entry) return { ok: false };

  const local = buildLocalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
  if (!local) return { ok: false };

  // 清单已列章 → 使用本站 /audio（磁盘或 GitHub 代理）。勿用 HEAD + force-cache，避免缓存旧 404 导致无法播放。
  return { ok: true, src: local };
}

export function teochewNtVoiceActive(voiceId: CuvChapterAudioVoiceId): boolean {
  return voiceId === "teochew-nt";
}
