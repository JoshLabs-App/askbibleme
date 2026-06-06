"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import { formatScriptureXrefLabel } from "@/lib/bible/format-scripture-xref-label";
import { scriptureXrefSnippetKey } from "@/lib/bible/join-verse-range-text";
import type { ScriptureVerseXrefs, ScriptureXrefTarget } from "@/lib/bible/scripture-xref-types";

const EMPTY_XREF_TARGETS: ScriptureXrefTarget[] = [];

type Props = {
  open: boolean;
  onClose: () => void;
  translationId: string;
  bookName: string;
  chapter: number;
  verse: number;
  bundle: ScriptureVerseXrefs | null;
};

function readerVerseHref(bookId: string, chapter: number, verseStart: number): string {
  return `/read/${encodeURIComponent(bookId)}/${chapter}?verse=${verseStart}`;
}

function XrefListSection({
  title,
  refs,
  snippets,
  loading,
  locale,
  onClose,
}: {
  title: string;
  refs: ScriptureXrefTarget[];
  snippets: Record<string, string>;
  loading: boolean;
  locale: AppLocale;
  onClose: () => void;
}) {
  if (!refs.length) return null;
  return (
    <section className="read-chapter-xref-sheet-section">
      <h3 className="read-chapter-xref-sheet-section-title">{title}</h3>
      <ul className="read-chapter-xref-sheet-list">
        {refs.map((ref) => {
          const key = scriptureXrefSnippetKey(ref);
          const snippet = snippets[key];
          return (
            <li key={`${title}-${key}`}>
              <Link
                href={readerVerseHref(ref.bookId, ref.chapter, ref.verseStart)}
                className="read-chapter-xref-sheet-link no-underline hover:no-underline"
                onClick={onClose}
              >
                {formatScriptureXrefLabel(ref, locale)}
              </Link>
              {snippet ? (
                <p className="read-chapter-xref-sheet-snippet">{snippet}</p>
              ) : loading ? (
                <p className="read-chapter-xref-sheet-snippet read-chapter-xref-sheet-snippet--loading">…</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ReadChapterVerseXrefSheet({
  open,
  onClose,
  translationId,
  bookName,
  chapter,
  verse,
  bundle,
}: Props) {
  const { t, locale } = useLocale();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const [loadingSnippets, setLoadingSnippets] = useState(false);

  const incoming = bundle?.incoming ?? EMPTY_XREF_TARGETS;
  const outgoing = bundle?.outgoing ?? EMPTY_XREF_TARGETS;
  const allRefs = useMemo(() => {
    if (!incoming.length && !outgoing.length) return EMPTY_XREF_TARGETS;
    return [...incoming, ...outgoing];
  }, [incoming, outgoing]);

  const refsFetchKey = useMemo(
    () => allRefs.map((ref) => scriptureXrefSnippetKey(ref)).join("\n"),
    [allRefs],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setVisible(true);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      const tmr = window.setTimeout(() => setVisible(false), 220);
      return () => window.clearTimeout(tmr);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || allRefs.length === 0) {
      setSnippets((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setLoadingSnippets((prev) => (prev ? false : prev));
      return;
    }
    let cancelled = false;
    setLoadingSnippets(true);
    void fetch("/api/read/verse-snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        translationId,
        locale,
        refs: allRefs,
      }),
    })
      .then((res) => (res.ok ? res.json() : { snippets: {} }))
      .then((data: { snippets?: Record<string, string> }) => {
        if (!cancelled) {
          setSnippets(data.snippets ?? {});
          setLoadingSnippets(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingSnippets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, translationId, locale, refsFetchKey, allRefs]);

  if (!portalReady || !visible) return null;

  const body = (
    <div
      className={[
        "read-chapter-xref-sheet-backdrop",
        entered ? "read-chapter-xref-sheet-backdrop--open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="read-chapter-xref-sheet-title"
        className={[
          "read-chapter-xref-sheet",
          entered ? "read-chapter-xref-sheet--open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="read-chapter-xref-sheet-header">
          <h2 id="read-chapter-xref-sheet-title" className="read-chapter-xref-sheet-title">
            {t("pages.read.verseXrefSheetTitle", {
              bookName,
              chapter: String(chapter),
              verse: String(verse),
            })}
          </h2>
          <button type="button" className="read-chapter-xref-sheet-close" onClick={onClose}>
            {t("pages.read.chapterJumpClose")}
          </button>
        </header>

        <div className="read-chapter-xref-sheet-scroll">
          <XrefListSection
            title={t("pages.read.verseXrefIncoming")}
            refs={incoming}
            snippets={snippets}
            loading={loadingSnippets}
            locale={locale}
            onClose={onClose}
          />
          <XrefListSection
            title={t("pages.read.verseXrefOutgoing")}
            refs={outgoing}
            snippets={snippets}
            loading={loadingSnippets}
            locale={locale}
            onClose={onClose}
          />
          {!incoming.length && !outgoing.length ? (
            <p className="read-chapter-xref-sheet-empty">{t("pages.read.verseXrefEmpty")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
