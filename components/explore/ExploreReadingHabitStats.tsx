"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ReadTodayReadingStats } from "@/components/bible/ReadTodayReadingStats";
import { ReadYearDayTimeline } from "@/components/bible/ReadYearDayTimeline";
import { ExploreRecentBookmarks } from "@/components/explore/ExploreRecentBookmarks";
import { ExploreRecentChapters } from "@/components/explore/ExploreRecentChapters";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadingHabitStats } from "@/hooks/useReadingHabitStats";
import { formatMemberJourneyDuration } from "@/lib/explore/member-journey-duration";
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
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

/** 探索首页上部：习惯统计 + 最近阅读/收藏（对齐 App `ExploreReadingHabitStats`）。 */
export function ExploreReadingHabitStats() {
  const { locale, t } = useLocale();
  const { user } = useAskbibleUser();
  const { yearDay, snapshot, completedDates } = useReadingHabitStats();
  const storedSec = useSyncExternalStore(subscribeAppUsageTime, getAppUsageTotalSec, () => 0);
  const [usageSec, setUsageSec] = useState(storedSec);
  const listenTotalSec = useSyncExternalStore(subscribeScriptureListenTotals, getScriptureListenTotalSec, () => 0);

  useEffect(() => {
    setUsageSec(getAppUsageTotalSec());
    const id = window.setInterval(() => setUsageSec(getAppUsageTotalSec()), 10_000);
    return () => window.clearInterval(id);
  }, [storedSec]);

  const usageLabel = locale === "en" ? "Time in app" : locale === "zh-TW" ? toZhTwText("使用时长") : "使用时长";
  const usageValue = formatAppUsageDuration(usageSec, locale);
  const listenDurationLabel = formatScriptureListenDuration(listenTotalSec, locale);
  const listenLine = t("pages.read.planPlayListenTotalLabel", { duration: listenDurationLabel });
  const journeyValue =
    user?.createdAt != null && user.createdAt.trim()
      ? formatMemberJourneyDuration(user.createdAt, locale)
      : null;
  const journeyLabel =
    locale === "en" ? "Walking together" : locale === "zh-TW" ? toZhTwText("一起走过") : "一起走过";

  return (
    <div className="explore-habit-stats">
      <div className="explore-habit-stats-inner">
        <ReadYearDayTimeline completedDates={completedDates} />
        <ReadTodayReadingStats yearDay={yearDay} snapshot={snapshot} />
        <p className="explore-habit-meta-line">
          {usageLabel}
          <span className="explore-habit-meta-value"> {usageValue}</span>
        </p>
        <p className="explore-habit-meta-line">{listenLine}</p>
        {journeyValue ? (
          <p className="explore-habit-meta-line explore-habit-meta-line--journey">
            {journeyLabel}
            <span className="explore-habit-meta-value"> {journeyValue}</span>
          </p>
        ) : null}
        <ExploreRecentChapters />
        <ExploreRecentBookmarks />
      </div>
    </div>
  );
}
