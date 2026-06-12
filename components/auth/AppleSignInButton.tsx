"use client";

import { useCallback, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppleBrandIcon } from "@/components/auth/OAuthBrandIcons";
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
      setError(t("auth.errorOAuth"));
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("auth.errorOAuth"));
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
        setError(oauthError.message || t("auth.errorOAuth"));
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
        className="relative flex w-full items-center justify-center gap-2.5 rounded-lg border border-ink/14 bg-ink/[0.88] px-4 py-3 text-[15px] font-medium text-white transition hover:bg-ink/[0.94] active:scale-[0.99] disabled:opacity-50"
      >
        <span className="absolute left-4 flex h-[22px] w-[18px] items-center justify-center" aria-hidden>
          <AppleBrandIcon color="#ffffff" />
        </span>
        {pending ? t("auth.appleSubmitting") : t("auth.continueWithApple")}
      </button>
      {error ? (
        <p className="mt-3 text-center text-[13px] text-red-300/95" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
