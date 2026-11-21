"use client";

import Link from "next/link";
import { UnifiedNotesSection } from "@/components/bible/UnifiedNotesSection";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function ReadFavoritesClient() {
  const { locale } = useLocale();
  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 sm:px-6">
      <div className="mb-3">
        <Link
          href="/read"
          aria-label={locale === "en" ? "Back" : "返回"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DFD0B8] bg-[#FAF5EC] text-lg text-[#231A12] no-underline dark:border-[#3E3328] dark:bg-[#262019] dark:text-[#EDE2CF]"
        >
          ‹
        </Link>
      </div>
      <UnifiedNotesSection />
    </section>
  );
}
