import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { ReadBibleTranslationPickerModal } from "../read/ReadBibleTranslationPickerModal";
import { translationSupportsGoldenVerseAudio } from "../read/readBibleTranslationAudioBadges";
import { t, resolveUiText } from "../i18n/site-copy";
import { NatureHomeSettingsSelect } from "./NatureHomeSettingsSelect";
import { CONTRAST_OFF_ID, PRIMARY_SYSTEM_DEFAULT_ID } from "./natureHomeTranslationLabels";
import { useNatureHomeTranslationSettings } from "./useNatureHomeTranslationSettings";
import {
  getHomeGoldenVerseAudioTranslationId,
  hydrateHomeGoldenVerseAudioTranslationId,
  subscribeHomeGoldenVerseAudioTranslationId,
  writeHomeGoldenVerseAudioTranslationId,
} from "./homeGoldenVerseAudioPrefs";

type Props = {
  onPrefsChanged: () => void;
};

export function NatureHomeTranslationSettings({ onPrefsChanged }: Props) {
  const [readingMenuOpen, setReadingMenuOpen] = useState(false);
  const readingTranslationId = useSyncExternalStore(
    subscribeHomeGoldenVerseAudioTranslationId,
    getHomeGoldenVerseAudioTranslationId,
    getHomeGoldenVerseAudioTranslationId,
  );
  const {
    locale,
    supportedCatalog,
    allOptions,
    openMenu,
    setOpenMenu,
    primaryOptions,
    contrastOptions,
    primaryValue,
    primaryId,
    contrastValue,
    selectPrimary,
    selectContrast,
    translationDownloadState,
    translationDownloadErrorText,
  } = useNatureHomeTranslationSettings(onPrefsChanged);

  useEffect(() => {
    void hydrateHomeGoldenVerseAudioTranslationId();
  }, []);

  if (allOptions.length === 0) return null;

  const primaryDisplay =
    primaryOptions.find((o) => o.id === primaryValue)?.shortLabel ??
    primaryOptions.find((o) => o.id === primaryValue)?.label ??
    primaryValue;
  const contrastOffLabel = t("pages.read.typography.contrastNone");
  const contrastDisplay =
    contrastOptions.find((o) => o.id === contrastValue)?.shortLabel ??
    contrastOptions.find((o) => o.id === contrastValue)?.label ??
    contrastOffLabel;
  const primaryModalExtraOptions = [
    {
      key: PRIMARY_SYSTEM_DEFAULT_ID,
      label: resolveUiText(locale, "系统预设", "System default"),
      meta:
        primaryOptions.find((item) => item.id === PRIMARY_SYSTEM_DEFAULT_ID)?.label ??
        primaryDisplay,
      selected: primaryValue === PRIMARY_SYSTEM_DEFAULT_ID,
      onPress: () => selectPrimary(PRIMARY_SYSTEM_DEFAULT_ID),
    },
  ];
  const contrastModalExtraOptions = [
    {
      key: "__contrast_none__",
      label: contrastOffLabel,
      selected: contrastValue === CONTRAST_OFF_ID,
      onPress: () => selectContrast(CONTRAST_OFF_ID),
    },
  ];
  const goldenVerseAccessoryIconName = (translation: { id: string }) =>
    translationSupportsGoldenVerseAudio(translation) ? "record-voice-over" : null;
  const downloadingTranslation =
    translationDownloadState.status === "running" ? translationDownloadState.translationId : null;
  const downloadErrorTranslation =
    translationDownloadState.status === "error" ? translationDownloadState.translationId : null;
  const downloadingTranslationMeta = downloadingTranslation
    ? allOptions.find((item) => item.id === downloadingTranslation) ?? null
    : null;
  const downloadingTranslationLabel = downloadingTranslationMeta?.label ?? "";
  const downloadErrorTranslationMeta = downloadErrorTranslation
    ? allOptions.find((item) => item.id === downloadErrorTranslation) ?? null
    : null;
  const downloadErrorTranslationLabel = downloadErrorTranslationMeta?.label ?? "";
  const readingTranslationOptions = [
    {
      id: "cuv-simp",
      label: locale === "en" ? "Chinese Union Version (Simplified)" : "中文和合本（简体）",
      shortLabel: locale === "en" ? "Reading · CUV (Simplified)" : "朗读 · 中文和合本（简体）",
    },
    {
      id: "web-en",
      label: locale === "en" ? "World English Bible (WEBP)" : "WEBP 英译本",
      shortLabel: locale === "en" ? "Reading · WEBP" : "朗读 · WEBP 英译本",
    },
  ];

  return (
    <View style={styles.row}>
      {downloadingTranslation || downloadErrorTranslation ? (
        <View style={styles.downloadBanner}>
          <View style={styles.downloadBannerHead}>
            <Text style={styles.downloadBannerTitle} numberOfLines={1}>
              {locale === "en"
                ? downloadErrorTranslation
                  ? `Download failed ${downloadErrorTranslationLabel}`
                  : `Downloading ${downloadingTranslationLabel}`
                : downloadErrorTranslation
                  ? `下载失败 ${downloadErrorTranslationLabel}`
                  : `正在下载 ${downloadingTranslationLabel}`}
            </Text>
            {downloadingTranslation ? (
              <Text style={styles.downloadBannerPercent}>
                {translationDownloadState.percent}%
              </Text>
            ) : null}
          </View>
          {downloadingTranslation ? (
            <>
              <View style={styles.downloadTrack}>
                <View
                  style={[
                    styles.downloadFill,
                    { width: `${translationDownloadState.percent}%` },
                  ]}
                />
              </View>
              <View style={styles.downloadBannerFooter}>
                <ActivityIndicator size="small" color="#fbbf24" />
                <Text style={styles.downloadBannerHint}>
                  {locale === "en" ? "Auto-downloading after selection" : "选择后自动下载"}
                </Text>
              </View>
            </>
          ) : null}
          {translationDownloadErrorText ? (
            <Text style={styles.downloadBannerError}>{translationDownloadErrorText}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.selectRow}>
        <NatureHomeSettingsSelect
          style={styles.select}
          accessibilityLabel={primaryDisplay}
          value={primaryValue}
          options={primaryOptions}
          open={false}
          onOpenChange={() => undefined}
          onSelect={() => undefined}
          onPressTrigger={() => setOpenMenu("primary")}
          showDownloadButton={false}
        />
        <NatureHomeSettingsSelect
          style={styles.select}
          accessibilityLabel={contrastDisplay}
          value={contrastValue}
          options={contrastOptions}
          open={false}
          onOpenChange={() => undefined}
          onSelect={() => undefined}
          onPressTrigger={() => setOpenMenu("contrast")}
          showDownloadButton={false}
        />
        <NatureHomeSettingsSelect
          style={styles.select}
          accessibilityLabel={locale === "en" ? "Verse audio translation" : "金句朗读版本"}
          value={readingTranslationId}
          options={readingTranslationOptions}
          open={readingMenuOpen}
          onOpenChange={setReadingMenuOpen}
          onSelect={(id) => {
            setReadingMenuOpen(false);
            void writeHomeGoldenVerseAudioTranslationId(
              id === "web-en" ? "web-en" : "cuv-simp",
            );
            onPrefsChanged();
          }}
          showDownloadButton={false}
          menuPlacement="above"
        />
      </View>

      <ReadBibleTranslationPickerModal
        visible={openMenu === "primary"}
        onClose={() => setOpenMenu(null)}
        locale={locale}
        translationCatalog={supportedCatalog}
        mode="single"
        selectedTranslationId={primaryId}
        onSelectTranslation={selectPrimary}
        extraOptions={primaryModalExtraOptions}
        translationAccessoryIconName={goldenVerseAccessoryIconName}
      />

      <ReadBibleTranslationPickerModal
        visible={openMenu === "contrast"}
        onClose={() => setOpenMenu(null)}
        locale={locale}
        translationCatalog={supportedCatalog.filter((item) => item.id !== primaryId)}
        mode="single"
        selectedTranslationId={contrastValue === CONTRAST_OFF_ID ? undefined : contrastValue}
        onSelectTranslation={selectContrast}
        extraOptions={contrastModalExtraOptions}
        translationAccessoryIconName={goldenVerseAccessoryIconName}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },
  downloadBanner: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#52525b",
    backgroundColor: "#27272a",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  downloadBannerHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  downloadBannerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.92)",
    ...parchmentSans(600),
  },
  downloadBannerPercent: {
    fontSize: 12,
    lineHeight: 16,
    color: "#fbbf24",
    ...parchmentSans(700),
  },
  downloadTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#3f3f46",
  },
  downloadFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#fbbf24",
  },
  downloadBannerFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  downloadBannerHint: {
    fontSize: 11,
    lineHeight: 14,
    color: "rgba(255,255,255,0.64)",
    ...parchmentSans(500),
  },
  downloadBannerError: {
    fontSize: 11,
    lineHeight: 14,
    color: "#fca5a5",
    ...parchmentSans(600),
  },
  selectRow: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  select: {
    width: "100%",
  },
});
