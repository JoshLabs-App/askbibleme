"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseScriptureVerseParam } from "@/lib/bible/parse-scripture-verse-param";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { teochewNtVoiceActive } from "@/lib/bible/teochew-nt-audio";
import {
  fetchChapterVerseTimings,
  type CuvChapterVerseTiming,
  verseIndexForVerseNumber,
  verseNumberAtChapterAudioTime,
} from "@/lib/bible/cuv-chapter-verse-timings";
import { getCuvChapterAudioContentBounds } from "@/lib/bible/cuv-chapter-audio-content-bounds";
import type { LoadedChapterVerse } from "@/lib/bible/loaded-chapter-verse";
import { resolveVerseSpeechParts } from "@/lib/bible/resolve-verse-speech-parts";
import {
  resolveChapterAudioPlayableSrc,
  translationSupportsChapterAudio,
} from "@/lib/bible/read-chapter-audio";
import {
  verseIndexForReadChapterAudioTime,
  verseWeightsForReadChapterAudio,
} from "@/lib/bible/read-chapter-audio-verse-from-progress";
import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadVerseBookmarkFeedback } from "@/components/bible/ReadVerseBookmarkFeedback";
import { useScriptureVerseBookmarks } from "@/components/bible/useScriptureVerseBookmarks";
import { formatScriptureVerseClipboard } from "@/lib/bible/format-scripture-verse-clipboard";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { ReadChapterVerseXrefSheet } from "@/components/bible/ReadChapterVerseXrefSheet";
import type { ScriptureVerseXrefsSerialized } from "@/lib/bible/load-chapter-xrefs";
import type { ChapterSegment } from "@/lib/bible/load-chapter-segments";

type Props = {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: LoadedChapterVerse[];
  segments?: ChapterSegment[] | null;
  contrastVerses?: LoadedChapterVerse[] | null;
  chapterXrefs?: ScriptureVerseXrefsSerialized[] | null;
  /** 经文搜索跳入：高亮该节并滚到视口中央 */
  initialFocusVerse?: number | null;
};

export function ReadChapterVersesClient({
  translationId,
  bookId,
  bookName,
  chapter,
  verses,
  segments = null,
  contrastVerses = null,
  chapterXrefs = null,
  initialFocusVerse: initialFocusVerseProp = null,
}: Props) {
  const { t } = useLocale();
  const [xrefSheetVerse, setXrefSheetVerse] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const { chapterAudioTranslationId } = useReadBibleTranslationSettings();
  const { isBookmarked, toggle: toggleVerseBookmark } = useScriptureVerseBookmarks();

  const focusVerseFromUrl = useMemo(() => {
    const fromQuery = parseScriptureVerseParam(searchParams.get("verse"));
    if (fromQuery != null) return fromQuery;
    if (typeof window === "undefined") return null;
    const m = window.location.hash.match(/^#v(\d+)$/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }, [searchParams]);

  const initialFocusVerse = initialFocusVerseProp ?? focusVerseFromUrl;
  const [bookmarkFeedback, setBookmarkFeedback] = useState<string | null>(null);
  const { effectiveVoiceId } = useCuvChapterAudioVoice();
  const { effectiveSrc, currentSec, durationSec, playing } = useMusicShellPlayback();
  const playVoice = effectiveVoiceId(bookId);
  const [resolvedChapterSrc, setResolvedChapterSrc] = useState<string | null>(null);
  const [verseTimings, setVerseTimings] = useState<CuvChapterVerseTiming[] | null>(null);
  const [verseTimingsReady, setVerseTimingsReady] = useState<"idle" | "pending" | "yes" | "no">("idle");
  const verseElRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const lastFollowIndexRef = useRef<number | null>(null);
  const searchFocusScrolledRef = useRef(false);
  const [searchFocusVerse, setSearchFocusVerse] = useState<number | null>(initialFocusVerse);
  const anchorKeyRef = useRef("");

  const anchorKey = `${bookId}:${chapter}`;
  if (anchorKeyRef.current !== anchorKey) {
    anchorKeyRef.current = anchorKey;
    verseElRefs.current = [];
    lastFollowIndexRef.current = null;
    searchFocusScrolledRef.current = false;
    setVerseTimings(null);
    setVerseTimingsReady("idle");
    setSearchFocusVerse(initialFocusVerse);
  }

  useEffect(() => {
    setSearchFocusVerse(initialFocusVerse);
    searchFocusScrolledRef.current = false;
  }, [initialFocusVerse, anchorKey]);

  useEffect(() => {
    if (searchFocusVerse == null) return;
    const timer = window.setTimeout(() => setSearchFocusVerse(null), 14_000);
    return () => window.clearTimeout(timer);
  }, [searchFocusVerse, anchorKey]);

  const supported = translationSupportsChapterAudio(chapterAudioTranslationId);

  useEffect(() => {
    if (!supported) {
      setResolvedChapterSrc(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await resolveChapterAudioPlayableSrc({
        translationId: chapterAudioTranslationId,
        bookName,
        bookId,
        chapter,
        voiceId: playVoice,
      });
      if (cancelled) return;
      setResolvedChapterSrc(r.ok ? r.src : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, chapterAudioTranslationId, bookName, bookId, chapter, playVoice]);

  const useVerseTimingsFile = supported;

  useEffect(() => {
    if (!useVerseTimingsFile) {
      setVerseTimings(null);
      setVerseTimingsReady("idle");
      return;
    }
    let cancelled = false;
    setVerseTimingsReady("pending");
    setVerseTimings(null);
    void (async () => {
      const timings = await fetchChapterVerseTimings(
        chapterAudioTranslationId,
        playVoice,
        bookId,
        chapter,
      );
      if (cancelled) return;
      if (timings?.length) {
        setVerseTimings(timings);
        setVerseTimingsReady("yes");
      } else {
        setVerseTimings(null);
        setVerseTimingsReady("no");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useVerseTimingsFile, chapterAudioTranslationId, playVoice, bookId, chapter]);

  const contrastByVerse = useMemo(() => {
    if (!contrastVerses?.length) return null;
    const m = new Map<number, string>();
    for (const v of contrastVerses) {
      if (v.text.trim()) m.set(v.verse, v.text);
    }
    return m;
  }, [contrastVerses]);

  const xrefsByVerse = useMemo(() => {
    if (!chapterXrefs?.length) return null;
    const m = new Map<number, ScriptureVerseXrefsSerialized>();
    for (const row of chapterXrefs) {
      if (row.incoming.length || row.outgoing.length) m.set(row.verse, row);
    }
    return m.size ? m : null;
  }, [chapterXrefs]);

  const xrefSheetBundle =
    xrefSheetVerse != null ? (xrefsByVerse?.get(xrefSheetVerse) ?? null) : null;

  const segmentMeta = useMemo(() => {
    const headingByVerse = new Map<number, string[]>();
    const paragraphStarts = new Set<number>();
    for (const row of segments ?? []) {
      if (!Number.isInteger(row.verseStart) || row.verseStart == null) continue;
      if (row.type === "heading" && row.title?.trim()) {
        const bucket = headingByVerse.get(row.verseStart) ?? [];
        const headingText = (row.titleZh || row.title).trim();
        if (headingText) bucket.push(headingText);
        headingByVerse.set(row.verseStart, bucket);
      }
      if (row.type === "paragraph" || row.type === "poetry") {
        paragraphStarts.add(row.verseStart);
      }
    }
    return { headingByVerse, paragraphStarts };
  }, [segments]);

  const weights = useMemo(() => verseWeightsForReadChapterAudio(verses), [verses]);

  const contentBounds = useMemo(() => {
    if (!supported || teochewNtVoiceActive(playVoice) || verseTimingsReady === "yes") return undefined;
    const { leadInSec, trailOutSec } = getCuvChapterAudioContentBounds(bookId, chapter);
    return { contentStartSec: leadInSec, contentEndTrimSec: trailOutSec };
  }, [supported, bookId, chapter, playVoice, verseTimingsReady]);

  const audioMatchesThisChapter =
    Boolean(resolvedChapterSrc) &&
    Boolean(effectiveSrc.trim()) &&
    shellPlaybackUrlsEqual(resolvedChapterSrc!, effectiveSrc.trim());

  const verseFollowEnabled = supported;

  const activeIndex = (() => {
    if (!verseFollowEnabled || !audioMatchesThisChapter) return null;
    if (verseTimingsReady === "yes" && verseTimings?.length) {
      const verseNum = verseNumberAtChapterAudioTime(currentSec, verseTimings);
      if (verseNum === null) return null;
      return verseIndexForVerseNumber(verses, verseNum);
    }
    if (verseTimingsReady === "pending") return null;
    return verseIndexForReadChapterAudioTime(currentSec, durationSec, weights, contentBounds);
  })();

  useLayoutEffect(() => {
    if (searchFocusVerse == null || searchFocusScrolledRef.current) return;
    const idx = verses.findIndex((v) => v.verse === searchFocusVerse);
    if (idx < 0) return;
    const el = verseElRefs.current[idx];
    if (!el) return;
    searchFocusScrolledRef.current = true;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [searchFocusVerse, verses]);

  useLayoutEffect(() => {
    if (!playing) {
      lastFollowIndexRef.current = null;
      return;
    }
    if (activeIndex === null) {
      lastFollowIndexRef.current = null;
      return;
    }
    if (lastFollowIndexRef.current === activeIndex) return;
    lastFollowIndexRef.current = activeIndex;
    const el = verseElRefs.current[activeIndex];
    if (!el) return;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [playing, activeIndex, verses.length]);

  const onVerseDoubleClick = (v: LoadedChapterVerse) => {
    void (async () => {
      const ref = {
        bookId,
        bookName,
        chapter,
        verse: v.verse,
        translationId,
        text: v.text,
      };
      const added = await toggleVerseBookmark(ref);
      if (added) {
        try {
          await navigator.clipboard.writeText(formatScriptureVerseClipboard(ref));
        } catch {
          /* 剪贴板失败不阻断收藏 */
        }
      }
      setBookmarkFeedback(
        added ? t("pages.read.verseBookmarkSaved") : t("pages.read.verseBookmarkRemoved"),
      );
    })();
  };

  return (
    <>
      <ReadVerseBookmarkFeedback message={bookmarkFeedback} onClear={() => setBookmarkFeedback(null)} />
      {verses.map((v, i) => {
        const headings = segmentMeta.headingByVerse.get(v.verse) ?? [];
        const showParagraphBreak = i > 0 && segmentMeta.paragraphStarts.has(v.verse);
        const searchFocus = searchFocusVerse === v.verse;
        const bookmarked = isBookmarked({
          translationId,
          bookId,
          chapter,
          verse: v.verse,
        });
        const active = !searchFocus && !bookmarked && activeIndex !== null && i === activeIndex;
        const contrastText = contrastByVerse?.get(v.verse) ?? null;
        const goldenMark = v.isGolden && !bookmarked ? " read-chapter-golden-marker" : "";
        const bookmarkMark = bookmarked ? " read-chapter-bookmark-marker" : "";
        const verseNumMark = bookmarkMark || goldenMark;
        const xrefBundle = xrefsByVerse?.get(v.verse);
        const hasXref = Boolean(xrefBundle);
        return (
          <Fragment key={`${bookId}:${chapter}:${v.verse}`}>
            {showParagraphBreak ? <div className="read-chapter-paragraph-break" aria-hidden="true" /> : null}
            {headings.map((title, headingIndex) => (
              <h2
                key={`${bookId}:${chapter}:${v.verse}:h:${headingIndex}`}
                className="read-chapter-segment-heading"
              >
                {title}
              </h2>
            ))}
            <p
              ref={(node) => {
                verseElRefs.current[i] = node;
              }}
              data-verse={v.verse}
              onDoubleClick={() => onVerseDoubleClick(v)}
              aria-current={searchFocus || active || bookmarked ? "location" : undefined}
              className={[
                "read-chapter-verse [text-wrap:pretty]",
                searchFocus ? "read-chapter-verse--search-focus" : "",
                active ? "read-chapter-verse--audio-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {hasXref ? (
                <button
                  type="button"
                  className={`read-chapter-verse-num read-chapter-verse-num--xref${verseNumMark}`}
                  aria-label={`${v.verse}. ${t("pages.read.verseXrefMarkerA11y")}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setXrefSheetVerse(v.verse);
                  }}
                >
                  {v.verse}
                </button>
              ) : (
                <span className={`read-chapter-verse-num${verseNumMark}`}>{v.verse}</span>
              )}
              <span className="read-chapter-verse-primary">
                {(() => {
                  const parts = resolveVerseSpeechParts(v, {
                    translationId,
                    bookId,
                    chapter,
                    verse: v.verse,
                  });
                  const body =
                    !parts?.length ? (
                      <span>{v.text}</span>
                    ) : (
                      parts.map((seg, si) =>
                        seg.kind === "divine" ? (
                          <span key={si} className="read-chapter-divine-speech">
                            {seg.text}
                          </span>
                        ) : seg.kind === "human" ? (
                          <span key={si} className="read-chapter-human-speech">
                            {seg.text}
                          </span>
                        ) : (
                          <span key={si}>{seg.text}</span>
                        ),
                      )
                    );
                  if (bookmarked) {
                    return <span className={bookmarkMark.trim()}>{body}</span>;
                  }
                  if (!parts?.length) {
                    return <span className={goldenMark.trim() || undefined}>{v.text}</span>;
                  }
                  return parts.map((seg, si) =>
                    seg.kind === "divine" ? (
                      <span key={si} className={`read-chapter-divine-speech${goldenMark}`}>
                        {seg.text}
                      </span>
                    ) : seg.kind === "human" ? (
                      <span key={si} className={`read-chapter-human-speech${goldenMark}`}>
                        {seg.text}
                      </span>
                    ) : (
                      <span key={si} className={goldenMark.trim() || undefined}>
                        {seg.text}
                      </span>
                    ),
                  );
                })()}
              </span>
              {contrastText ? (
                <span className="read-chapter-verse-contrast">{contrastText}</span>
              ) : null}
            </p>
          </Fragment>
        );
      })}
      <ReadChapterVerseXrefSheet
        open={xrefSheetVerse != null}
        onClose={() => setXrefSheetVerse(null)}
        translationId={translationId}
        bookName={bookName}
        chapter={chapter}
        verse={xrefSheetVerse ?? 0}
        bundle={xrefSheetBundle}
      />
    </>
  );
}
