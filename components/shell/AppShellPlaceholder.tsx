"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

type Props = {
  titleKey: string;
  /** 副标题：短、略亮；不传则不渲染引导区（分隔线 + 中段文案）。 */
  leadKey?: string;
  /** 正文：不传则不渲染。与 `leadKey` 皆省略时仅保留标题与按钮区。 */
  bodyKey?: string;
  ctaHref?: string;
  ctaLabelKey?: string;
  /** 次要入口（如圣经目录） */
  secondaryCtaHref?: string;
  secondaryCtaLabelKey?: string;
  /** 为 true 时不渲染「返回主页」主按钮（底栏已有主导航）。 */
  hideBackHomeCta?: boolean;
  /** 为 true 时不渲染外层 `main`，仅输出版心内容，供 `ShellTemplateChromeLayout` 等统一壳包裹。 */
  embedded?: boolean;
  /** 嵌入模式时加在外层 flex 容器上（如 `/read` 的 Apple 黑体系字族）。 */
  embeddedSurfaceClassName?: string;
  /** 为 false 时标题不用衬线体，继承外层字族（与 `embeddedSurfaceClassName` 等搭配）。 */
  useSerifTitle?: boolean;
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
  secondaryCtaHref,
  secondaryCtaLabelKey,
  embedded = false,
  embeddedSurfaceClassName,
  useSerifTitle = true,
  hideBackHomeCta = false,
}: Props) {
  const { t } = useLocale();
  const showPrimary = !hideBackHomeCta;
  const showSecondary = Boolean(secondaryCtaHref && secondaryCtaLabelKey);
  const showCtaRow = showPrimary || showSecondary;

  const titleClass = useSerifTitle
    ? "font-serif text-[clamp(1.35rem,4vw,1.85rem)] font-medium leading-snug tracking-[0.03em] text-ink/90"
    : "text-[clamp(1.45rem,4.2vw,1.95rem)] font-semibold leading-snug tracking-tight text-balance text-ink/95";

  const leadClass = useSerifTitle
    ? "mt-5 text-[14px] font-normal leading-relaxed text-ink/78 sm:text-[15px]"
    : "mt-5 text-[15px] font-medium leading-relaxed text-ink/82 sm:text-[16px]";

  const bodyTextClass = useSerifTitle
    ? "mt-4 text-[13px] leading-[1.65] text-muted sm:text-[14px]"
    : "mt-4 text-[14px] font-medium leading-[1.72] text-ink/78 sm:text-[15px]";

  const hasIntro = Boolean(leadKey || bodyKey);
  const ctaRowTopClass = hasIntro ? "mt-10" : "mt-12";

  const body = (
    <div className="mx-auto max-w-md">
      <h1 className={titleClass}>{t(titleKey)}</h1>
      {hasIntro ? (
        <>
          <div className="mx-auto mt-5 h-px w-10 bg-border/55" aria-hidden />
          {leadKey ? <p className={leadClass}>{t(leadKey)}</p> : null}
          {bodyKey ? <p className={bodyTextClass}>{t(bodyKey)}</p> : null}
        </>
      ) : null}
      {showCtaRow ? (
        <div
          className={`flex flex-col items-center gap-3 sm:flex-row sm:justify-center ${ctaRowTopClass}`}
        >
          {showPrimary ? (
            <Link
              href={ctaHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border/60 bg-surface/80 px-5 text-[13px] font-medium text-ink/88 shadow-sm transition hover:border-border hover:bg-surface hover:text-ink"
            >
              {t(ctaLabelKey)}
            </Link>
          ) : null}
          {showSecondary && secondaryCtaHref && secondaryCtaLabelKey ? (
            <Link
              href={secondaryCtaHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border/45 bg-transparent px-5 text-[13px] font-medium text-ink/75 transition hover:border-border hover:bg-surface/60 hover:text-ink"
            >
              {t(secondaryCtaLabelKey)}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (embedded) {
    const surface = embeddedSurfaceClassName?.trim();
    return (
      <div
        className={`flex w-full min-w-0 flex-1 flex-col items-center justify-center overflow-x-hidden text-center${surface ? ` ${surface}` : ""}`}
      >
        {body}
      </div>
    );
  }

  return (
    <main className="flex min-h-full min-w-0 w-full flex-1 flex-col items-center justify-center overflow-x-hidden px-6 pb-10 text-center text-ink">
      {body}
    </main>
  );
}
