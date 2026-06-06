"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { isMemberRegisterEnabledClient } from "@/lib/member-register-enabled";

export default function RegisterPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { bootstrapped, configured, user, refresh } = useAskbibleUser();
  const registerOpen = isMemberRegisterEnabledClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!acceptTerms) {
        setError(t("auth.registerTermsRequired"));
        return;
      }
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
    [acceptTerms, email, name, password, refresh, router, t],
  );

  if (!bootstrapped) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-12 text-ink/90">
        <div className="h-8 w-8 animate-pulse rounded-full bg-ink/10" aria-hidden />
      </div>
    );
  }

  if (!registerOpen) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-12 text-center text-ink/88">
        <h1 className="text-[18px] font-medium tracking-tight text-ink">{t("auth.registerPageTitle")}</h1>
        <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-ink/60">{t("auth.registerClosed")}</p>
        <Link
          href="/login"
          className="mt-10 text-[14px] text-ink/55 underline decoration-ink/25 underline-offset-4 transition hover:text-ink/80"
        >
          {t("auth.registerGoLogin")}
        </Link>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-12 text-center text-ink/88">
        <p className="max-w-sm text-[15px] leading-relaxed">{t("auth.notConfigured")}</p>
        <Link
          href="/"
          className="mt-8 text-[14px] text-ink/55 underline decoration-ink/25 underline-offset-4 transition hover:text-ink/80"
        >
          {t("auth.backHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-12 text-ink">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[18px] font-medium tracking-tight text-ink">{t("auth.registerPageTitle")}</h1>
        <p className="mt-3 text-center text-[13px] leading-relaxed text-ink/55">{t("auth.registerIntro")}</p>
        <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{t("auth.email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-ink/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink/30 focus:border-ink/25"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{t("auth.registerName")}</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-ink/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink/30 focus:border-ink/25"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{t("auth.password")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="rounded-lg border border-ink/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink/30 focus:border-ink/25"
              required
            />
          </label>
          <label className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink/20"
            />
            <span className="text-[13px] leading-relaxed text-ink/60">{t("auth.registerAcceptTerms")}</span>
          </label>
          {error ? (
            <p className="text-center text-[13px] text-red-300/95" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-lg bg-white/[0.12] px-4 py-3 text-[15px] font-medium text-ink transition hover:bg-white/[0.16] active:scale-[0.99] disabled:opacity-50"
          >
            {pending ? t("auth.registerSubmitting") : t("auth.registerSubmit")}
          </button>
        </form>
        <Link
          href="/login"
          className="mt-6 block text-center text-[13px] text-ink/50 underline decoration-ink/20 underline-offset-4 transition hover:text-ink/75"
        >
          {t("auth.registerGoLogin")}
        </Link>
        <Link
          href="/"
          className="mt-4 block text-center text-[13px] text-ink/40 underline decoration-ink/15 underline-offset-4 transition hover:text-ink/65"
        >
          {t("auth.backHome")}
        </Link>
      </div>
    </div>
  );
}
