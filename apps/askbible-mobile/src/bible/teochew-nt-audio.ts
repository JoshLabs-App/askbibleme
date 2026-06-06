import manifest from "../../../../data/bible/teochew-nt-audio-manifest.json";
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

export function buildLocalTeochewNtChapterAudioUrl(bookId: string, chapter: number): string {
  const entry = getTeochewNtManifestEntry(bookId, chapter);
  if (!entry) return "";
  return `/audio/teochew-nt/${entry.localFilename}`;
}

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
