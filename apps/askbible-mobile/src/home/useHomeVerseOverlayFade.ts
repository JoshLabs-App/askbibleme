import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import type { HomeVerseEntry } from "./verse-pool/types";

const FADE_IN_MS = 2000;
const FADE_OUT_MS = 2000;

type DisplayVerseState = {
  entry: HomeVerseEntry | null;
  contrastEntry: HomeVerseEntry | null;
  verseKey: string | null | undefined;
  primaryTranslationId: string;
  contrastTranslationId: string;
};

type VerseSnapshot = {
  ready: boolean;
  entry: HomeVerseEntry | null;
  contrastEntry: HomeVerseEntry | null;
  verseKey: string | null | undefined;
  primaryTranslationId: string;
  contrastTranslationId: string;
};

export function useHomeVerseOverlayFade({
  ready,
  entry,
  contrastEntry,
  verseKey,
  primaryTranslationId,
  contrastTranslationId,
}: VerseSnapshot) {
  const fadeAnim = useState(() => new Animated.Value(1))[0];
  const [displayVerse, setDisplayVerse] = useState<DisplayVerseState>(() => ({
    entry: null,
    contrastEntry: null,
    verseKey: null,
    primaryTranslationId: "",
    contrastTranslationId: "",
  }));
  const displayVerseRef = useRef(displayVerse);

  useEffect(() => {
    displayVerseRef.current = displayVerse;
  }, [displayVerse]);

  useEffect(() => {
    if (!ready || !entry) return;
    const current = displayVerseRef.current;
    const next = {
      entry,
      contrastEntry,
      verseKey,
      primaryTranslationId,
      contrastTranslationId,
    };

    if (!current.entry) {
      setDisplayVerse(next);
      fadeAnim.stopAnimation();
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }).start();
      return;
    }

    const currentKey = (current.verseKey ?? "").trim();
    const nextKey = (next.verseKey ?? "").trim();
    const sameVerse = currentKey === nextKey;
    const sameTranslations =
      current.primaryTranslationId === next.primaryTranslationId &&
      current.contrastTranslationId === next.contrastTranslationId;
    if (sameVerse && sameTranslations) {
      fadeAnim.stopAnimation();
      fadeAnim.setValue(1);
      return;
    }

    fadeAnim.stopAnimation();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setDisplayVerse(next);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }).start();
    });
  }, [
    ready,
    entry,
    contrastEntry,
    verseKey,
    primaryTranslationId,
    contrastTranslationId,
    fadeAnim,
  ]);

  return {
    fadeAnim,
    effectiveEntry: displayVerse.entry ?? entry,
    effectiveContrastEntry: displayVerse.contrastEntry ?? contrastEntry,
    effectiveVerseKey: displayVerse.verseKey ?? verseKey,
    effectivePrimaryTranslationId: displayVerse.primaryTranslationId || primaryTranslationId,
    effectiveContrastTranslationId: displayVerse.contrastTranslationId || contrastTranslationId,
  };
}
