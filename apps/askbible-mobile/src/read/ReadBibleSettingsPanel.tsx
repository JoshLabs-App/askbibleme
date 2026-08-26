import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useState } from "react";
import { Modal, Platform, Pressable, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { readBibleSettingsPanelStyles as styles } from "./readBibleSettingsPanelStyles";
import { ReadBibleSettingsParchmentRow } from "./ReadBibleSettingsParchmentRow";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { ReadSettingsSelect } from "./ReadSettingsSelect";
import { ReadBibleTranslationPickerModal } from "./ReadBibleTranslationPickerModal";
import { useReadBibleSettingsPanelModel } from "./useReadBibleSettingsPanelModel";
import { ParchmentModalCard } from "../shell/ParchmentControlSheet";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type TranslationPickerKind = "primary" | "contrast";

export function ReadBibleSettingsPanel({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [translationPickerKind, setTranslationPickerKind] = useState<TranslationPickerKind | null>(
    null,
  );
  const translationPickerOpen = translationPickerKind != null;
  useShellSwipeSuspend(visible || translationPickerOpen);
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
    chapterSegmentMode,
    setChapterSegmentMode: setChapterSegmentModeMaybe,
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

  const closeTranslationPicker = useCallback(() => setTranslationPickerKind(null), []);

  if (!visible && !translationPickerOpen) return null;

  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  );

  return (
    <>
      <Modal
        visible={visible && !translationPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
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
                    open={false}
                    onOpenChange={() => undefined}
                    onPressTrigger={() => setTranslationPickerKind("primary")}
                    onDownloadOption={model.onDownloadTranslation}
                    disabled={!translationCatalogReady || model.primarySelectOptions.length === 0}
                  />
                  <ReadSettingsSelect
                    style={styles.translationSelect}
                    accessibilityLabel={`${t("pages.read.typography.contrastTranslation")} ${model.contrastDisplay}`}
                    values={model.contrastDraftIds}
                    emptyDisplay={t("pages.read.typography.contrastNone")}
                    options={model.contrastSelectOptions}
                    open={false}
                    onOpenChange={() => undefined}
                    onPressTrigger={() => setTranslationPickerKind("contrast")}
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
                        model.chapterAudioPlaybackOptions.some(
                          (o) => o.id === model.chapterAudioPlaybackValue,
                        )
                          ? model.chapterAudioPlaybackValue
                          : model.chapterAudioPlaybackOptions[0]!.id
                      }
                      options={model.playbackSelectOptions}
                      open={model.openMenu === "playback"}
                      onOpenChange={model.onPlaybackOpenChange}
                      onSelect={model.onChapterAudioPlaybackSelect}
                      disabled={!translationCatalogReady}
                    />
                    {model.audioPackageDownloadAvailable ? (
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
                    ) : null}
                  </View>
                </ReadBibleSettingsParchmentRow>
              ) : null}
            </View>
          </ParchmentModalCard>
        </ShellSwipeExclude>
      </Modal>
      <ReadBibleTranslationPickerModal
        visible={translationPickerOpen}
        onClose={closeTranslationPicker}
        locale={locale}
        translationCatalog={translationCatalog}
        mode={translationPickerKind === "contrast" ? "multi" : "single"}
        selectedTranslationId={primaryTranslationId}
        selectedTranslationIds={model.contrastDraftIds}
        onSelectTranslation={async (id) => {
          await model.onPrimarySelect(id);
          closeTranslationPicker();
        }}
        onConfirmTranslations={async (ids) => {
          await model.onContrastConfirm(ids);
          closeTranslationPicker();
        }}
        presentation="fullScreen"
        languageFirst
        title={
          translationPickerKind === "contrast"
            ? locale === "en"
              ? "Choose parallel"
              : "选择对照本"
            : undefined
        }
        subtitle={
          translationPickerKind === "contrast"
            ? locale === "en"
              ? "Select one or more, then tap Done."
              : "可多选，点完成保存。"
            : undefined
        }
      />
    </>
  );
}
