"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

type FeastId =
  | "passover"
  | "unleavened-bread"
  | "firstfruits"
  | "weeks-pentecost"
  | "trumpets"
  | "atonement"
  | "tabernacles"
  | "advent"
  | "christmas"
  | "epiphany"
  | "ash-wednesday"
  | "lent"
  | "palm-sunday"
  | "good-friday"
  | "easter"
  | "ascension"
  | "pentecost-church";

type ReadTarget = {
  label: string;
  bookId: string;
  chapter: number;
  verse: number;
};

const ZH_BOOK_LABELS: Record<string, string> = {
  MAT: "太",
  MRK: "可",
  LUK: "路",
  JHN: "约",
  ACT: "徒",
  ROM: "罗",
  "1CO": "林前",
  "1TH": "帖前",
  HEB: "来",
  JAS: "雅",
  REV: "启",
  EXO: "出",
  LEV: "利",
  NUM: "民",
  PSA: "诗",
  ISA: "赛",
  JOL: "珥",
  ZEC: "亚",
};

function formatReadTargetLabel(target: ReadTarget, locale: string): string {
  if (!/^zh\b/i.test(locale)) return target.label;
  const book = ZH_BOOK_LABELS[target.bookId] ?? target.bookId;
  return `${book} ${target.chapter}:${target.verse}`;
}

const FEAST_TIMELINE: Array<{
  id: FeastId;
  season: "spring" | "autumn";
  orderLabel: string;
  readTargets: ReadTarget[];
}> = [
  {
    id: "passover",
    season: "spring",
    orderLabel: "01",
    readTargets: [
      { label: "LEV 23:5", bookId: "LEV", chapter: 23, verse: 5 },
      { label: "EXO 12:13", bookId: "EXO", chapter: 12, verse: 13 },
      { label: "JHN 1:29", bookId: "JHN", chapter: 1, verse: 29 },
    ],
  },
  {
    id: "unleavened-bread",
    season: "spring",
    orderLabel: "02",
    readTargets: [
      { label: "LEV 23:6", bookId: "LEV", chapter: 23, verse: 6 },
      { label: "EXO 12:15", bookId: "EXO", chapter: 12, verse: 15 },
      { label: "1CO 5:7", bookId: "1CO", chapter: 5, verse: 7 },
    ],
  },
  {
    id: "firstfruits",
    season: "spring",
    orderLabel: "03",
    readTargets: [
      { label: "LEV 23:10", bookId: "LEV", chapter: 23, verse: 10 },
      { label: "1CO 15:20", bookId: "1CO", chapter: 15, verse: 20 },
      { label: "ROM 11:16", bookId: "ROM", chapter: 11, verse: 16 },
    ],
  },
  {
    id: "weeks-pentecost",
    season: "spring",
    orderLabel: "04",
    readTargets: [
      { label: "LEV 23:15", bookId: "LEV", chapter: 23, verse: 15 },
      { label: "ACT 2:1", bookId: "ACT", chapter: 2, verse: 1 },
      { label: "JAS 1:18", bookId: "JAS", chapter: 1, verse: 18 },
    ],
  },
  {
    id: "trumpets",
    season: "autumn",
    orderLabel: "05",
    readTargets: [
      { label: "LEV 23:24", bookId: "LEV", chapter: 23, verse: 24 },
      { label: "NUM 10:10", bookId: "NUM", chapter: 10, verse: 10 },
      { label: "1TH 4:16", bookId: "1TH", chapter: 4, verse: 16 },
    ],
  },
  {
    id: "atonement",
    season: "autumn",
    orderLabel: "06",
    readTargets: [
      { label: "LEV 23:27", bookId: "LEV", chapter: 23, verse: 27 },
      { label: "LEV 16:30", bookId: "LEV", chapter: 16, verse: 30 },
      { label: "HEB 9:12", bookId: "HEB", chapter: 9, verse: 12 },
    ],
  },
  {
    id: "tabernacles",
    season: "autumn",
    orderLabel: "07",
    readTargets: [
      { label: "LEV 23:34", bookId: "LEV", chapter: 23, verse: 34 },
      { label: "JHN 1:14", bookId: "JHN", chapter: 1, verse: 14 },
      { label: "REV 21:3", bookId: "REV", chapter: 21, verse: 3 },
    ],
  },
];

const CHURCH_FEAST_TIMELINE: Array<{
  id: FeastId;
  orderLabel: string;
  readTargets: ReadTarget[];
}> = [
  {
    id: "advent",
    orderLabel: "01",
    readTargets: [
      { label: "MAT 24:42", bookId: "MAT", chapter: 24, verse: 42 },
      { label: "ISA 9:2", bookId: "ISA", chapter: 9, verse: 2 },
      { label: "REV 22:20", bookId: "REV", chapter: 22, verse: 20 },
    ],
  },
  {
    id: "christmas",
    orderLabel: "02",
    readTargets: [
      { label: "LUK 2:11", bookId: "LUK", chapter: 2, verse: 11 },
      { label: "ISA 9:6", bookId: "ISA", chapter: 9, verse: 6 },
      { label: "JHN 1:14", bookId: "JHN", chapter: 1, verse: 14 },
    ],
  },
  {
    id: "epiphany",
    orderLabel: "03",
    readTargets: [
      { label: "MAT 2:1", bookId: "MAT", chapter: 2, verse: 1 },
      { label: "ISA 60:3", bookId: "ISA", chapter: 60, verse: 3 },
      { label: "JHN 8:12", bookId: "JHN", chapter: 8, verse: 12 },
    ],
  },
  {
    id: "ash-wednesday",
    orderLabel: "04",
    readTargets: [
      { label: "JOE 2:12", bookId: "JOL", chapter: 2, verse: 12 },
      { label: "MAT 6:16", bookId: "MAT", chapter: 6, verse: 16 },
      { label: "PSA 51:10", bookId: "PSA", chapter: 51, verse: 10 },
    ],
  },
  {
    id: "lent",
    orderLabel: "05",
    readTargets: [
      { label: "MAT 4:2", bookId: "MAT", chapter: 4, verse: 2 },
      { label: "LUK 9:23", bookId: "LUK", chapter: 9, verse: 23 },
      { label: "ISA 58:6", bookId: "ISA", chapter: 58, verse: 6 },
    ],
  },
  {
    id: "palm-sunday",
    orderLabel: "06",
    readTargets: [
      { label: "MAT 21:9", bookId: "MAT", chapter: 21, verse: 9 },
      { label: "ZEC 9:9", bookId: "ZEC", chapter: 9, verse: 9 },
      { label: "JHN 12:13", bookId: "JHN", chapter: 12, verse: 13 },
    ],
  },
  {
    id: "good-friday",
    orderLabel: "07",
    readTargets: [
      { label: "ISA 53:5", bookId: "ISA", chapter: 53, verse: 5 },
      { label: "JHN 19:30", bookId: "JHN", chapter: 19, verse: 30 },
      { label: "LUK 23:46", bookId: "LUK", chapter: 23, verse: 46 },
    ],
  },
  {
    id: "easter",
    orderLabel: "08",
    readTargets: [
      { label: "MAT 28:6", bookId: "MAT", chapter: 28, verse: 6 },
      { label: "1CO 15:4", bookId: "1CO", chapter: 15, verse: 4 },
      { label: "JHN 11:25", bookId: "JHN", chapter: 11, verse: 25 },
    ],
  },
  {
    id: "ascension",
    orderLabel: "09",
    readTargets: [
      { label: "ACT 1:9", bookId: "ACT", chapter: 1, verse: 9 },
      { label: "LUK 24:51", bookId: "LUK", chapter: 24, verse: 51 },
      { label: "HEB 4:14", bookId: "HEB", chapter: 4, verse: 14 },
    ],
  },
  {
    id: "pentecost-church",
    orderLabel: "10",
    readTargets: [
      { label: "ACT 2:4", bookId: "ACT", chapter: 2, verse: 4 },
      { label: "JHN 14:26", bookId: "JHN", chapter: 14, verse: 26 },
      { label: "ROM 8:11", bookId: "ROM", chapter: 8, verse: 11 },
    ],
  },
];

export function ExploreBiblicalFeastsContent() {
  const { t, locale } = useLocale();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-6 text-ink md:px-8">
      <header className="text-center">
        <h1 className="font-serif text-[clamp(1.8rem,4.8vw,2.35rem)] font-medium leading-[1.24] tracking-[-0.015em] text-ink/92">
          {t("pages.explore.biblicalFeastsTitle")}
        </h1>
        <p className="mt-3 text-[15px] font-medium leading-relaxed tracking-[0.01em] text-ink/70">
          {t("pages.explore.biblicalFeastsSubtitle")}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-[1.95] text-ink/76">{t("pages.explore.biblicalFeastsLead")}</p>
        <div className="mt-5">
          <Link href="/explore" className="text-[13px] font-medium text-ink/80 underline decoration-ink/25 underline-offset-[0.2em]">
            {t("pages.explore.biblicalFeastsBack")}
          </Link>
        </div>
      </header>

      <section className="mt-10 rounded-2xl border border-ink/10 bg-canvas/55 px-5 py-4 sm:px-6">
        <h2 className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-muted/90">
          {t("pages.explore.biblicalFeastsChurchYearTitle")}
        </h2>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-ink/70">{t("pages.explore.biblicalFeastsChurchYearLead")}</p>
        <div className="mt-5 space-y-3">
          {CHURCH_FEAST_TIMELINE.map((entry, index) => (
            <article key={entry.id} className="grid grid-cols-[68px_22px_minmax(0,1fr)] gap-3">
              <div className="pt-2 text-right">
                <p className="text-[11px] font-medium text-muted">{t(`pages.explore.biblicalFeasts.churchFeasts.${entry.id}.month`)}</p>
                <p className="text-[12px] font-semibold text-ink/85">{t(`pages.explore.biblicalFeasts.churchFeasts.${entry.id}.date`)}</p>
              </div>
              <div className="relative flex flex-col items-center">
                {index < CHURCH_FEAST_TIMELINE.length - 1 ? (
                  <span aria-hidden className="absolute left-1/2 top-4 h-[calc(100%+18px)] w-px -translate-x-1/2 bg-border/70" />
                ) : null}
                <span aria-hidden className="mt-2 inline-flex h-2.5 w-2.5 rounded-full bg-amber-600/90 ring-1 ring-border/60" />
                <span className="mt-1 text-[9px] font-semibold tracking-[0.04em] text-muted">{entry.orderLabel}</span>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-canvas/70 px-4 py-3">
                <h3 className="font-serif text-[1.03rem] font-medium text-ink/90">{t(`pages.explore.biblicalFeasts.churchFeasts.${entry.id}.title`)}</h3>
                <p className="mt-1 text-[12px] font-medium text-muted">{t(`pages.explore.biblicalFeasts.churchFeasts.${entry.id}.scripture`)}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{t(`pages.explore.biblicalFeasts.churchFeasts.${entry.id}.summary`)}</p>
                <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-amber-700/90">
                  {t("pages.explore.biblicalFeastsFulfillmentLabel")}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/78">{t(`pages.explore.biblicalFeasts.churchFeasts.${entry.id}.fulfillment`)}</p>
                <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-amber-700/90">
                  {t("pages.explore.biblicalFeastsActionLabel")}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink/70">{t(`pages.explore.biblicalFeasts.churchFeasts.${entry.id}.practice`)}</p>
                <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-amber-700/90">
                  {t("pages.explore.biblicalFeastsKeyScripturesLabel")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.readTargets.map((target) => (
                    <Link
                      key={`${entry.id}-${target.label}`}
                      href={`/read/${target.bookId}/${target.chapter}?verse=${target.verse}`}
                      className="rounded-full border border-ink/15 bg-canvas/80 px-2.5 py-1 text-[11px] font-medium text-ink/82 hover:border-ink/25"
                    >
                      {formatReadTargetLabel(target, locale)}
                    </Link>
                  ))}
                </div>
                <div className="mt-3">
                  <Link
                    href={`/read/${entry.readTargets[0].bookId}/${entry.readTargets[0].chapter}?verse=${entry.readTargets[0].verse}`}
                    className="text-[13px] font-medium text-ink/80 underline decoration-ink/25 underline-offset-[0.2em]"
                  >
                    {t("pages.explore.biblicalFeastsReadNowCta")}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-ink/10 bg-canvas/55 px-5 py-4 sm:px-6">
        <h2 className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-muted/90">
          {t("pages.explore.biblicalFeastsYearLineTitle")}
        </h2>
        <div className="mt-5 space-y-3">
          {FEAST_TIMELINE.map((entry, index) => {
            const showSeasonLabel = index === 0 || FEAST_TIMELINE[index - 1]?.season !== entry.season;
            return (
              <div key={entry.id}>
                {showSeasonLabel ? (
                  <p className="mb-2 text-center text-[11px] font-semibold tracking-[0.08em] text-muted/90">
                    {entry.season === "spring"
                      ? t("pages.explore.biblicalFeastsSeasonSpring")
                      : t("pages.explore.biblicalFeastsSeasonAutumn")}
                  </p>
                ) : null}
                <article className="grid grid-cols-[68px_22px_minmax(0,1fr)] gap-3">
                  <div className="pt-2 text-right">
                    <p className="text-[11px] font-medium text-muted">{t(`pages.explore.biblicalFeasts.feasts.${entry.id}.month`)}</p>
                    <p className="text-[12px] font-semibold text-ink/85">{t(`pages.explore.biblicalFeasts.feasts.${entry.id}.date`)}</p>
                  </div>
                  <div className="relative flex flex-col items-center">
                    {index < FEAST_TIMELINE.length - 1 ? (
                      <span aria-hidden className="absolute left-1/2 top-4 h-[calc(100%+18px)] w-px -translate-x-1/2 bg-border/70" />
                    ) : null}
                    <span aria-hidden className="mt-2 inline-flex h-2.5 w-2.5 rounded-full bg-amber-600/90 ring-1 ring-border/60" />
                    <span className="mt-1 text-[9px] font-semibold tracking-[0.04em] text-muted">{entry.orderLabel}</span>
                  </div>
                  <div className="rounded-2xl border border-ink/10 bg-canvas/70 px-4 py-3">
                    <h3 className="font-serif text-[1.03rem] font-medium text-ink/90">{t(`pages.explore.biblicalFeasts.feasts.${entry.id}.title`)}</h3>
                    <p className="mt-1 text-[12px] font-medium text-muted">{t(`pages.explore.biblicalFeasts.feasts.${entry.id}.scripture`)}</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{t(`pages.explore.biblicalFeasts.feasts.${entry.id}.summary`)}</p>
                    <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-amber-700/90">
                      {t("pages.explore.biblicalFeastsFulfillmentLabel")}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink/78">{t(`pages.explore.biblicalFeasts.feasts.${entry.id}.fulfillment`)}</p>
                    <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-amber-700/90">
                      {t("pages.explore.biblicalFeastsActionLabel")}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink/70">{t(`pages.explore.biblicalFeasts.feasts.${entry.id}.practice`)}</p>
                    <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-amber-700/90">
                      {t("pages.explore.biblicalFeastsKeyScripturesLabel")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.readTargets.map((target) => (
                        <Link
                          key={`${entry.id}-${target.label}`}
                          href={`/read/${target.bookId}/${target.chapter}?verse=${target.verse}`}
                          className="rounded-full border border-ink/15 bg-canvas/80 px-2.5 py-1 text-[11px] font-medium text-ink/82 hover:border-ink/25"
                        >
                          {formatReadTargetLabel(target, locale)}
                        </Link>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Link
                        href={`/read/${entry.readTargets[0].bookId}/${entry.readTargets[0].chapter}?verse=${entry.readTargets[0].verse}`}
                        className="text-[13px] font-medium text-ink/80 underline decoration-ink/25 underline-offset-[0.2em]"
                      >
                        {t("pages.explore.biblicalFeastsReadNowCta")}
                      </Link>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
