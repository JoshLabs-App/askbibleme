import { NextResponse } from "next/server";
import {
  ScriptureSearchDatabaseError,
  searchScriptureVerses,
} from "@/lib/bible/search-scripture-verses";
import {
  DEFAULT_SCRIPTURE_SEARCH_SCOPE,
  type ScriptureSearchScope,
} from "@/lib/bible/scripture-search";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "@/lib/bible/translations-types";

function parseScope(raw: string | null): ScriptureSearchScope {
  if (raw === "old" || raw === "new") return raw;
  return DEFAULT_SCRIPTURE_SEARCH_SCOPE;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const translationId = url.searchParams.get("translationId")?.trim() || DEFAULT_SCRIPTURE_TRANSLATION_ID;
  const scope = parseScope(url.searchParams.get("scope"));

  try {
    const results = await searchScriptureVerses(process.cwd(), translationId, q, scope);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = e instanceof ScriptureSearchDatabaseError ? 503 : 500;
    return NextResponse.json({ ok: false, error: message, results: [] }, { status });
  }
}
