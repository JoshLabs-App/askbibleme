"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

type Props = {
  titleKey: string;
  /** 副标题：短、略亮，建立期待 */
  leadKey: string;
  /** 正文：说明「为何留白」与可先去哪 */
  bodyKey: string;
  ctaHref?: string;
  ctaLabelKey?: string;
};

/**
 * App Shell 占位页：分层文案走 i18n，语气偏「正在展开」而非「尚未完成」。
 */
export function AppShellPlaceholder({
  titleKey,
  leadKey,
  bodyKey,
  ctaHref = "/",
  ctaLabelKey = "chrome.backHome",
}: Props) {
  const { t } = useLocale();
  return (
    <main className="flex min-h-full min-w-0 w-full flex-1 flex-col items-center justify-center overflow-x-hidden px-6 pb-10 text-center text-ink">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-[clamp(1.35rem,4vw,1.85rem)] font-medium leading-snug tracking-[0.03em] text-ink/90">
          {t(titleKey)}
        </h1>
        <div className="mx-auto mt-5 h-px w-10 bg-border/55" aria-hidden />
        <p className="mt-5 text-[14px] font-normal leading-relaxed text-ink/78 sm:text-[15px]">{t(leadKey)}</p>
        <p className="mt-4 text-[13px] leading-[1.65] text-muted sm:text-[14px]">{t(bodyKey)}</p>
        <Link
          href={ctaHref}
          className="mt-10 inline-flex min-h-[44px] items-center justify-center rounded-full border border-border/60 bg-surface/80 px-5 text-[13px] font-medium text-ink/88 shadow-sm transition hover:border-border hover:bg-surface hover:text-ink"
        >
          {t(ctaLabelKey)}
        </Link>
      </div>
    </main>
  );
}
