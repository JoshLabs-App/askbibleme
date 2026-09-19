"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { medalCondition, medalText, pickLocaleText } from "@/components/achievements/achievement-text";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  MEDAL_CATALOG,
  MedalLevels,
  medalImageUrl,
  sealKeyForBookNumber,
} from "@/lib/achievements/medal-catalog";
import {
  getAchievementSnapshot,
  metricValue,
  refreshAchievements,
  subscribeAchievements,
} from "@/lib/achievements/achievement-store-web";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";

const EMPTY = {
  totalXP: 0,
  level: 1,
  levelProgress: 0,
  xpInLevel: 0,
  xpForLevel: 1,
  streakMultiplier: 1,
  chaptersReadCount: 0,
  earned: {} as Record<string, { tier: number; at: number }>,
  seals: {} as Record<string, number>,
};

/** 成就页（对齐原生 `AchievementsView.swift` / `AchievementsScreen.kt`）：勋章墙 + 66 卷印章墙 + 三个数字。 */
export function AchievementsView() {
  const { locale } = useLocale();
  const snap = useSyncExternalStore(subscribeAchievements, getAchievementSnapshot, () => EMPTY);

  useEffect(() => {
    refreshAchievements();
  }, []);

  const title = MedalLevels.title(snap.level);
  const earnedCount = Object.keys(snap.earned).length;
  const sealCount = Object.keys(snap.seals).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/explore" className="text-sm text-black/60 no-underline hover:text-black/80">
          ← {pickLocaleText("探索", "Explore", locale)}
        </Link>
        <h1 className="m-0 text-lg font-semibold text-black/85">
          {pickLocaleText("成就", "Achievements", locale)}
        </h1>
      </div>

      {/* 等级 + 进度 */}
      <section className="rounded-2xl border border-black/10 bg-white/55 px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-semibold text-black/85">
            Lv.{snap.level} · {pickLocaleText(title.zh, title.en, locale)}
          </span>
          <span className="text-xs tabular-nums text-black/55">
            {snap.xpInLevel.toLocaleString()} / {snap.xpForLevel.toLocaleString()} XP
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-amber-500/80 transition-[width] duration-500"
            style={{ width: `${Math.round(snap.levelProgress * 100)}%` }}
          />
        </div>
      </section>

      {/* 三个数字 */}
      <section className="mt-3 grid grid-cols-3 gap-2">
        <StatTile value={snap.totalXP} label={pickLocaleText("累计 XP", "Total XP", locale)} />
        <StatTile value={snap.chaptersReadCount} label={pickLocaleText("读完章数", "Chapters", locale)} />
        <StatTile value={earnedCount} label={pickLocaleText("已得勋章", "Medals", locale)} />
      </section>

      {/* 勋章墙 */}
      <h2 className="mb-2 mt-6 text-sm font-semibold text-black/70">
        {pickLocaleText("勋章", "Medals", locale)}
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {MEDAL_CATALOG.map((def) => {
          const tier = snap.earned[def.key]?.tier ?? 0;
          const value = metricValue(def.metric);
          const nextTier = def.tiers[tier] ?? null;
          return (
            <figure key={def.key} className="m-0 flex flex-col items-center gap-1 text-center">
              <img
                src={medalImageUrl(def.key)}
                alt={medalText(def.name, locale)}
                width={72}
                height={72}
                loading="lazy"
                className={`h-[72px] w-[72px] object-contain transition-[filter,opacity] ${
                  tier > 0 ? "" : "opacity-35 grayscale"
                }`}
              />
              <figcaption className="text-xs leading-tight text-black/75">
                {medalText(def.name, locale)}
                {def.tiers.length > 1 && tier > 0 ? (
                  <span className="text-black/45"> ·{tier}</span>
                ) : null}
              </figcaption>
              <span className="text-[11px] leading-tight text-black/45">
                {nextTier != null
                  ? `${medalCondition(def.condition, nextTier, locale)}（${value}/${nextTier}）`
                  : pickLocaleText("已满档", "Maxed", locale)}
              </span>
            </figure>
          );
        })}
      </div>

      {/* 66 卷印章墙 */}
      <h2 className="mb-2 mt-6 text-sm font-semibold text-black/70">
        {pickLocaleText("书卷印章", "Book Seals", locale)}
        <span className="ml-2 font-normal text-black/45">{sealCount}/66</span>
      </h2>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
        {scriptureBooks.map((book) => {
          const key = sealKeyForBookNumber(book.bookNumber);
          const lit = snap.seals[book.bookId] != null;
          const name = getScriptureBookDisplayName(book.bookId, locale);
          return (
            <figure key={book.bookId} className="m-0 flex flex-col items-center gap-1 text-center">
              {key ? (
                <img
                  src={medalImageUrl(key)}
                  alt={name}
                  width={56}
                  height={56}
                  loading="lazy"
                  className={`h-14 w-14 object-contain ${lit ? "" : "opacity-30 grayscale"}`}
                />
              ) : null}
              <figcaption className="text-[11px] leading-tight text-black/60">{name}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/50 px-3 py-3 text-center">
      <div className="text-lg font-semibold tabular-nums text-black/85">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[11px] text-black/55">{label}</div>
    </div>
  );
}
