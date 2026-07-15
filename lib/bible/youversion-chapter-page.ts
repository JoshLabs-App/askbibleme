import { buildYouVersionAudioPageUrl } from "@/lib/bible/youversion-chapter-audio";
import type { RemoteChapterVerseRow } from "@/lib/bible/providers/content-parser";
import type { BibleTranslationMeta } from "@/lib/bible/translations-types";

const YOUVERSION_TEXT_PAGE_VERSION_INFO: Record<string, { versionId: string; abbreviation: string }> = {
  "rcv-zh-hant": {
    versionId: "4230",
    abbreviation: "RCV",
  },
};

export function decodeYouVersionHtmlEntities(raw: string): string {
  return String(raw || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => {
      const code = Number.parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

export function stripYouVersionHtml(raw: string): string {
  return String(raw || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseYouVersionChapterContent(html: string): RemoteChapterVerseRow[] {
  const source = String(html || "");
  const verseStartRe = /<span class="verse v(\d+)"[^>]*data-usfm="[^"]+">/gi;
  const starts: Array<{ verse: number; index: number }> = [];
  for (let match = verseStartRe.exec(source); match; match = verseStartRe.exec(source)) {
    starts.push({ verse: Number(match[1]), index: match.index });
  }
  if (!starts.length) return [];

  const rows: RemoteChapterVerseRow[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i]!;
    const next = starts[i + 1];
    const block = source.slice(start.index, next?.index ?? source.length);
    let text = decodeYouVersionHtmlEntities(stripYouVersionHtml(block));
    text = text.replace(new RegExp(`^\\s*${start.verse}\\s*`), "").trim();
    text = text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const hit = rows.find((row) => row.verse === start.verse);
    if (hit) {
      if (!hit.text.includes(text)) {
        hit.text = `${hit.text} ${text}`.replace(/\s+/g, " ").trim();
      }
      continue;
    }
    rows.push({ verse: start.verse, text });
  }
  return rows.sort((a, b) => a.verse - b.verse);
}

export async function fetchYouVersionChapterPageHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadYouVersionChapterRowsFromPage(args: {
  translationId: string;
  bookId: string;
  chapter: number;
}): Promise<RemoteChapterVerseRow[] | null> {
  const audioPageUrl = buildYouVersionAudioPageUrl({
    translationId: args.translationId,
    bookId: args.bookId,
    chapter: args.chapter,
  });
  const textPageInfo = YOUVERSION_TEXT_PAGE_VERSION_INFO[String(args.translationId || "").trim().toLowerCase()];
  const pageUrl = audioPageUrl || (textPageInfo ? `https://www.bible.com/bible/${textPageInfo.versionId}/${String(args.bookId || "").trim().toUpperCase()}.${Number(args.chapter)}.${textPageInfo.abbreviation}` : "");
  if (!pageUrl) return null;

  const html = await fetchYouVersionChapterPageHtml(pageUrl);
  if (!html) return null;

  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const end = html.indexOf("</script>", start + marker.length);
  if (end < 0) return null;

  try {
    const data = JSON.parse(html.slice(start + marker.length, end)) as {
      props?: {
        pageProps?: {
          chapterInfo?: {
            content?: string;
          };
        };
      };
    };
    const content = data?.props?.pageProps?.chapterInfo?.content;
    if (!content) return null;
    const rows = parseYouVersionChapterContent(content);
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}
