"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { useGoldenVerseTextScale } from "@/hooks/useGoldenVerseTextScale";

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

type Props = {
  variant?: "light" | "dark";
  /** `inline`：顶栏圆钮；`panel`：设置浮层内整行 */
  layout?: "inline" | "panel";
};

/**
 * 金句页 A− / A＋ 字号（`zoom` 档位，本机 `localStorage`）。
 */
export function GoldenVerseTextScaleControls({ variant = "light", layout = "inline" }: Props) {
  const { t } = useLocale();
  const { atMin, atMax, onSmaller, onLarger } = useGoldenVerseTextScale();
  const onDark = variant === "dark";

  if (layout === "panel") {
    return (
      <div className="mx-4 mt-1.5 flex items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-white/[0.07] px-2 py-2">
        <button
          type="button"
          disabled={atMin}
          aria-label={t("nature.textScaleSmallerAria")}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] text-canvas/95 transition hover:bg-white/[0.14] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
          onClick={onSmaller}
        >
          <IconTextScaleSmaller className="h-[1.3rem] w-[1.3rem] opacity-90" />
        </button>
        <button
          type="button"
          disabled={atMax}
          aria-label={t("nature.textScaleLargerAria")}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] text-canvas/95 transition hover:bg-white/[0.14] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
          onClick={onLarger}
        >
          <IconTextScaleLarger className="h-[1.3rem] w-[1.3rem] opacity-90" />
        </button>
      </div>
    );
  }

  const btnClass = onDark
    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/85 transition hover:bg-ink/[0.06] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="pointer-events-auto flex items-center gap-0.5">
      <button type="button" disabled={atMin} aria-label={t("nature.textScaleSmallerAria")} className={btnClass} onClick={onSmaller}>
        <IconTextScaleSmaller className="h-[15px] w-[15px] opacity-88" />
      </button>
      <button type="button" disabled={atMax} aria-label={t("nature.textScaleLargerAria")} className={btnClass} onClick={onLarger}>
        <IconTextScaleLarger className="h-[15px] w-[15px] opacity-88" />
      </button>
    </div>
  );
}
