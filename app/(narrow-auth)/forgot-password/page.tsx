"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  authBodyClass,
  authLinkClass,
  authTitleClass,
} from "@/components/auth/authFormSurface";
import { AuthParchmentChrome } from "@/components/shell/AuthParchmentChrome";

export default function ForgotPasswordPage() {
  const { t } = useLocale();

  return (
    <AuthParchmentChrome>
      <div className="narrow-parchment-root w-full px-1 py-8 text-center">
        <h1 className={authTitleClass}>{t("auth.forgotPageTitle")}</h1>
        <p className={`mt-6 max-w-sm ${authBodyClass}`}>{t("auth.sqlitePasswordResetUnsupported")}</p>
        <Link href="/login" className={`mt-8 inline-block ${authLinkClass}`}>
          {t("auth.forgotGoLogin")}
        </Link>
      </div>
    </AuthParchmentChrome>
  );
}
