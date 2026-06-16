import "server-only";

import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { formatFigureRefCitation, figureRefKey } from "@/lib/figures/figure-ref";
import { figureRefVerseTranslationLabel, loadFigureRefVerseTexts } from "@/lib/figures/load-figure-ref-verse-texts";
import type { FigureScriptureRef } from "@/lib/figures/types";
import type { AppLocale } from "@/lib/i18n/config";
import {
  collectEnArticleScriptureRefsFromMarkdown,
  findEnArticleScriptureRefsInText,
} from "@/lib/explore/article-scripture-ref-en";
import {
  collectZhArticleScriptureRefsFromMarkdown,
  findZhArticleScriptureRefsInText,
} from "@/lib/explore/article-scripture-ref-zh";
import { linkifyExploreArticleScriptureRefsForLocale } from "@/lib/explore/linkify-explore-article-scripture-refs-for-locale";

function listContinuationIndent(line: string): string {
  const match = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+/);
  if (!match) return "";
  return `${match[1] ?? ""}  `;
}

function formatScriptureVerseBlockMarkdown(text: string, citation: string, indent = ""): string {
  const body = text
    .trim()
    .split(/\n/)
    .map((row) => `${indent}> ${row}`)
    .join("\n");
  return `\n${body}\n${indent}> \n${indent}> — ${citation}\n`;
}

function enrichMarkdownLine(
  line: string,
  verseTextByKey: Record<string, string>,
  locale: AppLocale,
  translationLabel: string,
): string {
  if (!line.trim() || line.startsWith(">") || line.includes("\u0000PROTECTED")) {
    return line;
  }

  const refs =
    locale === "en"
      ? findEnArticleScriptureRefsInText(line)
      : findZhArticleScriptureRefsInText(line);
  if (!refs.length) return line;

  const linked = linkifyExploreArticleScriptureRefsForLocale(line, locale);
  const indent = listContinuationIndent(line);
  const blocks = refs
    .map((ref) => {
      const text = verseTextByKey[figureRefKey(ref)];
      if (!text?.trim()) return "";
      const bookName = getScriptureBookDisplayName(ref.bookId, locale);
      const citation = `${formatFigureRefCitation(ref, bookName)} · ${translationLabel}`;
      return formatScriptureVerseBlockMarkdown(text, citation, indent);
    })
    .filter(Boolean);

  return linked + blocks.join("");
}

function enrichMarkdownBody(
  markdown: string,
  verseTextByKey: Record<string, string>,
  locale: AppLocale,
  translationLabel: string,
): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let inFence = false;
  let fenceMarker = "";

  for (const line of lines) {
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceMatch[1]!;
      } else if (line.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = "";
      }
      output.push(line);
      continue;
    }

    if (inFence) {
      output.push(line);
      continue;
    }

    output.push(enrichMarkdownLine(line, verseTextByKey, locale, translationLabel));
  }

  return output.join("\n");
}

/** 为文章正文中的中文经文引用添加跳转链接，并在引用下方展示经文正文。 */
export async function enrichArticleMarkdownWithScriptureContent(args: {
  markdown: string;
  locale: AppLocale;
}): Promise<string> {
  const trimmed = args.markdown.trim();
  if (!trimmed) return trimmed;

  const refs: FigureScriptureRef[] =
    args.locale === "en"
      ? collectEnArticleScriptureRefsFromMarkdown(trimmed)
      : collectZhArticleScriptureRefsFromMarkdown(trimmed);
  if (!refs.length) {
    return linkifyExploreArticleScriptureRefsForLocale(trimmed, args.locale);
  }

  const verseTextByKey = await loadFigureRefVerseTexts({ refs, locale: args.locale });
  const translationLabel = figureRefVerseTranslationLabel(args.locale);
  return enrichMarkdownBody(trimmed, verseTextByKey, args.locale, translationLabel);
}
