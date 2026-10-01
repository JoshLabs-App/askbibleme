"use client";

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

type SectionProps = {
  onOpenBibleVersionPicker: () => void;
};

/** 左上菜单：经文版本（与读经同步）。金句朗读的语言跟界面语言走，不再单独设（DECISIONS D-18）。 */
export function ShellNavDrawerHomeTranslationSection({ onOpenBibleVersionPicker }: SectionProps) {
  const { locale } = useLocale();
  const { translation, translationCatalog } = useReadBibleTranslationSettings();
  const zh = locale === "zh-CN" || locale === "zh-TW";

  const primaryDisplay = useMemo(() => {
    const meta = translationCatalog.find((item) => item.id === translation.primaryTranslationId);
    if (!meta) return translation.primaryTranslationId;
    return translationOptionLabel(meta, locale);
  }, [locale, translation.primaryTranslationId, translationCatalog]);

  return (
    <>
      <button type="button" className="shell-nav-drawer-row w-full shell-nav-drawer-row-stack" onClick={onOpenBibleVersionPicker}>
        <span className="shell-nav-drawer-row-text">{zh ? "圣经版本" : "Bible version"}</span>
        <span className="shell-nav-drawer-row-detail">{primaryDisplay} ›</span>
      </button>
    </>
  );
}

type PickerProps = {
  open: boolean;
  onClose: () => void;
};

/** 挂在抽屉 Modal 外，避免嵌套 overlay 点不进。 */
export function ShellNavDrawerBibleVersionPicker({ open, onClose }: PickerProps) {
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

  return (
    <ReadBibleTranslationPickerOverlay
      open={open}
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
