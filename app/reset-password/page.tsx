"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

function ResetPasswordFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-12 text-ink/90">
      <div className="h-8 w-8 animate-pulse rounded-full bg-ink/10" aria-hidden />
    </div>
  );
}

function ResetPasswordInner() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-12 text-center text-ink/88">
      <h1 className="text-[18px] font-medium tracking-tight text-ink">{t("auth.resetPageTitle")}</h1>
      <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-ink/75">{t("auth.sqlitePasswordResetUnsupported")}</p>
      <Link
        href="/login"
        className="mt-10 text-[14px] text-ink/55 underline decoration-ink/25 underline-offset-4 transition hover:text-ink/80"
      >
        {t("auth.resetGoLogin")}
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
