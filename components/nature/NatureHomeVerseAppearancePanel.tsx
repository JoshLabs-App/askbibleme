"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { NatureVerseTextScaleDockProps } from "@/components/home/HomePrayerVerseDockSettings";

type Props = {
  natureVerseTextScale?: NatureVerseTextScaleDockProps;
  /** 嵌入首页设置单卡：更矮行高、无外层圆角盒 */
  compact?: boolean;
};

function IconTextScaleSmaller(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7.5 15.5 12 6l4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.4 12h5.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M8 18.25h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTextScaleDefault(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7.5 15.5 12 6l4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.4 12h5.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M8 18.25h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 15h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTextScaleLarger(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7.5 15.5 12 6l4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.4 12h5.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M12 17v4M10 19h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 自然首页设置：仅字号；字体与字效固定（无衬线 + 铅印轻压）。
 */
export function NatureHomeVerseAppearancePanel({ natureVerseTextScale, compact = false }: Props) {
  const { t } = useLocale();

  if (!natureVerseTextScale) return null;

  const shellClass = compact
    ? "flex items-center justify-center gap-1 py-0.5"
    : "flex items-center justify-center gap-1.5 px-2 py-1.5";

  const btnClass = compact
    ? "inline-flex min-h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-md border border-zinc-600 bg-zinc-700 text-white/90 transition hover:bg-zinc-600 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
    : "inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/90 transition hover:bg-white/10 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35";

  const iconClass = compact ? "h-4 w-4 opacity-90" : "h-[1.15rem] w-[1.15rem] opacity-90";

  const showDefault = Boolean(natureVerseTextScale.onResetToDefault);

  return (
    <div className="w-full">
      <div className={shellClass}>
        {showDefault ? (
          <button
            type="button"
            disabled={natureVerseTextScale.atDefault}
            aria-label={t("nature.textScaleDefaultAria")}
            className={btnClass}
            onClick={natureVerseTextScale.onResetToDefault}
          >
            <IconTextScaleDefault className={iconClass} />
          </button>
        ) : null}
        <button
          type="button"
          disabled={natureVerseTextScale.atMin}
          aria-label={t("nature.textScaleSmallerAria")}
          className={btnClass}
          onClick={natureVerseTextScale.onSmaller}
        >
          <IconTextScaleSmaller className={iconClass} />
        </button>
        <button
          type="button"
          disabled={natureVerseTextScale.atMax}
          aria-label={t("nature.textScaleLargerAria")}
          className={btnClass}
          onClick={natureVerseTextScale.onLarger}
        >
          <IconTextScaleLarger className={iconClass} />
        </button>
      </div>
    </div>
  );
}
