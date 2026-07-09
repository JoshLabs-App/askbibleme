"use client";

import { useEffect, useState } from "react";
import { HOME_VERSE_STABLE_SEC_OPTIONS } from "@/lib/home-prayer-pools/constants";
import { HOME_PRAYER_PREFS_UPDATED_EVENT, readHomePrayerVersePrefs, writeHomePrayerVersePrefs } from "@/lib/home-prayer-pools/prefs";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

function formatSecLabel(locale: string, sec: number): string {
  if (locale === "en") return `${sec}s`;
  return `${sec}秒`;
}

export function HomeVerseHoldTimeMenuPicker() {
  const { locale } = useLocale();
  const [stableSec, setStableSec] = useState(() => readHomePrayerVersePrefs().homeVerseStableSec);
  const zh = locale === "zh-CN" || locale === "zh-TW";

  useEffect(() => {
    const sync = () => setStableSec(readHomePrayerVersePrefs().homeVerseStableSec);
    window.addEventListener(HOME_PRAYER_PREFS_UPDATED_EVENT, sync);
    sync();
    return () => window.removeEventListener(HOME_PRAYER_PREFS_UPDATED_EVENT, sync);
  }, []);

  const title = locale === "en" ? "Hold time" : locale === "zh-TW" ? toZhTwText("停留时间") : "停留时间";
  const hint = locale === "en" ? "Default 7s" : locale === "zh-TW" ? toZhTwText("默认 7 秒") : "默认 7 秒";

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="shell-nav-drawer-section-label">{title}</p>
        <p className="px-0.5 text-[11px] leading-5 text-[#37352f]/55">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {HOME_VERSE_STABLE_SEC_OPTIONS.map((sec) => {
          const selected = stableSec === sec;
          return (
            <button
              key={sec}
              type="button"
              aria-pressed={selected}
              aria-label={`${title} ${formatSecLabel(locale, sec)}`}
              className={[
                "min-h-8 min-w-[3.25rem] rounded-full border px-3 py-1.5 text-[12px] font-medium transition active:scale-[0.97]",
                selected
                  ? "border-amber-500/55 bg-amber-200/35 text-amber-950 shadow-[0_0_0_1px_rgba(255,183,77,0.15)]"
                  : "border-amber-900/12 bg-white/55 text-[#37352f]/75 hover:bg-white/80",
              ].join(" ")}
              onClick={() => {
                const next = { ...readHomePrayerVersePrefs(), homeVerseStableSec: sec };
                writeHomePrayerVersePrefs(next);
                setStableSec(sec);
              }}
            >
              {zh ? `${sec} 秒` : `${sec}s`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
