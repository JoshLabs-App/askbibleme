import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Animated, InteractionManager, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseVerseKey } from "../bible/parse-verse-key";
import type { AppLocale } from "../i18n/config";
import {
  readNatureHomeTextScaleIndex,
  readNatureHomeVerseAppearance,
  textScaleAtIndex,
  type NatureHomeVerseAppearance,
} from "./natureHomePrefs";
import { useLocale } from "../i18n/LocaleProvider";
import { t, toZhTwText } from "../i18n/site-copy";
import { flowLocaleForHomeVerseTranslationId } from "./homePrayerVersePrefs";
import { joinVerseLinesForFlow } from "./joinVerseLinesForFlow";
import { useHomeThemeRepeatVerse } from "./useHomeThemeRepeatVerse";
import { verseTypography } from "./verseTextStyle";
import {
  getHomeVersePoolScope,
  subscribeHomeVersePoolScope,
} from "./homeVersePoolScopePrefs";
import {
  GOLDEN_UPPER,
  HOME_VERSE_UP_SHIFT,
  hasCjkChars,
  homeVerseMaxHeightPx,
  referenceForSpeechByVerseKey,
  resolveSpeechLocale,
} from "./homeVerseOverlayHelpers";
import { homeVerseOverlayStyles as styles } from "./homeVerseOverlayStyles";
import { useHomeVerseOverlayFade } from "./useHomeVerseOverlayFade";

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

  const [appearance, setAppearance] = useState<NatureHomeVerseAppearance | null>(null);
  const [scaleIndex, setScaleIndex] = useState(12);
  const [blockH, setBlockH] = useState(40);

  const {
    fadeAnim,
    effectiveEntry,
    effectiveContrastEntry,
    effectiveVerseKey,
    effectivePrimaryTranslationId,
    effectiveContrastTranslationId,
  } = useHomeVerseOverlayFade({
    ready,
    entry,
    contrastEntry,
    verseKey,
    primaryTranslationId,
    contrastTranslationId,
  });

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const [nextAppearance, nextScaleIndex] = await Promise.all([
          readNatureHomeVerseAppearance(),
          readNatureHomeTextScaleIndex(),
        ]);
        if (cancelled) return;
        setAppearance(nextAppearance);
        setScaleIndex(nextScaleIndex);
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [prefsVersion]);

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

  const primaryFlowLocale = flowLocaleForHomeVerseTranslationId(effectivePrimaryTranslationId);
  const rawBody = joinVerseLinesForFlow(effectiveEntry.lines, primaryFlowLocale);
  const shouldUseTwForPrimary = locale === "zh-TW" && primaryFlowLocale !== "en";
  const body = shouldUseTwForPrimary ? toZhTwText(rawBody) : rawBody;
  const displayRef = shouldUseTwForPrimary ? toZhTwText(effectiveEntry.ref) : effectiveEntry.ref;
  const contrastFlowLocale = flowLocaleForHomeVerseTranslationId(effectiveContrastTranslationId);
  const contrastBodyRaw = effectiveContrastEntry
    ? joinVerseLinesForFlow(
        effectiveContrastEntry.lines,
        contrastFlowLocale,
      )
    : "";
  const shouldUseTwForContrast = locale === "zh-TW" && contrastFlowLocale !== "en";
  const contrastBody = shouldUseTwForContrast ? toZhTwText(contrastBodyRaw) : contrastBodyRaw;
  const scale = textScaleAtIndex(scaleIndex);
  const typo = verseTypography(appearance, scale, variant);
  const shouldUseCjkWrap =
    hasCjkChars(body) || hasCjkChars(contrastBody) || hasCjkChars(displayRef);
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
          <Text style={[typo.ref, styles.barStripText, cjkTextStyle]}>{displayRef}</Text>
        </View>
      ) : (
        <>
          <Text style={[typo.body, styles.goldenSlotText, cjkTextStyle]}>{body}</Text>
          {contrastBody ? (
            <Text style={[contrastTypo, styles.goldenSlotText, cjkTextStyle]}>{contrastBody}</Text>
          ) : null}
          <Text style={[typo.ref, styles.goldenSlotText, cjkTextStyle]}>{displayRef}</Text>
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
            <Text style={[typo.ref, styles.barStripText, cjkTextStyle]}>{displayRef}</Text>
          </View>
        ) : (
          <>
            <Text style={[typo.body, cjkTextStyle]}>{body}</Text>
            {contrastBody ? <Text style={[contrastTypo, cjkTextStyle]}>{contrastBody}</Text> : null}
            <Text style={[typo.ref, cjkTextStyle]}>{displayRef}</Text>
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
          accessibilityLabel={displayRef}
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
