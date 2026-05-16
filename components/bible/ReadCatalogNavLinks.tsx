"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function ReadCatalogTopBack() {
  const { t } = useLocale();
  return (
    <p className="bible-catalog-read-end mb-2">
      <Link href="/read" className="bible-catalog-text-link">
        {t("pages.read.catalogBack")}
      </Link>
    </p>
  );
}

export function ReadCatalogFooterLink() {
  const { t } = useLocale();
  return (
    <p className="bible-catalog-read-end">
      <Link href="/read/plans" className="bible-catalog-text-link">
        {t("pages.read.plansNav")}
      </Link>
      <span className="mx-2 text-amber-800/35 dark:text-stone-600">·</span>
      <Link href="/read" className="bible-catalog-text-link">
        {t("pages.read.catalogFooter")}
      </Link>
    </p>
  );
}
