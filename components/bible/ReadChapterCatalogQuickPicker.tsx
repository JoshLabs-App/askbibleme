"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { BibleCatalogReadOutline } from "@/components/bible/BibleCatalogReadOutline";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getScriptureCanonCatalogSectionsClient } from "@/lib/bible/scripture-canon-catalog-client";

type Props = {
  bookId: string;
  chapter: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function chapterHref(bookId: string, chapter: number) {
  return `/read/${encodeURIComponent(bookId)}/${chapter}`;
}

/** 章页底栏「读经」：正典十段双列目录 + 选章（对齐 iOS ReadChapterScreen jump sheet） */
export function ReadChapterCatalogQuickPicker({ bookId, chapter, open, onOpenChange }: Props) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const sections = useMemo(() => getScriptureCanonCatalogSectionsClient(locale), [locale]);
  const [portalReady, setPortalReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEntered(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const finishClose = useCallback(() => {
    setEntered(false);
  }, []);

  const onPanelTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform") return;
      if (!entered) {
        setVisible(false);
        onOpenChange(false);
      }
    },
    [entered, onOpenChange],
  );

  const navigateChapter = useCallback(
    (nextBookId: string, nextChapter: number) => {
      finishClose();
      router.push(chapterHref(nextBookId, nextChapter));
    },
    [finishClose, router],
  );

  if (!portalReady || !visible) return null;

  return createPortal(
    <div
      className={`read-chapter-jump-root read-chapter-jump-root--catalog${entered ? " read-chapter-jump-root--open" : ""}`}
      role="presentation"
    >
      <button
        type="button"
        className="read-chapter-jump-backdrop"
        aria-label={t("pages.read.chapterJumpClose")}
        onClick={finishClose}
      />
      <div
        className="read-chapter-jump-panel read-chapter-jump-panel--catalog read-bible-typography"
        role="dialog"
        aria-modal="true"
        aria-labelledby="read-chapter-catalog-title"
        onTransitionEnd={onPanelTransitionEnd}
      >
        <header className="read-chapter-jump-header read-chapter-jump-header--catalog">
          <Link
            href="/read"
            className="read-chapter-jump-back"
            aria-label={t("pages.read.backToBibleHome")}
            onClick={finishClose}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
              <path
                d="M14.5 6 9 12l5.5 6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <h2 id="read-chapter-catalog-title" className="read-chapter-jump-title">
            {t("pages.read.chapterJumpTitle")}
          </h2>
          <span className="read-chapter-jump-header-spacer" aria-hidden />
        </header>

        <div className="read-chapter-jump-catalog-scroll">
          <BibleCatalogReadOutline
            sections={sections}
            activeBookId={bookId}
            jumpCatalog
            onChapterNavigate={navigateChapter}
          />
        </div>

        <button type="button" className="read-chapter-jump-footer-close" onClick={finishClose}>
          {t("pages.read.chapterJumpClose")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
