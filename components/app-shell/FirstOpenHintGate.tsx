"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { trackTap } from "@/lib/telemetry/tap";
import { markFirstOpenHintSeen, shouldShowFirstOpenHint } from "@/lib/onboarding/first-open-hint-persistence";

function isFirstOpenHintEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIRST_OPEN_HINT_ENABLED !== "0";
}

export function FirstOpenHintGate() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const enabled = useMemo(() => isFirstOpenHintEnabled(), []);

  useEffect(() => {
    if (!enabled) return;
    setVisible(shouldShowFirstOpenHint());
  }, [enabled]);

  const closeWithTarget = (target: "intro.start" | "intro.skip") => {
    trackTap(target);
    setVisible(false);
    markFirstOpenHintSeen();
  };

  if (!enabled || !visible) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-4">
      <button
        type="button"
        aria-label={t("onboarding.firstOpenHint.ctaLater")}
        className="absolute inset-0 cursor-default"
        onClick={() => closeWithTarget("intro.skip")}
      />
      <section
        role="dialog"
        aria-labelledby="askbible-first-open-title"
        aria-describedby="askbible-first-open-body"
        className="relative z-[1] w-full max-w-[420px] rounded-[18px] border border-border/70 bg-surface px-5 py-5 text-left shadow-[0_10px_34px_-10px_rgba(0,0,0,0.38)]"
      >
        <h2 id="askbible-first-open-title" className="text-[20px] font-semibold leading-tight text-ink">
          {t("onboarding.firstOpenHint.title")}
        </h2>
        <p className="mt-1.5 text-[14px] font-medium leading-snug text-ink">
          {t("onboarding.firstOpenHint.subtitle")}
        </p>
        <p id="askbible-first-open-body" className="mt-2.5 text-[14px] leading-[1.65] text-ink/78">
          {t("onboarding.firstOpenHint.body")}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/65">{t("onboarding.firstOpenHint.helper")}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => closeWithTarget("intro.start")}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-app-dark px-4 text-[14px] font-medium text-white transition hover:opacity-95"
          >
            {t("onboarding.firstOpenHint.ctaStart")}
          </button>
          <button
            type="button"
            onClick={() => closeWithTarget("intro.skip")}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-border/70 px-4 text-[14px] text-ink/70 transition hover:text-ink"
          >
            {t("onboarding.firstOpenHint.ctaLater")}
          </button>
        </div>
      </section>
    </div>
  );
}
