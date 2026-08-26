import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { ensureScriptureTranslationReady } from "../bible/scripture-translation-download";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import { ReadBibleTranslationPickerModal } from "../read/ReadBibleTranslationPickerModal";
import { useReadBibleTypography } from "../read/ReadBibleTypographyContext";
import { translationSupportsGoldenVerseAudio } from "../read/readBibleTranslationAudioBadges";
import {
  getHomeGoldenVerseAudioTranslationId,
  hydrateHomeGoldenVerseAudioTranslationId,
  subscribeHomeGoldenVerseAudioTranslationId,
  writeHomeGoldenVerseAudioTranslationId,
} from "../home/homeGoldenVerseAudioPrefs";
import { translationShortLabel } from "../home/natureHomeTranslationLabels";
import { ShellNavDrawerMenuRow } from "./ShellNavDrawerMenuRow";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type SectionProps = {
  locale: AppLocale;
  /** 关闭抽屉后弹出全页选译本（避免嵌套 Modal） */
  onOpenBibleVersionPicker: () => void;
};

/** 左上菜单：经文版本（与读经同步）+ 金句朗读（中文 / 英文）。 */
export function ShellNavDrawerHomeTranslationSection({
  locale,
  onOpenBibleVersionPicker,
}: SectionProps) {
  const { primaryTranslationId, translationCatalog } = useReadBibleTypography();
  const readingTranslationId = useSyncExternalStore(
    subscribeHomeGoldenVerseAudioTranslationId,
    getHomeGoldenVerseAudioTranslationId,
    getHomeGoldenVerseAudioTranslationId,
  );

  useEffect(() => {
    void hydrateHomeGoldenVerseAudioTranslationId();
  }, []);

  const primaryMeta = useMemo(
    () => translationCatalog.find((item) => item.id === primaryTranslationId) ?? null,
    [primaryTranslationId, translationCatalog],
  );
  const primaryDisplay = primaryMeta
    ? translationShortLabel(primaryMeta, locale)
    : primaryTranslationId;

  const readingChips = [
    {
      id: "cuv-simp" as const,
      label: resolveUiText(locale, "中文", "Chinese"),
    },
    {
      id: "web-en" as const,
      label: resolveUiText(locale, "英文", "English"),
    },
  ];

  return (
    <>
      <ShellNavDrawerMenuRow
        label={resolveUiText(locale, "圣经版本", "Bible version")}
        detail={`${primaryDisplay} ›`}
        onPress={onOpenBibleVersionPicker}
      />
      <View style={[styles.row, styles.rowInline]}>
        <Text style={styles.rowText}>{resolveUiText(locale, "金句朗读", "Verse audio")}</Text>
        <View style={styles.localeInlineGroup}>
          {readingChips.map((item) => {
            const selected = readingTranslationId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  void writeHomeGoldenVerseAudioTranslationId(item.id);
                }}
                style={[styles.localeInlineChip, selected && styles.localeInlineChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item.label}
              >
                <Text
                  style={[styles.localeInlineLabel, selected && styles.localeInlineLabelActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

type PickerProps = {
  locale: AppLocale;
  visible: boolean;
  onClose: () => void;
};

/** 挂在抽屉 Modal 外，避免嵌套 Modal 点不进。 */
export function ShellNavDrawerBibleVersionPicker({ locale, visible, onClose }: PickerProps) {
  const { primaryTranslationId, setPrimaryTranslationId, translationCatalog } =
    useReadBibleTypography();

  return (
    <ReadBibleTranslationPickerModal
      visible={visible}
      onClose={onClose}
      locale={locale}
      translationCatalog={translationCatalog}
      mode="single"
      selectedTranslationId={primaryTranslationId}
      onSelectTranslation={(id) => {
        onClose();
        if (id === primaryTranslationId) return;
        const meta = translationCatalog.find((item) => item.id === id);
        void ensureScriptureTranslationReady(id, meta?.downloadUrl, {
          delivery: meta?.delivery,
        }).catch(() => undefined);
        void setPrimaryTranslationId(id);
      }}
      presentation="fullScreen"
      languageFirst
      translationAccessoryIconName={(translation) =>
        translationSupportsChapterAudio(translation.id) ||
        translationSupportsGoldenVerseAudio(translation)
          ? "record-voice-over"
          : null
      }
    />
  );
}
