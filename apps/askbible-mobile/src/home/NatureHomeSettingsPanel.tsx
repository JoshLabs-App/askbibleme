import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Speech from "expo-speech";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Slider from "@react-native-community/slider";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { parchmentSans } from "../fonts/parchmentType";
import { getLocale } from "../i18n/locale-store";
import { HomeSleepTimerSection } from "./HomeSleepTimerSection";
import { NatureHomeLevelSegment } from "./NatureHomeLevelSegment";
import { NatureHomeTranslationSettings } from "./NatureHomeTranslationSettings";
import { NatureHomeVerseEffectPicker } from "./NatureHomeVerseEffectPicker";
import {
  DEFAULT_BLUR_LEVEL,
  DEFAULT_DIM_LEVEL,
  DEFAULT_TEXT_SCALE_INDEX,
  DEFAULT_VERSE_APPEARANCE,
  mergeNatureVisualPrefs,
  NATURE_HOME_TEXT_SCALE_STEPS,
  readNatureHomeTextScaleIndex,
  readNatureHomeVerseAppearance,
  SUPER_LARGE_TEXT_SCALE_INDEX,
  readNatureSoftFocusBlurLevel,
  readNatureSoftFocusDimLevel,
  readNatureHomeTtsPrefs,
  textScaleAtIndex,
  writeNatureHomeTextScaleIndex,
  writeNatureHomeTtsPrefs,
  writeNatureHomeVerseAppearance,
  writeNatureSoftFocusBlurLevel,
  writeNatureSoftFocusDimLevel,
  type NatureHomeTtsLevel,
  type NatureHomeVerseAppearance,
  type NatureVisualLevel,
} from "./natureHomePrefs";
import {
  BLUR_LEVEL_COPY_KEYS,
  DIM_LEVEL_COPY_KEYS,
  tNatureHomeSettings,
  type NatureHomeSettingsCopyKey,
} from "./natureHomeSettingsCopy";
import { NatureHomeSettingsMenuBackdrop } from "./NatureHomeSoftFocusLayer";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

const DIM_LEVEL_ICONS: Record<NatureVisualLevel, MaterialIconName> = {
  0: "brightness-low",
  1: "brightness-5",
  2: "tonality",
  3: "brightness-high",
};

const BLUR_LEVEL_ICONS: Record<NatureVisualLevel, MaterialIconName> = {
  0: "blur-off",
  1: "blur-circular",
  2: "blur-linear",
  3: "blur-on",
};

/** Modal 默认可竖屏；横屏沉浸时用 `overlay` 避免 iOS 把界面扭回竖屏 */
export type NatureHomeSettingsPresentation = "modal" | "overlay";

const MODAL_SUPPORTED_ORIENTATIONS = [
  "portrait",
  "portrait-upside-down",
  "landscape",
  "landscape-left",
  "landscape-right",
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  onPrefsChanged: () => void;
  presentation?: NatureHomeSettingsPresentation;
  /** 当前场景海报：Android 背板磨砂模糊用 */
  posterUri?: string;
  /** 试验开关：关闭时隐藏 TTS 相关设置 */
  showTtsControls?: boolean;
};

const ICON_MUTED = "rgba(255,255,255,0.5)";
const TTS_LEVELS: readonly NatureHomeTtsLevel[] = [0, 1, 2, 3, 4];
type DeviceVoice = { identifier: string; name: string; language: string };

function ttsPrefsEqual(
  a: { rateLevel: NatureHomeTtsLevel; pitchLevel: NatureHomeTtsLevel; voiceId: string },
  b: { rateLevel: NatureHomeTtsLevel; pitchLevel: NatureHomeTtsLevel; voiceId: string },
): boolean {
  return a.rateLevel === b.rateLevel && a.pitchLevel === b.pitchLevel && a.voiceId === b.voiceId;
}

function compactVoiceName(voice: DeviceVoice): string {
  const raw = (voice.name?.trim() || voice.identifier || "").trim();
  if (!raw) return "Voice";
  const normalized = raw.replace(/\s+/g, " ");
  const isZh = (voice.language || "").toLowerCase().startsWith("zh");
  if (isZh) return normalized.length > 6 ? normalized.slice(0, 6) : normalized;
  const firstWord = normalized.split(" ")[0]?.trim() || normalized;
  return firstWord.length > 10 ? firstWord.slice(0, 10) : firstWord;
}

function inferVoiceGender(voice: DeviceVoice): "female" | "male" | "unknown" {
  const text = `${voice.name || ""} ${voice.identifier || ""}`.toLowerCase();
  if (
    /\bfemale\b|\bwoman\b|girl|tingting|meijia|samantha|victoria|karen|siri_female|xiaoyi/.test(
      text,
    )
  ) {
    return "female";
  }
  if (
    /\bmale\b|\bman\b|boy|alex|daniel|tom|fred|siri_male|yunxi|yunjian|tian-tian/.test(text)
  ) {
    return "male";
  }
  return "unknown";
}

function genderGlyph(g: "female" | "male" | "unknown"): string {
  if (g === "female") return "♀";
  if (g === "male") return "♂";
  return "◦";
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  backdrop: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  sheet: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 7,
  },
  translationSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    width: "100%",
    paddingTop: 0,
  },
  translationIcon: {
    width: 22,
    paddingTop: 6,
    alignItems: "center",
  },
  translationBody: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowAlignTop: {
    alignItems: "flex-start",
  },
  rowIcon: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#27272a",
    borderRadius: 7,
    padding: 2,
  },
  segBtn: {
    flex: 1,
    minHeight: 30,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: "#3f3f46" },
  scaleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  scaleBtn: {
    flex: 1,
    minHeight: 30,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3f3f46",
  },
  scaleBtnDisabled: { opacity: 0.35 },
  scaleBtnDefaultOn: {
    backgroundColor: "#52525b",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#71717a",
  },
  scaleSuperText: {
    fontSize: 18,
    ...parchmentSans(700),
    color: "#f1f5f9",
    letterSpacing: 0.1,
  },
  scaleDefaultText: {
    fontSize: 15,
    lineHeight: 17,
    ...parchmentSans(600),
    color: "#f1f5f9",
    letterSpacing: 0.05,
  },
  scaleOpText: {
    fontSize: 20,
    lineHeight: 20,
    ...parchmentSans(600),
    color: "#f1f5f9",
  },
  voiceScroll: {
    width: "100%",
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 6,
  },
  voiceChip: {
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    backgroundColor: "#27272a",
    paddingHorizontal: 9,
    minHeight: 30,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceChipOn: {
    backgroundColor: "#3f3f46",
    borderColor: "#71717a",
  },
  voiceAddChip: {
    minWidth: 32,
    width: 32,
    paddingHorizontal: 0,
  },
  voiceChipText: {
    fontSize: 12,
    lineHeight: 15,
    ...parchmentSans(500),
    color: "rgba(255,255,255,0.62)",
  },
  voiceChipTextOn: {
    ...parchmentSans(600),
    color: "#fff",
  },
  voiceChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voiceGenderText: {
    fontSize: 12,
    lineHeight: 14,
    ...parchmentSans(700),
    color: "rgba(255,255,255,0.55)",
  },
  voiceGenderTextOn: {
    color: "#fff",
  },
  voiceHint: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.52)",
    ...parchmentSans(500),
  },
  ttsSliderWrap: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    width: "100%",
  },
  ttsSliderCell: {
    flex: 1,
    minWidth: 0,
  },
  ttsSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "auto",
  },
  ttsSliderIcon: {
    width: 18,
    alignItems: "center",
  },
  ttsSlider: {
    flex: 1,
    height: 30,
  },
});

function IconSettingRow({
  icon,
  accessibilityLabel,
  children,
  alignTop,
}: {
  icon: MaterialIconName;
  accessibilityLabel: string;
  children: ReactNode;
  alignTop?: boolean;
}) {
  return (
    <View
      style={[styles.row, alignTop && styles.rowAlignTop]}
      accessibilityLabel={accessibilityLabel}
      accessible
    >
      <View style={styles.rowIcon} importantForAccessibility="no-hide-descendants">
        <MaterialIcons name={icon} size={18} color={ICON_MUTED} />
      </View>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

const segmentProps = {
  segmentStyle: styles.segment,
  segBtnStyle: styles.segBtn,
  segBtnOnStyle: styles.segBtnOn,
} as const;

export function NatureHomeSettingsPanel({
  visible,
  onClose,
  onPrefsChanged,
  presentation = "modal",
  posterUri,
  showTtsControls = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  /** 横屏约占屏宽 72%（与用户标注的蓝框一致）；竖屏略窄仍留边 */
  const sheetWidth = useMemo(() => {
    const edge = Math.max(insets.right, 12) + 8;
    const ratio = isLandscape ? 0.72 : 0.86;
    return Math.max(280, Math.round(winW * ratio - edge));
  }, [winW, isLandscape, insets.right]);
  useShellSwipeSuspend(visible);
  const [scaleIndex, setScaleIndex] = useState(DEFAULT_TEXT_SCALE_INDEX);
  const [verseAppearance, setVerseAppearance] = useState<NatureHomeVerseAppearance>(
    DEFAULT_VERSE_APPEARANCE,
  );
  const [dimLevel, setDimLevel] = useState<NatureVisualLevel>(DEFAULT_DIM_LEVEL);
  const [blurLevel, setBlurLevel] = useState<NatureVisualLevel>(DEFAULT_BLUR_LEVEL);
  const [ttsRateLevel, setTtsRateLevel] = useState<NatureHomeTtsLevel>(2);
  const [ttsPitchLevel, setTtsPitchLevel] = useState<NatureHomeTtsLevel>(2);
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoice[]>([]);
  const lastSavedTtsRef = useRef<{
    rateLevel: NatureHomeTtsLevel;
    pitchLevel: NatureHomeTtsLevel;
    voiceId: string;
  } | null>(null);
  const ttsHydratedRef = useRef(false);

  const load = useCallback(async () => {
    const [scale, appearance, dim, blur] = await Promise.all([
      readNatureHomeTextScaleIndex(),
      readNatureHomeVerseAppearance(),
      readNatureSoftFocusDimLevel(),
      readNatureSoftFocusBlurLevel(),
    ]);
    setScaleIndex(scale);
    setVerseAppearance(appearance);
    setDimLevel(dim);
    setBlurLevel(blur);
    if (showTtsControls) {
      const tts = await readNatureHomeTtsPrefs();
      setTtsRateLevel(tts.rateLevel);
      setTtsPitchLevel(tts.pitchLevel);
      setTtsVoiceId(tts.voiceId);
      lastSavedTtsRef.current = {
        rateLevel: tts.rateLevel,
        pitchLevel: tts.pitchLevel,
        voiceId: tts.voiceId,
      };
      ttsHydratedRef.current = true;
    } else {
      ttsHydratedRef.current = false;
      setDeviceVoices([]);
    }
    return { dim, blur };
  }, [showTtsControls]);

  const loadDeviceVoices = useCallback(async () => {
    if (!showTtsControls) {
      setDeviceVoices([]);
      return;
    }
    try {
      const locale = getLocale();
      const voicesRaw = (await Speech.getAvailableVoicesAsync()) as DeviceVoice[];
      const langPrefix = locale === "en" ? "en" : "zh";
      const valid = voicesRaw.filter((v) => typeof v.identifier === "string" && v.identifier.trim().length > 0);
      const preferred = valid.filter((v) => (v.language || "").toLowerCase().startsWith(langPrefix));
      // 按当前界面语言过滤；若该语言无可用声线，回退到全部，避免空列表。
      setDeviceVoices(preferred.length > 0 ? preferred : valid);
    } catch {
      setDeviceVoices([]);
    }
  }, [showTtsControls]);

  const openSystemVoiceSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  useEffect(() => {
    if (!visible) return;
    ttsHydratedRef.current = false;
    void load().then(() => {
      onPrefsChanged();
    });
    void loadDeviceVoices();
  }, [visible, load, loadDeviceVoices, onPrefsChanged]);

  useEffect(() => {
    if (!visible) return;
    if (!showTtsControls) return;
    if (!ttsHydratedRef.current) return;
    const next = {
      rateLevel: ttsRateLevel,
      pitchLevel: ttsPitchLevel,
      voiceId: ttsVoiceId,
    };
    if (lastSavedTtsRef.current && ttsPrefsEqual(lastSavedTtsRef.current, next)) return;
    const timer = setTimeout(() => {
      void writeNatureHomeTtsPrefs(next).then(() => {
        lastSavedTtsRef.current = next;
        onPrefsChanged();
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [visible, showTtsControls, ttsRateLevel, ttsPitchLevel, ttsVoiceId, onPrefsChanged]);

  const atMin = scaleIndex <= 0;
  const atMax = scaleIndex >= NATURE_HOME_TEXT_SCALE_STEPS.length - 1;
  const atDefault = scaleIndex === DEFAULT_TEXT_SCALE_INDEX;
  const superLargeIndex = Math.min(
    NATURE_HOME_TEXT_SCALE_STEPS.length - 1,
    SUPER_LARGE_TEXT_SCALE_INDEX,
  );
  const atSuperLarge = scaleIndex >= superLargeIndex;
  const scaleA11y = `${tNatureHomeSettings("verseSizeSection")} ${Math.round(textScaleAtIndex(scaleIndex) * 100)}%`;

  const labelForDim = (level: NatureVisualLevel) =>
    tNatureHomeSettings(DIM_LEVEL_COPY_KEYS[level] as NatureHomeSettingsCopyKey);

  const labelForBlur = (level: NatureVisualLevel) =>
    tNatureHomeSettings(BLUR_LEVEL_COPY_KEYS[level] as NatureHomeSettingsCopyKey);

  const labelForTtsRate = (level: NatureHomeTtsLevel) =>
    level <= 1
      ? tNatureHomeSettings("ttsLevelSlow")
      : level >= 3
        ? tNatureHomeSettings("ttsLevelFast")
        : tNatureHomeSettings("ttsLevelNormal");

  const labelForTtsPitch = (level: NatureHomeTtsLevel) =>
    level <= 1
      ? tNatureHomeSettings("ttsLevelLow")
      : level >= 3
        ? tNatureHomeSettings("ttsLevelHigh")
        : tNatureHomeSettings("ttsLevelNormal");

  if (!visible) return null;

  const menuVisual = mergeNatureVisualPrefs(dimLevel, blurLevel);
  const menuBackdropBlurPx = menuVisual.blurPx;
  // Android 下设置面板背板也跟随“压暗档位”，确保「模糊 + 黑层」同时可见。
  const menuBackdropAlpha =
    Platform.OS === "android"
      ? Math.max(0.12, Math.min(0.62, menuVisual.overlayOpacity * 0.92))
      : Math.max(0.22, Math.min(0.68, menuVisual.overlayOpacity * 0.95 + 0.2));
  const menuBackdropDimmed = `rgba(0,0,0,${menuBackdropAlpha})`;

  const sheet = (
    <ShellSwipeExclude style={[styles.backdrop, { backgroundColor: menuBackdropDimmed }]}>
        <NatureHomeSettingsMenuBackdrop blurPx={menuBackdropBlurPx} posterUri={posterUri} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tNatureHomeSettings("closeAria")}
        />
        <View
          style={[
            styles.sheet,
            { width: sheetWidth, marginTop: insets.top + 8, marginRight: Math.max(insets.right, 12) },
          ]}
          onStartShouldSetResponder={() => true}
          accessibilityViewIsModal
        >
          <IconSettingRow icon="tonality" accessibilityLabel={tNatureHomeSettings("dimSection")}>
            <NatureHomeLevelSegment
              selected={dimLevel}
              onSelect={(level) => {
                setDimLevel(level);
                void writeNatureSoftFocusDimLevel(level).then(onPrefsChanged);
              }}
              labelForLevel={labelForDim}
              iconForLevel={(level) => DIM_LEVEL_ICONS[level]}
              {...segmentProps}
            />
          </IconSettingRow>

          <IconSettingRow
            icon={Platform.OS === "android" && blurLevel > 0 ? "image" : "blur-on"}
            accessibilityLabel={tNatureHomeSettings("blurSection")}
          >
            <NatureHomeLevelSegment
              selected={blurLevel}
              onSelect={(level) => {
                setBlurLevel(level);
                void writeNatureSoftFocusBlurLevel(level).then(onPrefsChanged);
              }}
              labelForLevel={labelForBlur}
              iconForLevel={(level) => BLUR_LEVEL_ICONS[level]}
              {...segmentProps}
            />
          </IconSettingRow>

          <IconSettingRow icon="timer" accessibilityLabel={tNatureHomeSettings("sleepSection")}>
            <HomeSleepTimerSection {...segmentProps} />
          </IconSettingRow>

          {showTtsControls ? (
            <>
              <IconSettingRow icon="tune" accessibilityLabel={tNatureHomeSettings("ttsRateSection")} alignTop>
                <View style={styles.ttsSliderWrap}>
                  <View style={styles.ttsSliderCell}>
                    <View style={styles.ttsSliderRow}>
                      <View style={styles.ttsSliderIcon}>
                        <MaterialIcons name="speed" size={16} color={ICON_MUTED} />
                      </View>
                      <Slider
                        style={styles.ttsSlider}
                        minimumValue={0}
                        maximumValue={4}
                        step={1}
                        minimumTrackTintColor="#71717a"
                        maximumTrackTintColor="#3f3f46"
                        thumbTintColor="#e5e7eb"
                        value={ttsRateLevel}
                        onValueChange={(v) =>
                          setTtsRateLevel(Math.min(4, Math.max(0, Math.round(v))) as NatureHomeTtsLevel)
                        }
                        accessibilityLabel={labelForTtsRate(ttsRateLevel)}
                      />
                    </View>
                  </View>
                  <View style={styles.ttsSliderCell}>
                    <View style={styles.ttsSliderRow}>
                      <View style={styles.ttsSliderIcon}>
                        <MaterialIcons name="graphic-eq" size={16} color={ICON_MUTED} />
                      </View>
                      <Slider
                        style={styles.ttsSlider}
                        minimumValue={0}
                        maximumValue={4}
                        step={1}
                        minimumTrackTintColor="#71717a"
                        maximumTrackTintColor="#3f3f46"
                        thumbTintColor="#e5e7eb"
                        value={ttsPitchLevel}
                        onValueChange={(v) =>
                          setTtsPitchLevel(Math.min(4, Math.max(0, Math.round(v))) as NatureHomeTtsLevel)
                        }
                        accessibilityLabel={labelForTtsPitch(ttsPitchLevel)}
                      />
                    </View>
                  </View>
                </View>
              </IconSettingRow>

              <IconSettingRow icon="record-voice-over" accessibilityLabel={tNatureHomeSettings("ttsVoiceSection")}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.voiceRow}
                  style={styles.voiceScroll}
                >
                  <Pressable
                    onPress={openSystemVoiceSettings}
                    style={[styles.voiceChip, styles.voiceAddChip]}
                    accessibilityRole="button"
                    accessibilityLabel={tNatureHomeSettings("ttsVoiceAdd")}
                  >
                    <MaterialIcons name="add" size={17} color="rgba(255,255,255,0.72)" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setTtsVoiceId("");
                    }}
                    style={[styles.voiceChip, styles.voiceAddChip, ttsVoiceId === "" && styles.voiceChipOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ttsVoiceId === "" }}
                    accessibilityLabel={tNatureHomeSettings("ttsVoiceDefault")}
                  >
                    <MaterialIcons
                      name="radio-button-checked"
                      size={16}
                      color={ttsVoiceId === "" ? "#fff" : "rgba(255,255,255,0.62)"}
                    />
                  </Pressable>
                  {deviceVoices.map((voice, idx) => {
                    const selected = ttsVoiceId === voice.identifier;
                    const baseLabel = compactVoiceName(voice);
                    const duplicateCount = deviceVoices.filter(
                      (v) => compactVoiceName(v).toLowerCase() === baseLabel.toLowerCase(),
                    ).length;
                    const label = duplicateCount > 1 ? `${baseLabel}${idx + 1}` : baseLabel;
                    const gender = inferVoiceGender(voice);
                    return (
                      <Pressable
                        key={voice.identifier}
                        onPress={() => {
                          setTtsVoiceId(voice.identifier);
                        }}
                        style={[styles.voiceChip, selected && styles.voiceChipOn]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${voice.name?.trim() || voice.identifier} ${voice.language || ""}`.trim()}
                      >
                        <View style={styles.voiceChipInner}>
                          <Text style={[styles.voiceGenderText, selected && styles.voiceGenderTextOn]}>
                            {genderGlyph(gender)}
                          </Text>
                          <Text style={[styles.voiceChipText, selected && styles.voiceChipTextOn]}>{label}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </IconSettingRow>
            </>
          ) : null}

          <IconSettingRow icon="text-fields" accessibilityLabel={tNatureHomeSettings("verseEffectSection")}>
            <NatureHomeVerseEffectPicker
              selected={verseAppearance.textEffect}
              onSelect={(effect) => {
                const next = { ...verseAppearance, textEffect: effect };
                setVerseAppearance(next);
                void writeNatureHomeVerseAppearance(next).then(onPrefsChanged);
              }}
            />
          </IconSettingRow>

          <IconSettingRow icon="format-size" accessibilityLabel={scaleA11y}>
            <View
              style={styles.scaleRow}
              accessibilityRole="adjustable"
              accessibilityLabel={scaleA11y}
              accessibilityValue={{ text: `${Math.round(textScaleAtIndex(scaleIndex) * 100)}%` }}
            >
              <Pressable
                disabled={atDefault}
                onPress={async () => {
                  setScaleIndex(DEFAULT_TEXT_SCALE_INDEX);
                  await writeNatureHomeTextScaleIndex(DEFAULT_TEXT_SCALE_INDEX);
                  onPrefsChanged();
                }}
                style={[styles.scaleBtn, atDefault && styles.scaleBtnDefaultOn]}
                accessibilityRole="button"
                accessibilityLabel={tNatureHomeSettings("textScaleDefaultAria")}
                accessibilityState={{ disabled: atDefault, selected: atDefault }}
              >
                <Text style={styles.scaleDefaultText}>T</Text>
              </Pressable>
              <Pressable
                disabled={atSuperLarge}
                onPress={async () => {
                  setScaleIndex(superLargeIndex);
                  await writeNatureHomeTextScaleIndex(superLargeIndex);
                  onPrefsChanged();
                }}
                style={[styles.scaleBtn, atSuperLarge && styles.scaleBtnDefaultOn]}
                accessibilityRole="button"
                accessibilityLabel={tNatureHomeSettings("textScaleSuperAria")}
                accessibilityState={{ disabled: atSuperLarge, selected: atSuperLarge }}
              >
                <Text style={styles.scaleSuperText}>T</Text>
              </Pressable>
              <Pressable
                disabled={atMin}
                onPress={async () => {
                  const next = Math.max(0, scaleIndex - 1);
                  setScaleIndex(next);
                  await writeNatureHomeTextScaleIndex(next);
                  onPrefsChanged();
                }}
                style={[styles.scaleBtn, atMin && styles.scaleBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={tNatureHomeSettings("textScaleSmallerAria")}
                accessibilityState={{ disabled: atMin }}
              >
                <Text style={styles.scaleOpText}>-</Text>
              </Pressable>
              <Pressable
                disabled={atMax}
                onPress={async () => {
                  const next = Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, scaleIndex + 1);
                  setScaleIndex(next);
                  await writeNatureHomeTextScaleIndex(next);
                  onPrefsChanged();
                }}
                style={[styles.scaleBtn, atMax && styles.scaleBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={tNatureHomeSettings("textScaleLargerAria")}
                accessibilityState={{ disabled: atMax }}
              >
                <Text style={styles.scaleOpText}>+</Text>
              </Pressable>
            </View>
          </IconSettingRow>

          <View style={styles.translationSection}>
            <View style={styles.translationIcon} importantForAccessibility="no-hide-descendants">
              <MaterialIcons name="menu-book" size={18} color={ICON_MUTED} />
            </View>
            <View style={styles.translationBody}>
              <NatureHomeTranslationSettings onPrefsChanged={onPrefsChanged} />
            </View>
          </View>
        </View>
    </ShellSwipeExclude>
  );

  if (presentation === "overlay") {
    return <View style={styles.overlayRoot}>{sheet}</View>;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={[...MODAL_SUPPORTED_ORIENTATIONS]}
    >
      {sheet}
    </Modal>
  );
}
