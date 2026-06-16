"use client";

import { useCallback, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppleBrandIcon } from "@/components/auth/OAuthBrandIcons";
import { OAuthButtonLabel } from "@/components/auth/OAuthButtonLabel";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

type Props = {
  nextPath?: string;
};

export function AppleSignInButton({ nextPath = "/" }: Props) {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAppleSignIn = useCallback(async () => {
    if (pending) return;
    if (!isSupabaseAuthConfigured()) {
      setError(t("auth.errorOAuthApple"));
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("auth.errorOAuthApple"));
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
        provider: "apple",
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message || t("auth.errorOAuthApple"));
        setPending(false);
      }
    } catch {
      setError(t("auth.errorNetwork"));
      setPending(false);
    }
  }, [nextPath, pending, t]);

  if (!isSupabaseAuthConfigured()) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => void onAppleSignIn()}
        disabled={pending}
        aria-label={t("auth.continueWithApple")}
        className="relative flex min-h-[52px] w-full items-center justify-center rounded-lg border border-[rgba(43,29,21,0.14)] bg-[#2b1d15] px-4 py-3 text-[15px] font-medium text-white transition hover:bg-[#241810] active:scale-[0.99] disabled:opacity-50"
      >
        <span className="absolute left-4 flex h-[22px] w-[18px] items-center justify-center" aria-hidden>
          <AppleBrandIcon color="#ffffff" />
        </span>
        <OAuthButtonLabel
          line1={t("auth.continueWithAppleLine1")}
          line2={t("auth.continueWithAppleLine2")}
          pending={pending}
          pendingText={t("auth.appleSubmitting")}
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
