import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Animated,
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
import { homeNatureBottomChromeHeight } from "./homeNatureScreenConstants";
import { useHomeVerseOverlayFade } from "./useHomeVerseOverlayFade";

type Props = {
  prefsVersion?: number;
  variant?: "onVideo" | "onLight";
  layout?: "home" | "homeLandscape" | "inline";
  /** 沉浸点空白层 zIndex 更高时，抬升经文以便正文仍可点进阅读。 */
  elevateAboveImmersiveTap?: boolean;
  /** 桌面挂件点喇叭时强制显示并锁定该经文。 */
  forceVerseKey?: string | null;
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
  onVerseQueueControllerReady?: (ctrl: {
    peekNextVerseKey: () => string | null;
    peekNextTwoVerseKeys: () => [string | null, string | null];
    peekNextVerseKeys: (count: number) => string[];
    pinNextVerseKey: (key: string | null) => void;
  }) => void;
};

const HORIZONTAL_PAD = 24;
/** 横屏：经文左右留白加大 */
const HOME_VERSE_LANDSCAPE_HORIZONTAL_PAD = 120;
/** 横屏顶栏有时钟，经文起始略下移避免重叠 */
const HOME_VERSE_LANDSCAPE_TOP_PAD = 46;
/** 横屏经文：在用户字级上再放大一档 */
const HOME_VERSE_LANDSCAPE_TEXT_SCALE = 1.38;
/** 固定行数：超出截断，不按经文长短改字号 */
const HOME_VERSE_FIT_LINES = 6;
const HOME_VERSE_FIT_LINES_LANDSCAPE = 4;
/** 经文框底与底部图标之间的呼吸 */
const HOME_VERSE_BOTTOM_GAP = 16;
/** 横屏只在底栏隐藏时显示经文，底部无需为图标让位 */
const HOME_VERSE_LANDSCAPE_BOTTOM_PAD = 24;
/** 异常视口下的经文框最小高度 */
const HOME_VERSE_MIN_BOX_H = 120;
/** 竖屏经文顶对齐偏移（相对安全区顶），换句不随块高上下漂 */
const HOME_VERSE_PORTRAIT_TOP_PAD = 96;
/** 高于 autoImmersiveBackdrop(30)，低于顶/底控件(50) */
const HOME_VERSE_ELEVATED_Z = 32;

/** 自然首页经文：仅正文可点进阅读；出处与空白区域穿透到下层音乐点击层。 */
export function HomeVerseOverlay({
  prefsVersion = 0,
  variant = "onVideo",
  layout = "home",
  elevateAboveImmersiveTap = false,
  forceVerseKey = null,
  pauseRotation = false,
  onVerseBodyPress,
  onDisplayedVerseChange,
  onAdvanceControllerReady,
  onVerseQueueControllerReady,
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
  const {
    ready,
    entry,
    contrastEntry,
    verseKey,
    primaryTranslationId,
    contrastTranslationId,
    advanceNow,
    peekNextVerseKey,
    peekNextTwoVerseKeys,
    peekNextVerseKeys,
    pinNextVerseKey,
  } =
    useHomeThemeRepeatVerse(
      locale,
      undefined,
      prefsVersion,
      pauseRotation,
      homeVersePoolScope,
      forceVerseKey,
    );

  const [appearance, setAppearance] = useState<NatureHomeVerseAppearance | null>(null);
  const [scaleIndex, setScaleIndex] = useState(platformDefaultTextScaleIndex);

  const {
    fadeAnim,
    displayVerse,
    notifyVerseBlockLaidOut,
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

  /** 淡入开始后冻结量高，避免 Android 缩字二次 layout 把居中顶一下。 */
  const [heightFreezeKey, setHeightFreezeKey] = useState<string | null>(null);
  useEffect(() => {
    setHeightFreezeKey(null);
    // 换句先清高度，等新 onLayout 再淡入，避免用上一句高度居中后跳一下。
    setVerseBlockHeight(0);
  }, [displayVerse.verseKey]);

  /**
   * 只在 verseBlockHeight 从 onLayout 量到 >0 时开淡入。
   * 不可依赖 verseKey/entry：换句当帧旧高度仍 >0，会提前 notify 并误冻 heightFreezeKey，
   * 挡住新句 onLayout，淡入在缩字完成前就开始（观感像「啪」一下）。
   */
  useEffect(() => {
    if (!displayVerse.entry) return;
    if (verseBlockHeight <= 0) return;
    notifyVerseBlockLaidOut();
    const key = (displayVerse.verseKey ?? "").trim() || "__";
    setHeightFreezeKey(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- height gate only
  }, [verseBlockHeight, notifyVerseBlockLaidOut]);

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

  useEffect(() => {
    onVerseQueueControllerReady?.({
      peekNextVerseKey,
      peekNextTwoVerseKeys,
      peekNextVerseKeys,
      pinNextVerseKey,
    });
  }, [
    onVerseQueueControllerReady,
    peekNextTwoVerseKeys,
    peekNextVerseKey,
    peekNextVerseKeys,
    pinNextVerseKey,
  ]);

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
  const isInline = layout === "inline";
  const horizontalPad = isLandscape
    ? Math.max(HOME_VERSE_LANDSCAPE_HORIZONTAL_PAD, insets.left, insets.right)
    : Math.max(HORIZONTAL_PAD, insets.left, insets.right);
  const stageTop = isLandscape ? insets.top + HOME_VERSE_LANDSCAPE_TOP_PAD : insets.top;
  /** 竖屏固定顶对齐，避免换句随块高上下漂。 */
  const verseTop = isLandscape ? stageTop : stageTop + HOME_VERSE_PORTRAIT_TOP_PAD;

  const verseMaxLines = isLandscape ? HOME_VERSE_FIT_LINES_LANDSCAPE : HOME_VERSE_FIT_LINES;
  const bottomReserve = isLandscape
    ? insets.bottom + HOME_VERSE_LANDSCAPE_BOTTOM_PAD
    : insets.bottom + SHELL_TAB_BAR_CLEARANCE + homeNatureBottomChromeHeight(false, false);
  const verseBoxHeight = Math.max(
    HOME_VERSE_MIN_BOX_H,
    winH - verseTop - bottomReserve - HOME_VERSE_BOTTOM_GAP,
  );
  const typo = verseTypography(appearance, scale, variant);

  /** 横屏点经文只作空白切换，不进入圣经页。 */
  const openVerse =
    layout === "inline" || layout === "homeLandscape" ? undefined : onVerseBodyPress;

  const verseBody = (
    <View pointerEvents="box-none">
      {openVerse ? (
        <Pressable
          onPress={openVerse}
          style={styles.versePressTarget}
          accessibilityRole="button"
        >
          <Text
            pointerEvents="none"
            style={[typo.body, styles.line]}
            allowFontScaling={false}
            numberOfLines={verseMaxLines}
            ellipsizeMode="tail"
          >
            {body}
          </Text>
        </Pressable>
      ) : (
        <Text
          pointerEvents="none"
          style={[typo.body, styles.line]}
          allowFontScaling={false}
          numberOfLines={verseMaxLines}
          ellipsizeMode="tail"
        >
          {body}
        </Text>
      )}
      {contrastBody ? (
        openVerse ? (
          <Pressable
            onPress={openVerse}
            style={styles.versePressTarget}
            accessibilityRole="button"
          >
            <Text
              pointerEvents="none"
              style={[typo.body, styles.line, styles.contrastLine]}
              allowFontScaling={false}
              numberOfLines={verseMaxLines}
              ellipsizeMode="tail"
            >
              {contrastBody}
            </Text>
          </Pressable>
        ) : (
          <Text
            pointerEvents="none"
            style={[typo.body, styles.line, styles.contrastLine]}
            allowFontScaling={false}
            numberOfLines={verseMaxLines}
            ellipsizeMode="tail"
          >
            {contrastBody}
          </Text>
        )
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
      <Animated.View
        style={[styles.inlineWrap, { paddingHorizontal: horizontalPad, opacity: fadeAnim }]}
        pointerEvents="none"
        collapsable={false}
        onLayout={() => notifyVerseBlockLaidOut()}
      >
        {content}
        <Text pointerEvents="none" style={[typo.ref, styles.line]} allowFontScaling={false}>
          {displayRef}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View
      style={[
        styles.stage,
        {
          top: verseTop,
          paddingHorizontal: horizontalPad,
          zIndex: elevateAboveImmersiveTap ? HOME_VERSE_ELEVATED_Z : styles.stage.zIndex,
        },
      ]}
      pointerEvents="box-none"
      accessibilityRole="text"
    >
      <Animated.View
        style={[styles.verseBlock, { maxHeight: verseBoxHeight, opacity: fadeAnim }]}
        pointerEvents="box-none"
        collapsable={false}
        onLayout={(event) => {
          const key = (displayVerse.verseKey ?? "").trim() || "__";
          if (heightFreezeKey === key) return;
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          if (nextHeight !== verseBlockHeight) {
            setVerseBlockHeight(nextHeight);
          } else {
            notifyVerseBlockLaidOut();
            setHeightFreezeKey(key);
          }
        }}
      >
        {content}
        <Text pointerEvents="none" style={[typo.ref, styles.line]} allowFontScaling={false}>
          {displayRef}
        </Text>
      </Animated.View>
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
    overflow: "hidden",
  },
  line: {
    textAlign: "center",
  },
  versePressTarget: {
    alignSelf: "center",
    maxWidth: "100%",
    width: "100%",
  },
  contrastLine: {
    color: "#FFFFFF",
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
