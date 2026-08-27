"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getCachedLegacyFiguresBundle } from "@/lib/explore/explore-legacy-figures-cache-web";
import { refreshLegacyFiguresWeb } from "@/lib/explore/explore-content-refresh-web";
import { mobileLegacyFigureProfileToLegacyProfile } from "@/lib/explore/mobile-legacy-figure-to-legacy-profile";
import { getMobileLegacyFigureBySlugFromBundle } from "@/lib/explore/mobile-legacy-figure-lookup-web";
import { resolveMobileLegacyFigureView } from "@/lib/explore/resolve-mobile-legacy-figure-view";
import { localizeLegacyFigureProfileViewClient } from "@/lib/legacy-figure-locale-client";
import type { LegacyFigureProfile } from "@/lib/legacy-figure-preview";

export function useMobileLegacyFigureProfile(
  slug: string,
  initialProfile: LegacyFigureProfile,
): LegacyFigureProfile {
  const { locale } = useLocale();
  const [profile, setProfile] = useState(initialProfile);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    let cancelled = false;

    const applyBundle = (bundle = getCachedLegacyFiguresBundle()) => {
      if (!bundle || cancelled) return;
      const raw = getMobileLegacyFigureBySlugFromBundle(bundle, slug);
      if (!raw) return;
      const resolved = resolveMobileLegacyFigureView(raw, locale);
      setProfile(mobileLegacyFigureProfileToLegacyProfile(resolved));
    };

    applyBundle();

    const run = () => {
      void refreshLegacyFiguresWeb().then((bundle) => {
        if (cancelled) return;
        if (bundle) applyBundle(bundle);
      });
    };

    const schedule = () => {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => run(), { timeout: 3000 });
      } else {
        window.setTimeout(run, 600);
      }
    };

    schedule();

    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [locale, slug]);

  return useMemo(
    () => localizeLegacyFigureProfileViewClient(profile, locale),
    [locale, profile],
  );
}
