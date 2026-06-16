"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthParchmentFallback } from "@/components/auth/AuthParchmentFallback";
import {
  authBodyClass,
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

type Props = {
  registerOpen: boolean;
};

export function RegisterClient({ registerOpen }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const { bootstrapped, configured, user, refresh } = useAskbibleUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

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
            action: "register",
            email: email.trim(),
            password,
            name: name.trim(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error || t("auth.errorNetwork"));
          return;
        }
        await refresh();
        router.replace("/");
      } catch {
        setError(t("auth.errorNetwork"));
      } finally {
        setPending(false);
      }
    },
    [email, name, password, refresh, router, t],
  );

  if (!bootstrapped || user) {
    return <AuthParchmentFallback />;
  }

  if (!registerOpen) {
    return (
      <AuthParchmentChrome>
        <div className="narrow-parchment-root w-full px-1 py-8 text-center">
          <h1 className={authTitleClass}>{t("auth.registerPageTitle")}</h1>
          <p className={`mt-6 max-w-sm ${authBodyClass}`}>{t("auth.registerClosed")}</p>
          <Link href="/login" className={`mt-10 inline-block ${authLinkClass}`}>
            {t("auth.registerGoLogin")}
          </Link>
        </div>
      </AuthParchmentChrome>
    );
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
        <h1 className={authTitleClass}>{t("auth.registerPageTitle")}</h1>
        <p className={`mt-3 ${authBodyClass}`}>{t("auth.registerIntro")}</p>
        <SocialSignInButtons nextPath="/" className="mt-8" />
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
            <span className={authLabelClass}>{t("auth.registerName")}</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={authInputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={authLabelClass}>{t("auth.password")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
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
            {pending ? t("auth.registerSubmitting") : t("auth.registerSubmit")}
          </button>
        </form>
        <Link href="/login" className={`mt-6 block text-center ${authLinkClass}`}>
          {t("auth.registerGoLogin")}
        </Link>
        <Link href="/" className={`mt-4 block text-center ${authLinkClass}`}>
          {t("auth.backHome")}
        </Link>
      </div>
    </AuthParchmentChrome>
  );
}
