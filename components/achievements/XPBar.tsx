"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MedalLevels } from "@/lib/achievements/medal-catalog";
import {
  getAchievementSnapshot,
  refreshAchievements,
  subscribeAchievements,
  type AchievementSnapshot,
} from "@/lib/achievements/achievement-store-web";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

const EMPTY_SNAPSHOT: AchievementSnapshot = {
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

/** 订阅成就快照；挂载时评估一次，把云端同步进来还没算的补上。 */
export function useAchievementSnapshot(): AchievementSnapshot {
  const snap = useSyncExternalStore(
    subscribeAchievements,
    getAchievementSnapshot,
    () => EMPTY_SNAPSHOT,
  );
  useEffect(() => {
    refreshAchievements();
  }, []);
  return snap;
}

export function levelTitleText(level: number, locale: string): string {
  const t = MedalLevels.title(level);
  if (locale === "en") return t.en;
  return locale === "zh-TW" ? toZhTwText(t.zh) : t.zh;
}

/**
 * 常驻等级条（对齐 iOS `XPBar`）：称号 + 等级 + 会动的 XP 进度 + 连续天数倍率。
 * 倍率 > 1 时挂一颗火苗角标；进度条是暖色渐变加一层辉光。
 */
export function XPBar({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const snap = useAchievementSnapshot();
  const pct = Math.max(0, Math.min(1, snap.levelProgress));

  return (
    <div className="flex flex-col" style={{ gap: compact ? 4 : 6 }}>
      <div className="flex items-center gap-2">
        <span
          className="font-extrabold tabular-nums"
          style={{ fontSize: compact ? 12 : 14, color: "#FFB101" }}
        >
          Lv.{snap.level}
        </span>
        <span className="font-semibold" style={{ fontSize: compact ? 12 : 14, color: "#5C4030" }}>
          {levelTitleText(snap.level, locale)}
        </span>
        <span className="flex-1" />
        {snap.streakMultiplier > 1.001 ? (
          <span
            className="inline-flex items-center gap-[2px] rounded-full px-1.5 py-[2px] font-bold tabular-nums"
            style={{ color: "#E06C2A", backgroundColor: "rgba(224,108,42,0.12)", fontSize: 11 }}
          >
            <FlameIcon />×{snap.streakMultiplier.toFixed(2)}
          </span>
        ) : null}
        <span
          className="font-medium tabular-nums"
          style={{ fontSize: compact ? 11 : 12, color: "#7A633A" }}
        >
          {snap.xpInLevel} / {snap.xpForLevel}
        </span>
      </div>
      <div
        className="w-full overflow-hidden rounded-full"
        style={{ height: compact ? 6 : 8, backgroundColor: "#F2E4CF" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `max(6px, ${pct * 100}%)`,
            background: "linear-gradient(90deg, #FFC94D 0%, #FFB101 100%)",
            boxShadow: "0 0 4px rgba(255,177,1,0.5)",
            transition: "width 450ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden>
      <path d="M12 2c.5 3.5-1.8 4.6-3 6.3C7.4 10.5 7 12 7 13.5 7 17 9.5 19 12 19s5-2 5-5.5c0-2.4-1.3-4-2.6-5.4C13 6.6 12.3 4.7 12 2Z" />
    </svg>
  );
}
