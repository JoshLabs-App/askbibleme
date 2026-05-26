"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";

function LoginPageFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-12 text-ink/90">
      <div className="h-8 w-8 animate-pulse rounded-full bg-ink/10" aria-hidden />
    </div>
  );
}

function LoginPageInner() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next")?.trim() || "/";
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && nextRaw !== "/login" ? nextRaw : "/";

  const { bootstrapped, configured, user, refresh } = useAskbibleUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(safeNext);
    }
  }, [user, router, safeNext]);

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

  if (!bootstrapped) {
    return <LoginPageFallback />;
  }

  if (user) {
    return <LoginPageFallback />;
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
        <h1 className="text-center text-[18px] font-medium tracking-tight text-ink">{t("auth.pageTitle")}</h1>
        <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{t("auth.email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-ink/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-ink outline-none ring-0 transition placeholder:text-ink/30 focus:border-ink/25"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{t("auth.password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-ink/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-ink outline-none ring-0 transition placeholder:text-ink/30 focus:border-ink/25"
              required
            />
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
            {pending ? t("auth.submitting") : t("auth.submit")}
          </button>
        </form>
        <Link
          href="/"
          className="mt-8 block text-center text-[13px] text-ink/45 underline decoration-ink/20 underline-offset-4 transition hover:text-ink/70"
        >
          {t("auth.backHome")}
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageInner />
    </Suspense>
  );
}
