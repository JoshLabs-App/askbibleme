import { loadScriptureXrefSnippets } from "@/lib/bible/load-scripture-xref-snippets";
import type { VerseRef } from "@/lib/bible/verse-ref";
import type { AppLocale } from "@/lib/i18n/config";

type Body = {
  translationId?: string;
  locale?: AppLocale;
  refs?: VerseRef[];
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const translationId = String(body.translationId || "").trim();
  const refs = Array.isArray(body.refs) ? body.refs : [];
  if (!translationId || refs.length === 0) {
    return Response.json({ snippets: {} });
  }

  const locale: AppLocale = body.locale === "en" ? "en" : "zh-CN";
  const snippets = await loadScriptureXrefSnippets(process.cwd(), translationId, refs, locale);
  return Response.json({ snippets });
}
