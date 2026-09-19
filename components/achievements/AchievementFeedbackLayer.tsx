"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MedalIcon } from "@/components/achievements/MedalIcon";
import { levelTitleText } from "@/components/achievements/XPBar";
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
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { AppLocale } from "@/lib/i18n/config";

/** 飘字停留时长（iOS：1.1 秒后淡出上移） */
const FLOAT_MS = 1100;
const FLOAT_OUT_MS = 400;
/** 获得提示停留时长（iOS：2.8 秒） */
const TOAST_MS = 2800;

type Floater = { id: number; text: string; big: boolean; leaving: boolean };

/**
 * 成就的即时反馈层（对齐 iOS `XPFloater` + `EarnedToast`）。
 * 两条通道并行：+XP 走顶部飘字（最多叠 3 条），勋章 / 印章 / 升级走羊皮纸提示卡。
 * 事件从 store 队列整段抽干后按类型分流——不要用 ref 记「是否在展示」，
 * React 会重复挂载组件，跨挂载残留的 ref 会把后续事件永久堵住。
 */
export function AchievementFeedbackLayer() {
  const { locale } = useLocale();
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [toasts, setToasts] = useState<AchievementEvent[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    const drain = () => {
      const xp: Floater[] = [];
      const others: AchievementEvent[] = [];
      for (let e = getPendingAchievementEvents()[0]; e; e = getPendingAchievementEvents()[0]) {
        consumeAchievementEvent();
        if (e.kind === "xp") {
          seqRef.current += 1;
          xp.push({
            id: seqRef.current,
            text: `+${e.amount}`,
            big: e.amount >= MEDAL_XP.perChapterRead,
            leaving: false,
          });
        } else if (e.kind !== "chapterRead") {
          others.push(e);
        }
      }
      if (xp.length) setFloaters((cur) => [...cur, ...xp].slice(-3));
      if (others.length) setToasts((cur) => [...cur, ...others].slice(-6));
    };
    drain();
    return subscribeAchievements(drain);
  }, []);

  // 每条飘字各自计时：先标记 leaving 走淡出动画，再移除
  useEffect(() => {
    const live = floaters.find((f) => !f.leaving);
    if (!live) return;
    const out = window.setTimeout(() => {
      setFloaters((cur) => cur.map((f) => (f.id === live.id ? { ...f, leaving: true } : f)));
      window.setTimeout(() => {
        setFloaters((cur) => cur.filter((f) => f.id !== live.id));
      }, FLOAT_OUT_MS);
    }, FLOAT_MS);
    return () => window.clearTimeout(out);
  }, [floaters]);

  const currentToast = toasts[0] ?? null;
  const dropToast = useCallback(() => setToasts((cur) => cur.slice(1)), []);

  useEffect(() => {
    if (!currentToast) return;
    const id = window.setTimeout(dropToast, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [currentToast, dropToast]);

  return (
    <>
      {floaters.length ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-1.5"
          style={{ top: 90 }}
        >
          {floaters.map((f) => (
            <span
              key={f.id}
              className="font-extrabold tabular-nums"
              style={{
                fontSize: f.big ? 22 : 16,
                color: "#FFB101",
                textShadow: "0 1px 4px rgba(0,0,0,0.28)",
                transform: f.leaving ? "translateY(-40px)" : "none",
                opacity: f.leaving ? 0 : 1,
                transition: f.leaving
                  ? `transform ${FLOAT_OUT_MS}ms ease-out, opacity ${FLOAT_OUT_MS}ms ease-out`
                  : "none",
                animation: f.leaving ? undefined : "askbible-xp-pop 350ms cubic-bezier(0.2,1.4,0.4,1)",
              }}
            >
              {f.text}
            </span>
          ))}
          <style>{`@keyframes askbible-xp-pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        </div>
      ) : null}

      {currentToast ? <EarnedToast event={currentToast} locale={locale} onDismiss={dropToast} /> : null}
    </>
  );
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
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top: 8 }}>
      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto flex w-full items-center gap-3 text-left"
        style={{
          maxWidth: 340,
          padding: "10px 14px",
          borderRadius: 16,
          backgroundColor: "#FFFCF5",
          border: "1px solid rgba(255,177,1,0.35)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          animation: "askbible-toast-in 260ms ease-out",
        }}
      >
        {d.image ? (
          <MedalIcon imageKey={d.image} tier={d.tier} tierCount={d.tierCount} size={48} />
        ) : (
          <span
            className="flex shrink-0 items-center justify-center rounded-full font-extrabold"
            style={{ width: 48, height: 48, backgroundColor: "rgba(255,177,1,0.18)", color: "#FFB101", fontSize: 15 }}
          >
            {d.badge}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold" style={{ color: "#2B1D15", fontSize: 16 }}>
            {d.title}
          </span>
          <span className="block" style={{ color: "#7A633A", fontSize: 13 }}>
            {d.subtitle}
          </span>
        </span>
        <style>{`@keyframes askbible-toast-in{from{transform:translateY(-16px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      </button>
    </div>
  );
}

function describe(
  e: AchievementEvent,
  locale: AppLocale,
): { title: string; subtitle: string; image: string | null; tier: number; tierCount: number; badge: string } | null {
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
        badge: "",
      };
    }
    case "seal":
      return {
        title: achCopy("native.sealEarned", locale),
        subtitle: getScriptureBookDisplayName(e.bookId, locale),
        image: sealKeyForBookId(e.bookId),
        tier: 1,
        tierCount: 1,
        badge: "",
      };
    case "levelUp":
      return {
        title: achCopy("native.levelUp", locale, { level: e.level }),
        subtitle: levelTitleText(e.level, locale),
        image: null,
        tier: 0,
        tierCount: 1,
        badge: `Lv.${e.level}`,
      };
    default:
      return null;
  }
}
