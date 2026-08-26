import { useRouter } from "expo-router";
import { ensureScriptureTranslationReady } from "../bible/scripture-translation-download";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import { useLocale } from "../i18n/LocaleProvider";
import { ReadBibleTranslationPickerModal } from "./ReadBibleTranslationPickerModal";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { translationSupportsGoldenVerseAudio } from "./readBibleTranslationAudioBadges";

/** 读经 Stack 全页选译本（与经文搜索同级，底栏可见）。 */
export function ReadBibleTranslationPickerScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { primaryTranslationId, setPrimaryTranslationId, translationCatalog } =
    useReadBibleTypography();

  return (
    <ReadBibleTranslationPickerModal
      visible
      onClose={() => router.back()}
      locale={locale}
      translationCatalog={translationCatalog}
      mode="single"
      selectedTranslationId={primaryTranslationId}
      onSelectTranslation={(id) => {
        router.back();
        if (id === primaryTranslationId) return;
        const meta = translationCatalog.find((item) => item.id === id);
        void ensureScriptureTranslationReady(id, meta?.downloadUrl, {
          delivery: meta?.delivery,
        }).catch(() => undefined);
        void setPrimaryTranslationId(id);
      }}
      presentation="stack"
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
