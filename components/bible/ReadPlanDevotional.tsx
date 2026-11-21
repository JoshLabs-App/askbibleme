"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";
import {
  SOLID_JOYS_CREDIT_AUTHOR,
  SOLID_JOYS_CREDIT_LINK,
  SOLID_JOYS_CREDIT_TRANSLATION_TW,
  SOLID_JOYS_CREDIT_TRANSLATION_ZH,
  SOLID_JOYS_TITLE_TW,
  SOLID_JOYS_TITLE_ZH,
  dateFromDevotionalKey,
  devotionalAudioUrl,
  devotionalAvailable,
  devotionalBrief,
  devotionalDateLabel,
  devotionalKey,
  devotionalMinutesLabel,
  devotionalMonth,
  groupDevotionalDaysByMonth,
  loadDevotional,
  loadDevotionalDays,
  readDevotionalAuto,
  writeDevotionalAuto,
  type DevotionalDay,
} from "@/lib/devotional/solid-joys";
import { setPlanFlowActive } from "@/lib/read/plan-flow-session";
import { writeReadingPlanAudioSession } from "@/lib/read/reading-plan-audio-session";

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function shiftMdByDays(md: string, delta: number): string {
  const d = dateFromDevotionalKey(md);
  d.setDate(d.getDate() + delta);
  return devotionalKey(d);
}

/** 今日同行页底部的「每日灵修」卡片：直接展示简单标题、经文出处与 3 行内容简要，点击进入全年 12 个月目录与搜索页。 */
export function ReadPlanDevotional({
  viewAhead,
  onOpenCatalog,
}: {
  viewAhead: number;
  onOpenCatalog?: (md: string) => void;
}) {
  const { locale } = useLocale();
  const { isAdmin } = useAskbibleUser();
  const allowed = devotionalAvailable(locale, isAdmin);
  const [on, setOn] = useState(false);
  const [day, setDay] = useState<DevotionalDay>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const shell = useMusicShellPlayback();
  const tw = locale === "zh-TW";

  const targetMd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + viewAhead);
    return devotionalKey(d);
  }, [viewAhead]);

  useEffect(() => setOn(readDevotionalAuto()), []);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const date = new Date();
    date.setDate(date.getDate() + viewAhead);
    setDay(undefined);
    setFailed(false);
    void loadDevotional(locale, date)
      .then((d) => {
        if (!cancelled) {
          setDay(d);
          if (!d) setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, locale, viewAhead, retry]);

  if (!allowed) return null;

  const src = day ? devotionalAudioUrl(day) : null;
  const mine = !!src && shell.effectiveSrc === src;
  const isPlaying = mine && shell.playing;
  const brief = day ? devotionalBrief(day) : "";
  const minsLabel = day ? devotionalMinutesLabel(day.audioSec, tw) : null;

  const handleOpen = () => {
    if (failed && !day) {
      setRetry((n) => n + 1);
      return;
    }
    onOpenCatalog?.(day?.md ?? targetMd);
  };

  return (
    <section
      aria-label={tw ? "每日靈修" : "每日灵修"}
      className="mt-6 rounded-2xl border border-[#DFD0B8] bg-[#FAF5EC]/95 p-4 text-[#231A12] shadow-sm dark:border-[#3A3026] dark:bg-[#221C16]/95 dark:text-[#EDE2CF]"
    >
      <button
        type="button"
        onClick={handleOpen}
        className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13.5px] font-semibold text-[#C1660B] dark:text-[#E2A84B]">
            {tw ? "每日靈修" : "每日灵修"}
            {day ? (
              <span className="font-medium text-[#8B7358] dark:text-[#9E8E78]">
                {` · ${devotionalDateLabel(day.md)}`}
              </span>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-[#C1660B] dark:text-[#E2A84B]">
            <span>{tw ? "全年目錄" : "全年目录"}</span>
            <span aria-hidden>›</span>
          </span>
        </div>

        {day ? (
          <div className="mt-2.5">
            <h2 className="font-serif text-[19px] font-bold leading-snug text-[#231A12] dark:text-[#EDE2CF]">
              {day.title}
            </h2>
            {day.ref ? (
              <p className="mt-1 text-[12.5px] font-semibold text-[#C1660B]/90 dark:text-[#E2A84B]/90">
                {day.ref}
              </p>
            ) : null}
            {brief ? (
              <p className="mt-1.5 line-clamp-3 text-[14.5px] leading-relaxed text-[#4E3B28] dark:text-[#D5C3A8]">
                {brief}
              </p>
            ) : null}
          </div>
        ) : failed ? (
          <p className="mt-2.5 py-1 text-sm text-[#8B7358] dark:text-[#9E8E78]">
            {tw ? "靈修沒有載入，點這裡重試" : "灵修没有载入，点这里重试"}
          </p>
        ) : (
          <p className="mt-2.5 py-1 text-sm text-[#8B7358] dark:text-[#9E8E78]">
            {tw ? "正在準備每日靈修…" : "正在准备每日灵修…"}
          </p>
        )}
      </button>

      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[#E6D9C3] pt-3 dark:border-[#362C22]">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-[13.5px] font-medium text-[#75614B] dark:text-[#A99A84]">
          <input
            type="checkbox"
            role="switch"
            aria-label={tw ? "讀經後接著聽" : "读经后接着听"}
            checked={on}
            onChange={(e) => {
              setOn(e.target.checked);
              writeDevotionalAuto(e.target.checked);
            }}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-5 w-9 shrink-0 rounded-full bg-stone-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[#C1660B] peer-checked:after:translate-x-4 dark:bg-stone-700 dark:peer-checked:bg-[#D97707]"
          />
          <span>{tw ? "讀經後接著聽" : "读经后接着听"}</span>
        </label>

        {day && src ? (
          <button
            type="button"
            aria-pressed={isPlaying}
            onClick={() => {
              if (isPlaying) {
                shell.pausePlayback();
                return;
              }
              setPlanFlowActive(false);
              writeReadingPlanAudioSession(null);
              shell.setPlaybackSrc(src, { autoPlay: true });
            }}
            className={[
              "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.98]",
              isPlaying
                ? "border-transparent bg-[#C1660B] text-[#FFFBF4] dark:bg-[#D97707]"
                : "border-[#C1660B]/35 bg-[#C1660B]/15 text-[#C1660B] hover:bg-[#C1660B]/20 dark:border-[#E2A84B]/35 dark:bg-[#E2A84B]/15 dark:text-[#E2A84B]",
            ].join(" ")}
          >
            {isPlaying ? (
              <>
                <IconPause className="h-3.5 w-3.5" />
                <span>{tw ? "正在播放" : "正在播放"}</span>
              </>
            ) : (
              <>
                <IconPlay className="h-3.5 w-3.5 translate-x-[0.5px]" />
                <span>
                  {minsLabel
                    ? `${tw ? "收聽" : "收听"} · ${minsLabel}`
                    : tw
                      ? "收聽"
                      : "收听"}
                </span>
              </>
            )}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** 每日灵修全页目录与收听页：置顶当前选定篇 + 搜索框 + 1–12 月分类筛选 + 每日标题与简要列表（点选任意一天来听/读）。 */
export function ReadPlanDevotionalCatalog({
  initialMd,
  onBack,
}: {
  initialMd: string;
  onBack: () => void;
}) {
  const { locale } = useLocale();
  const shell = useMusicShellPlayback();
  const tw = locale === "zh-TW";
  const topAnchorRef = useRef<HTMLDivElement | null>(null);
  const activeMonthPillRef = useRef<HTMLButtonElement | null>(null);

  const [days, setDays] = useState<DevotionalDay[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedMd, setSelectedMd] = useState(initialMd);
  const [selectedMonth, setSelectedMonth] = useState(() => devotionalMonth(initialMd));
  const [query, setQuery] = useState("");
  const [articleExpanded, setArticleExpanded] = useState(false);

  const scrollToTopCard = useCallback(() => {
    topAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    setSelectedMd(initialMd);
    setSelectedMonth(devotionalMonth(initialMd));
  }, [initialMd]);

  useEffect(() => {
    activeMonthPillRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
    });
  }, [selectedMonth, days.length]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void loadDevotionalDays(locale)
      .then((list) => {
        if (!cancelled) setDays(list);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, retry]);

  const byKey = useMemo(() => {
    const map = new Map<string, DevotionalDay>();
    for (const d of days) map.set(d.md, d);
    return map;
  }, [days]);

  const todayMd = useMemo(() => devotionalKey(new Date()), []);
  const selectedDay = byKey.get(selectedMd) ?? days[0];
  const trimmedQuery = query.trim();

  const filteredGroups = useMemo(
    () =>
      groupDevotionalDaysByMonth(days, {
        month: selectedMonth,
        query: trimmedQuery,
      }),
    [days, selectedMonth, trimmedQuery],
  );

  const totalHitCount = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.items.length, 0),
    [filteredGroups],
  );

  const playDay = useCallback(
    (item: DevotionalDay) => {
      const src = devotionalAudioUrl(item);
      if (!src) return;
      const mine = shell.effectiveSrc === src;
      if (mine && shell.playing) {
        shell.pausePlayback();
        return;
      }
      setPlanFlowActive(false);
      writeReadingPlanAudioSession(null);
      shell.setPlaybackSrc(src, { autoPlay: true });
    },
    [shell],
  );

  const selectedSrc = selectedDay ? devotionalAudioUrl(selectedDay) : null;
  const selectedMine = !!selectedSrc && shell.effectiveSrc === selectedSrc;
  const selectedPlaying = selectedMine && shell.playing;
  const selectedTotalSec =
    selectedMine && shell.durationSec > 0
      ? shell.durationSec
      : selectedDay?.audioSec ?? 0;
  const selectedPosSec = selectedMine
    ? Math.min(shell.currentSec, Math.max(selectedTotalSec, shell.currentSec))
    : 0;

  return (
    <div className="read-plan-play-screen relative flex min-h-0 flex-1 flex-col">
      <div className="read-plan-play-screen__scroll mx-auto w-full max-w-[460px] flex-1 overflow-y-auto px-4 pb-12 pt-[calc(env(safe-area-inset-top,0px)+0.85rem)]">
        <div ref={topAnchorRef} />

        {/* 顶栏 */}
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label={tw ? "返回今日同行" : "返回今日同行"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[22px] font-semibold text-[#231A12] hover:bg-[#231A12]/5 dark:text-[#EDE2CF] dark:hover:bg-white/5"
            >
              ‹
            </button>
            <div className="min-w-0">
              <h1 className="font-serif text-[21px] font-bold leading-tight text-[#231A12] dark:text-[#EDE2CF]">
                {tw ? "每日靈修" : "每日灵修"}
              </h1>
              <p className="truncate text-[12px] text-[#75614B] dark:text-[#A99A84]">
                {tw ? `${SOLID_JOYS_TITLE_TW} · 全年 365 篇` : `${SOLID_JOYS_TITLE_ZH} · 全年 365 篇`}
              </p>
            </div>
          </div>

          {selectedMd !== todayMd ? (
            <button
              type="button"
              onClick={() => {
                setSelectedMd(todayMd);
                setSelectedMonth(devotionalMonth(todayMd));
                scrollToTopCard();
              }}
              className="shrink-0 rounded-full bg-[#C1660B]/15 px-3 py-1.5 text-[12.5px] font-semibold text-[#C1660B] dark:bg-[#E2A84B]/15 dark:text-[#E2A84B]"
            >
              {tw ? "回到今日" : "回到今日"}
            </button>
          ) : null}
        </header>

        {days.length === 0 ? (
          <div className="py-16 text-center">
            {failed ? (
              <div className="space-y-3">
                <p className="text-sm text-[#75614B] dark:text-[#A99A84]">
                  {tw ? "靈修內容未能載入，請檢查網路後重試" : "灵修内容未能载入，请检查网络后重试"}
                </p>
                <button
                  type="button"
                  onClick={() => setRetry((n) => n + 1)}
                  className="rounded-full bg-[#C1660B] px-5 py-2 text-sm font-semibold text-[#FFFBF4] dark:bg-[#D97707]"
                >
                  {tw ? "點這裡重試" : "点这里重试"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-[#75614B] dark:text-[#A99A84]">
                {tw ? "正在準備全年靈修目錄…" : "正在准备全年灵修目录…"}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* 置顶当前选定篇卡片 */}
            {selectedDay ? (
              <section className="rounded-2xl border border-[#C1660B]/45 bg-[#FAF5EC] p-4 shadow-sm dark:border-[#E2A84B]/40 dark:bg-[#241E18]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={tw ? "前一天" : "前一天"}
                      onClick={() => setSelectedMd((prev) => shiftMdByDays(prev, -1))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-[#231A12]/5 text-[16px] font-bold text-[#75614B] dark:bg-white/10 dark:text-[#A99A84]"
                    >
                      ‹
                    </button>
                    <span className="text-[14px] font-bold text-[#C1660B] dark:text-[#E2A84B]">
                      {devotionalDateLabel(selectedDay.md)}
                    </span>
                    <button
                      type="button"
                      aria-label={tw ? "後一天" : "后一天"}
                      onClick={() => setSelectedMd((prev) => shiftMdByDays(prev, 1))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-[#231A12]/5 text-[16px] font-bold text-[#75614B] dark:bg-white/10 dark:text-[#A99A84]"
                    >
                      ›
                    </button>
                  </div>

                  {selectedDay.ref ? (
                    selectedDay.refBook && selectedDay.refChapter ? (
                      <Link
                        href={`/read/${encodeURIComponent(selectedDay.refBook)}/${selectedDay.refChapter}`}
                        className="truncate text-[13px] font-semibold text-[#C1660B] no-underline hover:underline dark:text-[#E2A84B]"
                      >
                        （{selectedDay.ref}）
                      </Link>
                    ) : (
                      <span className="truncate text-[13px] font-medium text-[#75614B] dark:text-[#A99A84]">
                        （{selectedDay.ref}）
                      </span>
                    )
                  ) : null}
                </div>

                <h2 className="mt-2.5 font-serif text-[21px] font-bold leading-snug text-[#231A12] dark:text-[#EDE2CF]">
                  {selectedDay.title}
                </h2>

                {/* 朗读控制条 */}
                {selectedSrc ? (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#DFD0B8] bg-[#F4EBDC]/85 px-3 py-2.5 dark:border-[#3A3026] dark:bg-[#1C1712]/85">
                    <button
                      type="button"
                      aria-label={selectedPlaying ? (tw ? "暫停朗讀" : "暂停朗读") : (tw ? "播放朗讀" : "播放朗读")}
                      onClick={() => playDay(selectedDay)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-[#241F1B] text-[#F5EFE4] transition active:scale-95"
                    >
                      {selectedPlaying ? (
                        <IconPause className="h-4 w-4" />
                      ) : (
                        <IconPlay className="h-4 w-4 translate-x-[0.5px]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="font-semibold text-[#231A12] dark:text-[#EDE2CF]">
                          {tw ? "靈修朗讀" : "灵修朗读"}
                        </span>
                        <span className="tabular-nums text-[#75614B] dark:text-[#A99A84]">
                          {formatClock(selectedPosSec)} /{" "}
                          {selectedTotalSec > 0 ? formatClock(selectedTotalSec) : "--:--"}
                        </span>
                      </div>
                      {selectedMine && shell.durationSec > 0 ? (
                        <input
                          aria-label={tw ? "播放進度" : "播放进度"}
                          type="range"
                          min={0}
                          max={shell.durationSec}
                          step={1}
                          value={Math.min(shell.currentSec, shell.durationSec)}
                          onChange={(e) =>
                            shell.seekRatio(Number(e.target.value) / shell.durationSec)
                          }
                          className="mt-1.5 h-1.5 w-full cursor-pointer accent-[#C1660B] dark:accent-[#E2A84B]"
                        />
                      ) : (
                        <div className="mt-2 h-1.5 w-full rounded-full bg-[#231A12]/10 dark:bg-white/15" />
                      )}
                    </div>
                  </div>
                ) : null}

                {articleExpanded ? (
                  <div className="mt-4 space-y-3.5 text-[16px] leading-[1.78] text-[#2F241A] dark:text-[#DDD0BC]">
                    {selectedDay.verse ? (
                      <blockquote className="border-l-[3px] border-[#C1660B]/55 pl-3.5 text-[15.5px] leading-relaxed text-[#231A12] dark:border-[#E2A84B]/55 dark:text-[#EDE2CF]">
                        <p>{selectedDay.verse}</p>
                        {selectedDay.ref ? (
                          <p className="mt-1.5 text-[13px] font-semibold text-[#C1660B] dark:text-[#E2A84B]">
                            — {selectedDay.ref}
                          </p>
                        ) : null}
                      </blockquote>
                    ) : null}
                    {selectedDay.paragraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 line-clamp-2 text-[14.5px] leading-relaxed text-[#4E3B28] dark:text-[#D5C3A8]">
                    {devotionalBrief(selectedDay)}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setArticleExpanded((prev) => !prev)}
                  className="mt-2.5 flex w-full items-center justify-center gap-1 border-0 bg-transparent py-1.5 text-[13.5px] font-semibold text-[#C1660B] dark:text-[#E2A84B]"
                >
                  <span>
                    {articleExpanded
                      ? tw
                        ? "收起全文"
                        : "收起全文"
                      : tw
                        ? "展開閱讀全文"
                        : "展开阅读全文"}
                  </span>
                  <span className="text-[11px]">{articleExpanded ? "▴" : "▾"}</span>
                </button>
              </section>
            ) : null}

            {/* 搜索栏 */}
            <div className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-[#D8C6AA] bg-[#FAF5EC] px-3 dark:border-[#3E3328] dark:bg-[#221C16]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-[#8B7358] dark:text-[#9E8E78]"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16.2" y2="16.2" />
              </svg>
              <input
                type="text"
                inputMode="search"
                aria-label={tw ? "搜尋靈修" : "搜索灵修"}
                value={query}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  if (next.trim() && selectedMonth !== 0) {
                    setSelectedMonth(0);
                  }
                }}
                placeholder={
                  tw
                    ? "搜尋標題、內容簡要或經文（如：恩典、詩篇）…"
                    : "搜索标题、内容简要或经文（如：恩典、诗篇）…"
                }
                className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-[#231A12] outline-none placeholder:text-[#9B856B] dark:text-[#EDE2CF] dark:placeholder:text-[#867764]"
              />
              {query ? (
                <button
                  type="button"
                  aria-label={tw ? "清空搜尋" : "清空搜索"}
                  onClick={() => {
                    setQuery("");
                    setSelectedMonth(devotionalMonth(selectedMd));
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent text-[17px] text-[#8B7358] dark:text-[#9E8E78]"
                >
                  ×
                </button>
              ) : null}
            </div>

            {/* 1–12 月分类胶囊条 */}
            <div
              role="tablist"
              aria-label={tw ? "月份分類" : "月份分类"}
              className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                const active = selectedMonth === m;
                const label = m === 0 ? (tw ? "全部" : "全部") : `${m}月`;
                return (
                  <button
                    key={m}
                    ref={active ? activeMonthPillRef : undefined}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedMonth(m)}
                    className={[
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition",
                      active
                        ? "border-transparent bg-[#C1660B] font-bold text-[#FFFBF4] dark:bg-[#D97707]"
                        : "border-[#DFD0B8] bg-[#FAF5EC]/90 font-medium text-[#3C2E20] hover:bg-[#F3E9D8] dark:border-[#3A3026] dark:bg-[#221C16] dark:text-[#D5C3A8]",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {trimmedQuery ? (
              <p className="mt-2.5 text-[12.5px] font-medium text-[#8B7358] dark:text-[#9E8E78]">
                {tw ? `共找到 ${totalHitCount} 篇靈修` : `共找到 ${totalHitCount} 篇灵修`}
              </p>
            ) : null}

            {/* 按月分类列表 */}
            {filteredGroups.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[15px] font-semibold text-[#231A12] dark:text-[#EDE2CF]">
                  {tw ? "沒有找到匹配的靈修篇目" : "没有找到匹配的灵修篇目"}
                </p>
                <p className="mt-1 text-[13px] text-[#8B7358] dark:text-[#9E8E78]">
                  {tw
                    ? "試試搜尋「恩典」「平安」「信心」或切換上方月份"
                    : "试试搜索「恩典」「平安」「信心」或切换上方月份"}
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-5">
                {filteredGroups.map((group) => (
                  <section key={group.month}>
                    <div className="mb-2 flex items-baseline gap-1.5">
                      <h3 className="font-serif text-[16.5px] font-bold text-[#231A12] dark:text-[#EDE2CF]">
                        {group.month}月
                      </h3>
                      <span className="text-[12.5px] font-medium text-[#8B7358] dark:text-[#9E8E78]">
                        · {group.items.length} 篇
                      </span>
                    </div>

                    <ul className="space-y-2">
                      {group.items.map((item) => {
                        const isSelected = selectedDay?.md === item.md;
                        const itemSrc = devotionalAudioUrl(item);
                        const isPlayingThis =
                          !!itemSrc && shell.effectiveSrc === itemSrc && shell.playing;
                        const snippet = devotionalBrief(item, trimmedQuery);
                        const mins = devotionalMinutesLabel(item.audioSec, tw);

                        return (
                          <li key={item.md}>
                            <div
                              className={[
                                "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition",
                                isSelected
                                  ? "border-[#C1660B]/50 bg-[#FBF6EC] shadow-sm dark:border-[#E2A84B]/45 dark:bg-[#282119]"
                                  : "border-[#E3D5BE] bg-[#FAF5EC]/80 hover:bg-[#FAF5EC] dark:border-[#362C22] dark:bg-[#211B15]/85",
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMd(item.md);
                                  setArticleExpanded(true);
                                  scrollToTopCard();
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                              >
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px]">
                                  <span
                                    className={
                                      isSelected
                                        ? "font-bold text-[#C1660B] dark:text-[#E2A84B]"
                                        : "font-bold text-[#75614B] dark:text-[#A99A84]"
                                    }
                                  >
                                    {devotionalDateLabel(item.md)}
                                  </span>
                                  {item.ref ? (
                                    <span className="font-medium text-[#75614B] dark:text-[#A99A84]">
                                      · {item.ref}
                                    </span>
                                  ) : null}
                                  {mins ? (
                                    <span className="text-[11.5px] text-[#9B856B] dark:text-[#867764]">
                                      · {mins}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-1 truncate font-serif text-[16.5px] font-bold text-[#231A12] dark:text-[#EDE2CF]">
                                  {item.title}
                                </div>

                                {snippet ? (
                                  <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-[#6E5A44] dark:text-[#B8A790]">
                                    {snippet}
                                  </p>
                                ) : null}
                              </button>

                              {itemSrc ? (
                                <button
                                  type="button"
                                  aria-label={
                                    isPlayingThis
                                      ? `${tw ? "暫停" : "暂停"} ${devotionalDateLabel(item.md)}`
                                      : `${tw ? "收聽" : "收听"} ${devotionalDateLabel(item.md)}`
                                  }
                                  aria-pressed={isPlayingThis}
                                  onClick={() => {
                                    setSelectedMd(item.md);
                                    playDay(item);
                                  }}
                                  className={[
                                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95",
                                    isPlayingThis
                                      ? "border-transparent bg-[#C1660B] text-[#FFFBF4] dark:bg-[#E2A84B] dark:text-[#1A1511]"
                                      : "border-[#C1660B]/25 bg-[#C1660B]/15 text-[#C1660B] hover:bg-[#C1660B]/20 dark:border-[#E2A84B]/25 dark:bg-[#E2A84B]/15 dark:text-[#E2A84B]",
                                  ].join(" ")}
                                >
                                  {isPlayingThis ? (
                                    <IconPause className="h-4 w-4" />
                                  ) : (
                                    <IconPlay className="h-4 w-4 translate-x-[0.5px]" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {/* 版权署名块（授权必留，14px 清楚可读） */}
            <footer className="mt-7 border-t border-[#DFD0B8] pt-4 text-[14px] leading-relaxed text-[#75614B] dark:border-[#3A3026] dark:text-[#A99A84]">
              <p>
                {tw ? "原作：" : "原作："}
                {SOLID_JOYS_CREDIT_AUTHOR}
              </p>
              <p>
                {tw
                  ? `譯文與音頻：${SOLID_JOYS_CREDIT_TRANSLATION_TW}`
                  : `译文与音频：${SOLID_JOYS_CREDIT_TRANSLATION_ZH}`}
              </p>
              <a
                href={SOLID_JOYS_CREDIT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#C1660B] underline dark:text-[#E2A84B]"
              >
                befaithful.net
              </a>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/** 今日同行页底部灵修播放坞（对齐 Android/iOS `DevotionalDock`，实底羊皮色避免底字透出）。 */
export function ReadDevotionalPlaybackDock({
  md,
  onOpen,
}: {
  md: string;
  onOpen: (md: string) => void;
}) {
  const { locale } = useLocale();
  const shell = useMusicShellPlayback();
  const tw = locale === "zh-TW";
  const [day, setDay] = useState<DevotionalDay>();

  useEffect(() => {
    let cancelled = false;
    void loadDevotionalDays(locale)
      .then((list) => {
        if (!cancelled) {
          setDay(list.find((d) => d.md === md));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale, md]);

  const src = day ? devotionalAudioUrl(day) : null;

  return (
    <div className="pointer-events-auto w-full max-w-[440px] rounded-2xl border border-[#DFD0B8] bg-[#FAF5EC] px-4 py-3 shadow-[0_6px_22px_rgba(24,16,10,0.14)] dark:border-[#3A3026] dark:bg-[#221C16] dark:shadow-[0_8px_26px_rgba(0,0,0,0.42)]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(md)}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
        >
          <div className="text-[12px] text-[#75614B] dark:text-[#A99A84]">
            {tw ? SOLID_JOYS_TITLE_TW : SOLID_JOYS_TITLE_ZH}
          </div>
          <div className="truncate text-[15px] font-semibold text-[#231A12] dark:text-[#EDE2CF]">
            {day ? `${devotionalDateLabel(day.md)} · ${day.title}` : devotionalDateLabel(md)}
          </div>
        </button>

        <button
          type="button"
          aria-label={tw ? "關閉靈修播放" : "关闭灵修播放"}
          onClick={() => {
            shell.pausePlayback();
            shell.setPlaybackSrc(null);
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-[18px] text-[#75614B] hover:bg-[#231A12]/5 dark:text-[#A99A84]"
        >
          ×
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {shell.durationSec > 0 ? (
            <input
              aria-label={tw ? "播放進度" : "播放进度"}
              type="range"
              min={0}
              max={shell.durationSec}
              step={1}
              value={Math.min(shell.currentSec, shell.durationSec)}
              onChange={(e) => shell.seekRatio(Number(e.target.value) / shell.durationSec)}
              className="h-1.5 w-full cursor-pointer accent-[#C1660B] dark:accent-[#E2A84B]"
            />
          ) : (
            <div className="h-1.5 w-full rounded-full bg-[#231A12]/10 dark:bg-white/15" />
          )}
          <div className="mt-0.5 flex justify-between text-[11.5px] tabular-nums text-[#8B7358] dark:text-[#9E8E78]">
            <span>{formatClock(shell.currentSec)}</span>
            <span>{shell.durationSec > 0 ? formatClock(shell.durationSec) : "--:--"}</span>
          </div>
        </div>

        <button
          type="button"
          aria-label={shell.playing ? (tw ? "暫停" : "暂停") : (tw ? "播放" : "播放")}
          onClick={() => {
            if (shell.playing) {
              shell.pausePlayback();
            } else if (src) {
              shell.setPlaybackSrc(src, { autoPlay: true });
            }
          }}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-[#241F1B] text-[#F5EFE4] transition active:scale-95"
        >
          {shell.playing ? (
            <IconPause className="h-4 w-4" />
          ) : (
            <IconPlay className="h-4 w-4 translate-x-[0.5px]" />
          )}
        </button>
      </div>
    </div>
  );
}
