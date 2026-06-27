import { useEffect, useState, useSyncExternalStore } from "react";
import {
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppLocale } from "../i18n/config";
import { SHELL_TAB_BAR_CLEARANCE } from "../shell/shellLayout";
import {
  readNatureHomeTextScaleIndex,
  readNatureHomeVerseAppearance,
  platformDefaultTextScaleIndex,
  textScaleAtIndex,
  type NatureHomeVerseAppearance,
} from "./natureHomePrefs";
import { useLocale } from "../i18n/LocaleProvider";
import { toZhTwText } from "../i18n/site-copy";
import { flowLocaleForHomeVerseTranslationId } from "./homePrayerVersePrefs";
import { joinVerseLinesForFlow } from "./joinVerseLinesForFlow";
import { useHomeThemeRepeatVerse } from "./useHomeThemeRepeatVerse";
import { verseTypography } from "./verseTextStyle";
import {
  getHomeVersePoolScope,
  subscribeHomeVersePoolScope,
} from "./homeVersePoolScopePrefs";
import { referenceForSpeechByVerseKey, resolveSpeechLocale } from "./homeVerseOverlayHelpers";
import { HOME_NATURE_BOTTOM_CHROME_H } from "./homeNatureScreenConstants";
import { useHomeVerseOverlayFade } from "./useHomeVerseOverlayFade";

type Props = {
  prefsVersion?: number;
  variant?: "onVideo" | "onLight";
  layout?: "home" | "homeLandscape" | "inline";
  pauseRotation?: boolean;
  onVerseBodyPress?: () => void;
  onDisplayedVerseChange?: (payload: {
    verseKey: string | null;
    primaryTranslationId: string;
    speechMain: string;
    speechReference: string;
    speechLocale: AppLocale;
  }) => void;
  onAdvanceControllerReady?: (advanceNow: () => Promise<void>) => void;
};

const HORIZONTAL_PAD = 24;
/** 横屏：经文左右留白加大 */
const HOME_VERSE_LANDSCAPE_HORIZONTAL_PAD = 120;
/** 横屏顶栏有时钟，经文起始略下移避免重叠 */
const HOME_VERSE_LANDSCAPE_TOP_PAD = 46;
/** 横屏经文：在用户字级上再放大一档 */
const HOME_VERSE_LANDSCAPE_TEXT_SCALE = 1.38;

/** 自然首页经文：仅正文可点进阅读；出处与空白区域穿透到下层音乐点击层。 */
export function HomeVerseOverlay({
  prefsVersion = 0,
  variant = "onVideo",
  layout = "home",
  pauseRotation = false,
  onVerseBodyPress,
  onDisplayedVerseChange,
  onAdvanceControllerReady,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { locale } = useLocale();
  const [verseBlockHeight, setVerseBlockHeight] = useState(0);
  const homeVersePoolScope = useSyncExternalStore(
    subscribeHomeVersePoolScope,
    getHomeVersePoolScope,
    getHomeVersePoolScope,
  );
  const { ready, entry, contrastEntry, verseKey, primaryTranslationId, contrastTranslationId, advanceNow } =
    useHomeThemeRepeatVerse(locale, undefined, prefsVersion, pauseRotation, homeVersePoolScope);

  const [appearance, setAppearance] = useState<NatureHomeVerseAppearance | null>(null);
  const [scaleIndex, setScaleIndex] = useState(platformDefaultTextScaleIndex);

  const {
    displayVerse,
    effectiveEntry,
    effectiveVerseKey,
    effectivePrimaryTranslationId,
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

  if (!ready || !effectiveEntry || !appearance || !displayVerse.entry) return null;

  const isLandscape = layout === "homeLandscape";
  const scale = textScaleAtIndex(scaleIndex) * (isLandscape ? HOME_VERSE_LANDSCAPE_TEXT_SCALE : 1);
  const primaryFlowLocale = flowLocaleForHomeVerseTranslationId(displayVerse.primaryTranslationId);
  const rawBody = joinVerseLinesForFlow(displayVerse.entry.lines, primaryFlowLocale);
  const shouldUseTwForPrimary = locale === "zh-TW" && primaryFlowLocale !== "en";
  const body = shouldUseTwForPrimary ? toZhTwText(rawBody) : rawBody;
  const displayRef = shouldUseTwForPrimary ? toZhTwText(displayVerse.entry.ref) : displayVerse.entry.ref;
  const contrastFlowLocale = flowLocaleForHomeVerseTranslationId(displayVerse.contrastTranslationId);
  const contrastBodyRaw = displayVerse.contrastEntry
    ? joinVerseLinesForFlow(displayVerse.contrastEntry.lines, contrastFlowLocale)
    : "";
  const shouldUseTwForContrast = locale === "zh-TW" && contrastFlowLocale !== "en";
  const contrastBody = shouldUseTwForContrast ? toZhTwText(contrastBodyRaw) : contrastBodyRaw;
  const typo = verseTypography(appearance, scale, variant);
  const isInline = layout === "inline";
  const bottomReserve = isLandscape
    ? insets.bottom + HOME_NATURE_BOTTOM_CHROME_H
    : insets.bottom + SHELL_TAB_BAR_CLEARANCE + HOME_NATURE_BOTTOM_CHROME_H;
  const horizontalPad = isLandscape
    ? Math.max(HOME_VERSE_LANDSCAPE_HORIZONTAL_PAD, insets.left, insets.right)
    : Math.max(HORIZONTAL_PAD, insets.left, insets.right);
  const stageTop = isLandscape ? insets.top + HOME_VERSE_LANDSCAPE_TOP_PAD : insets.top;

  const openVerse = layout === "inline" ? undefined : onVerseBodyPress;

  const verseBody = (
    <View pointerEvents="box-none">
      <Pressable
        onPress={openVerse}
        disabled={!openVerse}
        style={({ pressed }) => [styles.versePressTarget, pressed && openVerse ? styles.versePressed : null]}
        accessibilityRole={openVerse ? "button" : undefined}
      >
        <Text pointerEvents="none" style={[typo.body, styles.line]} maxFontSizeMultiplier={1.15}>
          {body}
        </Text>
      </Pressable>
      {contrastBody ? (
        <Pressable
          onPress={openVerse}
          disabled={!openVerse}
          style={({ pressed }) => [styles.versePressTarget, pressed && openVerse ? styles.versePressed : null]}
          accessibilityRole={openVerse ? "button" : undefined}
        >
          <Text
            pointerEvents="none"
            style={[typo.body, styles.line, styles.contrastLine]}
            maxFontSizeMultiplier={1.15}
          >
            {contrastBody}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const content =
    appearance.textEffect === "barStrip" && variant === "onVideo" ? (
      <View style={styles.barStrip} pointerEvents="box-none">
        {verseBody}
      </View>
    ) : (
      verseBody
    );

  if (isInline) {
    return (
      <View style={[styles.inlineWrap, { paddingHorizontal: horizontalPad }]} pointerEvents="none">
        {content}
        <Text pointerEvents="none" style={[typo.ref, styles.line]} maxFontSizeMultiplier={1.15}>
          {displayRef}
        </Text>
      </View>
    );
  }

  const contentAreaHeight = Math.max(0, winH - stageTop - bottomReserve);
  const verseTop = isLandscape
    ? stageTop
    : stageTop + Math.max(0, (contentAreaHeight - verseBlockHeight) / 2);

  return (
    <View
      style={[
        styles.stage,
        {
          top: verseTop,
          paddingHorizontal: horizontalPad,
        },
      ]}
      pointerEvents="box-none"
      accessibilityRole="text"
    >
      <View
        style={styles.verseBlock}
        pointerEvents="box-none"
        onLayout={(event) => {
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          if (nextHeight !== verseBlockHeight) setVerseBlockHeight(nextHeight);
        }}
      >
        {content}
        <Text pointerEvents="none" style={[typo.ref, styles.line]} maxFontSizeMultiplier={1.15}>
          {displayRef}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 7,
    alignItems: "center",
  },
  verseBlock: {
    alignSelf: "center",
  },
  line: {
    textAlign: "center",
  },
  versePressTarget: {
    alignSelf: "center",
    maxWidth: "100%",
  },
  versePressed: {
    opacity: 0.88,
  },
  contrastLine: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.82)",
    marginTop: 6,
  },
  barStrip: {
    alignSelf: "center",
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.30)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineWrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 12,
  },
});
