"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";

type Props = {
  titleKey: string;
  descriptionKey?: string;
};

/** App Shell 占位页：文案走 i18n，便于与底栏语言一致 */
export function AppShellPlaceholder({ titleKey, descriptionKey }: Props) {
  const { t } = useLocale();
  return (
    <main className="flex min-h-full min-w-0 w-full flex-1 flex-col items-center justify-center overflow-x-hidden px-6 text-center text-ink">
      <h1 className="font-serif text-[clamp(1.35rem,4vw,1.85rem)] font-medium leading-snug tracking-[0.03em] text-ink/90">
        {t(titleKey)}
      </h1>
      {descriptionKey ? (
        <p className="mt-4 max-w-md text-[13px] leading-relaxed text-muted">{t(descriptionKey)}</p>
      ) : null}
    </main>
  );
}
