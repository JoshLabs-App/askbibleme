"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AchievementLevelCard } from "@/components/achievements/AchievementLevelCard";
import { ReadTodayReadingStats } from "@/components/bible/ReadTodayReadingStats";
import { ReadYearDayTimeline } from "@/components/bible/ReadYearDayTimeline";
import { ExploreRecentBookmarks } from "@/components/explore/ExploreRecentBookmarks";
import { ExploreRecentChapters } from "@/components/explore/ExploreRecentChapters";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadingHabitStats } from "@/hooks/useReadingHabitStats";
import {
  formatScriptureListenDuration,
  getScriptureListenTotalSec,
  subscribeScriptureListenTotals,
} from "@/lib/read/scripture-listen-totals-web";
import {
  formatAppUsageDuration,
  getAppUsageTotalSec,
  subscribeAppUsageTime,
} from "@/lib/shell/app-usage-time-web";
import { achCopy } from "@/lib/achievements/achievement-copy";

/**
 * 探索首页上部，顺序照安卓 `ExploreScreen.kt`（D-12）：
 * 年度进度 → 三个统计数 → 成就 → 使用时长 / 累计听 → 最近阅读 → 收藏。
 */
export function ExploreReadingHabitStats() {
  const { locale } = useLocale();
  const { yearDay, snapshot, completedDates } = useReadingHabitStats();
  const storedSec = useSyncExternalStore(subscribeAppUsageTime, getAppUsageTotalSec, () => 0);
  const [usageSec, setUsageSec] = useState(storedSec);
  const listenTotalSec = useSyncExternalStore(subscribeScriptureListenTotals, getScriptureListenTotalSec, () => 0);

  useEffect(() => {
    setUsageSec(getAppUsageTotalSec());
    const id = window.setInterval(() => setUsageSec(getAppUsageTotalSec()), 10_000);
    return () => window.clearInterval(id);
  }, [storedSec]);

  const usageLabel = achCopy("native.usageTime", locale);
  const usageValue = formatAppUsageDuration(usageSec, locale);
  const listenLine = achCopy("native.listenTotal", locale, {
    duration: formatScriptureListenDuration(listenTotalSec, locale),
  });

  return (
    <div className="explore-habit-stats">
      <div className="explore-habit-stats-inner">
        <div className="explore-habit-timeline">
          <ReadYearDayTimeline completedDates={completedDates} />
        </div>
        <div className="explore-habit-stat-row">
          <ReadTodayReadingStats yearDay={yearDay} snapshot={snapshot} />
        </div>
        <div className="explore-habit-level-card">
          <AchievementLevelCard />
        </div>
        <p className="explore-habit-meta-line">
          {usageLabel}&nbsp;&nbsp;{usageValue}
        </p>
        <p className="explore-habit-meta-line">{listenLine}</p>
        <ExploreRecentChapters />
        <ExploreRecentBookmarks />
      </div>
    </div>
  );
}
