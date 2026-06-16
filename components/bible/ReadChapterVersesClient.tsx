"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseScriptureVerseParam } from "@/lib/bible/parse-scripture-verse-param";
import { normalizeScriptureSearchQuery } from "@/lib/bible/scripture-search";
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
import { useReadBibleTranslationSettings, useReadBibleTypography } from "@/components/bible/ReadBibleTypographyProvider";
import { resolveChapterSegmentHeadingText } from "@/lib/bible/chapter-segment-display";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { AppLocale } from "@/lib/i18n/config";
import { useReadChapterSpreadLayout } from "@/hooks/useReadChapterSpreadLayout";
import { ReadChapterVerseXrefSheet } from "@/components/bible/ReadChapterVerseXrefSheet";
import type { ScriptureVerseXrefsSerialized } from "@/lib/bible/load-chapter-xrefs";
import { ReadChapterVerseText } from "@/components/bible/ReadChapterVerseText";
import {
  ReadChapterHighlightModeBar,
  DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR,
} from "@/components/bible/ReadChapterHighlightModeBar";
import {
  ReadChapterVerseActionSheet,
  type VerseActionMenuState,
} from "@/components/bible/ReadChapterVerseActionSheet";
import {
  cloneHighlightMap,
  countHighlightedChars,
  type ChapterHighlightMap,
  type VerseHighlightMap,
} from "@/lib/read/read-verse-highlight-utils";
import {
  readChapterVerseTextHighlights,
  writeVerseTextHighlightIndices,
} from "@/lib/read/read-verse-text-highlights";
import { recordTodayReadingChapterFraction } from "@/lib/read/today-reading-chapter-fraction";
import type { ChapterSegment } from "@/lib/bible/load-chapter-segments";

function useVerseLongPress(onLongPress: () => void, delayMs = 520) {
  const timerRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const clear = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    activePointerIdRef.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (e.pointerType !== "mouse" && e.pointerType !== "pen" && e.pointerType !== "touch") return;
      clear();
      activePointerIdRef.current = e.pointerId;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        onLongPress();
      }, delayMs);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (activePointerIdRef.current != null && activePointerIdRef.current !== e.pointerId) return;
      clear();
    },
    onPointerCancel: (e: React.PointerEvent) => {
      if (activePointerIdRef.current != null && activePointerIdRef.current !== e.pointerId) return;
      clear();
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (activePointerIdRef.current != null && activePointerIdRef.current !== e.pointerId) return;
      clear();
    },
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      clear();
      timerRef.current = window.setTimeout(onLongPress, delayMs);
    },
    onTouchEnd: clear,
    onTouchMove: clear,
    onTouchCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
  };
}

type ContrastVerseLine = { translationId: string; text: string };

type Props = {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: LoadedChapterVerse[];
  segments?: ChapterSegment[] | null;
  /** @deprecated 单对照；请用 `contrasts` */
  contrastVerses?: LoadedChapterVerse[] | null;
  contrasts?: { translationId: string; verses: LoadedChapterVerse[] }[] | null;
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
  contrasts = null,
  chapterXrefs = null,
  initialFocusVerse: initialFocusVerseProp = null,
}: Props) {
  const { t, locale } = useLocale();
  const isWideScreen = useReadChapterSpreadLayout();
  const [xrefSheetVerse, setXrefSheetVerse] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const { chapterAudioTranslationId, contrastTranslationIds } = useReadBibleTranslationSettings();
  const { typography } = useReadBibleTypography();
  const [resolvedSegments, setResolvedSegments] = useState<ChapterSegment[] | null>(segments ?? null);
  const { isBookmarked, toggle: toggleVerseBookmark } = useScriptureVerseBookmarks();
  const [highlightedVerseIndexes, setHighlightedVerseIndexes] = useState<ChapterHighlightMap>(
    () => new Map(),
  );
  const [highlightModeActive, setHighlightModeActive] = useState(false);
  const [highlightDraftMap, setHighlightDraftMap] = useState<ChapterHighlightMap | null>(null);
  const [activeHighlightColor, setActiveHighlightColor] = useState(DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR);
  const [verseActionMenu, setVerseActionMenu] = useState<VerseActionMenuState>(null);
  const [verseSelectionMode, setVerseSelectionMode] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const highlightDraftMapRef = useRef<ChapterHighlightMap | null>(null);

  const activeHighlightMap = highlightModeActive
    ? (highlightDraftMap ?? highlightedVerseIndexes)
    : highlightedVerseIndexes;

  const focusVerseFromUrl = useMemo(() => {
    const fromQuery = parseScriptureVerseParam(searchParams.get("verse"));
    if (fromQuery != null) return fromQuery;
    if (typeof window === "undefined") return null;
    const m = window.location.hash.match(/^#v(\d+)$/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }, [searchParams]);

  const searchQueryFromUrl = useMemo(
    () => normalizeScriptureSearchQuery(searchParams.get("q") ?? ""),
    [searchParams],
  );

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
    setHighlightModeActive(false);
    setHighlightDraftMap(null);
    highlightDraftMapRef.current = null;
    setVerseActionMenu(null);
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }

  useEffect(() => {
    setHighlightedVerseIndexes(
      readChapterVerseTextHighlights({ translationId, bookId, chapter }),
    );
  }, [translationId, bookId, chapter]);

  useEffect(() => {
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }, [bookId, chapter]);

  useEffect(() => {
    highlightDraftMapRef.current = highlightDraftMap;
  }, [highlightDraftMap]);

  useEffect(() => {
    setSearchFocusVerse(initialFocusVerse);
    searchFocusScrolledRef.current = false;
  }, [initialFocusVerse, anchorKey]);

  useEffect(() => {
    const onOpenHighlight = () => {
      runOpenHighlightEditor();
    };
    window.addEventListener("askbible:read-open-highlight", onOpenHighlight as EventListener);
    return () => {
      window.removeEventListener("askbible:read-open-highlight", onOpenHighlight as EventListener);
    };
  }, []);

  useEffect(() => {
    if (searchFocusVerse == null) return;
    const timer = window.setTimeout(() => setSearchFocusVerse(null), 14_000);
    return () => window.clearTimeout(timer);
  }, [searchFocusVerse, anchorKey]);

  useEffect(() => {
    setResolvedSegments(segments ?? null);
  }, [segments, anchorKey]);

  useEffect(() => {
    const mode = typography.chapterSegmentMode;
    if (mode === "default") {
      setResolvedSegments(segments ?? null);
      return;
    }
    let cancelled = false;
    void fetch(
      `/api/read/chapter-segments?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}&mode=${mode}`,
      { cache: "no-store" },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { segments?: ChapterSegment[] } | null) => {
        if (cancelled) return;
        setResolvedSegments(Array.isArray(data?.segments) ? data.segments : segments ?? null);
      })
      .catch(() => {
        if (!cancelled) setResolvedSegments(segments ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, chapter, typography.chapterSegmentMode, segments, anchorKey]);

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
    const rows =
      contrasts && contrasts.length > 0
        ? contrasts
        : contrastVerses?.length
          ? [{ translationId: "contrast", verses: contrastVerses }]
          : [];
    if (!rows.length) return null;
    const m = new Map<number, ContrastVerseLine[]>();
    for (const row of rows) {
      for (const v of row.verses) {
        const text = v.text.trim();
        if (!text) continue;
        const bucket = m.get(v.verse) ?? [];
        bucket.push({ translationId: row.translationId, text });
        m.set(v.verse, bucket);
      }
    }
    return m.size ? m : null;
  }, [contrasts, contrastVerses]);

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
    for (const row of resolvedSegments ?? []) {
      if (!Number.isInteger(row.verseStart) || row.verseStart == null) continue;
      if (row.type === "heading") {
        const text = resolveChapterSegmentHeadingText(row, locale, toZhTwText);
        if (text) {
          const bucket = headingByVerse.get(row.verseStart) ?? [];
          bucket.push(text);
          headingByVerse.set(row.verseStart, bucket);
        }
      }
      if (row.type === "paragraph" || row.type === "poetry") {
        paragraphStarts.add(row.verseStart);
      }
    }
    return { headingByVerse, paragraphStarts };
  }, [resolvedSegments, locale]);

  const useParagraphFlowLayout =
    typography.verseParagraphFlow && contrastTranslationIds.length === 0;

  const paragraphGroups = useMemo(() => {
    if (!useParagraphFlowLayout) return [];
    const groups: Array<{ verses: LoadedChapterVerse[] }> = [];
    let current: LoadedChapterVerse[] = [];
    for (let i = 0; i < verses.length; i += 1) {
      const verse = verses[i]!;
      const isStart =
        i === 0 ||
        segmentMeta.paragraphStarts.has(verse.verse) ||
        (segmentMeta.headingByVerse.get(verse.verse)?.length ?? 0) > 0;
      if (isStart && current.length > 0) {
        groups.push({ verses: current });
        current = [];
      }
      current.push(verse);
    }
    if (current.length > 0) groups.push({ verses: current });
    return groups;
  }, [useParagraphFlowLayout, verses, segmentMeta.headingByVerse, segmentMeta.paragraphStarts]);

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

  useEffect(() => {
    void recordTodayReadingChapterFraction(bookId, chapter, 0.1);
  }, [bookId, chapter]);

  useEffect(() => {
    if (!verses.length) return;
    const total = verses.length;
    const verseIdx =
      activeIndex != null && activeIndex >= 0 && activeIndex < total ? activeIndex : 0;
    const fraction = Math.min(1, (verseIdx + 1) / total);
    void recordTodayReadingChapterFraction(bookId, chapter, fraction);
  }, [bookId, chapter, verses.length, activeIndex]);

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
    if (highlightModeActive || verseSelectionMode) return;
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

  const openVerseActionMenu = (v: LoadedChapterVerse) => {
    if (highlightModeActive || verseSelectionMode) return;
    setVerseActionMenu({ verse: v.verse, text: v.text });
  };

  const runCopyCurrentVerse = () => {
    if (!verseActionMenu) return;
    const ref = {
      bookId,
      bookName,
      chapter,
      verse: verseActionMenu.verse,
      translationId,
      text: verseActionMenu.text,
    };
    void navigator.clipboard
      .writeText(formatScriptureVerseClipboard(ref))
      .then(() => setBookmarkFeedback(t("pages.read.verseCopied")))
      .catch(() => setBookmarkFeedback(t("pages.read.verseCopyFailed")));
    setVerseActionMenu(null);
  };

  const openMultiCopyMode = () => {
    if (!verseActionMenu) return;
    setVerseSelectionMode(true);
    setSelectedVerses([verseActionMenu.verse]);
    setVerseActionMenu(null);
  };

  const cancelVerseSelectionMode = useCallback(() => {
    setVerseSelectionMode(false);
    setSelectedVerses([]);
  }, []);

  const toggleSelectedVerse = useCallback((verse: number) => {
    setSelectedVerses((prev) =>
      prev.includes(verse) ? prev.filter((v) => v !== verse) : [...prev, verse].sort((a, b) => a - b),
    );
  }, []);

  const copySelectedVerses = useCallback(() => {
    if (selectedVerses.length === 0) {
      setBookmarkFeedback(t("pages.read.verseSelectionEmpty"));
      return;
    }
    const selectedText = selectedVerses
      .map((verse) => {
        const row = verses.find((v) => v.verse === verse);
        return row ? formatScriptureVerseClipboard({
          bookName,
          chapter,
          verse,
          text: row.text,
        }) : null;
      })
      .filter((x): x is string => Boolean(x))
      .join("\n");
    void navigator.clipboard
      .writeText(selectedText)
      .then(() => setBookmarkFeedback(t("pages.read.verseSelectionCopied", { count: String(selectedVerses.length) })))
      .catch(() => setBookmarkFeedback(t("pages.read.verseCopyFailed")));
    cancelVerseSelectionMode();
  }, [bookName, cancelVerseSelectionMode, chapter, selectedVerses, t, verses]);

  const shareCurrentVerse = useCallback(async () => {
    if (!verseActionMenu) return;
    const payload = formatScriptureVerseClipboard({
      bookName,
      chapter,
      verse: verseActionMenu.verse,
      text: verseActionMenu.text,
    });
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: `${bookName} ${chapter}:${verseActionMenu.verse}`,
          text: payload,
        });
        setBookmarkFeedback(t("pages.read.verseShared"));
      } else {
        await navigator.clipboard.writeText(payload);
        setBookmarkFeedback(t("pages.read.verseShared"));
      }
    } catch {
      setBookmarkFeedback(t("pages.read.verseCopyFailed"));
    }
    setVerseActionMenu(null);
  }, [bookName, chapter, t, verseActionMenu]);

  const runOpenHighlightEditor = () => {
    const draft = cloneHighlightMap(highlightedVerseIndexes);
    setHighlightDraftMap(draft);
    highlightDraftMapRef.current = draft;
    setHighlightModeActive(true);
    setVerseActionMenu(null);
  };

  const toggleVerseHighlightUnit = (
    verse: number,
    current: VerseHighlightMap | null,
    start: number,
    end: number,
    color: string,
  ) => {
    if (!highlightModeActive) return;
    const next = new Map(current ?? []);
    let allSelected = true;
    for (let i = start; i < end; i += 1) {
      if (!next.has(i)) {
        allSelected = false;
        break;
      }
    }
    for (let i = start; i < end; i += 1) {
      if (allSelected) next.delete(i);
      else next.set(i, color);
    }
    const base = cloneHighlightMap(highlightDraftMapRef.current ?? highlightedVerseIndexes);
    if (next.size) base.set(verse, next);
    else base.delete(verse);
    highlightDraftMapRef.current = base;
    setHighlightDraftMap(base);
  };

  const paintVerseHighlightUnit = (
    verse: number,
    start: number,
    end: number,
    mode: "add" | "remove",
    color: string,
  ) => {
    if (!highlightModeActive) return;
    const base = cloneHighlightMap(highlightDraftMapRef.current ?? highlightedVerseIndexes);
    const verseSet = new Map(base.get(verse) ?? []);
    for (let i = start; i < end; i += 1) {
      if (mode === "add") verseSet.set(i, color);
      else verseSet.delete(i);
    }
    if (verseSet.size) base.set(verse, verseSet);
    else base.delete(verse);
    highlightDraftMapRef.current = base;
    setHighlightDraftMap(base);
  };

  const finishHighlightMode = () => {
    const latestDraft = highlightDraftMapRef.current ?? highlightDraftMap ?? highlightedVerseIndexes;
    const nextMap = cloneHighlightMap(latestDraft);
    const savedChars = countHighlightedChars(nextMap);
    setHighlightedVerseIndexes(nextMap);
    setHighlightModeActive(false);
    setHighlightDraftMap(null);
    highlightDraftMapRef.current = null;

    const allVerses = new Set<number>([...highlightedVerseIndexes.keys(), ...nextMap.keys()]);
    for (const verse of Array.from(allVerses).sort((a, b) => a - b)) {
      writeVerseTextHighlightIndices(
        { translationId, bookId, chapter, verse },
        nextMap.get(verse)?.entries() ?? [],
      );
    }

    const persisted = readChapterVerseTextHighlights({ translationId, bookId, chapter });
    const persistedCount = countHighlightedChars(persisted);
    if (persistedCount > 0 || savedChars === 0) setHighlightedVerseIndexes(persisted);
    else setHighlightedVerseIndexes(nextMap);

    setBookmarkFeedback(
      savedChars > 0 ? t("pages.read.verseHighlightSaved") : t("pages.read.verseHighlightCleared"),
    );
  };

  return (
    <div
      className={[
        "read-chapter-verses-root",
        highlightModeActive ? "read-chapter-verses-root--highlight-mode" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ReadVerseBookmarkFeedback message={bookmarkFeedback} onClear={() => setBookmarkFeedback(null)} />
      {useParagraphFlowLayout
        ? paragraphGroups.map((group, groupIndex) => {
            const firstVerse = group.verses[0];
            if (!firstVerse) return null;
            const firstIndex = verses.findIndex((v) => v.verse === firstVerse.verse);
            const headings = segmentMeta.headingByVerse.get(firstVerse.verse) ?? [];
            const showParagraphBreak = groupIndex > 0;
            const showParagraphRule = showParagraphBreak && headings.length > 0;
            return (
              <Fragment key={`pg:${firstVerse.verse}`}>
                {showParagraphBreak ? (
                  showParagraphRule ? (
                    <div
                      className="read-chapter-paragraph-break read-chapter-paragraph-break--rule"
                      aria-hidden="true"
                    />
                  ) : (
                    <div className="read-chapter-paragraph-break" aria-hidden="true" />
                  )
                ) : null}
                {headings.map((title, headingIndex) => (
                  <h2
                    key={`${bookId}:${chapter}:${firstVerse.verse}:h:${headingIndex}`}
                    className="read-chapter-segment-heading"
                  >
                    {title}
                  </h2>
                ))}
                <p
                  className="read-chapter-verse-paragraph-flow"
                  ref={(node) => {
                    if (firstIndex >= 0) verseElRefs.current[firstIndex] = node;
                  }}
                >
                  {group.verses.map((v) => {
                    const i = verses.findIndex((row) => row.verse === v.verse);
                    return (
                      <ReadChapterInlineVerseChunk
                        key={`pv:${v.verse}`}
                        verse={v}
                        index={i}
                        translationId={translationId}
                        bookId={bookId}
                        chapter={chapter}
                        searchFocus={searchFocusVerse === v.verse}
                        searchKeyword={
                          searchFocusVerse === v.verse && searchQueryFromUrl
                            ? searchQueryFromUrl
                            : null
                        }
                        bookmarked={isBookmarked({
                          translationId,
                          bookId,
                          chapter,
                          verse: v.verse,
                        })}
                        active={
                          searchFocusVerse !== v.verse &&
                          !isBookmarked({ translationId, bookId, chapter, verse: v.verse }) &&
                          activeIndex !== null &&
                          i === activeIndex
                        }
                        highlightModeActive={highlightModeActive}
                        highlightedIndexes={activeHighlightMap.get(v.verse) ?? null}
                        activeHighlightColor={activeHighlightColor}
                        selectionMode={verseSelectionMode}
                        selected={selectedVerses.includes(v.verse)}
                        onToggleSelected={() => toggleSelectedVerse(v.verse)}
                        onToggleHighlightUnit={(start, end, color) =>
                          toggleVerseHighlightUnit(
                            v.verse,
                            activeHighlightMap.get(v.verse) ?? null,
                            start,
                            end,
                            color,
                          )
                        }
                        onPaintHighlightUnit={(start, end, mode, color) =>
                          paintVerseHighlightUnit(v.verse, start, end, mode, color)
                        }
                        onDoubleClick={() => onVerseDoubleClick(v)}
                        onOpenActionMenu={() => openVerseActionMenu(v)}
                        enableLongPress={!isWideScreen}
                      />
                    );
                  })}
                </p>
              </Fragment>
            );
          })
        : verses.map((v, i) => (
        <ReadChapterVerseParagraph
          key={`${bookId}:${chapter}:${v.verse}`}
          verse={v}
          index={i}
          bookId={bookId}
          chapter={chapter}
          translationId={translationId}
          headings={segmentMeta.headingByVerse.get(v.verse) ?? []}
          showParagraphBreak={i > 0 && segmentMeta.paragraphStarts.has(v.verse)}
          searchFocus={searchFocusVerse === v.verse}
          searchKeyword={
            searchFocusVerse === v.verse && searchQueryFromUrl ? searchQueryFromUrl : null
          }
          bookmarked={(() => {
            const bm = isBookmarked({ translationId, bookId, chapter, verse: v.verse });
            return bm;
          })()}
          active={(() => {
            const bm = isBookmarked({ translationId, bookId, chapter, verse: v.verse });
            return searchFocusVerse !== v.verse && !bm && activeIndex !== null && i === activeIndex;
          })()}
          contrastLines={contrastByVerse?.get(v.verse) ?? null}
          xrefBundle={xrefsByVerse?.get(v.verse)}
          highlightModeActive={highlightModeActive}
          highlightedIndexes={activeHighlightMap.get(v.verse) ?? null}
          activeHighlightColor={activeHighlightColor}
          selectionMode={verseSelectionMode}
          selected={selectedVerses.includes(v.verse)}
          onToggleSelected={() => toggleSelectedVerse(v.verse)}
          onToggleHighlightUnit={(start, end, color) =>
            toggleVerseHighlightUnit(v.verse, activeHighlightMap.get(v.verse) ?? null, start, end, color)
          }
          onPaintHighlightUnit={(start, end, mode, color) =>
            paintVerseHighlightUnit(v.verse, start, end, mode, color)
          }
          onDoubleClick={() => onVerseDoubleClick(v)}
          onOpenActionMenu={() => openVerseActionMenu(v)}
          onOpenXref={() => setXrefSheetVerse(v.verse)}
          verseRef={(node) => {
            verseElRefs.current[i] = node;
          }}
          t={t}
          enableLongPress={!isWideScreen}
        />
      ))}
      <ReadChapterVerseActionSheet
        menu={verseActionMenu}
        highlightModeActive={highlightModeActive}
        onClose={() => setVerseActionMenu(null)}
        onCopy={runCopyCurrentVerse}
        onOpenMultiCopy={openMultiCopyMode}
        onOpenHighlight={runOpenHighlightEditor}
        onShare={shareCurrentVerse}
      />
      {highlightModeActive ? (
        <ReadChapterHighlightModeBar
          activeColor={activeHighlightColor}
          onColorChange={setActiveHighlightColor}
          onDone={finishHighlightMode}
        />
      ) : null}
      {verseSelectionMode ? (
        <div className="read-chapter-selection-bar" role="toolbar" aria-label={t("pages.read.verseSelectionToggle")}>
          <p className="read-chapter-selection-bar-title">
            {t("pages.read.verseSelectionPicked", { count: String(selectedVerses.length) })}
          </p>
          <div className="read-chapter-selection-actions">
            <button type="button" className="read-chapter-selection-btn" onClick={() => setSelectedVerses([])}>
              {t("pages.read.verseSelectionClear")}
            </button>
            <button type="button" className="read-chapter-selection-btn read-chapter-selection-btn--primary" onClick={copySelectedVerses}>
              {t("pages.read.verseSelectionCopy")}
            </button>
            <button type="button" className="read-chapter-selection-btn" onClick={cancelVerseSelectionMode}>
              {t("pages.read.verseSelectionDone")}
            </button>
          </div>
        </div>
      ) : null}
      <ReadChapterVerseXrefSheet
        open={xrefSheetVerse != null}
        onClose={() => setXrefSheetVerse(null)}
        translationId={translationId}
        bookName={bookName}
        chapter={chapter}
        verse={xrefSheetVerse ?? 0}
        bundle={xrefSheetBundle}
      />
    </div>
  );
}

type ReadChapterInlineVerseChunkProps = {
  verse: LoadedChapterVerse;
  index: number;
  translationId: string;
  bookId: string;
  chapter: number;
  searchFocus: boolean;
  searchKeyword?: string | null;
  bookmarked: boolean;
  active: boolean;
  highlightModeActive: boolean;
  selectionMode: boolean;
  highlightedIndexes: VerseHighlightMap | null;
  activeHighlightColor: string;
  selected: boolean;
  onToggleSelected: () => void;
  onToggleHighlightUnit: (start: number, end: number, color: string) => void;
  onPaintHighlightUnit: (start: number, end: number, mode: "add" | "remove", color: string) => void;
  onDoubleClick: () => void;
  onOpenActionMenu: () => void;
  enableLongPress: boolean;
};

function ReadChapterInlineVerseChunk({
  verse: v,
  translationId,
  bookId,
  chapter,
  searchFocus,
  searchKeyword = null,
  bookmarked,
  active,
  highlightModeActive,
  selectionMode,
  highlightedIndexes,
  activeHighlightColor,
  selected,
  onToggleSelected,
  onToggleHighlightUnit,
  onPaintHighlightUnit,
  onDoubleClick,
  onOpenActionMenu,
  enableLongPress,
}: ReadChapterInlineVerseChunkProps) {
  const longPressHandlers = useVerseLongPress(onOpenActionMenu);
  const parts = resolveVerseSpeechParts(v, {
    translationId,
    bookId,
    chapter,
    verse: v.verse,
  });
  return (
    <span
      data-verse={v.verse}
      className={[
        "read-chapter-verse-inline-chunk",
        searchFocus ? "read-chapter-verse-inline-chunk--search-focus" : "",
        active ? "read-chapter-verse-inline-chunk--audio-active" : "",
        selected ? "read-chapter-verse-inline-chunk--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDoubleClick={onDoubleClick}
      onClick={selectionMode ? onToggleSelected : undefined}
      {...(highlightModeActive || !enableLongPress ? {} : longPressHandlers)}
    >
      <sup className="read-chapter-verse-inline-num">{v.verse}</sup>
      <ReadChapterVerseText
        text={v.text}
        parts={parts}
        highlightedCharIndexes={highlightedIndexes}
        highlightEditMode={highlightModeActive}
        activeHighlightColor={activeHighlightColor}
        onToggleHighlightUnit={onToggleHighlightUnit}
        onPaintHighlightUnit={onPaintHighlightUnit}
        goldenMark={v.isGolden && !bookmarked}
        bookmarkMark={bookmarked}
        searchKeyword={searchKeyword}
      />{" "}
    </span>
  );
}

type VerseParagraphProps = {
  verse: LoadedChapterVerse;
  index: number;
  bookId: string;
  chapter: number;
  translationId: string;
  headings: string[];
  showParagraphBreak: boolean;
  searchFocus: boolean;
  searchKeyword?: string | null;
  bookmarked: boolean;
  active: boolean;
  contrastLines: ContrastVerseLine[] | null;
  xrefBundle: ScriptureVerseXrefsSerialized | undefined;
  highlightModeActive: boolean;
  selectionMode: boolean;
  highlightedIndexes: VerseHighlightMap | null;
  activeHighlightColor: string;
  selected: boolean;
  onToggleSelected: () => void;
  onToggleHighlightUnit: (start: number, end: number, color: string) => void;
  onPaintHighlightUnit: (start: number, end: number, mode: "add" | "remove", color: string) => void;
  onDoubleClick: () => void;
  onOpenActionMenu: () => void;
  onOpenXref: () => void;
  verseRef: (node: HTMLParagraphElement | null) => void;
  t: (path: string, vars?: Record<string, string>) => string;
  enableLongPress: boolean;
};

function ReadChapterVerseParagraph({
  verse: v,
  bookId,
  chapter,
  translationId,
  headings,
  showParagraphBreak,
  searchFocus,
  searchKeyword = null,
  bookmarked,
  active,
  contrastLines,
  xrefBundle,
  highlightModeActive,
  selectionMode,
  highlightedIndexes,
  activeHighlightColor,
  selected,
  onToggleSelected,
  onToggleHighlightUnit,
  onPaintHighlightUnit,
  onDoubleClick,
  onOpenActionMenu,
  onOpenXref,
  verseRef,
  t,
  enableLongPress,
}: VerseParagraphProps) {
  const longPressHandlers = useVerseLongPress(onOpenActionMenu);
  const goldenMark = v.isGolden && !bookmarked;
  const bookmarkMark = bookmarked;
  const hasXref = Boolean(xrefBundle);
  const parts = resolveVerseSpeechParts(v, {
    translationId,
    bookId,
    chapter,
    verse: v.verse,
  });

  return (
    <Fragment>
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
        ref={verseRef}
        data-verse={v.verse}
        onDoubleClick={onDoubleClick}
        {...(highlightModeActive || !enableLongPress ? {} : longPressHandlers)}
        aria-current={searchFocus || active || bookmarked ? "location" : undefined}
        className={[
          "read-chapter-verse [text-wrap:pretty]",
          searchFocus ? "read-chapter-verse--search-focus" : "",
          active ? "read-chapter-verse--audio-active" : "",
          highlightModeActive ? "read-chapter-verse--highlight-mode" : "",
          selected ? "read-chapter-verse--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={selectionMode ? onToggleSelected : undefined}
      >
        {hasXref ? (
          <button
            type="button"
            className={`read-chapter-verse-num read-chapter-verse-num--xref${selected ? " read-chapter-verse-num--selected" : ""}`}
            aria-label={`${v.verse}. ${t("pages.read.verseXrefMarkerA11y")}`}
            onClick={(e) => {
              e.stopPropagation();
              if (selectionMode) {
                onToggleSelected();
              } else {
                onOpenXref();
              }
            }}
          >
            {v.verse}
          </button>
        ) : (
          <span className={`read-chapter-verse-num${selected ? " read-chapter-verse-num--selected" : ""}`}>{v.verse}</span>
        )}
        <span className="read-chapter-verse-primary">
          <ReadChapterVerseText
            text={v.text}
            parts={parts}
            highlightedCharIndexes={highlightedIndexes}
            highlightEditMode={highlightModeActive}
            activeHighlightColor={activeHighlightColor}
            onToggleHighlightUnit={onToggleHighlightUnit}
            onPaintHighlightUnit={onPaintHighlightUnit}
            goldenMark={goldenMark}
            bookmarkMark={bookmarkMark}
            searchKeyword={searchKeyword}
          />
        </span>
        {contrastLines?.map((row) => (
          <span key={`${v.verse}:${row.translationId}`} className="read-chapter-verse-contrast">
            {row.text}
          </span>
        ))}
      </p>
    </Fragment>
  );
}
