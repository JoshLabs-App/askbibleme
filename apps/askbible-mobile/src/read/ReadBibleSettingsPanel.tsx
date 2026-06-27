import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback } from "react";
import { Modal, Platform, Pressable, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { readBibleSettingsPanelStyles as styles } from "./readBibleSettingsPanelStyles";
import { ReadBibleSettingsParchmentRow } from "./ReadBibleSettingsParchmentRow";
import { ReadBibleSettingsTypographySection } from "./ReadBibleSettingsTypographySection";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { ReadSettingsSelect } from "./ReadSettingsSelect";
import { useReadBibleSettingsPanelModel } from "./useReadBibleSettingsPanelModel";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ReadBibleSettingsPanel({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  useShellSwipeSuspend(visible);
  const { locale } = useLocale();
  const {
    audioVoiceId,
    setAudioVoiceId: persistAudioVoiceId,
    translationCatalog,
    translationCatalogReady,
    primaryTranslationId,
    contrastTranslationIds,
    audioTranslationId,
    chapterAudioTranslationId,
    sizeAtMin,
    sizeAtMax,
    sizeAtDefault,
    sizeAtLargePreset,
    setSizeToLargePreset,
    verseParagraphFlow,
    setVerseParagraphFlow,
    chapterSegmentMode,
    setChapterSegmentMode: setChapterSegmentModeMaybe,
    bumpSize,
    resetSizeToDefault,
    setPrimaryTranslationId,
    setContrastTranslationIds,
    setAudioTranslationId,
    refreshTranslationCatalog,
  } = useReadBibleTypography();
  const setChapterSegmentModeSafe = useCallback(
    (mode: "default" | "t1") => {
      if (typeof setChapterSegmentModeMaybe === "function") {
        setChapterSegmentModeMaybe(mode);
      }
    },
    [setChapterSegmentModeMaybe],
  );

  const model = useReadBibleSettingsPanelModel({
    visible,
    locale,
    translationCatalog,
    translationCatalogReady,
    primaryTranslationId,
    contrastTranslationIds,
    audioTranslationId,
    audioVoiceId,
    chapterAudioTranslationId,
    chapterSegmentMode,
    setPrimaryTranslationId,
    setContrastTranslationIds,
    setAudioTranslationId,
    persistAudioVoiceId,
    refreshTranslationCatalog,
    setChapterSegmentModeSafe,
  });

  if (!visible) return null;

  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <ShellSwipeExclude style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <ParchmentModalCard
          style={[
            styles.sheet,
            { marginTop: topInset + 48, marginRight: Math.max(insets.right, 10) },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.sheetBody}>
          <ReadBibleSettingsParchmentRow icon="menu-book">
            <View style={styles.translationRow}>
              <ReadSettingsSelect
                style={styles.translationSelect}
                accessibilityLabel={`${t("pages.read.typography.primaryTranslation")} ${model.primaryDisplay}`}
                value={primaryTranslationId}
                options={model.primarySelectOptions}
                open={model.openMenu === "primary"}
                onOpenChange={model.onPrimaryOpenChange}
                onSelect={model.onPrimarySelect}
                onDownloadOption={model.onDownloadTranslation}
                disabled={!translationCatalogReady || model.primarySelectOptions.length === 0}
              />
              <ReadSettingsSelect
                style={styles.translationSelect}
                accessibilityLabel={`${t("pages.read.typography.contrastTranslation")} ${model.contrastDisplay}`}
                values={model.contrastDraftIds}
                emptyDisplay={t("pages.read.typography.contrastNone")}
                options={model.contrastSelectOptions}
                open={model.openMenu === "contrast"}
                onOpenChange={model.onContrastOpenChange}
                onToggleSelect={model.onContrastToggleSelect}
                onDownloadOption={model.onDownloadTranslation}
                disabled={!translationCatalogReady || model.contrastSelectOptions.length === 0}
              />
            </View>
          </ReadBibleSettingsParchmentRow>

          {model.chapterAudioPlaybackOptions.length > 0 ? (
            <ReadBibleSettingsParchmentRow icon="record-voice-over">
              <View style={styles.audioPlaybackRow}>
                <ReadSettingsSelect
                  style={styles.audioPlaybackSelect}
                  accessibilityLabel={`${t("pages.read.typography.chapterAudioVoiceLabel")} ${model.playbackDisplay}`}
                  value={
                    model.chapterAudioPlaybackOptions.some((o) => o.id === model.chapterAudioPlaybackValue)
                      ? model.chapterAudioPlaybackValue
                      : model.chapterAudioPlaybackOptions[0]!.id
                  }
                  options={model.playbackSelectOptions}
                  open={model.openMenu === "playback"}
                  onOpenChange={model.onPlaybackOpenChange}
                  onSelect={model.onChapterAudioPlaybackSelect}
                  disabled={!translationCatalogReady}
                />
                <Pressable
                  onPress={() => model.onDownloadPackage(model.currentDownloadPackage)}
                  accessibilityRole="button"
                  accessibilityLabel={`${locale === "en" ? "Audio package" : model.localeZhText("语音包")} ${model.downloadButtonText(model.currentDownloadPackage)}`}
                  style={({ pressed }) => [
                    styles.audioDownloadIconBtn,
                    pressed && styles.audioDownloadIconBtnPressed,
                  ]}
                >
                  <MaterialIcons
                    name={model.downloadActionMeta.icon}
                    size={18}
                    color={model.downloadActionMeta.color}
                  />
                </Pressable>
              </View>
            </ReadBibleSettingsParchmentRow>
          ) : null}

          <ReadBibleSettingsTypographySection
            locale={locale}
            localeZhText={model.localeZhText}
            chapterSegmentMode={chapterSegmentMode}
            verseParagraphFlow={verseParagraphFlow}
            sizeAtDefault={sizeAtDefault}
            sizeAtLargePreset={sizeAtLargePreset}
            sizeAtMax={sizeAtMax}
            sizeAtMin={sizeAtMin}
            onToggleChapterSegmentMode={model.onToggleChapterSegmentMode}
            setVerseParagraphFlow={setVerseParagraphFlow}
            resetSizeToDefault={resetSizeToDefault}
            setSizeToLargePreset={setSizeToLargePreset}
            bumpSize={bumpSize}
          />
          </View>
        </ParchmentModalCard>
      </ShellSwipeExclude>
    </Modal>
  );
}
