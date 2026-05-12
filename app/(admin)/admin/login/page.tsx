"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function useSupabaseMode(): boolean {
  return useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    return Boolean(url && key);
  }, []);
}

function AdminLoginForm() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() || "/admin";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/admin";
  const urlError = searchParams.get("error")?.trim();

  const supabaseMode = useSupabaseMode();

  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onLegacySubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setPending(true);
      try {
        const res = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (res.status === 410) {
          setError(t("admin.login.errorLegacyDisabled"));
          return;
        }
        if (!res.ok) {
          setError(t("admin.login.errorWrong"));
          return;
        }
        window.location.assign(safeNext);
      } catch {
        setError(t("admin.login.errorNetwork"));
      } finally {
        setPending(false);
      }
    },
    [password, safeNext, t],
  );

  const onSupabaseSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setPending(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: accountPassword,
        });
        if (signErr) {
          setError(signErr.message || t("admin.login.errorWrong"));
          return;
        }
        window.location.assign(safeNext);
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("admin.login.errorNetwork");
        setError(msg);
      } finally {
        setPending(false);
      }
    },
    [accountPassword, email, safeNext, t],
  );

  const bannerError =
    urlError === "forbidden"
      ? t("admin.login.errorForbidden")
      : urlError === "auth"
        ? t("admin.login.errorAuthCallback")
        : null;

  if (supabaseMode) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-adminLine bg-adminPanel/40 px-6 py-8 shadow-[0_12px_40px_-24px_rgba(44,40,36,0.35)]">
          <h1 className="text-center font-medium tracking-tight text-adminFg">{t("admin.login.pageTitle")}</h1>
          <p className="mt-2 text-center text-[12px] leading-relaxed text-adminMuted">{t("admin.login.supabaseHint")}</p>
          {bannerError ? (
            <p className="mt-3 text-center text-[12px] text-red-600/90 dark:text-red-400/90">{bannerError}</p>
          ) : null}
          <form className="mt-6 flex flex-col gap-4" onSubmit={onSupabaseSubmit}>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-adminMuted">{t("admin.login.emailLabel")}</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="rounded-lg border border-adminLine bg-adminBg px-3 py-2 text-[14px] text-adminFg outline-none ring-0 transition placeholder:text-adminMuted/50 focus:border-adminFg/25 focus:ring-2 focus:ring-ink/10"
                placeholder="you@example.com"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-adminMuted">{t("admin.login.passwordLabel")}</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={accountPassword}
                onChange={(ev) => setAccountPassword(ev.target.value)}
                className="rounded-lg border border-adminLine bg-adminBg px-3 py-2 text-[14px] text-adminFg outline-none ring-0 transition placeholder:text-adminMuted/50 focus:border-adminFg/25 focus:ring-2 focus:ring-ink/10"
                placeholder="····"
              />
            </label>
            {error ? <p className="text-center text-[12px] text-red-600/90 dark:text-red-400/90">{error}</p> : null}
            <button
              type="submit"
              disabled={pending || !email.trim() || !accountPassword}
              className="rounded-lg bg-adminFg px-4 py-2.5 text-[13px] font-medium text-adminBg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? t("admin.login.submitting") : t("admin.login.submit")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-adminLine bg-adminPanel/40 px-6 py-8 shadow-[0_12px_40px_-24px_rgba(44,40,36,0.35)]">
        <h1 className="text-center font-medium tracking-tight text-adminFg">{t("admin.login.pageTitle")}</h1>
        <p className="mt-2 text-center text-[12px] leading-relaxed text-adminMuted">{t("admin.login.hint")}</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onLegacySubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-adminMuted">{t("admin.login.passwordLabel")}</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="rounded-lg border border-adminLine bg-adminBg px-3 py-2 text-[14px] text-adminFg outline-none ring-0 transition placeholder:text-adminMuted/50 focus:border-adminFg/25 focus:ring-2 focus:ring-ink/10"
              placeholder="····"
            />
          </label>
          {error ? <p className="text-center text-[12px] text-red-600/90 dark:text-red-400/90">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || !password.trim()}
            className="rounded-lg bg-adminFg px-4 py-2.5 text-[13px] font-medium text-adminBg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? t("admin.login.submitting") : t("admin.login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="h-10 w-10 animate-pulse rounded-full bg-adminLine/60" aria-hidden />
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <AdminLoginForm />
    </Suspense>
  );
}
