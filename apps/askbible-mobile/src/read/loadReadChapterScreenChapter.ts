import { InteractionManager } from "react-native";
import { loadBundledChapterSegments } from "../bible/bundled-chapter-segments";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { loadRemoteChapter } from "../bible/load-remote-chapter";
import type { ChapterSegment, LoadedChapter } from "../bible/types";
import {
  DEFAULT_SCRIPTURE_LABEL_EN,
  DEFAULT_SCRIPTURE_LABEL_ZH,
} from "../bible/types";
import type { BibleTranslationMeta } from "../bible/translations-types";
import { translationMetaFromCatalog } from "../api/fetchBibleTranslationsCatalog";
import { ensureScriptureTranslationReady } from "../bible/scripture-translation-download";
import { isBundledScriptureTranslation } from "../bible/bundled-scripture-translations";
import { t } from "../i18n/site-copy";
import { recordTodayReadingChapterFraction } from "./reading-plan/today-reading-chapter-fraction";
import { writeLastReadPosition } from "./read-last-position";

/**
 * 主译本缺本章（如 UST 尚未发布的书卷）时的回退译本：按主译本语言选内置译本
 * （英文 → WEB，繁体 → 和合本繁体，其它 → 和合本简体）。
 */
function pickFallbackTranslationId(primaryTranslationId: string, language: string | undefined): string | null {
  const lang = String(language ?? "").trim().toLowerCase();
  const candidates = lang.startsWith("en")
    ? ["web-en", "kjv"]
    : lang === "zh-hant"
      ? ["cuv-trad", "cuv-simp"]
      : ["cuv-simp", "cuv-trad"];
  return candidates.find((id) => id !== primaryTranslationId && isBundledScriptureTranslation(id)) ?? null;
}

export type ReadChapterLoadResult =
  | { ok: true; chapter: LoadedChapter; segments: ChapterSegment[] | null }
  | { ok: false; error: string | null; chapter: null };

type Args = {
  bookId: string;
  chapter: number;
  primaryTranslationId: string;
  chapterSegmentMode: "default" | "t1";
  preferEnglishSegmentTitles: boolean;
  translationCatalog: BibleTranslationMeta[];
  loadSeq: number;
  chapterLoadSeqRef: React.MutableRefObject<number>;
  cancelDeferredTasks: () => void;
  scheduleXrefAfterChapterLoad: (loadSeq: number) => void;
};

export async function loadReadChapterScreenChapter({
  bookId,
  chapter,
  primaryTranslationId,
  chapterSegmentMode,
  preferEnglishSegmentTitles,
  translationCatalog,
  loadSeq,
  chapterLoadSeqRef,
  cancelDeferredTasks,
  scheduleXrefAfterChapterLoad,
}: Args): Promise<ReadChapterLoadResult> {
  if (__DEV__) {
    console.warn("[read] load chapter start", {
      bookId,
      chapter,
      primaryTranslationId,
      chapterSegmentMode,
      preferEnglishSegmentTitles,
    });
  }
  const primaryMeta = translationCatalog.find((item) => item.id === primaryTranslationId);
  const primaryLabels = {
    labelZh: primaryMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
    labelEn: primaryMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
  };
  const catalogMeta = translationMetaFromCatalog(
    {
      translations: translationCatalog,
      defaultTranslationId: null,
    },
    primaryTranslationId,
  );
  const isChapterApi = catalogMeta?.delivery === "chapter-api";
  let loaded: LoadedChapter | null = null;

  if (isChapterApi && catalogMeta) {
    // 按章在线译本：只拉所选译本，失败不偷换成内置和合本/WEB。
    loaded = await loadRemoteChapter(catalogMeta, bookId, chapter);
  } else {
    try {
      await ensureScriptureTranslationReady(primaryTranslationId, catalogMeta?.downloadUrl, {
        delivery: catalogMeta?.delivery,
      });
    } catch (err) {
      if (!isBundledScriptureTranslation(primaryTranslationId)) {
        console.warn("[read] chapter translation not ready", {
          bookId,
          chapter,
          primaryTranslationId,
          message: err instanceof Error ? err.message : String(err),
        });
        return { ok: false, error: t("pages.read.chapterLoadError"), chapter: null };
      }
    }
    if (loadSeq !== chapterLoadSeqRef.current) {
      return { ok: false, error: null, chapter: null };
    }
    loaded = await loadChapterFromBundledTranslation(
      bookId,
      chapter,
      primaryTranslationId,
      primaryLabels,
    );
    if (!loaded) {
      const fallbackId = pickFallbackTranslationId(primaryTranslationId, primaryMeta?.language);
      if (fallbackId) {
        const fallbackMeta = translationCatalog.find((item) => item.id === fallbackId);
        const fallbackLoaded = await loadChapterFromBundledTranslation(bookId, chapter, fallbackId, {
          labelZh: fallbackMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
          labelEn: fallbackMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
        });
        if (loadSeq !== chapterLoadSeqRef.current) {
          return { ok: false, error: null, chapter: null };
        }
        if (fallbackLoaded) {
          loaded = {
            ...fallbackLoaded,
            fallbackFromTranslationId: primaryTranslationId,
            fallbackFromLabelZh: primaryLabels.labelZh,
            fallbackFromLabelEn: primaryLabels.labelEn,
          };
        }
      }
    }
  }

  if (loadSeq !== chapterLoadSeqRef.current) {
    return { ok: false, error: null, chapter: null };
  }

  if (!loaded) {
    if (__DEV__) {
      console.warn("[read] chapter load failed", {
        bookId,
        chapter,
        primaryTranslationId,
        delivery: catalogMeta?.delivery ?? null,
      });
    }
    return { ok: false, error: t("pages.read.chapterLoadError"), chapter: null };
  }

  if (__DEV__) {
    console.warn("[read] chapter load ok", {
      bookId: loaded.bookId,
      chapter: loaded.chapter,
      translationId: loaded.translationId,
      verses: loaded.verses.length,
    });
  }

  const segments = loadBundledChapterSegments(loaded.bookId, loaded.chapter, chapterSegmentMode, {
    preferEnglishTitles: preferEnglishSegmentTitles,
  });

  InteractionManager.runAfterInteractions(() => {
    void writeLastReadPosition({
      bookId: loaded.bookId,
      chapter: loaded.chapter,
      bookName: loaded.bookName,
    });
  });

  cancelDeferredTasks();
  InteractionManager.runAfterInteractions(() => {
    void recordTodayReadingChapterFraction(loaded.bookId, loaded.chapter, 0.1);
    void import("./reading-habit-stats").then(({ recordAnyReadingActivityDay }) => {
      void recordAnyReadingActivityDay();
    });
  });
  scheduleXrefAfterChapterLoad(loadSeq);

  return { ok: true, chapter: loaded, segments };
}
