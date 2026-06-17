import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import { HomeSleepTimerSection } from "./HomeSleepTimerSection";
import { NatureHomeLevelSegment } from "./NatureHomeLevelSegment";
import { NatureHomeSettingsIconRow } from "./NatureHomeSettingsIconRow";
import { NatureHomeSettingsTextScaleSection } from "./NatureHomeSettingsTextScaleSection";
import { NatureHomeSettingsTtsSection } from "./NatureHomeSettingsTtsSection";
import { NatureHomeTranslationSettings } from "./NatureHomeTranslationSettings";
import { NatureHomeVerseEffectPicker } from "./NatureHomeVerseEffectPicker";
import {
  mergeNatureVisualPrefs,
  NATURE_VISUAL_EFFECT_LEVELS,
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
import {
  BLUR_LEVEL_ICONS,
  DIM_LEVEL_ICONS,
  ICON_MUTED,
  type DeviceVoice,
} from "./natureHomeSettingsPanelConstants";
import {
  natureHomeSettingsPanelStyles as styles,
  natureHomeSettingsSegmentProps as segmentProps,
} from "./natureHomeSettingsPanelStyles";

type Props = {
  sheetWidth: number;
  insets: EdgeInsets;
  posterUri?: string;
  showTtsControls: boolean;
  onClose: () => void;
  onPrefsChanged: () => void;
  dimLevel: NatureVisualLevel;
  setDimLevel: (level: NatureVisualLevel) => void;
  blurLevel: NatureVisualLevel;
  setBlurLevel: (level: NatureVisualLevel) => void;
  ttsRateLevel: NatureHomeTtsLevel;
  setTtsRateLevel: (level: NatureHomeTtsLevel) => void;
  ttsPitchLevel: NatureHomeTtsLevel;
  setTtsPitchLevel: (level: NatureHomeTtsLevel) => void;
  ttsVoiceId: string;
  setTtsVoiceId: (id: string) => void;
  deviceVoices: DeviceVoice[];
  openSystemVoiceSettings: () => void;
  verseAppearance: NatureHomeVerseAppearance;
  setVerseAppearance: (appearance: NatureHomeVerseAppearance) => void;
  scaleIndex: number;
  setScaleIndex: (index: number) => void;
};

export function NatureHomeSettingsPanelSheet({
  sheetWidth,
  insets,
  posterUri,
  showTtsControls,
  onClose,
  onPrefsChanged,
  dimLevel,
  setDimLevel,
  blurLevel,
  setBlurLevel,
  ttsRateLevel,
  setTtsRateLevel,
  ttsPitchLevel,
  setTtsPitchLevel,
  ttsVoiceId,
  setTtsVoiceId,
  deviceVoices,
  openSystemVoiceSettings,
  verseAppearance,
  setVerseAppearance,
  scaleIndex,
  setScaleIndex,
}: Props) {
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

  const menuVisual = mergeNatureVisualPrefs(dimLevel, blurLevel);
  const menuBackdropBlurPx = menuVisual.blurPx;
  // Android 下设置面板背板也跟随“压暗档位”，确保「模糊 + 黑层」同时可见。
  const menuBackdropAlpha =
    Platform.OS === "android"
      ? Math.max(0.12, Math.min(0.62, menuVisual.overlayOpacity * 0.92))
      : Math.max(0.22, Math.min(0.68, menuVisual.overlayOpacity * 0.95 + 0.2));
  const menuBackdropDimmed = `rgba(0,0,0,${menuBackdropAlpha})`;

  return (
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
        <NatureHomeSettingsIconRow icon="tonality" accessibilityLabel={tNatureHomeSettings("dimSection")}>
          <NatureHomeLevelSegment
            selected={dimLevel}
            onSelect={(level) => {
              setDimLevel(level);
              void writeNatureSoftFocusDimLevel(level).then(onPrefsChanged);
            }}
            labelForLevel={labelForDim}
            iconForLevel={(level) => DIM_LEVEL_ICONS[level]}
            levels={NATURE_VISUAL_EFFECT_LEVELS}
            allowToggleOff
            {...segmentProps}
          />
        </NatureHomeSettingsIconRow>

        <NatureHomeSettingsIconRow
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
            levels={NATURE_VISUAL_EFFECT_LEVELS}
            allowToggleOff
            {...segmentProps}
          />
        </NatureHomeSettingsIconRow>

        <NatureHomeSettingsIconRow icon="timer" accessibilityLabel={tNatureHomeSettings("sleepSection")}>
          <HomeSleepTimerSection {...segmentProps} />
        </NatureHomeSettingsIconRow>

        {showTtsControls ? (
          <NatureHomeSettingsTtsSection
            ttsRateLevel={ttsRateLevel}
            setTtsRateLevel={setTtsRateLevel}
            ttsPitchLevel={ttsPitchLevel}
            setTtsPitchLevel={setTtsPitchLevel}
            ttsVoiceId={ttsVoiceId}
            setTtsVoiceId={setTtsVoiceId}
            deviceVoices={deviceVoices}
            openSystemVoiceSettings={openSystemVoiceSettings}
            labelForTtsRate={labelForTtsRate}
            labelForTtsPitch={labelForTtsPitch}
          />
        ) : null}

        <NatureHomeSettingsIconRow icon="text-fields" accessibilityLabel={tNatureHomeSettings("verseEffectSection")}>
          <NatureHomeVerseEffectPicker
            selected={verseAppearance.textEffect}
            onSelect={(effect) => {
              const next = { ...verseAppearance, textEffect: effect };
              setVerseAppearance(next);
              void writeNatureHomeVerseAppearance(next).then(onPrefsChanged);
            }}
          />
        </NatureHomeSettingsIconRow>

        <NatureHomeSettingsTextScaleSection
          scaleIndex={scaleIndex}
          setScaleIndex={setScaleIndex}
          onPrefsChanged={onPrefsChanged}
        />

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
}
