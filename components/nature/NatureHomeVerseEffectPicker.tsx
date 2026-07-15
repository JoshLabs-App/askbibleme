"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { NATURE_HOME_VERSE_TEXT_EFFECTS } from "@/lib/home/nature-home-verse-effects";
import type { NatureHomeVerseTextEffectV1 } from "@/lib/home/nature-home-verse-appearance-prefs";
import { natureHomeVerseVideoTextShadow } from "@/lib/home/nature-home-verse-video-style";

type Props = {
  selected: NatureHomeVerseTextEffectV1;
  onSelect: (effect: NatureHomeVerseTextEffectV1) => void;
};

function labelForEffect(effect: NatureHomeVerseTextEffectV1, t: (key: string) => string): string {
  switch (effect) {
    case "classic":
      return t("nature.homeVerse.effectClassicHome");
    case "bold":
      return t("nature.homeVerse.effectBoldHome");
    case "barStrip":
      return t("nature.homeVerse.effectBarStripHome");
    case "insetCarved":
      return t("pages.goldenVerses.effectInsetCarved");
    default:
      return effect;
  }
}

/** 对齐 App `NatureHomeVerseEffectPicker` */
export function NatureHomeVerseEffectPicker({ selected, onSelect }: Props) {
  const { t } = useLocale();

  return (
    <div className="flex w-full" role="radiogroup" aria-label={t("nature.homeSettings.verseEffectSection")}>
      <div className="nature-home-settings-segment flex w-full rounded-[9px] border p-[3px]">
      {NATURE_HOME_VERSE_TEXT_EFFECTS.map((effect) => {
        const isOn = selected === effect;
        const textShadow = natureHomeVerseVideoTextShadow(effect, "body");
        return (
          <button
            key={effect}
            type="button"
            role="radio"
            aria-checked={isOn}
            aria-label={labelForEffect(effect, t)}
            onClick={() => onSelect(effect)}
            className={[
              "flex min-h-[36px] flex-1 items-center justify-center rounded-[7px] border border-transparent transition",
              isOn ? "nature-home-verse-effect-choice--active" : "bg-transparent",
            ].join(" ")}
          >
            <span
              className="nature-home-verse-effect-choice-label font-sans text-[17px] font-bold leading-none text-[#1c1410]"
              style={textShadow ? { textShadow } : undefined}
              aria-hidden
            >
              Aa
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
