"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function OfflinePageClient() {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="text-balance text-[17px] font-medium tracking-tight text-ink">
        {t("chrome.offlinePageTitle")}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink/75">{t("chrome.offlinePageBody")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-full border border-border/60 bg-canvas/90 px-5 text-[14px] font-medium text-ink"
      >
        {t("chrome.offlinePageHome")}
      </Link>
    </div>
  );
}
