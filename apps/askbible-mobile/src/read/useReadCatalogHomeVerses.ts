import { useEffect, useRef, useState } from "react";
import { Animated, InteractionManager } from "react-native";
import { localizeZhText } from "../i18n/site-copy";
import {
  HOME_VERSE_PREP_TIMEOUT_MS,
  HOME_VERSE_ROTATION,
} from "./readCatalogScreenConstants";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { useLocale } from "../i18n/LocaleProvider";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import {
  ensureScriptureTranslationReadyWithFallback,
} from "../bible/scripture-translation-download";
import {
  DEFAULT_SCRIPTURE_LABEL_EN,
  DEFAULT_SCRIPTURE_LABEL_ZH,
} from "../bible/types";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { resolveReadDisplayLocale } from "./resolveReadDisplayLocale";

type Args = {
  homeMode: boolean;
  catalogFocused: boolean;
};

export function useReadCatalogHomeVerses({ homeMode, catalogFocused }: Args) {
  const { primaryTranslationId, translationCatalog } = useReadBibleTypography();
  const { locale } = useLocale();
  const [homeVerses, setHomeVerses] = useState<Array<{ text: string; reference: string }>>([]);
  const [verseIndex, setVerseIndex] = useState(0);
  const verseOpacity = useRef(new Animated.Value(1)).current;
  const verseAnimatingRef = useRef(false);

  useEffect(() => {
    if (!homeMode || !catalogFocused) return;
    if (homeVerses.length < 2) return;
    setVerseIndex(0);
    verseOpacity.setValue(1);
    const rotateVerse = () => {
      if (verseAnimatingRef.current) return;
      verseAnimatingRef.current = true;
      Animated.timing(verseOpacity, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          verseAnimatingRef.current = false;
          return;
        }
        setVerseIndex((prev) => (prev + 1) % homeVerses.length);
        Animated.timing(verseOpacity, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }).start(() => {
          verseAnimatingRef.current = false;
        });
      });
    };
    const timer = setInterval(() => {
      rotateVerse();
    }, 15000);
    return () => {
      clearInterval(timer);
      verseAnimatingRef.current = false;
      verseOpacity.stopAnimation();
      verseOpacity.setValue(1);
    };
  }, [catalogFocused, homeMode, homeVerses.length, verseOpacity]);

  useEffect(() => {
    if (!homeMode || !catalogFocused) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const primaryMeta = translationCatalog.find((tr) => tr.id === primaryTranslationId);
      const displayLocale = resolveReadDisplayLocale({
        appLocale: locale,
        translationLanguage: primaryMeta?.language,
      });
      const labels = {
        labelZh: primaryMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
        labelEn: primaryMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
      };
      const versionLabel = String(
        displayLocale === "en"
          ? labels.labelEn
          : localizeZhText(displayLocale, labels.labelZh) ?? "",
      ).trim();
      void (async () => {
        let readyPrimaryId = primaryTranslationId;
        try {
          readyPrimaryId = await Promise.race([
            ensureScriptureTranslationReadyWithFallback(primaryTranslationId),
            new Promise<string>((resolve) => {
              setTimeout(() => resolve(primaryTranslationId), HOME_VERSE_PREP_TIMEOUT_MS);
            }),
          ]);
        } catch {
          readyPrimaryId = primaryTranslationId;
        }
        if (cancelled) return;

        const chapterCache = new Map<
          string,
          Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>
        >();
        const items: Array<{ text: string; reference: string }> = [];
        for (const ref of HOME_VERSE_ROTATION) {
          const cacheKey = `${readyPrimaryId}:${ref.bookId}:${ref.chapter}`;
          if (!chapterCache.has(cacheKey)) {
            try {
              chapterCache.set(
                cacheKey,
                await loadChapterFromBundledTranslation(
                  ref.bookId,
                  ref.chapter,
                  readyPrimaryId,
                  labels,
                ),
              );
            } catch {
              chapterCache.set(cacheKey, null);
            }
          }
          const loaded = chapterCache.get(cacheKey);
          const bookName = getScriptureBookDisplayName(ref.bookId, displayLocale);
          const verseText =
            loaded?.verses.find((row) => row.verse === ref.verse)?.text?.trim() || "";
          const reference = `${bookName} ${ref.chapter}:${ref.verse}${
            versionLabel ? ` · ${versionLabel}` : ""
          }`;
          items.push({ text: verseText, reference });
        }
        if (cancelled) return;
        const usable = items.filter((row) => row.text.length > 0);
        setHomeVerses(usable);
        setVerseIndex(0);
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [catalogFocused, homeMode, locale, primaryTranslationId, translationCatalog]);

  const activeHomeVerse = homeVerses[verseIndex] ?? homeVerses[0] ?? null;

  return {
    activeHomeVerse,
    verseOpacity,
  };
}
