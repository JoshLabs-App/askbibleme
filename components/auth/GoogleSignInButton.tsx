"use client";

import { useCallback, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { GoogleBrandIcon } from "@/components/auth/OAuthBrandIcons";
import { OAuthButtonLabel } from "@/components/auth/OAuthButtonLabel";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

type Props = {
  nextPath?: string;
  className?: string;
};

export function GoogleSignInButton({ nextPath = "/", className }: Props) {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogleSignIn = useCallback(async () => {
    if (pending) return;
    if (!isSupabaseAuthConfigured()) {
      setError(t("auth.errorOAuthGoogle"));
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("auth.errorOAuthGoogle"));
      return;
    }

    setPending(true);
    setError(null);
    try {
      const safeNext =
        nextPath.startsWith("/") && !nextPath.startsWith("//") && nextPath !== "/login" && nextPath !== "/register"
          ? nextPath
          : "/";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) {
        setError(oauthError.message || t("auth.errorOAuthGoogle"));
        setPending(false);
      }
    } catch {
      setError(t("auth.errorNetwork"));
      setPending(false);
    }
  }, [nextPath, pending, t]);

  if (!isSupabaseAuthConfigured()) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void onGoogleSignIn()}
        disabled={pending}
        aria-label={t("auth.continueWithGoogle")}
        className="relative flex min-h-[52px] w-full items-center justify-center rounded-lg border border-[rgba(43,29,21,0.14)] bg-white/[0.92] px-4 py-3 text-[15px] font-medium text-[#2b1d15] transition hover:bg-white active:scale-[0.99] disabled:opacity-50"
      >
        <span className="absolute left-4 flex h-[18px] w-[18px] items-center justify-center" aria-hidden>
          <GoogleBrandIcon />
        </span>
        <OAuthButtonLabel
          line1={t("auth.continueWithGoogleLine1")}
          line2={t("auth.continueWithGoogleLine2")}
          pending={pending}
          pendingText={t("auth.googleSubmitting")}
        />
      </button>
      {error ? (
        <p className="mt-3 text-center text-[13px] text-red-700/90 dark:text-red-300/95" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AuthMethodDivider({ className }: { className?: string }) {
  const { t } = useLocale();
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <span className="h-px flex-1 bg-[rgba(43,29,21,0.1)] dark:bg-stone-50/10" aria-hidden />
      <span className="text-[11px] font-medium uppercase tracking-wide text-[rgba(43,29,21,0.38)] dark:text-stone-50/38">
        {t("auth.orDivider")}
      </span>
      <span className="h-px flex-1 bg-[rgba(43,29,21,0.1)] dark:bg-stone-50/10" aria-hidden />
    </div>
  );
}
