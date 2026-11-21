"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
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

const ACT_NUMERALS_ZH = ["壹", "贰", "叁", "肆", "伍", "陆"];
const chaptersById = new Map(scriptureBooks.map((b) => [b.bookId, b.chapters]));

function pickCopy(zh: string, en: string, locale: string): string {
  if (locale === "en") return en;
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}

function ActLineArt({ actIndex }: { actIndex: number }) {
  return (
    <svg width="62" height="66" viewBox="0 0 64 68" fill="none" stroke="#C1660B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
 * 网页端「救赎全景」灵修画卷（对齐 iOS BiblePanoramaView / Android BiblePanoramaScreen）：
 * 置顶「✦ 你正在这一幕」沉浸定位卡 + 纵向金线六幕时间轴 + 书签式经文脉络导读卡 + 选章弹层。
 */
export function BiblePanoramaClient() {
  const { locale } = useLocale();
  const [lastPos, setLastPos] = useState<ReadLastPosition | null>(null);
  const [activeAct, setActiveAct] = useState<number>(0);
  const [pickerSpan, setPickerSpan] = useState<PanoramaSpan | null>(null);

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

  return (
    <div className="mx-auto w-full max-w-[460px] px-5 pb-28 pt-5 text-[#231A12] dark:text-[#EDE2CF]">
      <header className="mb-5">
        <h1 className="m-0 text-[28px] font-bold tracking-tight">
          {pickCopy("救赎全景", "Redemption Story", locale)}
        </h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[#75614B] dark:text-[#A99A84]">
          {pickCopy(
            "在完整的救赎故事中安静灵修，看见今天所读经文的位置",
            "Dwell in the whole story of redemption and see where today's reading belongs",
            locale,
          )}
        </p>
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
                  `继续灵修 · ${currentBookName} 第 ${currentChapter} 章`,
                  `Continue · ${currentBookName} ${currentChapter}`,
                  locale,
                )
              : pickCopy("从起初进入灵修 · 创世记 第 1 章", "Begin from Genesis 1", locale)}
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
                  <div className="space-y-4 px-3.5 pb-4">
                    {act.sections.map((sec) => {
                      const note = PANORAMA_READING_GUIDE[sec.id];
                      return (
                        <div key={sec.id} className="space-y-2.5 border-t border-[#DFD0B8]/70 pt-3 dark:border-[#3A3025]">
                          <h3 className="m-0 text-[15.5px] font-bold">{pickCopy(sec.zh, sec.en, locale)}</h3>
                          <p className="m-0 text-[13.5px] leading-relaxed text-[#75614B] dark:text-[#A99A84]">
                            {pickCopy(sec.summaryZh, sec.summaryEn, locale)}
                          </p>
                          {note ? (
                            <>
                              <p className="m-0 text-[13px] leading-relaxed opacity-90">
                                {pickCopy(note.zh, note.en, locale)}
                              </p>
                              {note.links.map((lk) => {
                                const bName = getScriptureBookDisplayName(lk.bookId, locale);
                                return (
                                  <Link
                                    key={`${lk.bookId}:${lk.chapter}:${lk.verses}`}
                                    href={`/read/${encodeURIComponent(lk.bookId)}/${lk.chapter}`}
                                    className="flex items-center gap-2.5 rounded-xl border border-[#C1660B]/25 bg-[#C1660B]/[0.08] px-3 py-2.5 text-inherit no-underline"
                                  >
                                    <span className="h-8 w-[2.5px] shrink-0 rounded-full bg-[#C1660B]" aria-hidden />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-[13.5px] font-semibold">
                                        {pickCopy(lk.kindZh, lk.kindEn, locale)} · {bName} {lk.chapter}
                                        {lk.verses ? `:${lk.verses}` : ""}
                                      </span>
                                      <span className="mt-0.5 block text-[12.5px] text-[#75614B] dark:text-[#A99A84]">
                                        {pickCopy(lk.reasonZh, lk.reasonEn, locale)}
                                      </span>
                                    </span>
                                    <span className="text-[#C1660B]" aria-hidden>
                                      ›
                                    </span>
                                  </Link>
                                );
                              })}
                            </>
                          ) : null}

                          <div className="space-y-1.5 pt-0.5">
                            {sec.spans.map((sp) => {
                              const bName = getScriptureBookDisplayName(sp.bookId, locale);
                              const maxCh = chaptersById.get(sp.bookId) ?? sp.last;
                              const rangeLabel =
                                sp.first === 1 && sp.last === maxCh
                                  ? pickCopy(`${maxCh} 章`, `${maxCh} ch`, locale)
                                  : pickCopy(`${sp.first}–${sp.last} 章`, `Ch ${sp.first}–${sp.last}`, locale);
                              const isCurrent =
                                lastPos?.bookId === sp.bookId &&
                                currentChapter >= sp.first &&
                                currentChapter <= sp.last;
                              if (sp.first === sp.last) {
                                return (
                                  <Link
                                    key={`${sec.id}:${sp.bookId}:${sp.first}`}
                                    href={`/read/${encodeURIComponent(sp.bookId)}/${sp.first}`}
                                    className={[
                                      "flex items-center justify-between rounded-xl border px-3 py-2.5 text-[14px] no-underline",
                                      isCurrent
                                        ? "border-[#C1660B] bg-[#C1660B]/12 font-semibold"
                                        : "border-[#DFD0B8] bg-white/40 dark:border-[#3A3025] dark:bg-black/15",
                                    ].join(" ")}
                                  >
                                    <span className="font-semibold text-[#231A12] dark:text-[#EDE2CF]">{bName}</span>
                                    <span className="text-[12px] text-[#75614B] dark:text-[#A99A84]">{rangeLabel} ›</span>
                                  </Link>
                                );
                              }
                              return (
                                <button
                                  key={`${sec.id}:${sp.bookId}:${sp.first}`}
                                  type="button"
                                  onClick={() => setPickerSpan(sp)}
                                  className={[
                                    "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[14px]",
                                    isCurrent
                                      ? "border-[#C1660B] bg-[#C1660B]/12"
                                      : "border-[#DFD0B8] bg-white/40 dark:border-[#3A3025] dark:bg-black/15",
                                  ].join(" ")}
                                >
                                  <span className="font-semibold text-[#231A12] dark:text-[#EDE2CF]">{bName}</span>
                                  <span className="text-[12px] text-[#75614B] dark:text-[#A99A84]">{rangeLabel} ›</span>
                                </button>
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
          "六幕为灵修导览脉络，帮助你在救赎历史中安放每一章经文；诗歌、智慧与先知书按历史处境与主题相联。",
          "The six acts serve as a devotional story guide, helping place each chapter within redemptive history.",
          locale,
        )}
      </p>

      {/* 选章弹层 */}
      {pickerSpan ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setPickerSpan(null)}
        >
          <div
            className="max-h-[72vh] w-full max-w-[380px] overflow-y-auto rounded-2xl border border-[#D8C6AA] bg-[#FAF5EC] p-5 dark:border-[#3E3328] dark:bg-[#241E18]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="m-0 text-[18px] font-bold">
                {getScriptureBookDisplayName(pickerSpan.bookId, locale)}
              </h3>
              <button
                type="button"
                onClick={() => setPickerSpan(null)}
                className="border-0 bg-transparent text-lg text-[#75614B]"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from(
                { length: pickerSpan.last - pickerSpan.first + 1 },
                (_, idx) => pickerSpan.first + idx,
              ).map((ch) => (
                <Link
                  key={ch}
                  href={`/read/${encodeURIComponent(pickerSpan.bookId)}/${ch}`}
                  onClick={() => setPickerSpan(null)}
                  className="flex h-10 items-center justify-center rounded-lg border border-[#DFD0B8] bg-white/60 text-[14.5px] font-medium text-[#231A12] no-underline hover:border-[#C1660B] dark:border-[#3A3025] dark:bg-black/25 dark:text-[#EDE2CF]"
                >
                  {ch}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
