import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform } from "react-native";
import type { HomeVerseEntry } from "./verse-pool/types";

/** 淡出 → 等新句排版稳定 → 停顿 → 慢淡入。 */
const FADE_OUT_MS = 720;
const FADE_GAP_MS = 560;
const FADE_IN_MS = 1960;
/** Android 量高偶发二次，再等一帧避免淡入中途跳一下。 */
const ANDROID_LAYOUT_SETTLE_MS = 72;
/**
 * 换句后若 onLayout / height-gate 未及时 notify（例如首帧仍 return null 等 appearance），
 * 超时仍开淡入，避免 opacity 永久停在 0。
 */
const LAYOUT_FADE_IN_TIMEOUT_MS = 400;

export type HomeVerseDisplayState = {
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
  const [displayVerse, setDisplayVerse] = useState<HomeVerseDisplayState>(() => ({
    entry: null,
    contrastEntry: null,
    verseKey: null,
    primaryTranslationId: "",
    contrastTranslationId: "",
  }));
  const displayVerseRef = useRef(displayVerse);
  const fadeGenRef = useRef(0);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 非 null：已换句、opacity=0，等 layout 后再淡入 */
  const pendingLayoutFadeInGenRef = useRef<number | null>(null);
  /** 最新正文快照：换句动画只跟 key/译本走，避免 entry 引用抖动取消淡入。 */
  const latestRef = useRef({
    ready,
    entry,
    contrastEntry,
    verseKey,
    primaryTranslationId,
    contrastTranslationId,
  });
  latestRef.current = {
    ready,
    entry,
    contrastEntry,
    verseKey,
    primaryTranslationId,
    contrastTranslationId,
  };

  useEffect(() => {
    displayVerseRef.current = displayVerse;
  }, [displayVerse]);

  const clearGapTimer = useCallback(() => {
    if (gapTimerRef.current) {
      clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  const clearLayoutWaitTimer = useCallback(() => {
    if (layoutWaitTimerRef.current) {
      clearTimeout(layoutWaitTimerRef.current);
      layoutWaitTimerRef.current = null;
    }
  }, []);

  const startFadeIn = useCallback(
    (gen: number) => {
      clearGapTimer();
      gapTimerRef.current = setTimeout(
        () => {
          gapTimerRef.current = null;
          if (fadeGenRef.current !== gen) return;
          // out 曲线：整段 1960ms 都在变亮（inOut 会把前半段耗在近乎不可见）。
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        },
        FADE_GAP_MS + (Platform.OS === "android" ? ANDROID_LAYOUT_SETTLE_MS : 0),
      );
    },
    [clearGapTimer, fadeAnim],
  );

  /** 换句后武装 layout 等待；超时仍淡入，避免永远 invisible。 */
  const armPendingLayoutFadeIn = useCallback(
    (gen: number) => {
      pendingLayoutFadeInGenRef.current = gen;
      clearLayoutWaitTimer();
      layoutWaitTimerRef.current = setTimeout(() => {
        layoutWaitTimerRef.current = null;
        if (pendingLayoutFadeInGenRef.current !== gen) return;
        if (fadeGenRef.current !== gen) return;
        pendingLayoutFadeInGenRef.current = null;
        startFadeIn(gen);
      }, LAYOUT_FADE_IN_TIMEOUT_MS);
    },
    [clearLayoutWaitTimer, startFadeIn],
  );

  /** 新句 onLayout / 高度就绪后调用：位置已对再淡入。 */
  const notifyVerseBlockLaidOut = useCallback(() => {
    const gen = pendingLayoutFadeInGenRef.current;
    if (gen == null || fadeGenRef.current !== gen) return;
    pendingLayoutFadeInGenRef.current = null;
    clearLayoutWaitTimer();
    startFadeIn(gen);
  }, [clearLayoutWaitTimer, startFadeIn]);

  /** 同句正文刷新：只改字，不动 opacity / 进行中的淡入淡出。 */
  useEffect(() => {
    if (!ready || !entry) return;
    const current = displayVerseRef.current;
    if (!current.entry) return;
    const currentKey = (current.verseKey ?? "").trim();
    const nextKey = (verseKey ?? "").trim();
    if (currentKey !== nextKey) return;
    if (
      current.primaryTranslationId !== primaryTranslationId ||
      current.contrastTranslationId !== contrastTranslationId
    ) {
      return;
    }
    setDisplayVerse({
      entry,
      contrastEntry,
      verseKey,
      primaryTranslationId,
      contrastTranslationId,
    });
  }, [ready, entry, contrastEntry, verseKey, primaryTranslationId, contrastTranslationId]);

  /**
   * 换句动画：只依赖 ready / verseKey / 译本 id。
   * 不可把 entry 对象放进 deps——resolve 重跑会产生新引用，cleanup 会 stopAnimation
   * 随后 same-verse 分支若 snap 到 1，会把 1960ms 淡入瞬间掐掉。
   */
  useEffect(() => {
    const snap = latestRef.current;
    if (!snap.ready || !snap.entry) return;
    const current = displayVerseRef.current;
    const next: HomeVerseDisplayState = {
      entry: snap.entry,
      contrastEntry: snap.contrastEntry,
      verseKey: snap.verseKey,
      primaryTranslationId: snap.primaryTranslationId,
      contrastTranslationId: snap.contrastTranslationId,
    };

    if (!current.entry) {
      // 首帧：保持 Animated.Value(1)，绝不先压到 0 再等 layout。
      // HomeVerseOverlay 在 appearance 就绪前会 return null，等 layout 会永久 invisible。
      clearGapTimer();
      clearLayoutWaitTimer();
      pendingLayoutFadeInGenRef.current = null;
      setDisplayVerse(next);
      fadeAnim.stopAnimation();
      fadeAnim.setValue(1);
      return;
    }

    const currentKey = (current.verseKey ?? "").trim();
    const nextKey = (next.verseKey ?? "").trim();
    const sameVerse = currentKey === nextKey;
    const sameTranslations =
      current.primaryTranslationId === next.primaryTranslationId &&
      current.contrastTranslationId === next.contrastTranslationId;
    if (sameVerse && sameTranslations) {
      // 正文由 soft-sync effect 更新；此处绝不 setValue(1)，以免打断进行中的淡入。
      return;
    }

    const gen = ++fadeGenRef.current;
    clearGapTimer();
    clearLayoutWaitTimer();
    pendingLayoutFadeInGenRef.current = null;
    fadeAnim.stopAnimation();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || fadeGenRef.current !== gen) return;
      // 淡出结束后再读一次最新快照，避免用到过期 next。
      const latest = latestRef.current;
      const swapped: HomeVerseDisplayState = {
        entry: latest.entry,
        contrastEntry: latest.contrastEntry,
        verseKey: latest.verseKey,
        primaryTranslationId: latest.primaryTranslationId,
        contrastTranslationId: latest.contrastTranslationId,
      };
      setDisplayVerse(swapped);
      fadeAnim.setValue(0);
      armPendingLayoutFadeIn(gen);
    });

    return () => {
      fadeGenRef.current += 1;
      pendingLayoutFadeInGenRef.current = null;
      clearLayoutWaitTimer();
      clearGapTimer();
      fadeAnim.stopAnimation();
    };
  }, [
    ready,
    verseKey,
    primaryTranslationId,
    contrastTranslationId,
    fadeAnim,
    clearGapTimer,
    clearLayoutWaitTimer,
    armPendingLayoutFadeIn,
  ]);

  return {
    fadeAnim,
    displayVerse,
    notifyVerseBlockLaidOut,
    effectiveEntry: displayVerse.entry ?? entry,
    effectiveContrastEntry: displayVerse.contrastEntry ?? contrastEntry,
    effectiveVerseKey: displayVerse.verseKey ?? verseKey,
    effectivePrimaryTranslationId: displayVerse.primaryTranslationId || primaryTranslationId,
    effectiveContrastTranslationId: displayVerse.contrastTranslationId || contrastTranslationId,
  };
}
