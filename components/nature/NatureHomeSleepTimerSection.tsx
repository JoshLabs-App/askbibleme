"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback, type MusicShellSleepTimerMinutes } from "@/components/music/MusicShellPlaybackContext";

const SLEEP_OPTIONS: MusicShellSleepTimerMinutes[] = [15, 30, 60, 120];

function sleepLabelKey(m: MusicShellSleepTimerMinutes): string {
  if (m === 15) return "nature.homeSettings.sleepM15";
  if (m === 30) return "nature.homeSettings.sleepM30";
  if (m === 60) return "nature.homeSettings.sleepM60";
  return "nature.homeSettings.sleepM120";
}

/** 对齐 App `HomeSleepTimerSection`：15 / 30 / 60 / 120 分段 */
export function NatureHomeSleepTimerSection() {
  const { t } = useLocale();
  const { sleepTimerMinutes, setSleepTimerMinutes } = useMusicShellPlayback();

  return (
    <div
      className="inline-flex rounded-lg bg-zinc-800 p-[3px]"
      role="radiogroup"
      aria-label={t("nature.homeSettings.sleepSection")}
    >
      {SLEEP_OPTIONS.map((minutes) => {
        const selected = sleepTimerMinutes === minutes;
        return (
          <button
            key={minutes}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${t(sleepLabelKey(minutes))} min`}
            onClick={() => setSleepTimerMinutes(selected ? 0 : minutes)}
            className={[
              "flex h-[34px] w-[2.25rem] shrink-0 items-center justify-center rounded-md border-0 px-0 text-[11px] font-semibold tabular-nums transition",
              selected ? "bg-zinc-600 text-white" : "bg-transparent text-white/50 hover:text-white/70",
            ].join(" ")}
          >
            {t(sleepLabelKey(minutes))}
          </button>
        );
      })}
    </div>
  );
}
