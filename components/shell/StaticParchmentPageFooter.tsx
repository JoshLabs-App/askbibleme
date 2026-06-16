"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

const COPY = {
  "zh-CN": {
    feedback: "意见反馈",
    privacy: "隐私政策",
    install: "安装说明",
    home: "返回首页",
  },
  en: {
    feedback: "Feedback",
    privacy: "Privacy",
    install: "Install guide",
    home: "Back to home",
  },
} as const;

export function StaticParchmentPageFooter() {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const base = isEn ? COPY.en : COPY["zh-CN"];
  const copy = useMemo(
    () =>
      isEn
        ? base
        : {
            feedback: locale === "zh-TW" ? toZhTwText(base.feedback) : base.feedback,
            privacy: locale === "zh-TW" ? toZhTwText(base.privacy) : base.privacy,
            install: locale === "zh-TW" ? toZhTwText(base.install) : base.install,
            home: locale === "zh-TW" ? toZhTwText(base.home) : base.home,
          },
    [base, isEn, locale],
  );

  return (
    <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[rgba(120,53,15,0.12)] pt-8 text-[14px] text-[rgba(77,53,34,0.68)]">
      <Link
        href="/feedback"
        className="underline decoration-[rgba(77,53,34,0.25)] underline-offset-4 transition hover:text-[#2b1d15]"
      >
        {copy.feedback}
      </Link>
      <Link
        href="/privacy"
        className="underline decoration-[rgba(77,53,34,0.25)] underline-offset-4 transition hover:text-[#2b1d15]"
      >
        {copy.privacy}
      </Link>
      <Link
        href="/install"
        className="underline decoration-[rgba(77,53,34,0.25)] underline-offset-4 transition hover:text-[#2b1d15]"
      >
        {copy.install}
      </Link>
      <Link
        href="/"
        className="underline decoration-[rgba(77,53,34,0.25)] underline-offset-4 transition hover:text-[#2b1d15]"
      >
        {copy.home}
      </Link>
    </footer>
  );
}
