"use client";

import { AchievementLevelCard } from "@/components/achievements/AchievementLevelCard";
import { UnifiedNotesSection } from "@/components/bible/UnifiedNotesSection";
import { ExploreRecentChapters } from "@/components/explore/ExploreRecentChapters";

/**
 * 私人读经书房主体（对齐去游戏化后的 iOS ExploreView / Android ExploreScreen）：
 * 手抄本藏书票与书卷火漆印 → 四色摘录与印记 → 最近阅读轨迹。
 */
export function ExploreReadingHabitStats() {
  return (
    <div className="mx-auto w-full max-w-[460px] space-y-6 px-4">
      <AchievementLevelCard />
      <UnifiedNotesSection limit={6} />
      <ExploreRecentChapters />
    </div>
  );
}
