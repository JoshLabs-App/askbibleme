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
import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";

function LoginPageInner() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next")?.trim() || WEB_APP_HOME_PATH;
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && nextRaw !== "/login" ? nextRaw : "/";

  const { bootstrapped, configured, user, refresh } = useAskbibleUser();
  const registerOpen = isMemberRegisterEnabledClient();
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const oauthError = searchParams.get("error");
  const validCode = /^\d{6,10}$/.test(code.trim());

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

  const onSendOtp = useCallback(
    async (targetEmail?: string) => {
      const address = (targetEmail ?? email).trim();
      if (!address) return;
      setError(null);
      setPending(true);
      try {
        const { signInAskbibleWebWithOtp } = await import("@/lib/askbible-web-auth-client");
        const result = await signInAskbibleWebWithOtp(address);
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
    [email, t],
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
    [code, refresh, router, safeNext, sentEmail, t, validCode],
  );

  const onPasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setPending(true);
      try {
        const { signInAskbibleWebWithPassword } = await import("@/lib/askbible-web-auth-client");
        const result = await signInAskbibleWebWithPassword({
          email: email.trim(),
          password,
        });
        if (!result.ok) {
          setError(t("auth.errorWrong"));
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
          <Link href={WEB_APP_HOME_PATH} className={`mt-8 inline-block ${authLinkClass}`}>
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

        <div className="mb-4 flex border-b border-[rgba(43,29,21,0.1)] dark:border-stone-50/10">
          <button
            type="button"
            onClick={() => {
              setMode("otp");
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-[14px] font-medium transition ${
              mode === "otp"
                ? "border-b-2 border-[#2b1d15] text-[#2b1d15] dark:border-stone-50 dark:text-stone-50"
                : "text-[rgba(43,29,21,0.45)] hover:text-[rgba(43,29,21,0.7)] dark:text-stone-50/45 dark:hover:text-stone-50/70"
            }`}
          >
            {t("auth.otpMode")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-[14px] font-medium transition ${
              mode === "password"
                ? "border-b-2 border-[#2b1d15] text-[#2b1d15] dark:border-stone-50 dark:text-stone-50"
                : "text-[rgba(43,29,21,0.45)] hover:text-[rgba(43,29,21,0.7)] dark:text-stone-50/45 dark:hover:text-stone-50/70"
            }`}
          >
            {t("auth.passwordMode")}
          </button>
        </div>

        {mode === "otp" ? (
          sentEmail ? (
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
                  placeholder={t("auth.otpInputPlaceholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
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
          )
        ) : (
          <form className="flex flex-col gap-4" onSubmit={onPasswordSubmit}>
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
            <label className="flex flex-col gap-1.5">
              <span className={authLabelClass}>{t("auth.password")}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <button type="submit" disabled={pending} className={authSubmitClass}>
              {pending ? t("auth.submitting") : t("auth.submit")}
            </button>
          </form>
        )}

        {registerOpen ? (
          <div className="mt-6 text-center">
            <Link href="/register" className={authLinkClass}>
              {t("auth.loginFooterRegister")}
            </Link>
          </div>
        ) : null}
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
