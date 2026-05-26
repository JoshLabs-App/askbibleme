import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseVerseKey } from "../bible/parse-verse-key";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { SHELL_TAB_BAR_CLEARANCE } from "../shell/shellLayout";
import {
  HOME_SCENE_THUMB_SIZE,
  HOME_SCENE_THUMB_SLOT_PAD,
} from "./HomeSceneThumb";
import {
  readNatureHomeTextScaleIndex,
  readNatureHomeVerseAppearance,
  textScaleAtIndex,
  type NatureHomeVerseAppearance,
} from "./natureHomePrefs";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { flowLocaleForHomeVerseTranslationId } from "./homePrayerVersePrefs";
import { joinVerseLinesForFlow } from "./joinVerseLinesForFlow";
import { useHomeThemeRepeatVerse } from "./useHomeThemeRepeatVerse";
import { verseTypography } from "./verseTextStyle";
import {
  getHomeVersePoolScope,
  hydrateHomeVersePoolScope,
  subscribeHomeVersePoolScope,
} from "./homeVersePoolScopePrefs";

type Props = {
  prefsVersion?: number;
  variant?: "onVideo" | "onLight";
  /** `homeLandscape`：横屏沉浸；锚点落黄金线 ≈38.2%，增高 45% 上 / 55% 下 */
  layout?: "home" | "homeLandscape" | "inline";
  pauseRotation?: boolean;
  onDisplayedVerseChange?: (payload: {
    verseKey: string | null;
    primaryTranslationId: string;
    speechMain: string;
    speechReference: string;
    speechLocale: AppLocale;
  }) => void;
  onAdvanceControllerReady?: (advanceNow: () => Promise<void>) => void;
};

const PHI = (1 + Math.sqrt(5)) / 2;
/** 上黄金线（距安全区顶 ≈ 38.2%） */
const GOLDEN_UPPER = 1 - 1 / PHI;
/** 首页经文整体上移 10% 视口高度 */
const HOME_VERSE_UP_SHIFT = 0.1;
const HOME_VERSE_TOP_PAD = 12;
/** 与 `HomeNatureScreen` `bottomBand` + 场景条行高对齐 */
const HOME_SCENE_STRIP_BAND_H =
  12 + 6 + (HOME_SCENE_THUMB_SIZE + HOME_SCENE_THUMB_SLOT_PAD * 2) + 6;
const CJK_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

function homeVerseMaxHeightPx(
  screenH: number,
  insets: { top: number; bottom: number },
): number {
  const usableH = Math.max(1, screenH - insets.top - insets.bottom);
  const goldenY = insets.top + usableH * (GOLDEN_UPPER - HOME_VERSE_UP_SHIFT);
  const spaceAbove = Math.max(0, goldenY - insets.top - HOME_VERSE_TOP_PAD);
  const stripTop = screenH - (SHELL_TAB_BAR_CLEARANCE + insets.bottom) - HOME_SCENE_STRIP_BAND_H;
  const spaceBelow = Math.max(0, stripTop - goldenY);
  // 以“中线”对齐黄金线：块体上下各占一半。
  return Math.floor(Math.min(spaceAbove, spaceBelow) * 2);
}

function hasCjkChars(text: string): boolean {
  return CJK_CHAR_RE.test(text);
}

const LATIN_CHAR_RE = /[A-Za-z]/;

function resolveSpeechLocale(
  speechMain: string,
  translationId: string,
): AppLocale {
  const text = speechMain.trim();
  if (text) {
    if (LATIN_CHAR_RE.test(text) && !hasCjkChars(text)) return "en";
    if (hasCjkChars(text)) return "zh-CN";
  }
  return flowLocaleForHomeVerseTranslationId(translationId);
}

function referenceForSpeech(ref: string, isEnglish: boolean): string {
  const raw = String(ref || "").trim();
  if (!raw) return "";
  return raw.replace(
    /(\d+)\s*:\s*(\d+)(?:\s*[-~—]\s*(\d+))?/g,
    (_m, chapterRaw: string, verseStartRaw: string, verseEndRaw?: string) => {
      const chapter = String(chapterRaw).trim();
      const verseStart = String(verseStartRaw).trim();
      const verseEnd = verseEndRaw ? String(verseEndRaw).trim() : "";
      if (isEnglish) {
        return verseEnd
          ? `chapter ${chapter} verse ${verseStart} to ${verseEnd}`
          : `chapter ${chapter} verse ${verseStart}`;
      }
      return verseEnd ? `${chapter}章${verseStart}到${verseEnd}节` : `${chapter}章${verseStart}节`;
    },
  );
}

function referenceForSpeechByVerseKey(
  verseKey: string | null | undefined,
  ref: string,
  isEnglish: boolean,
): string {
  const parsed = verseKey ? parseVerseKey(verseKey) : null;
  if (!parsed) return referenceForSpeech(ref, isEnglish);
  const bookName = getScriptureBookDisplayName(parsed.bookId, isEnglish ? "en" : "zh-CN");
  if (isEnglish) {
    return `${bookName} chapter ${parsed.chapter} verse ${parsed.verse}`;
  }
  return `${bookName}${parsed.chapter}章${parsed.verse}节`;
}

/** 自然首页轮播经文：竖屏与网站 `top-[38.2%]` 对齐；横屏整块落黄金位。 */
export function HomeVerseOverlay({
  prefsVersion = 0,
  variant = "onVideo",
  layout = "home",
  pauseRotation = false,
  onDisplayedVerseChange,
  onAdvanceControllerReady,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { locale } = useLocale();
  const homeVersePoolScope = useSyncExternalStore(
    subscribeHomeVersePoolScope,
    getHomeVersePoolScope,
    getHomeVersePoolScope,
  );
  const { ready, entry, contrastEntry, verseKey, primaryTranslationId, contrastTranslationId, advanceNow } =
    useHomeThemeRepeatVerse(locale, undefined, prefsVersion, pauseRotation, homeVersePoolScope);

  useEffect(() => {
    void hydrateHomeVersePoolScope();
  }, []);
  const fadeAnim = useState(() => new Animated.Value(1))[0];
  const [displayVerse, setDisplayVerse] = useState(() => ({
    entry: null as typeof entry,
    contrastEntry: null as typeof contrastEntry,
    verseKey: null as typeof verseKey,
    primaryTranslationId: "",
    contrastTranslationId: "",
  }));
  const displayVerseRef = useRef(displayVerse);
  const [appearance, setAppearance] = useState<NatureHomeVerseAppearance | null>(null);
  const [scaleIndex, setScaleIndex] = useState(12);
  const [blockH, setBlockH] = useState(40);
  const FADE_IN_MS = 2000;
  const FADE_OUT_MS = 2000;

  useEffect(() => {
    void (async () => {
      const [nextAppearance, nextScaleIndex] = await Promise.all([
        readNatureHomeVerseAppearance(),
        readNatureHomeTextScaleIndex(),
      ]);
      setAppearance(nextAppearance);
      setScaleIndex(nextScaleIndex);
    })();
  }, [prefsVersion]);

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

  const effectiveEntry = displayVerse.entry ?? entry;
  const effectiveContrastEntry = displayVerse.contrastEntry ?? contrastEntry;
  const effectiveVerseKey = displayVerse.verseKey ?? verseKey;
  const effectivePrimaryTranslationId =
    displayVerse.primaryTranslationId || primaryTranslationId;
  const effectiveContrastTranslationId =
    displayVerse.contrastTranslationId || contrastTranslationId;

  useEffect(() => {
    onAdvanceControllerReady?.(advanceNow);
  }, [advanceNow, onAdvanceControllerReady]);

  const speechMain =
    effectiveEntry && effectivePrimaryTranslationId
      ? joinVerseLinesForFlow(
          effectiveEntry.lines,
          flowLocaleForHomeVerseTranslationId(effectivePrimaryTranslationId),
        ).trim()
      : "";
  const speechReference =
    effectiveEntry && effectivePrimaryTranslationId
      ? referenceForSpeechByVerseKey(
          effectiveVerseKey,
          effectiveEntry.ref,
          flowLocaleForHomeVerseTranslationId(effectivePrimaryTranslationId) === "en",
        ).trim()
      : "";
  const speechLocale = resolveSpeechLocale(speechMain, effectivePrimaryTranslationId);

  useEffect(() => {
    onDisplayedVerseChange?.({
      verseKey: effectiveVerseKey ?? null,
      primaryTranslationId: effectivePrimaryTranslationId,
      speechMain,
      speechReference,
      speechLocale,
    });
  }, [
    effectiveVerseKey,
    effectivePrimaryTranslationId,
    speechMain,
    speechReference,
    speechLocale,
    onDisplayedVerseChange,
  ]);

  const readTarget = effectiveVerseKey ? parseVerseKey(effectiveVerseKey) : null;

  const openReadChapter = useCallback(() => {
    if (!readTarget) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/(tabs)/read/[bookId]/[chapter]",
      params: {
        bookId: readTarget.bookId,
        chapter: String(readTarget.chapter),
        verse: String(readTarget.verse),
      },
    });
  }, [readTarget, router]);

  if (!ready || !effectiveEntry || !appearance) return null;

  const body = joinVerseLinesForFlow(
    effectiveEntry.lines,
    flowLocaleForHomeVerseTranslationId(effectivePrimaryTranslationId),
  );
  const contrastBody = effectiveContrastEntry
    ? joinVerseLinesForFlow(
        effectiveContrastEntry.lines,
        flowLocaleForHomeVerseTranslationId(effectiveContrastTranslationId),
      )
    : "";
  const scale = textScaleAtIndex(scaleIndex);
  const typo = verseTypography(appearance, scale, variant);
  const shouldUseCjkWrap =
    hasCjkChars(body) || hasCjkChars(contrastBody) || hasCjkChars(effectiveEntry.ref);
  const cjkTextStyle = shouldUseCjkWrap ? styles.cjkText : null;
  const contrastTypo: typeof typo.body = effectiveContrastEntry
    ? {
        ...typo.body,
        fontSize: Math.max(12, Math.round(typo.body.fontSize! * 0.88)),
        lineHeight: Math.max(16, Math.round((typo.body.lineHeight ?? 24) * 0.9)),
        color: variant === "onVideo" ? "#FFFFFF" : "rgba(51, 65, 85, 0.72)",
      }
    : typo.body;
  const useUnifiedBarStrip = appearance.textEffect === "barStrip" && variant === "onVideo";

  const isLandscapeLayout = layout === "homeLandscape";
  /** 横屏沉浸：点屏由 `HomeNatureScreen` 处理播放/场景，经文不跳转读经 */
  const linkToRead = !isLandscapeLayout && Boolean(readTarget);
  const padL = Math.max(insets.left, 30);
  const padR = Math.max(insets.right, 30);
  const usableH = Math.max(1, screenH - insets.top - insets.bottom);
  const upperGoldenY = insets.top + usableH * (GOLDEN_UPPER - HOME_VERSE_UP_SHIFT);
  const isPortraitHome = layout === "home";
  const homeVerseMaxH = isPortraitHome ? homeVerseMaxHeightPx(screenH, insets) : 0;
  const goldenAnchorLift = Math.round(blockH * 0.5);

  const wrapStyle =
    isLandscapeLayout || isPortraitHome ? styles.wrapHomeStage : styles.wrapInline;

  const onGoldenBlockLayout = (h: number) => {
    if (h > 0) setBlockH(Math.round(h));
  };

  const goldenBlock = (
    <Animated.View
      style={[
        styles.goldenSlot,
        { opacity: fadeAnim },
        {
          left: padL,
          right: padR,
          top: upperGoldenY,
          maxHeight: isPortraitHome ? homeVerseMaxH : undefined,
          transform: [{ translateY: -goldenAnchorLift }],
        },
      ]}
      onLayout={(e) => onGoldenBlockLayout(e.nativeEvent.layout.height)}
    >
      {useUnifiedBarStrip ? (
        <View style={styles.barStripCard}>
          <Text style={[typo.body, styles.barStripText, cjkTextStyle]}>{body}</Text>
          {contrastBody ? (
            <Text style={[contrastTypo, styles.barStripText, cjkTextStyle]}>{contrastBody}</Text>
          ) : null}
          <Text style={[typo.ref, styles.barStripText, cjkTextStyle]}>{effectiveEntry.ref}</Text>
        </View>
      ) : (
        <>
          <Text style={[typo.body, styles.goldenSlotText, cjkTextStyle]}>{body}</Text>
          {contrastBody ? (
            <Text style={[contrastTypo, styles.goldenSlotText, cjkTextStyle]}>{contrastBody}</Text>
          ) : null}
          <Text style={[typo.ref, styles.goldenSlotText, cjkTextStyle]}>{effectiveEntry.ref}</Text>
        </>
      )}
    </Animated.View>
  );

  const content =
    isLandscapeLayout || isPortraitHome ? (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {goldenBlock}
      </View>
    ) : (
      <Animated.View style={{ opacity: fadeAnim }}>
        {useUnifiedBarStrip ? (
          <View style={[styles.barStripCard, styles.barStripInlineCard]}>
            <Text style={[typo.body, styles.barStripText, cjkTextStyle]}>{body}</Text>
            {contrastBody ? <Text style={[contrastTypo, styles.barStripText, cjkTextStyle]}>{contrastBody}</Text> : null}
            <Text style={[typo.ref, styles.barStripText, cjkTextStyle]}>{effectiveEntry.ref}</Text>
          </View>
        ) : (
          <>
            <Text style={[typo.body, cjkTextStyle]}>{body}</Text>
            {contrastBody ? <Text style={[contrastTypo, cjkTextStyle]}>{contrastBody}</Text> : null}
            <Text style={[typo.ref, cjkTextStyle]}>{effectiveEntry.ref}</Text>
          </>
        )}
      </Animated.View>
    );

  return (
    <View
      style={wrapStyle}
      pointerEvents={isLandscapeLayout || isPortraitHome ? "box-none" : "auto"}
      accessibilityRole="text"
    >
      {linkToRead ? (
        <Pressable
          onPress={openReadChapter}
          style={({ pressed }) => [styles.tapTarget, pressed && styles.tapTargetPressed]}
          accessibilityRole="button"
          accessibilityLabel={effectiveEntry.ref}
          accessibilityHint={t("pages.home.openVerseInBible")}
        >
          {content}
        </Pressable>
      ) : (
        <View pointerEvents="none">{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapHomeStage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
  },
  goldenSlot: {
    position: "absolute",
    alignItems: "center",
    overflow: "hidden",
  },
  goldenSlotText: {
    width: "100%",
    maxWidth: 560,
    textAlign: "center",
  },
  barStripCard: {
    maxWidth: "88%",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.30)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    overflow: "hidden",
  },
  barStripText: {
    textAlign: "center",
    maxWidth: 560,
  },
  barStripInlineCard: {
    alignSelf: "center",
  },
  cjkText: {
    letterSpacing: 0,
    lineBreakStrategyIOS: "standard",
    textBreakStrategy: "highQuality",
  },
  wrapInline: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  tapTarget: {
    alignItems: "center",
    maxWidth: "100%",
  },
  tapTargetPressed: {
    opacity: 0.88,
  },
});
