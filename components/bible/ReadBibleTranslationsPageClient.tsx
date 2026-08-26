"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ReadBibleTranslationPickerOverlay } from "@/components/bible/ReadBibleTranslationPickerOverlay";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

function translationOptionLabel(
  tr: { labelZh: string; labelEn: string },
  locale: AppLocale,
): string {
  if (locale === "en") return tr.labelEn;
  if (locale === "zh-TW") return toZhTwText(tr.labelZh);
  return tr.labelZh;
}

/** 读经 Stack 全页选译本 — 对齐 App `ReadBibleTranslationPickerScreen`。 */
export function ReadBibleTranslationsPageClient() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { translation, translationCatalog, setPrimaryTranslationId, contrastTranslationIds } =
    useReadBibleTranslationSettings();

  const primaryOptions = useMemo(
    () =>
      translationCatalog.map((tr) => ({
        id: tr.id,
        label: translationOptionLabel(tr, locale),
        language: tr.language,
      })),
    [translationCatalog, locale],
  );

  const onClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/read");
  };

  return (
    <ReadBibleTranslationPickerOverlay
      open
      mode="primary"
      title={t("pages.read.typography.primaryTranslation")}
      options={primaryOptions}
      primaryValue={translation.primaryTranslationId}
      contrastValues={contrastTranslationIds}
      noneLabel={t("pages.read.typography.contrastNone")}
      confirmLabel={locale === "en" ? "Confirm" : "确认"}
      onClose={onClose}
      onSelectPrimary={(id) => {
        onClose();
        if (id !== translation.primaryTranslationId) void setPrimaryTranslationId(id);
      }}
      onConfirmContrast={() => onClose()}
    />
  );
}
