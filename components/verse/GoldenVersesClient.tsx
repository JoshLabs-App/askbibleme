"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { useGoldenVersesChromeless } from "@/components/verse/GoldenVersesChromelessContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useGoldenVerseTextScale } from "@/hooks/useGoldenVerseTextScale";
import type { GoldenVerseFontFamilyV1, GoldenVerseTextEffectV1 } from "@/lib/home-prayer-pools/types";
import { HOME_PRAYER_PREFS_UPDATED_EVENT, readHomePrayerVersePrefs } from "@/lib/home-prayer-pools/prefs";

type Props = {
  /**
   * `shellFullBleed`：与首页 `NatureVideoExperience` 主视频槽一致——无左右页边距，经文区由父级绝对定位。
   */
  layout?: "default" | "shellFullBleed";
};

/** 与 `MusicHomeClient` 中经文区同版心、同最小高度（浅色 + `prominence="nature"`） */
const GOLDEN_VERSE_ROTATOR_CLASS =
  "w-full min-h-[12rem] sm:min-h-[14rem] landscape:min-h-0 [@media(max-height:500px)_and_(orientation:portrait)]:min-h-[8rem] [@media(max-height:500px)_and_(orientation:portrait)]:sm:min-h-[8.5rem]";

export function GoldenVersesClient({ layout = "default" }: Props) {
  const { t } = useLocale();
  const { zoom: verseTextZoom } = useGoldenVerseTextScale();
  const { landscapeNarrow, toggleManualChromeless } = useGoldenVersesChromeless();
  const [goldenVerseFontFamily, setGoldenVerseFontFamily] = useState<GoldenVerseFontFamilyV1>("sans");
  const [goldenVerseTextEffect, setGoldenVerseTextEffect] = useState<GoldenVerseTextEffectV1>("insetCarved");

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

  const verseZoomStyle = {
    zoom: verseTextZoom,
    maxWidth: `min(96vw, ${96 / verseTextZoom}vw)`,
  } satisfies CSSProperties;

  const inner = (
    <div className="mx-auto min-w-0 overflow-x-clip" style={verseZoomStyle}>
      <HomeVerseRotator
        variant="light"
        prominence="nature"
        verseStyle="goldenVerses"
        goldenVerseFontFamily={goldenVerseFontFamily}
        goldenVerseTextEffect={goldenVerseTextEffect}
        className={GOLDEN_VERSE_ROTATOR_CLASS}
      />
    </div>
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
    </div>
  );
}
