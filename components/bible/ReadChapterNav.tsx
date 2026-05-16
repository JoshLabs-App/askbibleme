"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function ReadChapterNav() {
  const { t } = useLocale();
  return (
    <p className="text-[11px] text-amber-900/48 dark:text-stone-500">
      <Link
        href="/read/catalog"
        className="font-medium text-amber-900/72 underline decoration-amber-800/25 underline-offset-[0.2em] transition hover:text-amber-950 hover:decoration-amber-800/45 dark:text-stone-400 dark:decoration-stone-500/35 dark:hover:text-stone-200 dark:hover:decoration-stone-400/55"
      >
        {t("pages.read.chapterNavCatalog")}
      </Link>
      <span className="mx-2 text-amber-800/35 dark:text-stone-600">·</span>
      <Link
        href="/read/plans"
        className="font-medium text-amber-900/72 underline decoration-amber-800/25 underline-offset-[0.2em] transition hover:text-amber-950 hover:decoration-amber-800/45 dark:text-stone-400 dark:decoration-stone-500/35 dark:hover:text-stone-200 dark:hover:decoration-stone-400/55"
      >
        {t("pages.read.plansNav")}
      </Link>
      <span className="mx-2 text-amber-800/35 dark:text-stone-600">·</span>
      <Link
        href="/read"
        className="font-medium text-amber-900/72 underline decoration-amber-800/25 underline-offset-[0.2em] transition hover:text-amber-950 hover:decoration-amber-800/45 dark:text-stone-400 dark:decoration-stone-500/35 dark:hover:text-stone-200 dark:hover:decoration-stone-400/55"
      >
        {t("pages.read.chapterNavRead")}
      </Link>
    </p>
  );
}
