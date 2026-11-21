"use client";

import { useCallback, useEffect, useState } from "react";
import { MedalIcon } from "@/components/achievements/MedalIcon";
import { medalCondition, medalText } from "@/components/achievements/achievement-text";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { achCopy } from "@/lib/achievements/achievement-copy";
import { MEDAL_CATALOG, MEDAL_XP } from "@/lib/achievements/medal-catalog";
import {
  consumeAchievementEvent,
  getPendingAchievementEvents,
  sealKeyForBookId,
  subscribeAchievements,
  type AchievementEvent,
} from "@/lib/achievements/achievement-store-web";
import {
  playAchievementCue,
  playAchievementXp,
  prefersReducedMotion,
} from "@/lib/achievements/achievement-feedback-web";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { AppLocale } from "@/lib/i18n/config";

const TOAST_MS = 2800;

/**
 * 去游戏化反馈层（对齐 iOS / Android XPFloater + EarnedToast）：
 * - 静默消化队列里的 xp / streak / levelUp 事件，不再弹出 +XP 飘字或 Lv.X 升级横幅
 * - 读完一章时保留章标题柔和亮金（ab-chapter-done）与一记小钵声
 * - 点亮书卷火漆印或阅读纪念章时展示克制的羊皮纸卡片
 */
export function AchievementFeedbackLayer() {
  const { locale } = useLocale();
  const [toasts, setToasts] = useState<AchievementEvent[]>([]);

  useEffect(() => {
    const drain = () => {
      let hasMilestone = false;
      const others: AchievementEvent[] = [];
      for (let e = getPendingAchievementEvents()[0]; e; e = getPendingAchievementEvents()[0]) {
        consumeAchievementEvent();
        if (e.kind === "xp") {
          if (e.amount >= MEDAL_XP.perChapterRead) hasMilestone = true;
        } else if (e.kind === "streak" || e.kind === "levelUp") {
          // 去游戏化：静默消化连续天数飘字与升级横幅
        } else if (e.kind === "chapterRead") {
          const root = document.documentElement;
          root.classList.remove("ab-chapter-done");
          void root.offsetWidth;
          root.classList.add("ab-chapter-done");
          window.setTimeout(() => root.classList.remove("ab-chapter-done"), 2300);
        } else {
          others.push(e);
        }
      }
      if (hasMilestone) playAchievementXp(true);
      if (others.length) setToasts((cur) => [...cur, ...others].slice(-6));
    };
    drain();
    return subscribeAchievements(drain);
  }, []);

  const currentToast = toasts[0] ?? null;
  const dropToast = useCallback(() => setToasts((cur) => cur.slice(1)), []);

  useEffect(() => {
    if (!currentToast) return;
    playAchievementCue("earn");
    const id = window.setTimeout(dropToast, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [currentToast, dropToast]);

  return currentToast ? (
    <EarnedToast event={currentToast} locale={locale} onDismiss={dropToast} />
  ) : null;
}

function EarnedToast({
  event,
  locale,
  onDismiss,
}: {
  event: AchievementEvent;
  locale: AppLocale;
  onDismiss: () => void;
}) {
  const d = describe(event, locale);
  if (!d) return null;
  const calm = prefersReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top: 10 }}>
      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden text-left"
        style={{
          maxWidth: 340,
          padding: "10px 14px",
          borderRadius: 16,
          backgroundColor: "#FFFCF5",
          border: "1px solid #D8C6AA",
          boxShadow: "0 6px 18px rgba(28,20,16,0.16)",
          animation: calm ? undefined : "askbible-toast-in 260ms ease-out",
        }}
      >
        {d.image ? (
          <MedalIcon imageKey={d.image} tier={d.tier} tierCount={d.tierCount} size={46} />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold" style={{ color: "#231A12", fontSize: 15.5 }}>
            {d.title}
          </span>
          <span className="block" style={{ color: "#75614B", fontSize: 13 }}>
            {d.subtitle}
          </span>
        </span>
        <style>{`@keyframes askbible-toast-in{from{transform:translateY(-14px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      </button>
    </div>
  );
}

function describe(
  e: AchievementEvent,
  locale: AppLocale,
): { title: string; subtitle: string; image: string | null; tier: number; tierCount: number } | null {
  switch (e.kind) {
    case "medal": {
      const def = MEDAL_CATALOG.find((d) => d.key === e.key);
      if (!def) return null;
      const threshold = def.tiers[e.tier - 1] ?? def.tiers[def.tiers.length - 1];
      return {
        title: medalText(def.name, locale),
        subtitle: medalCondition(def.condition, threshold, locale),
        image: def.key,
        tier: e.tier,
        tierCount: def.tiers.length,
      };
    }
    case "seal":
      return {
        title: achCopy("native.sealEarned", locale),
        subtitle: getScriptureBookDisplayName(e.bookId, locale),
        image: sealKeyForBookId(e.bookId),
        tier: 1,
        tierCount: 1,
      };
    default:
      return null;
  }
}
