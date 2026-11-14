"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ReadChapterCompletionSection } from "@/components/bible/ReadChapterCompletionSection";
import { ReadChapterEndNav } from "@/components/bible/ReadChapterEndNav";
import { ReadChapterLastPositionSync } from "@/components/bible/ReadChapterLastPositionSync";
import { ReadChapterPlanFlowSync } from "@/components/bible/ReadChapterPlanFlowSync";
import { ReadChapterPostReadingEditions } from "@/components/bible/ReadChapterPostReadingEditions";
import { ReadChapterTodayPlanBlock } from "@/components/bible/ReadChapterTodayPlanBlock";
import { ReadChapterTopActions } from "@/components/bible/ReadChapterTopActions";
import { ReadChapterVersesClient } from "@/components/bible/ReadChapterVersesClient";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { parseScriptureVerseParam } from "@/lib/bible/parse-scripture-verse-param";
import { resolveReadChapterNeighbors } from "@/lib/bible/read-chapter-neighbors";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { parseScriptureSearchQueryParam } from "@/lib/bible/scripture-search";
import type { ScriptureVerseXrefs } from "@/lib/bible/scripture-xref-types";
import {
  formatReadChapterFallbackNotice,
  formatReadChapterTitleChapterSuffix,
} from "@/lib/read/read-chapter-format";
import {
  loadReadChapterClient,
  loadReadChapterXrefsClient,
  type ReadChapterClientData,
} from "@/lib/read/read-chapter-client";
import { resolveReadChapterPrimaryTranslationId } from "@/lib/read/read-bible-translation-prefs";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

type Props = {
  bookId: string;
  chapter: number;
};

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; key: string; data: ReadChapterClientData; xrefs: ScriptureVerseXrefs[] | null };

/**
 * 读经章页主体（浏览器端）。
 *
 * 页面外壳是静态的：服务端不再读 cookie / searchParams / 文件，所以章页可被 CDN 缓存。
 * 语言、主译本、对照译本取自客户端的译本设置（localStorage / cookie），
 * 经文与交叉引用取按卷静态 JSON；`?verse=` `?q=` 也在这里读。
 * 讲解版 / 发现版本来就是用户点开后才取静态 published JSON，不在首屏取。
 */
function ReadChapterPageBody({ bookId, chapter }: Props) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const { translation, translationCatalog, translationCatalogReady } = useReadBibleTranslationSettings();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const index = useMemo(
    () => ({ translations: translationCatalog, defaultTranslationId: null }),
    [translationCatalog],
  );
  const ready = translationCatalogReady && translation !== null;
  const primaryTranslationId = useMemo(
    () => (ready && translation ? resolveReadChapterPrimaryTranslationId(translation, index, locale) : null),
    [ready, translation, index, locale],
  );
  const contrastKey = translation?.contrastTranslationIds.join(",") ?? "";
  const loadKey = `${primaryTranslationId ?? ""}|${contrastKey}|${bookId}|${chapter}|${locale}`;

  useEffect(() => {
    if (!primaryTranslationId) return;
    let cancelled = false;
    void (async () => {
      const [data, xrefs] = await Promise.all([
        loadReadChapterClient({
          index,
          primaryTranslationId,
          contrastTranslationIds: contrastKey ? contrastKey.split(",") : [],
          bookId,
          chapter,
          locale,
        }),
        loadReadChapterXrefsClient(bookId, chapter),
      ]);
      if (cancelled) return;
      setState(data ? { status: "ready", key: loadKey, data, xrefs } : { status: "missing" });
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryTranslationId, contrastKey, index, bookId, chapter, locale, loadKey]);

  const displayBookName = getScriptureBookDisplayName(bookId, locale);

  useEffect(() => {
    document.title = sitePageTitle(`${displayBookName} ${chapter}`);
  }, [displayBookName, chapter]);

  const initialFocusVerse = parseScriptureVerseParam(searchParams.get("verse") ?? undefined);
  const initialSearchQuery = parseScriptureSearchQueryParam(searchParams.get("q") ?? undefined);
  const { prev, next } = resolveReadChapterNeighbors(bookId, chapter);

  /** 切章 / 切译本后，旧数据（key 对不上）不当作新章渲染，避免闪一下上一章的经文。 */
  const loaded = state.status === "ready" && state.key === loadKey ? state : null;

  return (
    <ScriptureChrome hideTypographyControl parchmentColumnClassName="read-bible-parchment-column--read-chapter">
      <ReadChapterTopActions />
      <Suspense fallback={null}>
        <ReadChapterPlanFlowSync />
      </Suspense>
      <ReadChapterLastPositionSync bookId={bookId} chapter={chapter} bookName={displayBookName} />
      <article className="read-chapter-article">
        <div className="read-chapter-spread">
          <div className="read-chapter-open-book">
            <div className="read-chapter-spread-scripture read-chapter-open-book-page read-chapter-open-book-page--left">
              <header className="read-chapter-header">
                <h1 className="read-chapter-title">
                  {displayBookName}{" "}
                  <span className="read-chapter-title-chapter tabular-nums">
                    {formatReadChapterTitleChapterSuffix(chapter, locale)}
                  </span>
                </h1>
                {loaded?.data.fallbackFrom ? (
                  <p className="read-chapter-fallback-notice" role="status">
                    {formatReadChapterFallbackNotice(loaded.data.fallbackFrom, loaded.data.primary, locale)}
                  </p>
                ) : null}
                {state.status === "missing" ? (
                  <p className="read-chapter-fallback-notice" role="status">
                    {locale === "en" ? "This chapter isn't available right now." : "暂时无法取得本章经文。"}
                  </p>
                ) : null}
              </header>
              <div className="read-chapter-scripture">
                {loaded ? (
                  <Suspense fallback={null}>
                    <ReadChapterVersesClient
                      translationId={loaded.data.primary.translationId}
                      bookId={bookId}
                      bookName={displayBookName}
                      chapter={chapter}
                      verses={loaded.data.primary.verses}
                      segments={loaded.data.primary.segments ?? null}
                      contrasts={loaded.data.contrasts.map((c) => ({
                        translationId: c.translationId,
                        verses: c.chapter.verses,
                      }))}
                      chapterXrefs={loaded.xrefs}
                      initialFocusVerse={initialFocusVerse}
                      initialSearchQuery={initialSearchQuery || null}
                    />
                  </Suspense>
                ) : null}
              </div>
              <div className="read-chapter-ending">
                <ReadChapterEndNav
                  bookId={bookId}
                  bookName={displayBookName}
                  chapter={chapter}
                  prev={prev}
                  next={next}
                />
                <ReadChapterCompletionSection bookId={bookId} chapter={chapter} />
              </div>
            </div>
            <div className="read-chapter-open-book-spine" aria-hidden="true" />
            <aside className="read-chapter-spread-editions read-chapter-open-book-page read-chapter-open-book-page--right">
              <ReadChapterPostReadingEditions
                bookId={bookId}
                chapter={chapter}
                prevChapterHref={prev ? `/read/${prev.bookId}/${prev.chapter}` : null}
                nextChapterHref={next ? `/read/${next.bookId}/${next.chapter}` : null}
              />
            </aside>
          </div>
        </div>
        <div className="read-chapter-spread-after read-chapter-spread-after--web-extras">
          <ReadChapterTodayPlanBlock bookId={bookId} chapter={chapter} />
        </div>
      </article>
    </ScriptureChrome>
  );
}

/** `useSearchParams` 要求外面有 Suspense 边界，否则整页退成客户端渲染。 */
export function ReadChapterPageClient(props: Props) {
  return (
    <Suspense fallback={null}>
      <ReadChapterPageBody {...props} />
    </Suspense>
  );
}
