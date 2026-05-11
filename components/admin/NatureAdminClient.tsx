"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { NatureVideoAdminSection } from "@/components/admin/NatureVideoAdminSection";

export function NatureAdminClient() {
  const { t } = useLocale();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <main className={`${ADMIN_MAIN_CLASS} text-adminFg`}>
      {msg ? (
        <p
          className={`mb-6 rounded-md border px-2.5 py-2 text-[12px] leading-snug ${
            msg.includes("已写入") || msg.includes("成功") || msg.includes("已完成")
              ? "border-emerald-600/25 bg-emerald-50 text-emerald-950"
              : "border-amber-600/25 bg-amber-50 text-amber-950"
          }`}
        >
          {msg}
        </p>
      ) : null}

      <header className="mb-8 border-b border-adminLine pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-medium tracking-tight text-adminFg">{t("admin.naturePage.title")}</h1>
            <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-adminMuted">{t("admin.naturePage.intro")}</p>
          </div>
          <Link
            href="/admin/music"
            className="shrink-0 text-[11px] font-medium text-adminFg underline-offset-2 hover:underline"
          >
            ← {t("admin.naturePage.linkMusicLibrary")}
          </Link>
        </div>
      </header>

      <NatureVideoAdminSection
        setMsg={setMsg}
        showGallery
        galleryTitle={t("admin.naturePage.galleryTitle")}
        galleryHint={t("admin.naturePage.galleryHint")}
      />
    </main>
  );
}
