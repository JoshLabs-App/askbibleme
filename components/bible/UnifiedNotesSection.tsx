"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import {
  VerseShareCardModal,
  type VerseShareCardPayload,
} from "@/components/bible/VerseShareCardModal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { listScriptureVerseBookmarks } from "@/lib/bible/scripture-verse-bookmarks";
import {
  getScriptureVerseBookmarkStoreServerSnapshot,
  getScriptureVerseBookmarkStoreSnapshot,
  subscribeScriptureVerseBookmarks,
  toggleScriptureVerseBookmark,
} from "@/lib/bible/scripture-verse-bookmarks-client";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import {
  DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR,
  normalizeVerseTextHighlightColor,
  readVerseTextHighlightStore,
  writeVerseTextHighlightIndices,
} from "@/lib/read/read-verse-text-highlights";

type UnifiedEntry = {
  id: string;
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  pigmentHex: string;
  isBookmarked: boolean;
  highlightPairs: [number, string][];
};

function pickCopy(zh: string, en: string, locale: string): string {
  if (locale === "en") return en;
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}

function dominantPigment(pairs: [number, string][]): string | null {
  if (!pairs.length) return null;
  const counts = new Map<string, number>();
  for (const [, raw] of pairs) {
    const hex = normalizeVerseTextHighlightColor(raw);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [hex, cnt] of counts) {
    if (cnt > bestCount) {
      best = hex;
      bestCount = cnt;
    }
  }
  return best;
}

/**
 * 书房与收藏页共用的「摘录与印记」模块（对齐 iOS / Android UnifiedNotesBlock）：
 * 合并经文收藏与四色划重点，提供古籍四色颜料筛选胶囊、书签图分享与 3.4 秒「撤销」防误删胶囊。
 */
export function UnifiedNotesSection({ limit }: { limit?: number }) {
  const { locale } = useLocale();
  const { translationCatalog } = useReadBibleTranslationSettings();
  const bookmarkStore = useSyncExternalStore(
    subscribeScriptureVerseBookmarks,
    getScriptureVerseBookmarkStoreSnapshot,
    getScriptureVerseBookmarkStoreServerSnapshot,
  );
  const [hlTick, setHlTick] = useState(0);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<VerseShareCardPayload | null>(null);
  const [undoState, setUndoState] = useState<{ msg: string; restore: () => void } | null>(null);

  useEffect(() => {
    setHlTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!undoState) return;
    const t = window.setTimeout(() => setUndoState(null), 3400);
    return () => window.clearTimeout(t);
  }, [undoState]);

  const translationLabel = useCallback(
    (tid: string) => {
      const meta = translationCatalog.find((tr) => tr.id === tid);
      if (!meta) return tid;
      if (locale === "en") return meta.labelEn;
      return locale === "zh-TW" ? toZhTwText(meta.labelZh) : meta.labelZh;
    },
    [locale, translationCatalog],
  );

  const entries = useMemo((): UnifiedEntry[] => {
    void hlTick;
    const bmList = listScriptureVerseBookmarks(bookmarkStore);
    const hlStore = readVerseTextHighlightStore();
    const map = new Map<string, UnifiedEntry>();

    for (const bm of bmList) {
      const key = `${bm.translationId}:${bm.bookId}:${bm.chapter}:${bm.verse}`;
      const hlRows = hlStore[key] ?? [];
      const pairs: [number, string][] = hlRows.map((r) => [r.i, r.c]);
      const dom = dominantPigment(pairs) ?? DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR;
      map.set(key, {
        id: key,
        translationId: bm.translationId,
        bookId: bm.bookId,
        bookName: bm.bookName,
        chapter: bm.chapter,
        verse: bm.verse,
        text: bm.text,
        pigmentHex: dom,
        isBookmarked: true,
        highlightPairs: pairs,
      });
    }

    for (const [key, hlRows] of Object.entries(hlStore)) {
      if (!hlRows.length || map.has(key)) continue;
      const parts = key.split(":");
      if (parts.length !== 4) continue;
      const [tid, bidRaw, chRaw, vsRaw] = parts;
      const ch = Number(chRaw);
      const vs = Number(vsRaw);
      if (!tid || !bidRaw || !Number.isInteger(ch) || !Number.isInteger(vs)) continue;
      const bid = bidRaw.toUpperCase();
      const pairs: [number, string][] = hlRows.map((r) => [r.i, r.c]);
      const dom = dominantPigment(pairs) ?? DEFAULT_VERSE_TEXT_HIGHLIGHT_COLOR;
      map.set(key, {
        id: key,
        translationId: tid,
        bookId: bid,
        bookName: getScriptureBookDisplayName(bid, locale as AppLocale),
        chapter: ch,
        verse: vs,
        text: "",
        pigmentHex: dom,
        isBookmarked: false,
        highlightPairs: pairs,
      });
    }

    return Array.from(map.values());
  }, [bookmarkStore, hlTick, locale]);

  const filtered = useMemo(
    () =>
      selectedHex == null
        ? entries
        : entries.filter((e) => e.pigmentHex.toUpperCase() === selectedHex.toUpperCase()),
    [entries, selectedHex],
  );
  const displayed = limit != null ? filtered.slice(0, limit) : filtered;

  const filters: { hex: string | null; label: string }[] = [
    { hex: null, label: pickCopy("全部", "All", locale) },
    { hex: "#FFB103", label: pickCopy("灯油黄", "Amber", locale) },
    { hex: "#A3B565", label: pickCopy("橄榄绿", "Olive", locale) },
    { hex: "#4E86A0", label: pickCopy("青石蓝", "Slate", locale) },
    { hex: "#C0625F", label: pickCopy("石榴红", "Garnet", locale) },
  ];

  return (
    <section className="space-y-3 text-[#231A12] dark:text-[#EDE2CF]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-[18px] font-bold">
          {pickCopy("摘录与印记", "Notes & Highlights", locale)}
        </h2>
        {limit != null && entries.length > limit ? (
          <Link
            href="/read/favorites"
            className="text-[13px] font-semibold text-[#C1660B] no-underline"
          >
            {pickCopy(`全部 (${entries.length}) ›`, `All (${entries.length}) ›`, locale)}
          </Link>
        ) : null}
      </div>

      {/* 四色古籍颜料筛选胶囊 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filters.map((f) => {
          const active = selectedHex === f.hex;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => setSelectedHex(f.hex)}
              className={[
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition",
                active
                  ? "border-[#231A12] bg-[#231A12] text-[#FAF5EC] dark:border-[#EDE2CF] dark:bg-[#EDE2CF] dark:text-[#1C1712]"
                  : "border-[#DFD0B8] bg-[#FAF5EC]/85 text-[#231A12] dark:border-[#3E3328] dark:bg-[#262019] dark:text-[#EDE2CF]",
              ].join(" ")}
            >
              {f.hex ? (
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.hex }} aria-hidden />
              ) : null}
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {displayed.length === 0 ? (
        <p className="m-0 py-1.5 text-[13.5px] leading-relaxed text-[#75614B] dark:text-[#A99A84]">
          {pickCopy(
            "阅读时双击经文收藏，或长按经文点选四色颜料，都会安静收在这里。",
            "Double-tap a verse to save, or long-press to highlight in four antique pigments.",
            locale,
          )}
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2.5 p-0">
          {displayed.map((entry) => {
            const bookDisplay = getScriptureBookDisplayName(entry.bookId, locale as AppLocale) || entry.bookName;
            const trLabel = translationLabel(entry.translationId);
            return (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-2xl border border-[#DFD0B8] bg-[#FAF5EC]/92 p-3.5 dark:border-[#3E3328] dark:bg-[#262019]/92"
              >
                <span
                  className="mt-1 h-10 w-[3px] shrink-0 rounded-full"
                  style={{ backgroundColor: entry.pigmentHex }}
                  aria-hidden
                />
                <Link
                  href={`/read/${encodeURIComponent(entry.bookId)}/${entry.chapter}?verse=${entry.verse}`}
                  className="min-w-0 flex-1 text-inherit no-underline"
                >
                  <span className="block text-[12.5px] font-semibold text-[#75614B] dark:text-[#A99A84]">
                    {bookDisplay} {entry.chapter}:{entry.verse} · {trLabel}
                  </span>
                  {entry.text ? (
                    <span className="mt-1 line-clamp-3 block text-[15px] leading-relaxed">
                      {entry.text}
                    </span>
                  ) : null}
                </Link>
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  {entry.text ? (
                    <button
                      type="button"
                      aria-label={pickCopy("生成书签图", "Share card", locale)}
                      onClick={() =>
                        setSharePayload({
                          reference: `${bookDisplay} ${entry.chapter}:${entry.verse}`,
                          translationName: trLabel,
                          text: entry.text,
                        })
                      }
                      className="border-0 bg-transparent px-1.5 py-1 text-[12px] text-[#75614B] hover:text-[#231A12] dark:text-[#A99A84]"
                    >
                      {pickCopy("书签图", "Card", locale)}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={pickCopy("移除", "Remove", locale)}
                    onClick={() => {
                      const savedBm = entry.isBookmarked;
                      const savedPairs = entry.highlightPairs;
                      const bmRef = {
                        bookId: entry.bookId,
                        bookName: entry.bookName,
                        chapter: entry.chapter,
                        verse: entry.verse,
                        translationId: entry.translationId,
                        text: entry.text,
                      };
                      if (savedBm) void toggleScriptureVerseBookmark(bmRef);
                      if (savedPairs.length) {
                        writeVerseTextHighlightIndices(
                          {
                            translationId: entry.translationId,
                            bookId: entry.bookId,
                            chapter: entry.chapter,
                            verse: entry.verse,
                          },
                          [],
                        );
                        setHlTick((n) => n + 1);
                      }
                      setUndoState({
                        msg: pickCopy("已移除该条摘录", "Removed note", locale),
                        restore: () => {
                          if (savedBm) void toggleScriptureVerseBookmark(bmRef);
                          if (savedPairs.length) {
                            writeVerseTextHighlightIndices(
                              {
                                translationId: entry.translationId,
                                bookId: entry.bookId,
                                chapter: entry.chapter,
                                verse: entry.verse,
                              },
                              savedPairs,
                            );
                            setHlTick((n) => n + 1);
                          }
                        },
                      });
                    }}
                    className="border-0 bg-transparent px-1.5 py-0.5 text-[14px] text-[#9A8670] hover:text-[#A63D33]"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {undoState ? (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="inline-flex items-center gap-4 rounded-full bg-[#231B14]/95 px-4 py-2.5 text-[13.5px] text-[#F5EFE4] shadow-lg">
            <span>{undoState.msg}</span>
            <button
              type="button"
              onClick={() => {
                undoState.restore();
                setUndoState(null);
              }}
              className="border-0 bg-transparent font-bold text-[#FFC94D]"
            >
              {pickCopy("撤销", "Undo", locale)}
            </button>
          </div>
        </div>
      ) : null}

      <VerseShareCardModal payload={sharePayload} onClose={() => setSharePayload(null)} />
    </section>
  );
}
