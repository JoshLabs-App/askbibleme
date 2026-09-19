"use client";

import { useEffect, useState } from "react";
import { medalText, pickLocaleText } from "@/components/achievements/achievement-text";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MEDAL_CATALOG, MedalLevels, medalImageUrl } from "@/lib/achievements/medal-catalog";
import {
  consumeAchievementEvent,
  getPendingAchievementEvents,
  sealKeyForBookId,
  subscribeAchievements,
  type AchievementEvent,
} from "@/lib/achievements/achievement-store-web";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";

const XP_MS = 1400;
const TOAST_MS = 2600;

/**
 * 成就的即时反馈层（对齐原生 `XPFloater` / `EarnedToast`）：
 * 队列里一次消费一条，+XP 走短飘字，勋章 / 印章 / 升级走稍长的横幅。
 * 挂在壳层上，任何页面得到 XP 都看得见。
 */
export function AchievementFeedbackLayer() {
  const { locale } = useLocale();
  const [queue, setQueue] = useState<AchievementEvent[]>([]);
  const current = queue[0] ?? null;

  /**
   * 订阅 store，把队列整段抽干到组件自己的 state 里再依次展示。
   * 不用 ref 记「当前是否在展示」：React 会重复挂载（StrictMode 下必然），
   * 跨挂载残留的 ref 会把后面的事件永久堵住。
   */
  useEffect(() => {
    const renderable = (e: AchievementEvent) =>
      e.kind === "xp" || e.kind === "medal" || e.kind === "seal" || e.kind === "levelUp";
    const drain = () => {
      const taken: AchievementEvent[] = [];
      for (let e = getPendingAchievementEvents()[0]; e; e = getPendingAchievementEvents()[0]) {
        consumeAchievementEvent();
        if (renderable(e)) taken.push(e);
      }
      if (taken.length) setQueue((q) => [...q, ...taken].slice(-12));
    };
    drain();
    return subscribeAchievements(drain);
  }, []);

  useEffect(() => {
    if (!current) return;
    const ms = current.kind === "xp" ? XP_MS : TOAST_MS;
    const id = window.setTimeout(() => setQueue((q) => q.slice(1)), ms);
    return () => window.clearTimeout(id);
  }, [current]);

  if (!current) return null;

  if (current.kind === "xp") {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[18%] z-[60] flex justify-center">
        <span className="rounded-full bg-black/55 px-3 py-1 text-sm font-semibold tabular-nums text-amber-200 shadow-lg">
          +{current.amount.toLocaleString()} XP
        </span>
      </div>
    );
  }

  const toast = toastContent(current, locale);
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[12%] z-[60] flex justify-center px-4">
      <div className="flex max-w-sm items-center gap-3 rounded-2xl bg-[#1c1410]/80 px-4 py-2.5 text-white shadow-xl backdrop-blur-sm">
        {toast.image ? (
          <img src={toast.image} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
        ) : null}
        <div className="min-w-0">
          <div className="text-[11px] text-white/65">{toast.kicker}</div>
          <div className="truncate text-sm font-semibold">{toast.title}</div>
        </div>
      </div>
    </div>
  );
}

function toastContent(
  e: AchievementEvent,
  locale: string,
): { kicker: string; title: string; image: string | null } | null {
  switch (e.kind) {
    case "medal": {
      const def = MEDAL_CATALOG.find((d) => d.key === e.key);
      if (!def) return null;
      return {
        kicker: pickLocaleText("获得勋章", "Medal earned", locale),
        title:
          medalText(def.name, locale) + (def.tiers.length > 1 ? ` · ${e.tier}` : ""),
        image: medalImageUrl(def.key),
      };
    }
    case "seal": {
      const key = sealKeyForBookId(e.bookId);
      return {
        kicker: pickLocaleText("书卷读完", "Book finished", locale),
        title: getScriptureBookDisplayName(e.bookId, locale as never),
        image: key ? medalImageUrl(key) : null,
      };
    }
    case "levelUp": {
      const title = MedalLevels.title(e.level);
      return {
        kicker: pickLocaleText("升级", "Level up", locale),
        title: `Lv.${e.level} · ${pickLocaleText(title.zh, title.en, locale)}`,
        image: null,
      };
    }
    default:
      return null;
  }
}
