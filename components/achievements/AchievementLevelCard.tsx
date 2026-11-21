"use client";

import Link from "next/link";
import { XPBar } from "@/components/achievements/XPBar";

/**
 * 书房「手抄本藏书票与书卷火漆印」卡片（对齐 iOS ExploreView / Android ExploreScreen）：
 * 整张卡片可点进 66 卷书卷印鉴墙。
 */
export function AchievementLevelCard() {
  return (
    <Link
      href="/explore/achievements"
      className="block rounded-[20px] border border-[#D8C6AA] bg-[#FAF5EC]/92 p-4 no-underline transition hover:border-[#C1660B]/45 dark:border-[#3E3328] dark:bg-[#262019]/92"
    >
      <XPBar />
    </Link>
  );
}
