import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  reference: string;
  book: string;
  chapterStart: number;
  text: string;
  prayerPrompt?: string;
  variant: "preview" | "full";
  index?: number;
};

export function PrayerVersePassage({ reference, book, chapterStart, text, prayerPrompt, variant, index }: Props): ReactNode {
  const isFull = variant === "full";
  const body = text?.trim() || "（暂无译本正文）";
  const showIdx = isFull && typeof index === "number";

  return (
    <div className={isFull ? "mt-10 first:mt-0" : ""}>
      {showIdx ? (
        <p className="mb-2 font-mono text-[11px] font-medium tabular-nums tracking-wide text-muted">
          {String(index + 1).padStart(2, "0")}
        </p>
      ) : null}
      <blockquote
        className={
          isFull
            ? "m-0 border-0 border-l-2 border-ink/18 pl-5 sm:pl-6"
            : "m-0 border-0 border-l-2 border-ink/12 pl-4 sm:pl-5"
        }
      >
        <p
          className={
            isFull
              ? "font-serif text-[16px] leading-[1.85] text-ink/92 sm:text-[17px]"
              : "text-[14px] leading-[1.82] text-ink/88 sm:text-[15px]"
          }
        >
          {body}
        </p>
        <footer className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-sans">
          <cite className="not-italic text-[12px] font-medium tabular-nums text-muted">{reference}</cite>
          <Link
            href={`/read/${book}/${chapterStart}`}
            className="text-[12px] text-ink/70 underline decoration-ink/25 underline-offset-[0.2em] transition hover:text-ink hover:decoration-ink/45"
          >
            去读整章
          </Link>
        </footer>
      </blockquote>
      {prayerPrompt ? (
        <p
          className={
            isFull
              ? "mt-4 max-w-prose border-l border-ink/10 pl-4 text-[13px] leading-relaxed text-ink/78"
              : "mt-3 max-w-prose border-l border-ink/10 pl-3 text-[12px] leading-relaxed text-ink/72"
          }
        >
          <span className="font-medium text-ink/85">{isFull ? "可这样祷告：" : "提醒："}</span>
          {prayerPrompt}
        </p>
      ) : null}
    </div>
  );
}
