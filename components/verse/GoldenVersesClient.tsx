"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { useHomePrayerVerseFeed } from "@/components/home/useHomePrayerVerseFeed";
import { useGoldenVersesChromeless } from "@/components/verse/GoldenVersesChromelessContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import type { GoldenVerseFontFamilyV1, GoldenVerseTextEffectV1 } from "@/lib/home-prayer-pools/types";
import { HOME_PRAYER_PREFS_UPDATED_EVENT, readHomePrayerVersePrefs } from "@/lib/home-prayer-pools/prefs";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";

type Props = {
  fallbackByLocale: Record<AppLocale, HomeVerseEntry[]>;
  /**
   * `shellFullBleed`：与首页 `NatureVideoExperience` 主视频槽一致——无左右页边距，经文区由父级绝对定位。
   */
  layout?: "default" | "shellFullBleed";
};

/** 与 `MusicHomeClient` 中经文区同版心、同最小高度（浅色 + `prominence="nature"`） */
const GOLDEN_VERSE_ROTATOR_CLASS =
  "w-full min-h-[12rem] sm:min-h-[14rem] landscape:min-h-0 [@media(max-height:500px)_and_(orientation:portrait)]:min-h-[8rem] [@media(max-height:500px)_and_(orientation:portrait)]:sm:min-h-[8.5rem]";

function IconChevron(props: { dir: "left" | "right"; className?: string }) {
  const d = props.dir === "left" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6";
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PREV_NEXT_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center border-0 bg-transparent text-ink/72 transition hover:text-ink/92 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25";

/** 视口高度约 70% 处水平居中；`-translate-y-1/2` 使整行垂直居中于该线 */
const PREV_NEXT_ROW =
  "pointer-events-auto fixed inset-x-0 z-[25] flex justify-center gap-10 opacity-50 top-[70dvh] -translate-y-1/2";

export function GoldenVersesClient({ fallbackByLocale, layout = "default" }: Props) {
  const { t, locale } = useLocale();
  const { landscapeNarrow, toggleManualChromeless } = useGoldenVersesChromeless();
  const feed = useHomePrayerVerseFeed({ fallbackByLocale });
  const [goldenVerseFontFamily, setGoldenVerseFontFamily] = useState<GoldenVerseFontFamilyV1>("sans");
  const [goldenVerseTextEffect, setGoldenVerseTextEffect] = useState<GoldenVerseTextEffectV1>("engraved");

  useEffect(() => {
    const sync = () => {
      const p = readHomePrayerVersePrefs();
      setGoldenVerseFontFamily(p.goldenVerseFontFamily);
      setGoldenVerseTextEffect(p.goldenVerseTextEffect);
    };
    sync();
    window.addEventListener(HOME_PRAYER_PREFS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(HOME_PRAYER_PREFS_UPDATED_EVENT, sync);
  }, []);
  const primaryLocale: AppLocale = feed.bilingual ? "en" : locale;
  const primaryList = feed.entriesByLocale[primaryLocale] ?? [];
  const n = primaryList.length;

  const [idx, setIdx] = useState(0);
  const verseKeysSig = feed.verseKeys?.join("\0") ?? "";

  useEffect(() => {
    setIdx(0);
  }, [verseKeysSig, feed.bilingual, primaryLocale]);

  useEffect(() => {
    if (n <= 0) {
      setIdx(0);
      return;
    }
    setIdx((i) => Math.min(Math.max(0, i), n - 1));
  }, [n]);

  const goNext = useCallback(() => {
    if (n <= 0) return;
    const nextIdx = (idx + 1) % n;
    if (feed.verseKeys && feed.onVerseCommitted) {
      const k = feed.verseKeys[idx];
      if (k) feed.onVerseCommitted(k);
    }
    setIdx(nextIdx);
  }, [n, idx, feed.verseKeys, feed.onVerseCommitted]);

  const goPrev = useCallback(() => {
    if (n <= 0) return;
    setIdx((i) => (i - 1 + n) % n);
  }, [n]);

  const prevNextBar =
    n > 1 ? (
      <div className={PREV_NEXT_ROW}>
        <button type="button" onClick={goPrev} aria-label={t("pages.goldenVerses.prev")} className={PREV_NEXT_BTN}>
          <IconChevron dir="left" className="h-[22px] w-[22px]" />
        </button>
        <button type="button" onClick={goNext} aria-label={t("pages.goldenVerses.next")} className={PREV_NEXT_BTN}>
          <IconChevron dir="right" className="h-[22px] w-[22px]" />
        </button>
      </div>
    ) : null;

  const inner = (
    <>
      {n === 0 ? (
        <p className="max-w-prose text-[15px] leading-relaxed text-muted">{t("pages.goldenVerses.empty")}</p>
      ) : (
        <HomeVerseRotator
          entriesByLocale={feed.entriesByLocale}
          bilingual={feed.bilingual}
          verseKeys={feed.verseKeys}
          onVerseCommitted={feed.onVerseCommitted}
          onNearEnd={feed.onNearEnd}
          variant="light"
          prominence="nature"
          verseStyle="goldenVerses"
          goldenVerseFontFamily={goldenVerseFontFamily}
          goldenVerseTextEffect={goldenVerseTextEffect}
          className={GOLDEN_VERSE_ROTATOR_CLASS}
          paused
          verseIndex={idx}
        />
      )}
    </>
  );

  const portraitVerseTapProps =
    landscapeNarrow === false
      ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-label": t("pages.goldenVerses.tapVerseToggleChromeless"),
          onClick: () => toggleManualChromeless(),
          onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleManualChromeless();
            }
          },
        }
      : {};

  const verseTapShellClass =
    landscapeNarrow === false
      ? "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      : "";

  if (layout === "shellFullBleed") {
    return (
      <>
        <div
          className={`w-full max-w-lg text-center sm:max-w-xl landscape:max-w-[80vw] ${verseTapShellClass}`.trim()}
          {...portraitVerseTapProps}
        >
          {inner}
        </div>
        {prevNextBar}
      </>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[36rem] flex-1 flex-col px-5 pb-24 pt-2 text-ink [-webkit-overflow-scrolling:touch] sm:max-w-[40rem] landscape:max-w-[80vw] md:px-8">
        <div
          className={`flex min-h-0 flex-1 flex-col items-center justify-center text-center ${verseTapShellClass}`.trim()}
          {...portraitVerseTapProps}
        >
          {inner}
        </div>
      </div>
      {prevNextBar}
    </div>
  );
}
