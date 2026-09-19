"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { pickLocaleText } from "@/components/achievements/achievement-text";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MedalLevels } from "@/lib/achievements/medal-catalog";
import {
  getAchievementSnapshot,
  refreshAchievements,
  subscribeAchievements,
} from "@/lib/achievements/achievement-store-web";

const EMPTY = {
  totalXP: 0,
  level: 1,
  levelProgress: 0,
  xpInLevel: 0,
  xpForLevel: 1,
  streakMultiplier: 1,
  chaptersReadCount: 0,
  earned: {},
  seals: {},
};

/** 探索页顶部的等级条卡片（对齐原生 ExploreView / ExploreScreen 的 XPBar 卡片）。 */
export function AchievementLevelCard() {
  const { locale } = useLocale();
  const snap = useSyncExternalStore(subscribeAchievements, getAchievementSnapshot, () => EMPTY);

  // 挂载时算一次：把云端同步进来、还没评估的勋章 / XP 补上
  useEffect(() => {
    refreshAchievements();
  }, []);

  const title = MedalLevels.title(snap.level);
  const levelLabel = pickLocaleText(`Lv.${snap.level}`, `Lv.${snap.level}`, locale);

  return (
    <Link
      href="/explore/achievements"
      className="block rounded-2xl border border-black/10 bg-white/55 px-4 py-3 no-underline transition-colors hover:bg-white/70"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-black/80">
          {levelLabel} · {pickLocaleText(title.zh, title.en, locale)}
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
      <div className="mt-2 flex items-center justify-between text-xs text-black/55">
        <span>
          {pickLocaleText("累计", "Total", locale)} {snap.totalXP.toLocaleString()} XP
        </span>
        {snap.streakMultiplier > 1 ? (
          <span>×{snap.streakMultiplier.toFixed(2)}</span>
        ) : null}
      </div>
    </Link>
  );
}
