"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MedalIcon } from "@/components/achievements/MedalIcon";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useReadingHabitStats } from "@/hooks/useReadingHabitStats";
import { MedalLevels, sealKeyForBookNumber } from "@/lib/achievements/medal-catalog";
import {
  getAchievementSnapshot,
  refreshAchievements,
  subscribeAchievements,
  type AchievementSnapshot,
} from "@/lib/achievements/achievement-store-web";
import { scriptureBooks } from "@/lib/bible/scripture-books";
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

const PREVIEW_BOOK_IDS = ["GEN", "EXO", "PSA", "ISA", "JHN"];

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

function pickCopy(zh: string, en: string, locale: string): string {
  if (locale === "en") return en;
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}

/**
 * 去游戏化「手抄本藏书票」（对齐 iOS / Android XPBar）：
 * 移除 Lv.X、XP 进度条与火焰连击倍率，展示「安静相伴(天) | 已读章节 | 书卷火漆印 X/66」及 5 枚浮雕印鉴。
 */
export function XPBar({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const snap = useAchievementSnapshot();
  const { snapshot: habit } = useReadingHabitStats();
  const calmDays = Math.max(habit.readDays ?? 0, habit.streakDays ?? 0);
  const sealCount = Object.keys(snap.seals).length;

  return (
    <div className="flex flex-col" style={{ gap: compact ? 10 : 14 }}>
      <div className="flex items-center">
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <span className="text-[22px] font-bold tabular-nums text-[#4F7A54]">{calmDays}</span>
          <span className="text-[11.5px] text-[#75614B] dark:text-[#A99A84]">
            {pickCopy("安静相伴 (天)", "Quiet Days", locale)}
          </span>
        </div>
        <span className="h-8 w-[1px] bg-[#DFD0B8] dark:bg-[#3E3328]" aria-hidden />
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <span className="text-[22px] font-bold tabular-nums text-[#231A12] dark:text-[#EDE2CF]">
            {snap.chaptersReadCount}
          </span>
          <span className="text-[11.5px] text-[#75614B] dark:text-[#A99A84]">
            {pickCopy("已读章节", "Chapters Read", locale)}
          </span>
        </div>
        <span className="h-8 w-[1px] bg-[#DFD0B8] dark:bg-[#3E3328]" aria-hidden />
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <span className="tabular-nums">
            <strong className="text-[22px] font-bold text-[#C1660B]">{sealCount}</strong>
            <span className="text-[12.5px] font-bold text-[#75614B] dark:text-[#A99A84]"> /66</span>
          </span>
          <span className="text-[11.5px] text-[#75614B] dark:text-[#A99A84]">
            {pickCopy("书卷火漆印", "Book Seals", locale)}
          </span>
        </div>
      </div>

      {!compact ? (
        <>
          <div className="h-[0.5px] w-full bg-[#DFD0B8] dark:bg-[#3E3328]" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {PREVIEW_BOOK_IDS.map((bid) => {
                const meta = scriptureBooks.find((b) => b.bookId === bid);
                const key = meta ? sealKeyForBookNumber(meta.bookNumber) : null;
                const lit = snap.seals[bid] != null;
                return key ? (
                  <MedalIcon key={bid} imageKey={key} tier={lit ? 1 : 0} size={38} />
                ) : null;
              })}
            </div>
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#231A12] dark:text-[#EDE2CF]">
              <span>{pickCopy("印鉴墙", "Seals", locale)}</span>
              <span aria-hidden>›</span>
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
