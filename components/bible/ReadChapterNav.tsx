"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function ReadChapterNav() {
  const { t } = useLocale();
  return (
    <p className="text-[11px] text-muted">
      <Link href="/read/catalog" className="underline underline-offset-2">
        {t("pages.read.chapterNavCatalog")}
      </Link>
      <span className="mx-2 text-border/80">·</span>
      <Link href="/read" className="underline underline-offset-2">
        {t("pages.read.chapterNavRead")}
      </Link>
    </p>
  );
}
