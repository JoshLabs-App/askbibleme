"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function RegisterPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (password !== confirm) {
        setError(t("auth.resetMismatch"));
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
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error || t("auth.errorNetwork"));
          return;
        }
        router.replace("/");
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("auth.errorNetwork");
        setError(msg);
      } finally {
        setPending(false);
      }
    },
    [confirm, email, password, router, t],
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-12 text-ink">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[18px] font-medium tracking-tight text-ink">{t("auth.registerPageTitle")}</h1>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="rounded-lg border border-ink/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-ink outline-none ring-0 transition placeholder:text-ink/30 focus:border-ink/25"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">
              {t("auth.resetConfirmPassword")}
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
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
            {pending ? t("auth.submitting") : t("auth.drawerRegister")}
          </button>
        </form>
        <Link
          href="/login"
          className="mt-8 block text-center text-[13px] text-ink/45 underline decoration-ink/20 underline-offset-4 transition hover:text-ink/70"
        >
          {t("auth.registerGoLogin")}
        </Link>
      </div>
    </div>
  );
}
