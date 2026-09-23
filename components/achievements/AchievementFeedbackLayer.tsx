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
import {
  playAchievementCue,
  playAchievementXp,
  prefersReducedMotion,
} from "@/lib/achievements/achievement-feedback-web";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { AppLocale } from "@/lib/i18n/config";

/** 飘字停留时长（iOS：1.1 秒后淡出上移） */
const FLOAT_MS = 1100;
const FLOAT_OUT_MS = 400;
/** 获得提示停留时长（iOS：2.8 秒） */
const TOAST_MS = 2800;

type Floater = {
  id: number;
  text: string;
  big: boolean;
  leaving: boolean;
  /** 连续天数飘字：文案在渲染时按当前语言取，不在抽干事件的 effect 里定——那里的 locale 是旧的 */
  streakDays?: number;
};

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
        } else if (e.kind === "streak") {
          // 连续天数：飘一条字，不弹卡片（Josh 2026-09-20 定的语气）
          seqRef.current += 1;
          xp.push({
            id: seqRef.current,
            text: "",
            big: true,
            leaving: false,
            streakDays: e.days,
          });
        } else if (e.kind === "chapterRead") {
          // 读完这一章：给标题挂 1.85 秒的亮金动画，不弹任何卡片。
          // 事件本来就是从这一章的页面发出来的，不用再核对卷章。
          const root = document.documentElement;
          root.classList.remove("ab-chapter-done");
          // 强制重排，不然同一页连读两章时动画不会重新播
          void root.offsetWidth;
          root.classList.add("ab-chapter-done");
          window.setTimeout(() => root.classList.remove("ab-chapter-done"), 2300);
        } else {
          others.push(e);
        }
      }
      if (xp.length) {
        // 一批只响一次：一次抽干三条 XP 不该连响三下。
        // 只要这批里有一条够里程碑（整章）就出声，否则只给触感。
        playAchievementXp(xp.some((f) => f.big));
        setFloaters((cur) => [...cur, ...xp].slice(-3));
      }
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
    // 声音 + 触感：升级用三声上行钟，勋章 / 卷印用单声钟
    playAchievementCue(currentToast.kind === "levelUp" ? "levelUp" : "earn");
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
                transform: f.leaving ? "translateY(-56px) scale(1.12)" : "none",
                opacity: f.leaving ? 0 : 1,
                transition: f.leaving
                  ? `transform ${FLOAT_OUT_MS}ms ease-out, opacity ${FLOAT_OUT_MS}ms ease-out`
                  : "none",
                animation:
                  f.leaving || prefersReducedMotion()
                    ? undefined
                    : "askbible-xp-pop 420ms cubic-bezier(0.2,1.7,0.35,1)",
              }}
            >
              {f.streakDays != null
                ? achCopy("native.streakDays", locale, { n: f.streakDays })
                : f.text}
            </span>
          ))}
          <style>{`@keyframes askbible-xp-pop{from{transform:scale(.4) translateY(14px);opacity:0}60%{transform:scale(1.14) translateY(-4px);opacity:1}to{transform:scale(1) translateY(0);opacity:1}}`}</style>
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
  const isLevelUp = event.kind === "levelUp";
  const calm = prefersReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top: 8 }}>
      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden text-left"
        style={{
          maxWidth: 340,
          padding: "10px 14px",
          borderRadius: 16,
          backgroundColor: "#FFFCF5",
          border: isLevelUp ? "2px solid #FFB101" : "1px solid rgba(255,177,1,0.35)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          animation: calm
            ? undefined
            : `askbible-toast-in 260ms ease-out${isLevelUp ? ", askbible-toast-pulse 1350ms ease-in-out 260ms infinite alternate" : ""}`,
        }}
      >
        {/* 升级多一道缓慢扫过的金光。不用粒子 —— 粒子是街机语气；
            一道光扫过去像「金箔被光照到」，和羊皮卷 + 烫金是一路的。
            开了「减弱动态效果」就不扫。 */}
        {isLevelUp && !calm ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{
              width: "45%",
              background:
                "linear-gradient(115deg, transparent, rgba(255,255,255,0.22), transparent)",
              animation: "askbible-toast-sweep 620ms ease-in-out 180ms 1",
            }}
          />
        ) : null}
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
        <style>{`
          @keyframes askbible-toast-in{from{transform:translateY(-16px);opacity:0}to{transform:translateY(0);opacity:1}}
          @keyframes askbible-toast-sweep{from{transform:translateX(-120%)}to{transform:translateX(320%)}}
          @keyframes askbible-toast-pulse{from{border-color:rgba(255,177,1,0.18)}to{border-color:rgba(255,177,1,0.95)}}
        `}</style>
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
