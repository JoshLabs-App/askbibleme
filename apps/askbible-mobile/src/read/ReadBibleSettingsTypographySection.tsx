import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readBibleSettingsPanelStyles as styles } from "./readBibleSettingsPanelStyles";
import { ReadBibleSettingsParchmentRow } from "./ReadBibleSettingsParchmentRow";

type Props = {
  locale: string;
  localeZhText: (text: string) => string;
  chapterSegmentMode: "default" | "t1";
  verseParagraphFlow: boolean;
  sizeAtDefault: boolean;
  sizeAtLargePreset: boolean;
  sizeAtMax: boolean;
  sizeAtMin: boolean;
  onToggleChapterSegmentMode: () => void;
  setVerseParagraphFlow: (enabled: boolean) => void;
  resetSizeToDefault: () => void;
  setSizeToLargePreset: () => void;
  bumpSize: (delta: -1 | 1) => void;
};

export function ReadBibleSettingsTypographySection({
  locale,
  localeZhText,
  chapterSegmentMode,
  verseParagraphFlow,
  sizeAtDefault,
  sizeAtLargePreset,
  sizeAtMax,
  sizeAtMin,
  onToggleChapterSegmentMode,
  setVerseParagraphFlow,
  resetSizeToDefault,
  setSizeToLargePreset,
  bumpSize,
}: Props) {
  return (
    <ReadBibleSettingsParchmentRow icon="format-size">
      <View style={styles.sizeSection}>
        <View style={styles.sizeActions}>
          <Pressable
            onPress={onToggleChapterSegmentMode}
            accessibilityRole="switch"
            accessibilityState={{ checked: chapterSegmentMode === "t1" }}
            accessibilityLabel={
              locale === "en" ? "Toggle section titles (T1)" : localeZhText("切换分段标题（T1）")
            }
            style={({ pressed }) => [
              styles.sizeActionBtn,
              chapterSegmentMode === "t1" && styles.sizeActionBtnActive,
              pressed && styles.sizeActionBtnPressed,
            ]}
          >
            <Text
              style={[
                styles.segmentModeText,
                chapterSegmentMode === "t1" && styles.segmentModeTextActive,
              ]}
            >
              T1
            </Text>
          </Pressable>
          <View style={styles.sizeActionsTrailing}>
            <Pressable
              onPress={() => setVerseParagraphFlow(!verseParagraphFlow)}
              accessibilityRole="switch"
              accessibilityState={{ checked: verseParagraphFlow }}
              accessibilityLabel={t("pages.read.typography.verseParagraphFlowLabel")}
              style={({ pressed }) => [
                styles.sizeActionBtn,
                verseParagraphFlow && styles.sizeActionBtnActive,
                pressed && styles.sizeActionBtnPressed,
              ]}
            >
              <MaterialIcons
                name="subject"
                size={16}
                color={verseParagraphFlow ? c.parchmentAccent : c.muted}
              />
            </Pressable>
            <Pressable
              onPress={resetSizeToDefault}
              disabled={sizeAtDefault}
              accessibilityRole="button"
              accessibilityLabel={
                locale === "en" ? "Reset scripture text size" : localeZhText("恢复默认字号")
              }
              style={({ pressed }) => [
                styles.sizeActionBtn,
                sizeAtDefault && styles.sizeActionBtnDisabled,
                pressed && !sizeAtDefault && styles.sizeActionBtnPressed,
              ]}
            >
              <MaterialIcons name="text-fields" size={16} color={sizeAtDefault ? c.muted : c.ink} />
            </Pressable>
            <Pressable
              onPress={setSizeToLargePreset}
              disabled={sizeAtLargePreset}
              accessibilityRole="button"
              accessibilityLabel={
                locale === "en" ? "Apply large text preset" : localeZhText("切换到大字预设")
              }
              style={({ pressed }) => [
                styles.sizeActionBtn,
                sizeAtLargePreset && styles.sizeActionBtnDisabled,
                pressed && !sizeAtLargePreset && styles.sizeActionBtnPressed,
              ]}
            >
              <Text style={[styles.sizeActionTextPreset, sizeAtLargePreset && styles.sizeActionTextDisabled]}>
                TT
              </Text>
            </Pressable>
            <Pressable
              onPress={() => bumpSize(1)}
              disabled={sizeAtMax}
              accessibilityRole="button"
              accessibilityLabel={
                locale === "en" ? "Increase scripture text size" : localeZhText("增大经文字号")
              }
              style={({ pressed }) => [
                styles.sizeActionBtn,
                sizeAtMax && styles.sizeActionBtnDisabled,
                pressed && !sizeAtMax && styles.sizeActionBtnPressed,
              ]}
            >
              <Text style={[styles.sizeActionText, sizeAtMax && styles.sizeActionTextDisabled]}>T+</Text>
            </Pressable>
            <Pressable
              onPress={() => bumpSize(-1)}
              disabled={sizeAtMin}
              accessibilityRole="button"
              accessibilityLabel={
                locale === "en" ? "Decrease scripture text size" : localeZhText("减小经文字号")
              }
              style={({ pressed }) => [
                styles.sizeActionBtn,
                sizeAtMin && styles.sizeActionBtnDisabled,
                pressed && !sizeAtMin && styles.sizeActionBtnPressed,
              ]}
            >
              <Text style={[styles.sizeActionText, sizeAtMin && styles.sizeActionTextDisabled]}>T-</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ReadBibleSettingsParchmentRow>
  );
}
