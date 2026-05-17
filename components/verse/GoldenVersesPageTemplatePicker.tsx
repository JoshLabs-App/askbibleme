"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useGoldenVersePageTemplateId } from "@/hooks/useGoldenVersePageTemplateId";
import { writeGoldenVersePageTemplatePrefs } from "@/lib/verse/golden-verse-page-template-prefs";
import {
  listGoldenVersePageTemplateOptions,
  resolveGoldenVersePageTemplateImageUrl,
  type GoldenVersePageTemplateId,
} from "@/lib/verse/golden-verse-page-templates";

function IconLayoutTemplate(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9v11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

type Props = {
  customUploadUrl: string | null;
  variant?: "light" | "dark";
};

/**
 * 金句页右上：页模板（底图）选择，横向缩略图条。
 */
export function GoldenVersesPageTemplatePicker({ customUploadUrl, variant = "light" }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const templateId = useGoldenVersePageTemplateId(customUploadUrl);
  const rootRef = useRef<HTMLDivElement>(null);

  const options = listGoldenVersePageTemplateOptions(customUploadUrl);

  const applyTemplate = (id: GoldenVersePageTemplateId) => {
    writeGoldenVersePageTemplatePrefs(id);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onDark = variant === "dark";
  const btnClass = onDark
    ? "flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 active:scale-[0.97]"
    : "flex h-9 w-9 items-center justify-center rounded-full text-ink/85 transition hover:bg-ink/[0.06] active:scale-[0.97]";

  return (
    <div className="pointer-events-auto relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("pages.goldenVerses.pageTemplate")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? "golden-verse-page-template-popover" : undefined}
        className={btnClass}
      >
        <IconLayoutTemplate className="h-[15px] w-[15px] opacity-88" />
      </button>
      {open ? (
        <div
          id="golden-verse-page-template-popover"
          role="dialog"
          aria-label={t("pages.goldenVerses.pageTemplate")}
          className="absolute right-0 top-[calc(100%+0.35rem)] z-[60] w-[min(20rem,calc(100vw-1.25rem))] rounded-xl border border-white/20 bg-ink/88 p-3 shadow-xl backdrop-blur-md"
        >
          <p className="mb-2 px-0.5 text-[11px] font-medium tracking-wide text-white/70">
            {t("pages.goldenVerses.pageTemplate")}
          </p>
          <div
            className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain scroll-smooth py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="radiogroup"
            aria-label={t("pages.goldenVerses.pageTemplate")}
          >
            {options.map((opt) => {
              const thumbSrc = resolveGoldenVersePageTemplateImageUrl(opt.id, customUploadUrl);
              if (!thumbSrc) return null;
              const selected = templateId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(`pages.goldenVerses.pageTemplates.${opt.id}`)}
                  title={t(`pages.goldenVerses.pageTemplates.${opt.id}`)}
                  onClick={() => applyTemplate(opt.id)}
                  className={[
                    "relative h-[4.25rem] w-[3.35rem] shrink-0 overflow-hidden rounded-lg border-2 transition active:scale-[0.97]",
                    selected ? "border-white/90 shadow-md" : "border-white/25 opacity-90 hover:border-white/50",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 缩略图条，本地静态小图 */}
                  <img
                    src={thumbSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
