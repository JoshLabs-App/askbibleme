"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { NatureVerseTextScaleDockProps } from "@/components/home/HomePrayerVerseDockSettings";
import { normalizeGoldenVerseFontFamily } from "@/lib/home-prayer-pools/prefs";
import type { GoldenVerseFontFamilyV1 } from "@/lib/home-prayer-pools/types";
import {
  NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT,
  readNatureHomeVerseAppearance,
  writeNatureHomeVerseAppearance,
  type NatureHomeVerseTextEffectV1,
  normalizeNatureHomeVerseTextEffect,
} from "@/lib/home/nature-home-verse-appearance-prefs";

type Props = {
  natureVerseTextScale?: NatureVerseTextScaleDockProps;
};

function IconTextScaleSmaller(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7.5 15.5 12 6l4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.4 12h5.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M8 18.25h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTextScaleLarger(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7.5 15.5 12 6l4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.4 12h5.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M12 17v4M10 19h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const rowLabel = "shrink-0 text-[12px] leading-snug text-white/78";
const selectClass =
  "min-h-[40px] min-w-0 max-w-[58%] flex-1 cursor-pointer appearance-none truncate border-0 bg-transparent py-1.5 pr-5 text-right text-[13px] font-normal leading-snug text-white/95 outline-none ring-0 focus:ring-0";

/**
 * 自然首页 Aa 浮层：极简列表，与右上「暗衣柔焦」浮层同气质；无说明段落。
 */
export function NatureHomeVerseAppearancePanel({ natureVerseTextScale }: Props) {
  const { t } = useLocale();
  const [fontFamily, setFontFamily] = useState<GoldenVerseFontFamilyV1>(() =>
    readNatureHomeVerseAppearance().fontFamily,
  );
  const [textEffect, setTextEffect] = useState<NatureHomeVerseTextEffectV1>(() =>
    readNatureHomeVerseAppearance().textEffect,
  );

  const persist = useCallback((next: { fontFamily: GoldenVerseFontFamilyV1; textEffect: NatureHomeVerseTextEffectV1 }) => {
    const font = normalizeGoldenVerseFontFamily(next.fontFamily);
    let effect = normalizeNatureHomeVerseTextEffect(next.textEffect);
    if (font === "serif" && effect === "classic") {
      effect = "flat";
    }
    writeNatureHomeVerseAppearance({ version: 1, fontFamily: font, textEffect: effect });
    setFontFamily(font);
    setTextEffect(effect);
  }, []);

  useEffect(() => {
    const sync = () => {
      const a = readNatureHomeVerseAppearance();
      setFontFamily(a.fontFamily);
      setTextEffect(a.textEffect);
    };
    window.addEventListener(NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT, sync);
  }, []);

  return (
    <div className="w-full">
      <div className="divide-y divide-white/10 overflow-hidden rounded-xl bg-white/[0.05]">
        <label className="flex min-h-[40px] items-center justify-between gap-2 px-2.5 py-1">
          <span className={rowLabel}>{t("pages.goldenVerses.fontRowLabel")}</span>
          <select
            className={selectClass}
            value={fontFamily}
            onChange={(e) => {
              const nextFont = normalizeGoldenVerseFontFamily(e.target.value);
              if (nextFont === "serif" && textEffect === "classic") {
                persist({ fontFamily: nextFont, textEffect: "flat" });
              } else {
                persist({ fontFamily: nextFont, textEffect });
              }
            }}
          >
            <option value="sans">{t("pages.goldenVerses.fontSans")}</option>
            <option value="serif">{t("pages.goldenVerses.fontSerif")}</option>
          </select>
        </label>
        <label className="flex min-h-[40px] items-center justify-between gap-2 px-2.5 py-1">
          <span className={rowLabel}>{t("pages.goldenVerses.effectRowLabel")}</span>
          <select
            className={selectClass}
            value={textEffect}
            onChange={(e) => {
              const v = e.target.value as NatureHomeVerseTextEffectV1;
              if (v === "classic") {
                persist({ fontFamily: "sans", textEffect: "classic" });
                return;
              }
              persist({ fontFamily, textEffect: normalizeNatureHomeVerseTextEffect(v) });
            }}
          >
            <option value="classic">{t("nature.homeVerse.effectClassicHome")}</option>
            <option value="engraved">{t("pages.goldenVerses.effectEngraved")}</option>
            <option value="insetCarved">{t("pages.goldenVerses.effectInsetCarved")}</option>
            <option value="flat">{t("pages.goldenVerses.effectFlat")}</option>
            <option value="letterpress">{t("pages.goldenVerses.effectLetterpress")}</option>
            <option value="softBloom">{t("pages.goldenVerses.effectSoftBloom")}</option>
          </select>
        </label>
        {natureVerseTextScale ? (
          <div className="flex items-center justify-center gap-1.5 px-2 py-1.5">
            <button
              type="button"
              disabled={natureVerseTextScale.atMin}
              aria-label={t("nature.textScaleSmallerAria")}
              className="inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/90 transition hover:bg-white/10 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
              onClick={natureVerseTextScale.onSmaller}
            >
              <IconTextScaleSmaller className="h-[1.15rem] w-[1.15rem] opacity-90" />
            </button>
            <button
              type="button"
              disabled={natureVerseTextScale.atMax}
              aria-label={t("nature.textScaleLargerAria")}
              className="inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/90 transition hover:bg-white/10 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
              onClick={natureVerseTextScale.onLarger}
            >
              <IconTextScaleLarger className="h-[1.15rem] w-[1.15rem] opacity-90" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
