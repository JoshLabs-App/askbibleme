import { NextResponse } from "next/server";
import {
  ScriptureSearchDatabaseError,
  searchScriptureVerses,
} from "@/lib/bible/search-scripture-verses";
import {
  DEFAULT_SCRIPTURE_SEARCH_SCOPE,
  type ScriptureSearchChapterRef,
  type ScriptureSearchScope,
} from "@/lib/bible/scripture-search";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "@/lib/bible/translations-types";

function parseScope(raw: string | null): ScriptureSearchScope {
  if (raw === "old" || raw === "new" || raw === "chapter") return raw;
  return DEFAULT_SCRIPTURE_SEARCH_SCOPE;
}

function parseChapterRef(
  bookIdRaw: string | null,
  chapterRaw: string | null,
): ScriptureSearchChapterRef | null {
  const bookId = String(bookIdRaw ?? "").trim();
  const chapter = Number(chapterRaw);
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId, chapter };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const translationId = url.searchParams.get("translationId")?.trim() || DEFAULT_SCRIPTURE_TRANSLATION_ID;
  const scope = parseScope(url.searchParams.get("scope"));
  const chapterRef = parseChapterRef(url.searchParams.get("bookId"), url.searchParams.get("chapter"));

  try {
    const results = await searchScriptureVerses(process.cwd(), translationId, q, scope, chapterRef);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = e instanceof ScriptureSearchDatabaseError ? 503 : 500;
    return NextResponse.json({ ok: false, error: message, results: [] }, { status });
  }
}
