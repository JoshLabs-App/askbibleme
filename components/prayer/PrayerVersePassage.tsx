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
    <div className={["prayer-verse-passage", isFull ? "prayer-verse-passage--full" : ""].filter(Boolean).join(" ")}>
      {showIdx ? (
        <p className="prayer-eyebrow mb-2 tabular-nums">{String(index + 1).padStart(2, "0")}</p>
      ) : null}
      <blockquote className="prayer-accent-l">
        <p className="prayer-body m-0">{body}</p>
        <footer className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <cite className="prayer-muted not-italic text-[0.69em] font-semibold tabular-nums">{reference}</cite>
          <Link href={`/read/${book}/${chapterStart}`} className="prayer-link text-[0.69em] font-medium">
            去读整章
          </Link>
        </footer>
      </blockquote>
      {prayerPrompt ? (
        <p className="prayer-accent-l prayer-lead mt-4 max-w-prose text-[0.82em]">
          <span className="font-semibold text-inherit">{isFull ? "可这样祷告：" : "提醒："}</span>
          {prayerPrompt}
        </p>
      ) : null}
    </div>
  );
}
