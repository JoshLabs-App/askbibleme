"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getPublicRegisterUrl } from "@/lib/site-auth-links";

export default function RegisterPage() {
  const { t } = useLocale();
  const url = getPublicRegisterUrl() ?? "";

  useEffect(() => {
    if (url && /^https?:\/\//i.test(url)) {
      window.location.replace(url);
    }
  }, [url]);

  if (url && /^https?:\/\//i.test(url)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-12 text-ink/70">
        <div className="h-8 w-8 animate-pulse rounded-full bg-ink/10" aria-hidden />
        <p className="mt-4 text-[13px]">{t("auth.registerRedirecting")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-12 text-center text-ink/88">
      <h1 className="text-[18px] font-medium tracking-tight text-ink">{t("auth.registerPageTitle")}</h1>
      <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-ink/75">{t("auth.registerIntro")}</p>
      <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-ink/50">{t("auth.registerEnvHint")}</p>
      <Link
        href="/login"
        className="mt-10 text-[14px] text-ink/55 underline decoration-ink/25 underline-offset-4 transition hover:text-ink/80"
      >
        {t("auth.registerGoLogin")}
      </Link>
      <Link
        href="/"
        className="mt-4 text-[13px] text-ink/40 underline decoration-ink/15 underline-offset-4 transition hover:text-ink/65"
      >
        {t("auth.backHome")}
      </Link>
    </div>
  );
}
