"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthParchmentFallback } from "@/components/auth/AuthParchmentFallback";
import {
  authInputClass,
  authLabelClass,
  authLinkClass,
  authSubmitClass,
  authTitleClass,
} from "@/components/auth/authFormSurface";
import { AuthMethodDivider, SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AuthParchmentChrome } from "@/components/shell/AuthParchmentChrome";
import { isMemberRegisterEnabledClient } from "@/lib/member-register-enabled";

function LoginPageInner() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next")?.trim() || "/";
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && nextRaw !== "/login" ? nextRaw : "/";

  const { bootstrapped, configured, user, refresh } = useAskbibleUser();
  const registerOpen = isMemberRegisterEnabledClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const oauthError = searchParams.get("error");

  useEffect(() => {
    if (user) {
      router.replace(safeNext);
    }
  }, [user, router, safeNext]);

  useEffect(() => {
    if (oauthError === "oauth") {
      setError(t("auth.errorOAuth"));
    }
  }, [oauthError, t]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setPending(true);
      try {
        const res = await fetch("/api/auth/askbible", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "login",
            email: email.trim(),
            password,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error || t("auth.errorWrong"));
          return;
        }
        await refresh();
        router.replace(safeNext);
      } catch {
        setError(t("auth.errorNetwork"));
      } finally {
        setPending(false);
      }
    },
    [email, password, refresh, router, safeNext, t],
  );

  if (!bootstrapped || user) {
    return <AuthParchmentFallback />;
  }

  if (!configured) {
    return (
      <AuthParchmentChrome>
        <div className="narrow-parchment-root w-full px-1 py-8 text-center">
          <p className="max-w-sm text-[15px] leading-relaxed">{t("auth.notConfigured")}</p>
          <Link href="/" className={`mt-8 inline-block ${authLinkClass}`}>
            {t("auth.backHome")}
          </Link>
        </div>
      </AuthParchmentChrome>
    );
  }

  return (
    <AuthParchmentChrome>
      <div className="narrow-parchment-root w-full px-1 py-8">
        <h1 className={authTitleClass}>{t("auth.pageTitle")}</h1>
        <SocialSignInButtons nextPath={safeNext} className="mt-8" />
        <AuthMethodDivider className="my-5" />
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>{t("auth.email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>{t("auth.password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
              required
            />
          </label>
          {error ? (
            <p className="text-center text-[13px] text-red-700/90 dark:text-red-300/95" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className={authSubmitClass}>
            {pending ? t("auth.submitting") : t("auth.submit")}
          </button>
        </form>
        {registerOpen ? (
          <div className="mt-6 text-center">
            <Link href="/register" className={authLinkClass}>
              {t("auth.loginFooterRegister")}
            </Link>
          </div>
        ) : null}
        <Link href="/" className={`mt-8 block text-center ${authLinkClass}`}>
          {t("auth.backHome")}
        </Link>
      </div>
    </AuthParchmentChrome>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthParchmentFallback />}>
      <LoginPageInner />
    </Suspense>
  );
}
