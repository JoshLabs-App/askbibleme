"use client";

import { useEffect, useState } from "react";
import { HOME_VERSE_STABLE_SEC_OPTIONS } from "@/lib/home-prayer-pools/constants";
import { HOME_PRAYER_PREFS_UPDATED_EVENT, readHomePrayerVersePrefs, writeHomePrayerVersePrefs } from "@/lib/home-prayer-pools/prefs";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

function formatSecLabel(locale: string, sec: number): string {
  return `${sec}s`;
}

type Props = {
  variant?: "drawer" | "settings";
  onPrefsChanged?: () => void;
};

export function HomeVerseHoldTimeMenuPicker({ variant = "drawer", onPrefsChanged }: Props = {}) {
  const { locale } = useLocale();
  const [stableSec, setStableSec] = useState(() => readHomePrayerVersePrefs().homeVerseStableSec);
  const zh = locale === "zh-CN" || locale === "zh-TW";
  const settings = variant === "settings";

  useEffect(() => {
    const sync = () => setStableSec(readHomePrayerVersePrefs().homeVerseStableSec);
    window.addEventListener(HOME_PRAYER_PREFS_UPDATED_EVENT, sync);
    sync();
    return () => window.removeEventListener(HOME_PRAYER_PREFS_UPDATED_EVENT, sync);
  }, []);

  const title = locale === "en" ? "Hold time" : locale === "zh-TW" ? toZhTwText("停留时间") : "停留时间";
  const hint = locale === "en" ? "Default 7s" : locale === "zh-TW" ? toZhTwText("默认 7 秒") : "默认 7 秒";

  return (
    <div className={settings ? "w-full" : "space-y-2"}>
      {settings ? null : (
      <div className="space-y-1">
        <p className="shell-nav-drawer-section-label">{title}</p>
        <p className="px-0.5 text-[11px] leading-5 text-[#37352f]/55">{hint}</p>
      </div>
      )}
      <div
        className={
          settings
            ? "nature-home-settings-segment flex w-full rounded-[9px] border p-[3px]"
            : "flex flex-wrap gap-2"
        }
        role={settings ? "radiogroup" : undefined}
        aria-label={title}
      >
        {HOME_VERSE_STABLE_SEC_OPTIONS.map((sec) => {
          const selected = stableSec === sec;
          return (
            <button
              key={sec}
              type="button"
              aria-pressed={selected}
              aria-label={`${title} ${formatSecLabel(locale, sec)}`}
              role={settings ? "radio" : undefined}
              aria-checked={settings ? selected : undefined}
              className={
                settings
                  ? [
                      "flex min-h-[36px] flex-1 items-center justify-center rounded-[7px] border border-transparent px-0 text-[18px] font-semibold leading-[22px] tabular-nums text-[#1c1410] transition active:scale-[0.97]",
                      selected ? "nature-home-rotation-choice--active" : "",
                    ].join(" ")
                  : [
                      "min-h-8 min-w-[3.25rem] rounded-full border px-3 py-1.5 text-[12px] font-medium transition active:scale-[0.97]",
                      selected
                        ? "border-amber-500/55 bg-amber-200/35 text-amber-950 shadow-[0_0_0_1px_rgba(255,183,77,0.15)]"
                        : "border-amber-900/12 bg-white/55 text-[#37352f]/75 hover:bg-white/80",
                    ].join(" ")
              }
              onClick={() => {
                const next = { ...readHomePrayerVersePrefs(), homeVerseStableSec: sec };
                writeHomePrayerVersePrefs(next);
                setStableSec(sec);
                onPrefsChanged?.();
              }}
            >
              {settings ? formatSecLabel(locale, sec) : zh ? `${sec} 秒` : `${sec}s`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
