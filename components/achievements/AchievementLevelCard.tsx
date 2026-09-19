"use client";

import Link from "next/link";
import { XPBar } from "@/components/achievements/XPBar";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { achCopy } from "@/lib/achievements/achievement-copy";

/**
 * 探索页的等级条卡片（对齐 iOS `ExploreView` 里那块）：
 * 整条可点进成就页，下面一行副标题 + 右箭头。
 */
export function AchievementLevelCard() {
  const { locale } = useLocale();

  return (
    <Link
      href="/explore/achievements"
      className="block no-underline"
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: "rgba(255,252,245,0.92)",
        border: "1px solid #F2E4CF",
      }}
    >
      <div className="flex flex-col gap-2">
        <XPBar />
        <div className="flex items-center gap-1" style={{ color: "#7A633A", fontSize: 12 }}>
          <span>{achCopy("native.achievementsSub", locale)}</span>
          <ChevronRight />
        </div>
      </div>
    </Link>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
