"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";

type AuthConfig = { askbible: boolean };

function AdminLoginForm() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() || "/admin";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/admin";
  const urlError = searchParams.get("error")?.trim();

  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/auth", { cache: "no-store" });
        const j = (await res.json()) as AuthConfig;
        if (!cancelled) setConfig({ askbible: Boolean(j.askbible) });
      } catch {
        if (!cancelled) setConfig({ askbible: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const onAskbibleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setPending(true);
      try {
        const res = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password: accountPassword }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error || t("admin.login.errorWrong"));
          return;
        }
        window.location.assign(safeNext);
      } catch {
        setError(t("admin.login.errorNetwork"));
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

  if (!config) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-12">
        <div className="h-10 w-10 animate-pulse rounded-full bg-adminLine/60" aria-hidden />
      </div>
    );
  }

  const emailPasswordForm = (opts: { hint?: string; onSubmit: (e: React.FormEvent) => void }) => (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm rounded-xl border border-adminLine bg-adminPanel px-6 py-8 shadow-[0_8px_32px_-20px_rgba(15,15,15,0.1)]">
        <h1 className="text-center font-medium tracking-tight text-adminFg">{t("admin.login.pageTitle")}</h1>
        {opts.hint?.trim() ? (
          <p className="mt-2 text-center text-[12px] leading-relaxed text-adminMuted">{opts.hint}</p>
        ) : null}
        {bannerError ? (
          <p className="mt-3 text-center text-[12px] text-red-600/90 dark:text-red-400/90">{bannerError}</p>
        ) : null}
        <form
          className={[
            "flex flex-col gap-4",
            opts.hint?.trim() ? "mt-6" : bannerError ? "mt-6" : "mt-8",
          ].join(" ")}
          onSubmit={opts.onSubmit}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-adminMuted">{t("admin.login.emailLabel")}</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="rounded-lg border border-adminLine bg-white px-3 py-2 text-[14px] text-adminFg outline-none ring-0 transition placeholder:text-adminMuted/50 focus:border-adminFg/30 focus:ring-2 focus:ring-adminFg/12"
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
              className="rounded-lg border border-adminLine bg-white px-3 py-2 text-[14px] text-adminFg outline-none ring-0 transition placeholder:text-adminMuted/50 focus:border-adminFg/30 focus:ring-2 focus:ring-adminFg/12"
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

  if (config.askbible) {
    return emailPasswordForm({ onSubmit: onAskbibleSubmit });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm rounded-xl border border-adminLine bg-adminPanel px-6 py-8 shadow-[0_8px_32px_-20px_rgba(15,15,15,0.1)]">
        <h1 className="text-center font-medium tracking-tight text-adminFg">{t("admin.login.pageTitle")}</h1>
        {bannerError ? (
          <p className="mt-3 text-center text-[12px] text-red-600/90 dark:text-red-400/90">{bannerError}</p>
        ) : null}
        <form
          className={bannerError ? "mt-6 flex flex-col gap-4" : "mt-8 flex flex-col gap-4"}
          onSubmit={onLegacySubmit}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-adminMuted">{t("admin.login.passwordLabel")}</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="rounded-lg border border-adminLine bg-white px-3 py-2 text-[14px] text-adminFg outline-none ring-0 transition placeholder:text-adminMuted/50 focus:border-adminFg/30 focus:ring-2 focus:ring-adminFg/12"
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
