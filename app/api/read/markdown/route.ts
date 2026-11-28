import {
  DEFAULT_TRANSLATION_ID,
  PRODUCT_ORIGIN,
  parseVerseRange,
  resolveBook,
  resolveTranslation,
} from "@/lib/ai/askbible-ai-catalog.mjs";
import { formatChapterMarkdown } from "@/lib/ai/askbible-ai-docs.mjs";
import { loadStaticScriptureChapterVerses } from "@/lib/bible/load-static-scripture-chapter";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const book = resolveBook(url.searchParams.get("bookId") || url.searchParams.get("book"));
  const chapter = Number(url.searchParams.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return new Response("# Not Found\n\nInvalid book or chapter.\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const tr = resolveTranslation(url.searchParams.get("t") || url.searchParams.get("translation") || DEFAULT_TRANSLATION_ID);
  if (!tr) {
    return new Response("# Bad Request\n\nUnsupported translation.\n", {
      status: 400,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const rawVerses = await loadStaticScriptureChapterVerses(process.cwd(), tr.id, book.id, chapter);
  if (!rawVerses || rawVerses.length === 0) {
    return new Response("# Not Found\n\nPassage not available in static bundle.\n", {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const rawRange = url.searchParams.get("v") || url.searchParams.get("verses");
  const range = rawRange ? parseVerseRange(rawRange) : null;
  const verses = range
    ? rawVerses.filter((row) => row.verse >= range.start && row.verse <= range.end)
    : rawVerses;

  const origin = url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : PRODUCT_ORIGIN;
  const md = formatChapterMarkdown({
    book,
    chapter,
    translation: tr,
    verses: verses.map((v) => ({ verse: v.verse, text: v.text })),
    verseRange: range,
    origin,
  });

  return new Response(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      Vary: "Accept",
    },
  });
}
