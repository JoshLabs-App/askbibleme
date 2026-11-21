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
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AuthParchmentChrome } from "@/components/shell/AuthParchmentChrome";
import { sanitizeAuthNextPath } from "@/lib/auth/safe-auth-redirect";
import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";

function LoginPageInner() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeNext = sanitizeAuthNextPath(searchParams.get("next"));

  const { bootstrapped, user, refresh } = useAskbibleUser();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const validCode = /^\d{6}$/.test(code.trim());

  useEffect(() => {
    if (user) {
      router.replace(safeNext);
    }
  }, [user, router, safeNext]);

  const onSendOtp = useCallback(
    async (targetEmail?: string) => {
      const address = (targetEmail ?? email).trim();
      if (!address) return;
      setError(null);
      setPending(true);
      try {
        const { signInAskbibleWebWithOtp } = await import("@/lib/askbible-web-auth-client");
        const result = await signInAskbibleWebWithOtp(address, locale);
        if (!result.ok) {
          if (result.status === 429) {
            setError(t("auth.errorOtpRateLimit"));
          } else if (result.error === "invalid_email") {
            setError(t("auth.errorInvalidEmail"));
          } else {
            setError(result.error || t("auth.errorNetwork"));
          }
          return;
        }
        setSentEmail(address);
        setCode("");
      } catch {
        setError(t("auth.errorNetwork"));
      } finally {
        setPending(false);
      }
    },
    [email, locale, t],
  );

  const onVerifyOtp = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!sentEmail || !validCode) return;
      setError(null);
      setPending(true);
      try {
        const { verifyAskbibleWebOtp } = await import("@/lib/askbible-web-auth-client");
        const result = await verifyAskbibleWebOtp({
          email: sentEmail,
          token: code.trim(),
          locale,
        });
        if (!result.ok) {
          if (result.status === 429) {
            setError(t("auth.errorVerifyRateLimit"));
          } else {
            setError(t("auth.errorOtpInvalid"));
          }
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
    [code, locale, refresh, router, safeNext, sentEmail, t, validCode],
  );

  if (!bootstrapped || user) {
    return <AuthParchmentFallback />;
  }

  return (
    <AuthParchmentChrome>
      <div className="narrow-parchment-root w-full px-1 py-8">
        <h1 className={authTitleClass}>{t("auth.pageTitle")}</h1>

        <div className="mt-8">
          {sentEmail ? (
            <form className="flex flex-col gap-4" onSubmit={onVerifyOtp}>
              <div className="rounded-lg bg-[rgba(43,29,21,0.04)] p-3 text-center dark:bg-stone-50/5">
                <p className="text-[13px] text-[#2b1d15]/80 dark:text-stone-50/80">
                  {t("auth.otpSent", { email: sentEmail })}
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className={authLabelClass}>{t("auth.otpInputLabel")}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  className={authInputClass}
                  disabled={pending}
                  required
                />
              </label>
              {error ? (
                <p className="text-center text-[13px] text-red-700/90 dark:text-red-300/95" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={pending || !validCode} className={authSubmitClass}>
                {pending ? t("auth.verifyingOtp") : t("auth.verifyAndLogin")}
              </button>
              <div className="flex items-center justify-center gap-4 text-[13px]">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void onSendOtp(sentEmail)}
                  className={authLinkClass}
                >
                  {t("auth.resendOtp")}
                </button>
                <span className="text-[rgba(43,29,21,0.25)] dark:text-stone-50/25">·</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setSentEmail(null);
                    setCode("");
                    setError(null);
                  }}
                  className={authLinkClass}
                >
                  {t("auth.changeEmail")}
                </button>
              </div>
            </form>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void onSendOtp();
              }}
            >
              <label className="flex flex-col gap-1.5">
                <span className={authLabelClass}>{t("auth.email")}</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authInputClass}
                  disabled={pending}
                  required
                />
              </label>
              {error ? (
                <p className="text-center text-[13px] text-red-700/90 dark:text-red-300/95" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={pending || !email.trim()} className={authSubmitClass}>
                {pending ? t("auth.sendingOtp") : t("auth.sendOtp")}
              </button>
            </form>
          )}
        </div>

        <Link href={WEB_APP_HOME_PATH} className={`mt-8 block text-center ${authLinkClass}`}>
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
