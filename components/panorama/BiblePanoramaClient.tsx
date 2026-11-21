"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import panoramaJson from "@/data/bible/panorama.json";
import {
  BIBLE_PANORAMA_ACTS,
  findPanoramaLocation,
  PANORAMA_READING_GUIDE,
  type PanoramaSpan,
} from "@/lib/bible/bible-panorama";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { readLastReadPosition, type ReadLastPosition } from "@/lib/read/read-last-position";

type BookIntro = { zh: string; en: string; references: string };
const BOOK_INTRODUCTIONS = panoramaJson.introductions as Record<string, BookIntro | undefined>;

const ACT_NUMERALS_ZH = ["壹", "贰", "叁", "肆", "伍", "陆"];
const chaptersById = new Map(scriptureBooks.map((b) => [b.bookId, b.chapters]));

function pickCopy(zh: string, en: string, locale: string): string {
  if (locale === "en") return en;
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}

function ActLineArt({ actIndex }: { actIndex: number }) {
  return (
    <svg
      width="62"
      height="66"
      viewBox="0 0 64 68"
      fill="none"
      stroke="#C1660B"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {actIndex === 0 ? (
        <>
          <line x1="8" y1="58" x2="56" y2="58" />
          <line x1="32" y1="58" x2="32" y2="30" />
          <circle cx="32" cy="24" r="11" />
          <circle cx="24" cy="28" r="8" />
          <circle cx="40" cy="28" r="8" />
        </>
      ) : actIndex === 1 ? (
        <>
          <path d="M16 54 L28 24 L36 38 L48 18" />
          <line x1="10" y1="58" x2="54" y2="58" />
        </>
      ) : actIndex === 2 ? (
        <>
          <path d="M10 54 Q32 20 54 54" />
          <circle cx="32" cy="18" r="4" />
          <circle cx="20" cy="24" r="2.5" />
          <circle cx="44" cy="24" r="2.5" />
        </>
      ) : actIndex === 3 ? (
        <>
          <line x1="32" y1="12" x2="32" y2="56" />
          <line x1="18" y1="26" x2="46" y2="26" />
          <path d="M12 56 Q32 48 52 56" />
        </>
      ) : actIndex === 4 ? (
        <>
          <circle cx="32" cy="34" r="18" />
          <path d="M14 34 H50 M32 16 C25 24 25 44 32 52 M32 16 C39 24 39 44 32 52" />
        </>
      ) : (
        <>
          <circle cx="32" cy="28" r="12" />
          <path d="M10 54 C20 46 44 46 54 54" />
          <path d="M16 60 C26 54 38 54 48 60" />
        </>
      )}
    </svg>
  );
}

/**
 * 网页端「救赎全景」灵修画卷 + 66 卷逐卷简介合璧版（对齐 iOS BiblePanoramaView / Android BiblePanoramaScreen）：
 * 置顶「✦ 你正在这一幕」定位卡 + 66 卷速查 + 纵向金线六幕时间轴 + 每一卷书在写什么（66 卷核心主旨简介与选章直达）。
 */
export function BiblePanoramaClient() {
  const { locale } = useLocale();
  const [lastPos, setLastPos] = useState<ReadLastPosition | null>(null);
  const [activeAct, setActiveAct] = useState<number>(0);
  const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderQuery, setFinderQuery] = useState("");

  useEffect(() => {
    const pos = readLastReadPosition();
    setLastPos(pos);
    if (pos) {
      const loc = findPanoramaLocation(pos.bookId, pos.chapter);
      if (loc) setActiveAct(loc.actIndex);
    }
  }, []);

  const currentBookId = lastPos?.bookId ?? "GEN";
  const currentChapter = lastPos?.chapter ?? 1;
  const heroLoc = findPanoramaLocation(currentBookId, currentChapter);
  const heroActIdx = heroLoc?.actIndex ?? 0;
  const heroAct = BIBLE_PANORAMA_ACTS[heroActIdx] ?? BIBLE_PANORAMA_ACTS[0]!;
  const heroSection = heroLoc?.section ?? heroAct.sections[0]!;
  const currentBookName = getScriptureBookDisplayName(currentBookId, locale);

  const filteredBooks = useMemo(() => {
    const q = finderQuery.trim().toLowerCase();
    if (!q) return scriptureBooks;
    return scriptureBooks.filter((b) => {
      const displayName = getScriptureBookDisplayName(b.bookId, locale).toLowerCase();
      const intro = BOOK_INTRODUCTIONS[b.bookId];
      return (
        displayName.includes(q) ||
        b.bookId.toLowerCase().includes(q) ||
        (intro?.zh.toLowerCase().includes(q) ?? false) ||
        (intro?.en.toLowerCase().includes(q) ?? false)
      );
    });
  }, [finderQuery, locale]);

  return (
    <div className="mx-auto w-full max-w-[480px] px-5 pb-28 pt-5 text-[#231A12] dark:text-[#EDE2CF]">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[28px] font-bold tracking-tight">
            {pickCopy("救赎全景", "Redemption Story", locale)}
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[#75614B] dark:text-[#A99A84]">
            {pickCopy(
              "在完整的救赎故事中，读懂每一卷书在写什么",
              "Understand what every book of Scripture is about within one redemptive story",
              locale,
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFinderQuery("");
            setFinderOpen(true);
          }}
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#D8C6AA] bg-[#FAF5EC]/90 px-3 py-1.5 text-[12.5px] font-semibold text-[#C1660B] shadow-sm transition hover:bg-[#F3E9D8] dark:border-[#3E3328] dark:bg-[#262019]/90 dark:text-[#FFC845]"
        >
          <span>{pickCopy("书卷速查", "66 Books", locale)}</span>
        </button>
      </header>

      {/* 置顶：你正在这一幕 */}
      <section className="mb-6 rounded-[20px] border border-[#D8C6AA] bg-[#FAF5EC]/90 p-4 shadow-sm dark:border-[#3E3328] dark:bg-[#262019]/90">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-full bg-[#C1660B] px-2.5 py-1 text-[11.5px] font-semibold text-[#FFFBF4]">
              {pickCopy(`✦ 你正在这一幕 · 第 ${heroActIdx + 1} 幕`, `✦ You are here · Act ${heroActIdx + 1}`, locale)}
            </span>
            <h2 className="mt-2.5 text-[20px] font-bold leading-snug">
              {pickCopy(heroAct.zh, heroAct.en, locale)} · {pickCopy(heroSection.zh, heroSection.en, locale)}
            </h2>
            <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-[#75614B] dark:text-[#A99A84]">
              {pickCopy(heroSection.summaryZh, heroSection.summaryEn, locale)}
            </p>
          </div>
          <ActLineArt actIndex={heroActIdx} />
        </div>

        <Link
          href={`/read/${encodeURIComponent(currentBookId)}/${currentChapter}`}
          className="mt-3.5 flex h-11 w-full items-center justify-between rounded-xl bg-[#C1660B] px-4 text-[14.5px] font-semibold text-[#FFFBF4] no-underline transition hover:opacity-95"
        >
          <span className="truncate">
            {lastPos
              ? pickCopy(
                  `接着阅读 · ${currentBookName} 第 ${currentChapter} 章`,
                  `Continue · ${currentBookName} ${currentChapter}`,
                  locale,
                )
              : pickCopy("从起初进入 · 创世记 第 1 章", "Begin from Genesis 1", locale)}
          </span>
          <span aria-hidden>›</span>
        </Link>
      </section>

      {/* 纵向金线六幕时间轴 */}
      <div className="space-y-3">
        {BIBLE_PANORAMA_ACTS.map((act, index) => {
          const expanded = activeAct === index;
          const badge = locale === "en" ? String(index + 1) : (ACT_NUMERALS_ZH[index] ?? String(index + 1));
          return (
            <div key={act.en} className="relative flex items-start gap-3">
              {index < BIBLE_PANORAMA_ACTS.length - 1 ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-[-14px] left-[5px] top-6 w-[1.5px] bg-[#C1660B]/35"
                />
              ) : null}
              <span
                aria-hidden
                className={[
                  "mt-4 h-[11px] w-[11px] shrink-0 rounded-full",
                  expanded
                    ? "bg-[#C1660B]"
                    : "border-[1.6px] border-[#C1660B] bg-[#EFE4D1] dark:bg-[#1C1712]",
                ].join(" ")}
              />

              <div
                className={[
                  "min-w-0 flex-1 rounded-2xl border transition",
                  expanded
                    ? "border-[#C1660B]/45 bg-[#FAF5EC]/95 dark:bg-[#262019]"
                    : "border-[#DFD0B8] bg-[#FAF5EC]/65 dark:border-[#3A3025] dark:bg-[#262019]/65",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => setActiveAct(expanded ? -1 : index)}
                  className="flex w-full items-center gap-2.5 border-0 bg-transparent px-3.5 py-3.5 text-left text-inherit"
                >
                  <span
                    className={[
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold",
                      expanded ? "bg-[#C1660B] text-[#FFFBF4]" : "bg-[#C1660B]/15 text-[#C1660B]",
                    ].join(" ")}
                  >
                    {badge}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <strong className="text-[17px] font-bold">{pickCopy(act.zh, act.en, locale)}</strong>
                    <span className="text-[13.5px] text-[#75614B] dark:text-[#A99A84]">
                      {" "}
                      · {pickCopy(act.subtitleZh, act.subtitleEn, locale)}
                    </span>
                  </span>
                  <span className="text-sm text-[#75614B] dark:text-[#A99A84]" aria-hidden>
                    {expanded ? "▴" : "▾"}
                  </span>
                </button>

                {expanded ? (
                  <div className="space-y-5 px-3.5 pb-4">
                    {act.sections.map((sec) => {
                      const note = PANORAMA_READING_GUIDE[sec.id];
                      return (
                        <div key={sec.id} className="space-y-2.5 border-t border-[#DFD0B8]/70 pt-3.5 dark:border-[#3A3025]">
                          <h3 className="m-0 text-[15.5px] font-bold text-[#C1660B] dark:text-[#FFC845]">
                            {pickCopy(sec.zh, sec.en, locale)}
                          </h3>
                          <p className="m-0 text-[13.5px] leading-relaxed text-[#75614B] dark:text-[#A99A84]">
                            {pickCopy(sec.summaryZh, sec.summaryEn, locale)}
                          </p>
                          {note ? (
                            <div className="space-y-2">
                              {note.links.map((lk) => {
                                const bName = getScriptureBookDisplayName(lk.bookId, locale);
                                return (
                                  <Link
                                    key={`${lk.bookId}:${lk.chapter}:${lk.verses}`}
                                    href={`/read/${encodeURIComponent(lk.bookId)}/${lk.chapter}`}
                                    className="flex items-center gap-2.5 rounded-xl border border-[#C1660B]/25 bg-[#C1660B]/[0.08] px-3 py-2 text-inherit no-underline"
                                  >
                                    <span className="h-7 w-[2.5px] shrink-0 rounded-full bg-[#C1660B]" aria-hidden />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-[13.5px] font-semibold">
                                        {pickCopy(lk.kindZh, lk.kindEn, locale)} · {bName} {lk.chapter}
                                        {lk.verses ? `:${lk.verses}` : ""}
                                      </span>
                                      <span className="mt-0.5 block text-[12px] text-[#75614B] dark:text-[#A99A84]">
                                        {pickCopy(lk.reasonZh, lk.reasonEn, locale)}
                                      </span>
                                    </span>
                                    <span className="text-[#C1660B]" aria-hidden>
                                      ›
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}

                          {/* 每一卷书在写什么：逐卷核心主旨导览卡 */}
                          <div className="space-y-2.5 pt-1">
                            {sec.spans.map((sp: PanoramaSpan) => {
                              const cardKey = `${sec.id}:${sp.bookId}:${sp.first}-${sp.last}`;
                              const cardOpen = expandedCardKey === cardKey;
                              const bName = getScriptureBookDisplayName(sp.bookId, locale);
                              const maxCh = chaptersById.get(sp.bookId) ?? sp.last;
                              const intro = BOOK_INTRODUCTIONS[sp.bookId];
                              const rangeLabel =
                                sp.first === 1 && sp.last === maxCh
                                  ? pickCopy(`共 ${maxCh} 章`, `${maxCh} chs`, locale)
                                  : pickCopy(`第 ${sp.first}–${sp.last} 章`, `Ch. ${sp.first}–${sp.last}`, locale);
                              const isCurrent =
                                lastPos?.bookId === sp.bookId &&
                                currentChapter >= sp.first &&
                                currentChapter <= sp.last;

                              return (
                                <div
                                  key={cardKey}
                                  className={[
                                    "rounded-xl border p-3 transition",
                                    isCurrent
                                      ? "border-[#C1660B] bg-[#C1660B]/10 dark:border-[#FFB101]/70 dark:bg-[#FFB101]/10"
                                      : "border-[#DFD0B8] bg-white/55 dark:border-[#3A3025] dark:bg-[#1E1813]/85",
                                  ].join(" ")}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setExpandedCardKey(cardOpen ? null : cardKey)}
                                    className="w-full border-0 bg-transparent p-0 text-left text-inherit"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate text-[15px] font-bold text-[#231A12] dark:text-[#F4EBE1]">
                                          {bName}
                                        </span>
                                        <span className="shrink-0 rounded-full bg-[#C1660B]/14 px-2 py-0.5 text-[11px] font-semibold text-[#C1660B] dark:bg-[#FFB101]/16 dark:text-[#FFC845]">
                                          {rangeLabel}
                                        </span>
                                      </div>
                                      <span className="shrink-0 text-[12px] font-semibold text-[#C1660B] dark:text-[#FFC845]">
                                        {cardOpen ? pickCopy("收起", "Hide", locale) : pickCopy("选章 ›", "Chapters ›", locale)}
                                      </span>
                                    </div>
                                    {intro ? (
                                      <p className="mt-1.5 mb-0 text-[13.5px] leading-relaxed text-[#4A3828] dark:text-[#D8C8B4]">
                                        {pickCopy(intro.zh, intro.en, locale)}
                                      </p>
                                    ) : null}
                                  </button>

                                  {cardOpen ? (
                                    <div className="mt-3 border-t border-[#DFD0B8]/80 pt-2.5 dark:border-[#3A3025]">
                                      {intro?.references ? (
                                        <p className="mt-0 mb-2 text-[12px] text-[#75614B] dark:text-[#A99A84]">
                                          {pickCopy("核心经文线索：", "Key passages: ", locale)}
                                          {intro.references}
                                        </p>
                                      ) : null}
                                      <div className="grid grid-cols-6 gap-1.5">
                                        {Array.from(
                                          { length: sp.last - sp.first + 1 },
                                          (_, idx) => sp.first + idx,
                                        ).map((ch) => {
                                          const isCurCh = lastPos?.bookId === sp.bookId && currentChapter === ch;
                                          return (
                                            <Link
                                              key={ch}
                                              href={`/read/${encodeURIComponent(sp.bookId)}/${ch}`}
                                              className={[
                                                "flex h-9 items-center justify-center rounded-lg border text-[13.5px] font-semibold no-underline transition",
                                                isCurCh
                                                  ? "border-[#C1660B] bg-[#C1660B] text-white"
                                                  : "border-[#DFD0B8] bg-[#FAF5EC] text-[#231A12] hover:border-[#C1660B] dark:border-[#463A2E] dark:bg-[#2A221B] dark:text-[#F4EBE1]",
                                              ].join(" ")}
                                            >
                                              {ch}
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-2">
                                      <Link
                                        href={`/read/${encodeURIComponent(sp.bookId)}/${sp.first}`}
                                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#C1660B] no-underline hover:underline dark:text-[#FFC845]"
                                      >
                                        <span>
                                          {sp.first === 1
                                            ? pickCopy("读第 1 章 →", "Read Ch. 1 →", locale)
                                            : pickCopy(`读第 ${sp.first} 章 →`, `Read Ch. ${sp.first} →`, locale)}
                                        </span>
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[12px] leading-relaxed text-[#8B7760] dark:text-[#8E806D]">
        {pickCopy(
          "六幕为灵修导览脉络，帮助你在救赎历史中读懂每一卷书在写什么。",
          "The six acts serve as a devotional story guide introducing what every book of Scripture is about.",
          locale,
        )}
      </p>

      {/* 66 卷速查弹层 */}
      {finderOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
          onClick={() => setFinderOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[420px] flex-col rounded-2xl border border-[#D8C6AA] bg-[#FAF5EC] p-4 text-[#231A12] shadow-xl dark:border-[#3E3328] dark:bg-[#221C16] dark:text-[#F4EBE1]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="m-0 text-[18px] font-bold">
                {pickCopy("66 卷书都在写什么", "66 Books Overview", locale)}
              </h3>
              <button
                type="button"
                onClick={() => setFinderOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-lg text-[#75614B] dark:text-[#B9A896]"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <input
              type="search"
              value={finderQuery}
              onChange={(e) => setFinderQuery(e.target.value)}
              placeholder={pickCopy("搜书名或主题关键词…", "Search book or theme…", locale)}
              className="mb-3 h-10 w-full rounded-xl border border-[#D8C6AA] bg-white/80 px-3 text-[14px] text-[#231A12] outline-none placeholder:text-[#8B7760] dark:border-[#463A2E] dark:bg-[#2C241D] dark:text-[#F4EBE1] dark:placeholder:text-[#9C8B78]"
            />
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredBooks.map((b) => {
                const intro = BOOK_INTRODUCTIONS[b.bookId];
                const bName = getScriptureBookDisplayName(b.bookId, locale);
                return (
                  <Link
                    key={b.bookId}
                    href={`/read/${encodeURIComponent(b.bookId)}/1`}
                    onClick={() => setFinderOpen(false)}
                    className="block rounded-xl border border-[#DFD0B8] bg-white/65 p-3 text-inherit no-underline transition hover:border-[#C1660B] dark:border-[#3A3025] dark:bg-[#2A221B]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14.5px] font-bold">
                        {String(b.bookNumber).padStart(2, "0")} · {bName}
                      </span>
                      <span className="text-[12px] font-semibold text-[#C1660B] dark:text-[#FFC845]">
                        {pickCopy("进入阅读 ›", "Read ›", locale)}
                      </span>
                    </div>
                    {intro ? (
                      <p className="mt-1 mb-0 text-[13px] leading-relaxed text-[#5C4632] dark:text-[#D8C8B4]">
                        {pickCopy(intro.zh, intro.en, locale)}
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
