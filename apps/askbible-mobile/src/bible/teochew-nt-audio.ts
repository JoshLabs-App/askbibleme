import manifest from "../../assets/bible/teochew-nt-audio-manifest.json";
import { isMobileScriptureReadLocalOnly } from "../config/mobileBundledOnly";
import { absoluteSelfHostedChapterAudioUrl } from "./chapter-audio-url";
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

export async function resolveTeochewNtChapterAudioPlayableSrc(args: {
  bookId: string;
  chapter: number;
  baseUrl: string;
}): Promise<{ ok: true; src: string } | { ok: false }> {
  if (!voiceSupportsBook("teochew-nt", args.bookId)) return { ok: false };
  if (!getTeochewNtManifestEntry(args.bookId, args.chapter)) return { ok: false };
  if (isMobileScriptureReadLocalOnly()) return { ok: false };

  const local = buildLocalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
  const selfHosted =
    (local ? absoluteSelfHostedChapterAudioUrl(args.baseUrl, local) : null) ??
    (local ? absoluteSelfHostedChapterAudioUrl("https://askbible.me", local) : null);
  if (selfHosted) return { ok: true, src: selfHosted };

  const external = buildExternalTeochewNtChapterAudioUrl(args.bookId, args.chapter);
  if (external) return { ok: true, src: external };
  return { ok: false };
}
