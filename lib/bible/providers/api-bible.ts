import { parseRemoteChapterContent, type RemoteChapterVerseRow } from "@/lib/bible/providers/content-parser";
import type { BibleTranslationMeta } from "@/lib/bible/translations-types";

const API_BIBLE_BASE_URL = "https://api.scripture.api.bible/v1";
const API_BIBLE_KEY = process.env.API_BIBLE_KEY?.trim() || "";

type ApiBibleVersion = {
  id?: string;
  abbreviation?: string;
  name?: string;
  nameLong?: string;
};

type ApiBiblePassageResponse = {
  data?: {
    content?: string;
    reference?: string;
  };
  content?: string;
  reference?: string;
};

async function apiBibleFetchJson(url: string): Promise<unknown | null> {
  if (!API_BIBLE_KEY) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "api-key": API_BIBLE_KEY,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function findFirstStringValue(value: unknown, depth = 0): string | null {
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
}

function extractRemoteContent(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return findFirstStringValue(raw);
  const obj = raw as Record<string, unknown>;
  const directContent =
    typeof obj.content === "string" && obj.content.trim()
      ? obj.content
      : typeof obj.text === "string" && obj.text.trim()
        ? obj.text
        : null;
  if (directContent) return directContent;
  const data = obj.data;
  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    const nestedContent =
      typeof nested.content === "string" && nested.content.trim()
        ? nested.content
        : typeof nested.text === "string" && nested.text.trim()
          ? nested.text
          : null;
    if (nestedContent) return nestedContent;
  }
  return findFirstStringValue(raw);
}

function stripHtmlTags(raw: string): string {
  return String(raw || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseApiBibleHtmlChapterContent(raw: string): ReturnType<typeof parseRemoteChapterContent> {
  const html = String(raw || "");
  const rows: Array<{ verse: number; text: string }> = [];
  const verseRe = /<span[^>]*data-number="(\d+)"[^>]*class="v"[^>]*>[^<]*<\/span>([\s\S]*?)(?=<span[^>]*data-number="\d+"[^>]*class="v"|<\/p>|$)/gi;
  for (const match of html.matchAll(verseRe)) {
    const verse = Number(match[1]);
    const text = stripHtmlTags(match[2] || "").replace(/\s+/g, " ").trim();
    if (Number.isInteger(verse) && verse > 0 && text) {
      rows.push({ verse, text });
    }
  }
  return rows.sort((a, b) => a.verse - b.verse);
}

async function resolveApiBibleVersionId(meta: BibleTranslationMeta): Promise<string | null> {
  if (!API_BIBLE_KEY) return null;
  const remoteId = meta.remoteId?.trim();
  if (remoteId) return remoteId;
  const lookup = meta.id.trim().toUpperCase();
  const queries = [
    `${API_BIBLE_BASE_URL}/bibles?language=eng&abbreviation=${encodeURIComponent(lookup)}`,
    `${API_BIBLE_BASE_URL}/bibles?language=eng&name=${encodeURIComponent(meta.labelEn)}`,
  ];
  for (const url of queries) {
    const json = await apiBibleFetchJson(url);
    const data = json && typeof json === "object" ? (json as Record<string, unknown>).data : null;
    if (!Array.isArray(data)) continue;
    const found = data.find((item) => {
      if (!item || typeof item !== "object") return false;
      const bible = item as ApiBibleVersion;
      const abbr = String(bible.abbreviation || "").trim().toUpperCase();
      const name = String(bible.name || bible.nameLong || "").trim().toUpperCase();
      return abbr === lookup || name === lookup || name.includes(lookup);
    }) as ApiBibleVersion | undefined;
    const versionId = String(found?.id || "").trim();
    if (versionId) return versionId;
  }
  return null;
}

async function fetchApiBiblePassageContent(url: string): Promise<string | null> {
  if (!API_BIBLE_KEY) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "api-key": API_BIBLE_KEY,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { content?: string; text?: string };
      content?: string;
      text?: string;
    };
    const direct =
      (typeof json?.data?.content === "string" && json.data.content.trim() ? json.data.content : null) ||
      (typeof json?.data?.text === "string" && json.data.text.trim() ? json.data.text : null) ||
      (typeof json?.content === "string" && json.content.trim() ? json.content : null) ||
      (typeof json?.text === "string" && json.text.trim() ? json.text : null);
    return direct ?? null;
  } catch {
    return null;
  }
}

export async function loadApiBibleChapterRows(
  meta: BibleTranslationMeta,
  bookId: string,
  chapter: number,
): Promise<RemoteChapterVerseRow[] | null> {
  const bibleId = await resolveApiBibleVersionId(meta);
  if (!bibleId) return null;
  const passageId = `${String(bookId || "").trim().toUpperCase()}.${chapter}`;
  const urls = [
    `${API_BIBLE_BASE_URL}/bibles/${encodeURIComponent(bibleId)}/passages/${encodeURIComponent(
      passageId,
    )}?content-type=html&include-notes=true&include-titles=true&include-chapter-numbers=true&include-verse-numbers=true`,
    `${API_BIBLE_BASE_URL}/bibles/${encodeURIComponent(bibleId)}/passages/${encodeURIComponent(
      passageId,
    )}?content-type=text&include-notes=true&include-titles=true&include-chapter-numbers=true&include-verse-numbers=true`,
    `${API_BIBLE_BASE_URL}/bibles/${encodeURIComponent(bibleId)}/passages/${encodeURIComponent(passageId)}`,
  ];
  for (const url of urls) {
    const content = await fetchApiBiblePassageContent(url);
    if (!content) continue;
    const rows = content.includes('data-number="')
      ? parseApiBibleHtmlChapterContent(content)
      : parseRemoteChapterContent(content);
    if (rows.length > 0) return rows;
  }
  return null;
}
