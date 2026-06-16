"use client";

import Link from "next/link";
import { Suspense } from "react";
import { AuthParchmentFallback } from "@/components/auth/AuthParchmentFallback";
import {
  authBodyClass,
  authLinkClass,
  authTitleClass,
} from "@/components/auth/authFormSurface";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AuthParchmentChrome } from "@/components/shell/AuthParchmentChrome";

function ResetPasswordInner() {
  const { t } = useLocale();
  return (
    <AuthParchmentChrome>
      <div className="narrow-parchment-root w-full px-1 py-8 text-center">
        <h1 className={authTitleClass}>{t("auth.resetPageTitle")}</h1>
        <p className={`mt-6 max-w-sm ${authBodyClass}`}>{t("auth.sqlitePasswordResetUnsupported")}</p>
        <Link href="/login" className={`mt-10 inline-block ${authLinkClass}`}>
          {t("auth.resetGoLogin")}
        </Link>
      </div>
    </AuthParchmentChrome>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthParchmentFallback />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
