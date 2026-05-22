"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function ForgotPasswordPage() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-12 text-ink">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[18px] font-medium tracking-tight text-ink">{t("auth.forgotPageTitle")}</h1>
        <p className="mt-6 text-center text-[14px] leading-relaxed text-ink/70">{t("auth.sqlitePasswordResetUnsupported")}</p>
        <Link
          href="/login"
          className="mt-8 block text-center text-[13px] text-ink/45 underline decoration-ink/20 underline-offset-4 transition hover:text-ink/70"
        >
          {t("auth.forgotGoLogin")}
        </Link>
      </div>
    </div>
  );
}
