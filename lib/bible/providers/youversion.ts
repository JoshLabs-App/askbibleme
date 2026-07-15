import { parseRemoteChapterContent, type RemoteChapterVerseRow } from "@/lib/bible/providers/content-parser";
import { loadYouVersionChapterRowsFromPage } from "@/lib/bible/youversion-chapter-page";
import type { BibleTranslationMeta } from "@/lib/bible/translations-types";

const YOUVERSION_BASE_URL = "https://api.youversion.com/v1";
const YOUVERSION_APP_KEY = process.env.YVP_APP_KEY?.trim() || "";

async function youVersionFetchJson(url: string): Promise<unknown | null> {
  if (!YOUVERSION_APP_KEY) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "X-YVP-App-Key": YOUVERSION_APP_KEY,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function extractRemoteContent(raw: unknown): string | null {
  const findFirstStringValue = (value: unknown, depth = 0): string | null => {
    if (depth > 3 || value == null) return null;
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = findFirstStringValue(item, depth + 1);
        if (hit) return hit;
      }
      return null;
    }
    if (typeof value !== "object") return null;
    for (const key of ["content", "text", "passage", "body", "reference"]) {
      const candidate = findFirstStringValue((value as Record<string, unknown>)[key], depth + 1);
      if (candidate) return candidate;
    }
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const hit = findFirstStringValue(nested, depth + 1);
      if (hit) return hit;
    }
    return null;
  };

  return findFirstStringValue(raw);
}

function resolveYouVersionVersionId(meta: BibleTranslationMeta): string | null {
  const remoteId = meta.remoteId?.trim();
  if (remoteId) return remoteId;
  return meta.id === "niv" ? "111" : null;
}

type YouVersionChapterVerse = {
  id?: string;
  passage_id?: string;
  title?: string;
};

async function loadYouVersionVerseText(versionId: string, passageId: string): Promise<string | null> {
  const url = `${YOUVERSION_BASE_URL}/bibles/${encodeURIComponent(versionId)}/passages/${encodeURIComponent(
    passageId,
  )}?content-type=text`;
  const json = await youVersionFetchJson(url);
  const content = extractRemoteContent(json);
  return content ? content.trim() : null;
}

export async function loadYouVersionChapterRows(
  meta: BibleTranslationMeta,
  bookId: string,
  chapter: number,
): Promise<RemoteChapterVerseRow[] | null> {
  const versionId = resolveYouVersionVersionId(meta);
  if (!versionId) return null;

  const pageRows = await loadYouVersionChapterRowsFromPage({
    translationId: meta.id,
    bookId,
    chapter,
  });
  if (pageRows?.length) return pageRows;

  if (!YOUVERSION_APP_KEY) return null;
  const chapterId = `${String(bookId || "").trim().toUpperCase()}.${chapter}`;
  const verseListUrl = `${YOUVERSION_BASE_URL}/bibles/${encodeURIComponent(versionId)}/books/${encodeURIComponent(
    String(bookId || "").trim().toUpperCase(),
  )}/chapters/${encodeURIComponent(String(chapter))}/verses`;
  const verseListJson = await youVersionFetchJson(verseListUrl);
  const verseList = Array.isArray((verseListJson as { data?: unknown } | null)?.data)
    ? ((verseListJson as { data?: YouVersionChapterVerse[] }).data ?? [])
    : [];
  const passageIds = verseList
    .map((row) => String(row.passage_id || `${chapterId}.${String(row.title || row.id || "").trim()}`).trim())
    .filter(Boolean);
  if (passageIds.length > 0) {
    const rows: RemoteChapterVerseRow[] = [];
    for (let index = 0; index < passageIds.length; index += 1) {
      const verseNo = index + 1;
      const content = await loadYouVersionVerseText(versionId, passageIds[index]!);
      if (!content) continue;
      rows.push({ verse: verseNo, text: content });
    }
    if (rows.length > 0) return rows;
  }

  const urls = [
    `${YOUVERSION_BASE_URL}/bibles/${encodeURIComponent(versionId)}/passages/${encodeURIComponent(
      chapterId,
    )}?content-type=text`,
    `${YOUVERSION_BASE_URL}/bibles/${encodeURIComponent(versionId)}/passages/${encodeURIComponent(chapterId)}`,
  ];
  for (const url of urls) {
    const json = await youVersionFetchJson(url);
    const content = extractRemoteContent(json);
    if (!content) continue;
    const rows = parseRemoteChapterContent(content);
    if (rows.length > 0) return rows;
  }
  return null;
}
